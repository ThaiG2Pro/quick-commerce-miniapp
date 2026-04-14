# Server Fix Guide for Guest-first Flow

## Mục tiêu
Giữ flow client chạy theo kiểu guest-first:
- khách vào app vẫn xem được catalog/branches/storefront profile;
- chỉ khi thao tác thật sự cần customer context thì mới bắt login;
- không để promotion/cart/customer-order chặn sớm bằng lỗi mơ hồ.

## Hiện trạng cần sửa trên server

### 1) Public routes phải thật sự public
Các route sau không nên yêu cầu customer auth:
- `GET /store/regions`
- `GET /store/product-categories`
- `GET /store/products`
- `GET /store/storefront-profile`
- `GET /store/branches`

Nếu route fail, response vẫn phải có CORS headers đầy đủ để browser đọc được lỗi thật.

### 2) Customer-scoped routes có thể giữ auth
Các route sau vẫn được phép yêu cầu login:
- `GET /store/customers/me`
- `POST /store/customers/me`
- `GET /store/orders`
- `GET /store/orders/:id`
- checkout submit / payment session / shipping method nếu cần customer context

Nhưng khi thiếu auth, server phải trả:
- `401` hoặc `403`
- body rõ ràng, không lẫn với lỗi hệ thống

### 3) Promotion/cart không được chặn guest một cách cứng
Hiện có lỗi kiểu:
- `Attribute value for "customer_id" is required by promotion campaign budget`

Nếu guest chưa có customer:
- hoặc cho add-to-cart guest đi qua,
- hoặc chỉ áp dụng customer_id ở bước checkout / redeem promotion,
- hoặc trả lỗi nghiệp vụ rõ ràng để client kích hoạt login rồi retry một lần.

Không nên để `POST /store/carts/:id/line-items` fail sớm chỉ vì promotion rule đang cần customer_id.

### 4) Response shape nên ổn định
Client cần các response sau ổn định:
- cart luôn có `id`, `items`, totals, `region`
- orders luôn có `id`, `items`, totals, `status`
- storefront profile luôn có `shopName`, `shopAddress`, `logoUrl`
- branches luôn có `name`, `address`, `location`

### 5) CORS trên error path
Server/gateway cần đảm bảo `Access-Control-Allow-Origin` vẫn xuất hiện trên:
- `400`
- `401`
- `403`
- `404`
- `500`
- `502`

Browser hiện báo CORS khi upstream trả lỗi mà không kèm header này.

## Kết quả mong muốn
1. Guest browse được app không bị ép login.
2. Add-to-cart chỉ login khi server thật sự cần customer context.
3. Orders/profile/customer flows trả lỗi auth rõ ràng.
4. Browser không còn thấy CORS giả trên các lỗi có thể đọc được.
