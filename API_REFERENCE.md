# API REFERENCE

Tài liệu chi tiết tất cả API endpoints được thêm mới cho payment và fulfillment.

---

## Base URL

```
Local: http://localhost:9000
Production: https://your-domain.com
```

---

## Authentication

Hầu hết store endpoints không cần authentication. Admin endpoints cần JWT token trong header:

```
Authorization: Bearer {jwt_token}
```

---

## Contract nhanh cho client fetch tay

### Header rules

| Loại endpoint | Header bắt buộc |
|---|---|
| Store built-in/public (`/store/*`) | `x-publishable-api-key` |
| Store user-scoped (`/store/*` có user data) | `x-publishable-api-key` + `Authorization: Bearer <customer_token>` |
| Custom auth alias (`/auth/zalo`) | `Content-Type: application/json` |
| Admin routes (`/admin/*`) | `Authorization: Bearer <admin_token>` |

### Custom APIs (đang được server maintain)

| Endpoint | Auth | Ghi chú response |
|---|---|---|
| `POST /auth/zalo` | Không cần customer token | Trả `token` + aliases (`accessToken`, `access_token`, `jwt`) + `customer` |
| `GET /store/storefront-profile` | Public | Trả `storefront.shop_name/shop_address/logo_url` |
| `GET /store/branches` | Public | Trả `branches[]` gồm `name/address/location.lat/lng` |
| `GET /store/loyalty-profile` | Optional auth | Có token thì đọc metadata customer; không token trả default profile |
| `GET /store/orders` | Customer token + publishable key | Trả `orders[]` với shape ổn định |
| `GET /store/orders/:id` | Customer token + publishable key | Trả `order` với shape ổn định hoặc 404 |
| `GET /store/orders/:id/fulfillments` | Optional | Trả status tracking |
| `POST /store/orders/:id/cod-capture` | Theo policy hiện tại | Capture COD payment |

### `POST /auth/zalo` contract

**Request**
```json
{
  "accessToken": "<zalo_access_token>"
}
```

**Success Response (200)**
```json
{
  "token": "<medusa_customer_token>",
  "accessToken": "<medusa_customer_token>",
  "access_token": "<medusa_customer_token>",
  "jwt": "<medusa_customer_token>",
  "customer": {
    "id": "cus_...",
    "first_name": "Thai",
    "last_name": "Nguyen",
    "email": "zalo_xxx@miniapp.local",
    "phone": null,
    "metadata": {}
  },
  "profile": {
    "id": "cus_...",
    "email": "zalo_xxx@miniapp.local"
  }
}
```

**Error Response (401 ví dụ)**
```json
{
  "type": "unauthorized",
  "message": "Invalid appsecret_proof provided in the API argument"
}
```

### `GET /store/orders` contract

**Success Response (200)**
```json
{
  "orders": [
    {
      "id": "order_01...",
      "items": [],
      "total": 150000,
      "created_at": "2026-04-14T03:00:00.000Z",
      "payment_status": "captured",
      "fulfillment_status": "delivered"
    }
  ],
  "count": 1
}
```

---

## Store APIs (Public - Customer Facing)

### 1. Capture COD Payment

Capture COD payment sau khi giao hàng thành công.

**Endpoint**: `POST /store/orders/:id/cod-capture`

**Authentication**: Optional (tùy business logic)

**Path Parameters**:
- `id` (string, required): Order ID

**Request Body**:
```json
{
  "payment_id": "pay_01HXXX",
  "amount": 150000,
  "notes": "Đã nhận tiền mặt từ khách hàng"
}
```

**Request Body Fields**:
- `payment_id` (string, required): ID của payment session cần capture
- `amount` (number, optional): Số tiền capture. Mặc định là total amount của order
- `notes` (string, optional): Ghi chú về payment capture

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "order_id": "order_01HXXX",
    "payment_id": "pay_01HXXX",
    "captured_amount": 150000,
    "status": "captured",
    "captured_at": "2024-01-15T10:30:00.000Z",
    "notes": "Đã nhận tiền mặt từ khách hàng"
  }
}
```

**Error Responses**:

400 - Payment ID missing:
```json
{
  "error": "payment_id is required"
}
```

400 - Order not found:
```json
{
  "error": "Order order_01HXXX not found"
}
```

400 - Payment already captured:
```json
{
  "error": "Order order_01HXXX payment already captured"
}
```

400 - Order canceled:
```json
{
  "error": "Order order_01HXXX is canceled"
}
```

400 - No COD payment found:
```json
{
  "error": "No COD payment found for order order_01HXXX"
}
```

**Example**:
```bash
curl -X POST http://localhost:9000/store/orders/order_01HXXX/cod-capture \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "pay_01HXXX",
    "amount": 150000,
    "notes": "Đã nhận tiền mặt"
  }'
```

---

### 2. Get Order Fulfillments

Lấy danh sách fulfillments của order để tracking.

**Endpoint**: `GET /store/orders/:id/fulfillments`

**Authentication**: Optional

**Path Parameters**:
- `id` (string, required): Order ID

**Success Response** (200):
```json
{
  "fulfillments": [
    {
      "id": "ful_01HXXX",
      "tracking_number": "IH1A2B3C4D5E",
      "status": "shipped",
      "estimated_delivery_date": "2024-01-20T00:00:00.000Z",
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-16T14:30:00.000Z",
      "items": [
        {
          "item_id": "item_01HXXX",
          "title": "Product Name",
          "quantity": 2,
          "sku": "PROD-001"
        }
      ],
      "location": "HCM City Hub",
      "notes": "Package picked up by shipper"
    }
  ]
}
```

**Response Fields**:
- `fulfillments` (array): Danh sách fulfillments
  - `id` (string): Fulfillment ID
  - `tracking_number` (string): Mã tracking
  - `status` (string): Trạng thái (pending, processing, shipped, out_for_delivery, delivered, failed, canceled)
  - `estimated_delivery_date` (string, ISO 8601): Ngày giao dự kiến
  - `created_at` (string, ISO 8601): Ngày tạo
  - `updated_at` (string, ISO 8601): Ngày cập nhật
  - `items` (array): Danh sách sản phẩm trong fulfillment
  - `location` (string): Vị trí hiện tại
  - `notes` (string): Ghi chú

**Error Responses**:

400 - Failed to fetch:
```json
{
  "error": "Failed to fetch fulfillments"
}
```

**Example**:
```bash
curl http://localhost:9000/store/orders/order_01HXXX/fulfillments
```

**JavaScript Example**:
```javascript
const response = await fetch(
  `http://localhost:9000/store/orders/${orderId}/fulfillments`
)
const { fulfillments } = await response.json()

fulfillments.forEach(f => {
  console.log(`Tracking: ${f.tracking_number}, Status: ${f.status}`)
})
```

---

### 3. Storefront Support Endpoints

Các endpoint này hỗ trợ client mini app map dữ liệu ổn định.

#### 3.1 Storefront Profile
- **Endpoint**: `GET /store/storefront-profile`
- **Authentication**: Không bắt buộc
- **Response**:
```json
{
  "storefront": {
    "shop_name": "Q-Commerce",
    "shop_address": "123 Example Street",
    "logo_url": "https://cdn.example.com/logo.png"
  }
}
```

#### 3.2 Branches
- **Endpoint**: `GET /store/branches`
- **Authentication**: Không bắt buộc
- **Response**:
```json
{
  "branches": [
    {
      "name": "Chi nhánh trung tâm",
      "address": "123 Nguyen Trai, HCM, VN",
      "location": {
        "lat": 10.7769,
        "lng": 106.7009
      }
    }
  ]
}
```

#### 3.3 Loyalty Profile
- **Endpoint**: `GET /store/loyalty-profile`
- **Authentication**: Tùy chọn (có token customer sẽ trả dữ liệu theo customer metadata)
- **Response**:
```json
{
  "loyalty_profile": {
    "points": 120,
    "expiry_date": "2026-12-31",
    "expiryDate": "2026-12-31",
    "barcode_value": "LOYALTY-123",
    "barcodeValue": "LOYALTY-123"
  }
}
```

---

### 4. Customer Orders (User-scoped)

Các endpoint này yêu cầu token customer hợp lệ (`Authorization: Bearer <customer_token>`).

#### 4.1 List Orders
- **Endpoint**: `GET /store/orders`
- **Response**:
```json
{
  "orders": [
    {
      "id": "order_01HXXX",
      "items": [],
      "total": 150000,
      "created_at": "2024-01-15T10:30:00.000Z",
      "payment_status": "captured",
      "fulfillment_status": "delivered"
    }
  ],
  "count": 1
}
```

#### 4.2 Get Order Detail
- **Endpoint**: `GET /store/orders/:id`
- **Response**:
```json
{
  "order": {
    "id": "order_01HXXX",
    "items": [],
    "total": 150000,
    "created_at": "2024-01-15T10:30:00.000Z",
    "payment_status": "captured",
    "fulfillment_status": "delivered"
  }
}
```

404 sẽ được trả khi order không tồn tại hoặc không thuộc customer hiện tại.

---

## Admin APIs (Protected - Staff/Admin Only)

### 3. Update Fulfillment Status

Update trạng thái fulfillment (Admin/Staff only).

**Endpoint**: `POST /admin/fulfillments/:id/status`

**Authentication**: Required (JWT token)

**Path Parameters**:
- `id` (string, required): Fulfillment ID

**Request Body**:
```json
{
  "order_id": "order_01HXXX",
  "status": "shipped",
  "location": "HCM City Hub",
  "notes": "Package picked up by shipper"
}
```

**Request Body Fields**:
- `order_id` (string, required): Order ID
- `status` (string, required): Trạng thái mới
  - Valid values: `pending`, `processing`, `shipped`, `out_for_delivery`, `delivered`, `failed`, `canceled`
- `location` (string, optional): Vị trí hiện tại của package
- `notes` (string, optional): Ghi chú về update

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "fulfillment": {
      "id": "ful_01HXXX",
      "data": {
        "status": "shipped",
        "status_updated_at": "2024-01-16T14:30:00.000Z",
        "location": "HCM City Hub",
        "notes": "Package picked up by shipper"
      }
    },
    "notification": {
      "notification_sent": true,
      "sent_at": "2024-01-16T14:30:01.000Z"
    },
    "updated_at": "2024-01-16T14:30:00.000Z"
  }
}
```

**Error Responses**:

400 - Missing order_id:
```json
{
  "error": "order_id is required"
}
```

400 - Invalid status:
```json
{
  "error": "Invalid status. Must be one of: pending, processing, shipped, out_for_delivery, delivered, failed, canceled"
}
```

400 - Update failed:
```json
{
  "error": "Failed to update fulfillment status"
}
```

**Example**:
```bash
curl -X POST http://localhost:9000/admin/fulfillments/ful_01HXXX/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {jwt_token}" \
  -d '{
    "order_id": "order_01HXXX",
    "status": "shipped",
    "location": "HCM City Hub",
    "notes": "Package picked up"
  }'
```

**Status Transition Logic**:

Recommended flow:
```
pending → processing → shipped → out_for_delivery → delivered
                    ↘ failed
                    ↘ canceled
```

**When to use each status**:
- `pending`: Order vừa được tạo, chờ xử lý
- `processing`: Staff đang chuẩn bị hàng, đóng gói
- `shipped`: Đã giao hàng cho shipper, có tracking number
- `out_for_delivery`: Shipper đang trên đường giao đến khách
- `delivered`: Đã giao thành công cho khách hàng
- `failed`: Giao hàng thất bại (khách không nhận, địa chỉ sai, etc.)
- `canceled`: Đơn hàng bị hủy

---

## Webhook APIs

### 4. Stripe Webhook

Endpoint nhận webhook events từ Stripe.

**Endpoint**: `POST /webhooks/stripe`

**Authentication**: Stripe signature verification

**Headers**:
- `stripe-signature` (string, required): Stripe webhook signature

**Request Body**: Stripe event object (varies by event type)

Example event:
```json
{
  "id": "evt_xxx",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_xxx",
      "amount": 150000,
      "currency": "vnd",
      "status": "succeeded"
    }
  }
}
```

**Success Response** (200):
```json
{
  "received": true,
  "result": {
    // Processing result
  }
}
```

**Error Responses**:

400 - Missing signature:
```json
{
  "error": "Missing stripe-signature header"
}
```

400 - Processing failed:
```json
{
  "error": "Webhook processing failed"
}
```

**Important Notes**:
- Endpoint PHẢI return 200 để Stripe không retry
- Signature verification được handle tự động bởi workflow
- Supported events:
  - `payment_intent.succeeded`
  - `payment_intent.failed`
  - `checkout.session.completed`
  - `checkout.session.expired`

**Setup Webhook in Stripe Dashboard**:
1. Go to Developers → Webhooks
2. Add endpoint: `https://your-domain.com/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.failed`
4. Copy webhook secret → set to `STRIPE_WEBHOOK_SECRET` env var

**Local Testing with Stripe CLI**:
```bash
stripe listen --forward-to localhost:9000/webhooks/stripe

# Trigger test event
stripe trigger payment_intent.succeeded
```

---

## Standard Medusa Store APIs

Client cũng cần sử dụng các standard Medusa APIs. Dưới đây là tóm tắt các endpoints quan trọng:

### Products

**List Products**: `GET /store/products`
**Get Product**: `GET /store/products/:id`

### Cart

**Create Cart**: `POST /store/carts`
**Get Cart**: `GET /store/carts/:id`
**Update Cart**: `POST /store/carts/:id`
**Add Line Item**: `POST /store/carts/:id/line-items`
**Update Line Item**: `POST /store/carts/:id/line-items/:line_id`
**Delete Line Item**: `DELETE /store/carts/:id/line-items/:line_id`

### Checkout

**List Shipping Options**: `GET /store/carts/:id/shipping-options`
**Add Shipping Method**: `POST /store/carts/:id/shipping-methods`
**Initialize Payment Sessions**: `POST /store/carts/:id/payment-sessions`
**Set Payment Session**: `POST /store/carts/:id/payment-session`
**Complete Cart**: `POST /store/carts/:id/complete`

### Orders

**Get Order**: `GET /store/orders/:id`
**List Orders**: `GET /store/orders` (requires auth)

---

## Error Handling Best Practices

### Standard Error Response Format
```json
{
  "error": "Human readable error message",
  "type": "error_type",
  "code": "ERROR_CODE"
}
```

### Common Error Types
- `not_found`: Resource không tồn tại
- `invalid_data`: Dữ liệu request không hợp lệ
- `unauthorized`: Không có quyền truy cập
- `payment_error`: Lỗi thanh toán
- `fulfillment_error`: Lỗi fulfillment

### Client Error Handling Example
```javascript
try {
  const response = await fetch('/store/orders/order_xxx/cod-capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: 'pay_xxx' })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Request failed')
  }
  
  const data = await response.json()
  return data
} catch (error) {
  console.error('API Error:', error.message)
  // Show user-friendly message
  alert('Không thể xử lý thanh toán. Vui lòng thử lại.')
}
```

---

## Rate Limiting

Hiện tại chưa có rate limiting. Khuyến nghị implement rate limiting cho production:

- Store APIs: 100 requests/minute per IP
- Admin APIs: 1000 requests/minute per user
- Webhook APIs: No rate limiting (trusted sources)

---

## CORS Configuration

Đảm bảo CORS được configure đúng trong `.env`:

```bash
STORE_CORS=http://localhost:3000,https://your-storefront.com
ADMIN_CORS=http://localhost:5173,https://your-admin.com
```

---

## Testing

### Postman Collection

Import collection để test APIs:

```json
{
  "info": {
    "name": "Q-Commerce APIs",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Capture COD Payment",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/store/orders/{{order_id}}/cod-capture",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"payment_id\": \"{{payment_id}}\",\n  \"amount\": 150000\n}"
        }
      }
    },
    {
      "name": "Get Fulfillments",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/store/orders/{{order_id}}/fulfillments"
      }
    },
    {
      "name": "Update Fulfillment Status",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/admin/fulfillments/{{fulfillment_id}}/status",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"order_id\": \"{{order_id}}\",\n  \"status\": \"shipped\",\n  \"location\": \"HCM City\"\n}"
        }
      }
    }
  ]
}
```

### Environment Variables for Postman

```json
{
  "base_url": "http://localhost:9000",
  "order_id": "order_01HXXX",
  "payment_id": "pay_01HXXX",
  "fulfillment_id": "ful_01HXXX",
  "admin_token": "your_jwt_token"
}
```

---

## API Versioning

Hiện tại: v1 (no version prefix)

Trong tương lai nếu có breaking changes, sẽ có:
- v1: `/store/...`, `/admin/...`
- v2: `/v2/store/...`, `/v2/admin/...`

---

## Support

Nếu có vấn đề với APIs:
- Check logs: `docker-compose logs medusa`
- Review documentation: `docs/BACKEND_INTEGRATION.md`
- Contact: tech@company.com
