# Server Need (for current client flow)

## Mục tiêu
Đảm bảo client checkout hiện tại chạy end-to-end với Medusa backend thật, không fallback/mock ở các bước quan trọng.

## P0 - Bắt buộc để checkout chạy được

### 1) Zalo auth exchange route
- Tạo/duy trì route: `POST /auth/zalo`
- Input:
```json
{ "accessToken": "<zalo_access_token>" }
```
- Server cần:
1. Verify token với Zalo Open API (kèm `appsecret_proof` nếu cần).
2. Tìm hoặc tạo customer tương ứng trong Medusa.
3. Trả về token để storefront set session (`jwt` hoặc `token` hoặc `accessToken`).
4. Trả thêm profile cơ bản nếu có (`user`/`customer`/`profile`).

### 2) Shipping options hợp lệ cho cart/region
- Đảm bảo cart có thể lấy shipping options khả dụng theo region.
- Đảm bảo `addShippingMethod` không fail vì thiếu shipping profile/fulfillment setup.
- Điều kiện pass:
1. Sau khi client gửi shipping address, cart có thể attach shipping method.
2. Không lỗi 400/500 ở bước add shipping method.

### 3) Payment provider cấu hình thật theo region
- Bật ít nhất 1 payment provider đang hoạt động cho region checkout.
- Đảm bảo endpoint listing providers trả danh sách non-empty cho cart region hiện tại.
- Điều kiện pass:
1. Client lấy được providers.
2. `initiate payment session` thành công với `provider_id` được chọn.

### 4) Complete cart phải thành order thành công
- Sau khi đã có contact + shipping address + shipping method + payment session:
1. `complete cart` phải trả kết quả completed/order.
2. Không trả trạng thái dangling/incomplete do thiếu cấu hình backend.

### 5) Sửa lỗi tạo cart 500
- Hiện có dấu hiệu `POST /store/carts` trả `500 unknown_error` trong một số môi trường.
- Cần kiểm tra:
1. Region tồn tại và active.
2. Publishable key mapping đúng sales channel/region.
3. Migration/schema DB đầy đủ.
4. Logs workflow cart creation.

## P1 - Nên có ngay sau P0

### 6) Store profile endpoint cho storefront
- Route khuyến nghị: `GET /store/storefront-profile`
- Trả dữ liệu branding:
```json
{
  "storefront": {
    "shop_name": "...",
    "shop_address": "...",
    "logo_url": "..."
  }
}
```
- Client có fallback `/store/store`, nhưng endpoint riêng giúp ổn định mapping.

### 7) Branches endpoint cho điểm nhận hàng
- Route: `GET /store/branches`
- Trả `branches` (hoặc `stations`/`locations`) có `name`, `address`, `location.lat`, `location.lng`.

### 8) Loyalty profile endpoint
- Route: `GET /store/loyalty-profile`
- Trả `points`, `expiry_date` (hoặc `expiryDate`), `barcode_value` (hoặc `barcodeValue`).

## API contract tối thiểu để khớp client hiện tại

### Checkout data client gửi lên server
1. Contact: email (update cart contact).
2. Shipping address: first_name, last_name, address_1, city, country_code, phone.
3. Shipping method: option_id đã chọn.
4. Payment: provider_id để initiate payment session.
5. Complete: complete cart để tạo order.

## Definition of Done (DoD)
1. Test manual 1 vòng checkout từ app mini:
   - add to cart -> chọn địa chỉ -> chọn shipping -> chọn payment -> thanh toán.
2. Medusa trả order thành công, app điều hướng sang trang orders.
3. Không còn lỗi 500/400 ở các bước cart/shipping/payment/complete với dữ liệu hợp lệ.
4. Auth `/auth/zalo` trả token hợp lệ và session customer dùng được cho `store.customer.retrieve`.

## Gợi ý kiểm thử nhanh (backend)
1. `POST /auth/zalo` với token test.
2. `POST /store/carts` tạo cart với `region_id`.
3. `GET /store/payment-providers?region_id=...`.
4. Attach shipping method cho cart.
5. Initiate payment session cho cart.
6. Complete cart và xác nhận order được tạo.
