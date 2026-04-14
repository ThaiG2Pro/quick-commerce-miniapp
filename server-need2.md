# Server Need v2 (aligned with updated client requests)

## Mục tiêu
Chuẩn hóa contract server cho client theo 2 nhóm request:
1. **User-scoped (bắt buộc auth, không fallback phía client)**
2. **Public/shared (không phụ thuộc user, có thể cho phép fallback tùy môi trường)**

## Auth policy (guest-first + on-demand)
- Client **không pre-auth khi app startup**.
- Mặc định chạy ở guest mode; chỉ login khi cần.
- Trigger login:
  1. **Checkout-sensitive**: thao tác cần gắn customer vào cart/checkout/order.
  2. **User-scoped actions**: profile, order history/detail, loyalty hoặc dữ liệu riêng theo user.

---

## 1) User-scoped APIs (required auth/session)

> Các API này phục vụ dữ liệu thay đổi theo user: profile, cart, checkout, promotion, order.  
> Client đã bỏ fallback mock cho order flows; server cần trả lỗi rõ ràng khi fail.

### 1.1 Auth exchange
- `POST /auth/zalo`
- Body:
```json
{ "accessToken": "<zalo_access_token>" }
```
- Auth flow contract (bắt buộc):
  1. Client gọi `zmp-sdk getAccessToken`.
  2. Client gửi `accessToken` vào `POST /auth/zalo`.
  3. Server verify token với Zalo Open API.
  4. Server create/find Medusa customer tương ứng.
  5. Server trả customer token + profile shape ổn định cho client.
- Response tối thiểu:
```json
{
  "token": "<customer_token>",
  "customer": {
    "id": "cus_...",
    "first_name": "...",
    "last_name": "...",
    "email": "...",
    "phone": "...",
    "metadata": {}
  }
}
```
- Chấp nhận alias token: `jwt` hoặc `accessToken` (để backward-compatible).

### 1.2 Customer profile
- `GET /store/customers/me`
- `POST /store/customers/me`
- Payload update client gửi:
```json
{
  "first_name": "...",
  "last_name": "...",
  "email": "...",
  "phone": "...",
  "metadata": { "address": "..." }
}
```

### 1.3 Cart + checkout
- `POST /store/carts` (tạo cart, cần `region_id` hợp lệ)
- `GET /store/carts/:id`
- `POST /store/carts/:id/line-items`
- `POST /store/carts/:id/line-items/:lineItemId`
- `DELETE /store/carts/:id/line-items/:lineItemId`
- `POST /store/carts/:id` (update contact/shipping address)
- `POST /store/carts/:id/shipping-methods`
- `GET /store/shipping-options?cart_id=:id`
- `POST /store/shipping-options/:id/calculate`
- `GET /store/payment-providers?region_id=:id`
- Initiate payment session endpoint theo Medusa payment flow
- `POST /store/carts/:id/complete`

### 1.4 Promotions
- `POST /store/carts/:id/promotions`
- `DELETE /store/carts/:id/promotions`
- Payload:
```json
{ "promo_codes": ["CODE1"] }
```

### 1.5 Orders
- `GET /store/orders` (list theo customer hiện tại)
- `GET /store/orders/:id` (**bắt buộc** cho màn chi tiết đơn)

---

## 2) Public/shared APIs (non user-scoped)

### 2.1 Catalog/storefront core
- `GET /store/regions`
- `GET /store/product-categories`
- `GET /store/products`
- `GET /store/storefront-profile` (khuyến nghị)
- `GET /store/store` (fallback branding)
- `GET /store/branches`

### 2.2 Optional
- `GET /store/loyalty-profile` (nếu loyalty là dữ liệu user thì chuyển sang user-scoped + auth)

---

## Header/authorization contract

### User-scoped
- Bắt buộc nhận diện customer session/token hợp lệ.
- Trả lỗi phân biệt rõ:
  - `401/403`: guest gọi endpoint cần customer, hoặc thiếu/hết hạn auth.
  - `404`: resource không tồn tại (cart/order).
  - `409`: conflict dữ liệu (line item/cart state).
  - `400`: payload không hợp lệ.

### Public/shared
- Không yêu cầu customer auth.
- Dùng publishable key/public access theo cấu hình Medusa store APIs.
- Guest có thể gọi bình thường; dữ liệu user-scoped (ví dụ order history) có thể rỗng nếu chưa login.

---

## Response shape tối thiểu cần ổn định

1. **Order list/detail**: luôn có `id`, `items`, `total`, `created_at`, `payment_status`, `fulfillment_status`.
2. **Cart retrieve/update**: luôn có `id`, `items`, pricing totals, `region`, `shipping_methods`.
3. **Payment providers**: trả mảng non-empty khi region đã cấu hình đúng.
4. **Shipping options**: trả option hợp lệ để attach shipping method thành công.

---

## DoD
1. Flow checkout chạy end-to-end không fallback mock ở user-scoped:
   - add to cart -> shipping address -> shipping method -> payment -> complete -> order created.
2. Màn orders:
   - `GET /store/orders` hiển thị danh sách.
   - `GET /store/orders/:id` mở chi tiết đơn trực tiếp theo id.
3. Lỗi auth/resource được trả đúng mã để client hiển thị thông báo chính xác.
