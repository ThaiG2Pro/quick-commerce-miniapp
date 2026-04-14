# CLIENT INTEGRATION GUIDE

## Tổng Quan

Tài liệu này hướng dẫn Frontend developers tích hợp với Medusa backend đã được setup với payment providers (Stripe, COD, ZaloPay) và fulfillment provider (In-house).

**Lưu ý quan trọng**: Client KHÔNG được tự ý tạo/update orders. Tất cả operations phải tuân theo flow chuẩn của Medusa.

---

### Initialize SDK
```typescript
// src/lib/medusa.ts
import Medusa from "@medusajs/js-sdk"

export const medusa = new Medusa({
  baseUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})
```

### SDK-first policy (khuyến nghị)

- **Built-in Medusa endpoints**: luôn ưu tiên gọi bằng SDK method (`medusa.store.cart.*`, `medusa.store.product.*`, ...).
- **Custom endpoints**: dùng `medusa.client.fetch("/path", ...)`.
- Chỉ fetch tay khi thật sự cần debug; nếu fetch tay phải tự gắn đúng header.

| Nhu cầu client | Built-in SDK call khuyến nghị | Ghi chú |
|---|---|---|
| Create cart | `medusa.store.cart.create({ region_id })` | Cần `region_id` hợp lệ |
| Get/update cart | `medusa.store.cart.retrieve(cartId)` / `medusa.store.cart.update(cartId, body)` | Tránh gọi custom wrapper cũ |
| Line items | `createLineItem`, `updateLineItem`, `deleteLineItem` | Dùng built-in |
| Shipping options | `medusa.store.cart.listShippingOptions(cartId)` | Built-in |
| Payment providers/session | `cart.retrieve(...fields)`, `initializePaymentSession`, `setPaymentSession` | Built-in |
| Complete checkout | `medusa.store.cart.complete(cartId)` | Built-in |
| Customer me | `medusa.store.customer.retrieve()` / update me route | Cần customer token |
| Orders | `medusa.client.fetch("/store/orders")` hoặc built-in order APIs theo SDK version | Repo hiện có custom shape ổn định |

### Nếu buộc phải fetch tay

```ts
const res = await fetch(`${BASE_URL}/store/carts/${cartId}`, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "x-publishable-api-key": PUBLISHABLE_KEY,
    Authorization: `Bearer ${customerToken}`, // chỉ cho user-scoped
  },
})
```

**Thiếu `x-publishable-api-key`** sẽ gây `400` cho nhiều Store APIs.

---

## Luồng Hoàn Chỉnh: Cart → Payment → Fulfillment

### Overview Flow Chart
```
1. Browse Products
   ↓
2. Create Cart
   ↓
3. Add Items to Cart
   ↓
4. Set Shipping Address
   ↓
5. Select Shipping Option
   ↓
6. Select Payment Method (Stripe/COD/ZaloPay)
   ↓
7. Complete Cart → Create Order
   ↓
8a. [Stripe] Redirect to Stripe → Webhook → Order Confirmed
8b. [COD] Order Created → Wait Delivery → Capture Payment
8c. [ZaloPay] Redirect to ZaloPay → Webhook → Order Confirmed
   ↓
9. Track Fulfillment Status
   ↓
10. Delivered → (COD: Capture Payment) → Complete
```

---

## 1. Browse & Search Products

### Get Products List
```typescript
const { products } = await medusa.store.product.list({
  limit: 20,
  offset: 0,
})
```

### Search Products
```typescript
const { products } = await medusa.store.product.list({
  q: "laptop",
  limit: 20,
})
```

### Get Product Details
```typescript
const { product } = await medusa.store.product.retrieve(productId)
```

---

## 2. Cart Management

### 2.1 Create Cart
```typescript
// Tạo cart mới
const { cart } = await medusa.store.cart.create({
  region_id: "reg_xxx", // Required
})

// Lưu cart_id vào localStorage/cookies
localStorage.setItem("cart_id", cart.id)
```

### 2.2 Add Items to Cart
```typescript
const cartId = localStorage.getItem("cart_id")

const { cart } = await medusa.store.cart.createLineItem(cartId, {
  variant_id: "variant_xxx",
  quantity: 1,
})
```

### 2.3 Update Item Quantity
```typescript
const { cart } = await medusa.store.cart.updateLineItem(
  cartId,
  lineItemId,
  {
    quantity: 2,
  }
)
```

### 2.4 Remove Item
```typescript
const { cart } = await medusa.store.cart.deleteLineItem(cartId, lineItemId)
```

### 2.5 Get Current Cart
```typescript
const { cart } = await medusa.store.cart.retrieve(cartId)
```

---

## 3. Checkout Flow

### 3.1 Set Shipping Address
```typescript
const { cart } = await medusa.store.cart.update(cartId, {
  shipping_address: {
    first_name: "John",
    last_name: "Doe",
    address_1: "123 Main St",
    city: "HCM City",
    country_code: "vn",
    postal_code: "70000",
    phone: "+84123456789", // Required for delivery
  },
})
```

### 3.2 Set Email (for guest checkout)
```typescript
const { cart } = await medusa.store.cart.update(cartId, {
  email: "customer@example.com",
})
```

### 3.3 List Available Shipping Options
```typescript
const { shipping_options } = await medusa.store.cart.listShippingOptions(cartId)

// Response:
// [
//   {
//     id: "so_xxx",
//     name: "Standard Delivery",
//     price_incl_tax: 30000,
//     data: { delivery_time: "3-5 days" }
//   },
//   {
//     id: "so_yyy",
//     name: "Express Delivery",
//     price_incl_tax: 50000,
//     data: { delivery_time: "1-2 days" }
//   }
// ]
```

### 3.4 Select Shipping Option
```typescript
const { cart } = await medusa.store.cart.addShippingMethod(cartId, {
  option_id: "so_xxx",
})
```

---

## 4. Payment Flow

### 4.1 Initialize Payment Session

**Quan trọng**: Phải initialize payment sessions TRƯỚC KHI complete cart.

```typescript
// Get available payment providers
const { payment_providers } = await medusa.store.cart.retrieve(cartId, {
  fields: "+payment_providers",
})

// Initialize payment sessions for all providers
const { cart } = await medusa.store.cart.initializePaymentSession(cartId)

// Cart now has payment_session for each provider
console.log(cart.payment_sessions)
// [
//   { provider_id: "stripe", ... },
//   { provider_id: "cod", ... },
//   { provider_id: "zalopay", ... },
// ]
```

### 4.2 Select Payment Provider

User chọn payment method trên UI, client gọi:

```typescript
const { cart } = await medusa.store.cart.setPaymentSession(cartId, {
  provider_id: "stripe", // or "cod" or "zalopay"
})
```

---

## 5. Payment Provider Implementations

### 5.1 Stripe Payment Flow

#### Step 1: Complete Cart
```typescript
const { type, data, order } = await medusa.store.cart.complete(cartId)

// type có thể là "order" hoặc "cart"
if (type === "order") {
  // Order created successfully (for COD)
  console.log("Order created:", order)
} else {
  // Need to handle payment (Stripe/ZaloPay)
  console.log("Payment required:", data)
}
```

#### Step 2: Get Stripe Session
```typescript
// Sau khi complete cart với Stripe
const paymentSession = cart.payment_session

// Stripe session có stripe_session_id
const stripeSessionId = paymentSession.data.stripe_session_id

// Redirect to Stripe Checkout
const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
await stripe.redirectToCheckout({ sessionId: stripeSessionId })
```

#### Step 3: Handle Return from Stripe
```typescript
// URL: /checkout/success?session_id={CHECKOUT_SESSION_ID}

const params = new URLSearchParams(window.location.search)
const sessionId = params.get("session_id")

// Poll order status
const checkOrderStatus = async () => {
  try {
    const { order } = await medusa.store.order.retrieve(orderId)
    
    if (order.payment_status === "captured") {
      // Payment successful!
      router.push(`/order/${order.id}`)
    } else if (order.payment_status === "awaiting") {
      // Still processing, wait and retry
      setTimeout(checkOrderStatus, 2000)
    }
  } catch (error) {
    // Order not found yet, retry
    setTimeout(checkOrderStatus, 2000)
  }
}

checkOrderStatus()
```

#### Alternative: Use Stripe Elements (Advanced)
```typescript
// For more control, use Stripe Elements instead of redirect
import { Elements, CardElement, useStripe } from "@stripe/react-stripe-js"

const CheckoutForm = () => {
  const stripe = useStripe()
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Complete cart first
    const { data } = await medusa.store.cart.complete(cartId)
    
    // Confirm payment with Stripe
    const { error } = await stripe.confirmCardPayment(
      data.client_secret,
      {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      }
    )
    
    if (!error) {
      // Payment successful
      router.push(`/order/${orderId}`)
    }
  }
  
  return <form onSubmit={handleSubmit}>...</form>
}
```

---

### 5.2 COD Payment Flow

COD (Cash on Delivery) đơn giản hơn vì không cần redirect.

#### Step 1: Select COD Payment
```typescript
await medusa.store.cart.setPaymentSession(cartId, {
  provider_id: "cod",
})
```

#### Step 2: Complete Cart
```typescript
const { type, order } = await medusa.store.cart.complete(cartId)

if (type === "order") {
  // Order created successfully!
  console.log("Order ID:", order.id)
  console.log("Payment Status:", order.payment_status) // "authorized" (chưa capture)
  
  // Redirect to order confirmation
  router.push(`/order/${order.id}`)
}
```

#### Step 3: Track Delivery
```typescript
// Customer tracks delivery status
const { fulfillments } = await fetch(
  `${BACKEND_URL}/store/orders/${orderId}/fulfillments`
).then(res => res.json())

console.log(fulfillments)
// [
//   {
//     id: "ful_xxx",
//     tracking_number: "IH123ABC",
//     status: "shipped", // pending, processing, shipped, out_for_delivery, delivered
//     estimated_delivery_date: "2024-01-05T00:00:00Z",
//   }
// ]
```

#### Step 4: Payment Capture (After Delivery)
```typescript
// Admin/Staff captures payment after delivery
// Client không cần gọi API này - chỉ hiển thị status

// Optional: Poll order status to check if payment captured
const { order } = await medusa.store.order.retrieve(orderId)

if (order.payment_status === "captured") {
  // Payment completed!
  console.log("Đã thanh toán thành công")
}
```

---

### 5.3 ZaloPay Payment Flow

Tương tự Stripe, cần redirect.

#### Step 1: Complete Cart
```typescript
const { data } = await medusa.store.cart.complete(cartId)

// Get ZaloPay redirect URL
const zalopayUrl = data.order_url

// Redirect to ZaloPay
window.location.href = zalopayUrl
```

#### Step 2: Handle Callback
```typescript
// User completes payment on ZaloPay and is redirected back
// Webhook sẽ update order status tự động

// Poll order status
const { order } = await medusa.store.order.retrieve(orderId)

if (order.payment_status === "captured") {
  // Payment successful!
}
```

---

## 6. Order Management

### 6.1 Get Order Details
```typescript
const { order } = await medusa.store.order.retrieve(orderId)

console.log(order)
// {
//   id: "order_xxx",
//   status: "pending",
//   payment_status: "captured",
//   fulfillment_status: "fulfilled",
//   total: 150000,
//   items: [...],
//   shipping_address: {...},
//   ...
// }
```

### 6.2 List Customer Orders
```typescript
// Requires authentication
const { orders } = await medusa.store.order.list({
  limit: 10,
  offset: 0,
})
```

---

## 7. Fulfillment Tracking

### 7.1 Get Fulfillment Status
```typescript
const response = await fetch(
  `${BACKEND_URL}/store/orders/${orderId}/fulfillments`
)

const { fulfillments } = await response.json()

console.log(fulfillments[0])
// {
//   id: "ful_xxx",
//   tracking_number: "IH123ABC",
//   status: "out_for_delivery",
//   estimated_delivery_date: "2024-01-05T00:00:00Z",
//   location: "Customer's city",
//   notes: "Out for delivery",
//   items: [...]
// }
```

### 7.2 Display Fulfillment Timeline (UI Example)
```tsx
const FulfillmentTracker = ({ orderId }) => {
  const [fulfillments, setFulfillments] = useState([])
  
  useEffect(() => {
    const fetchFulfillments = async () => {
      const res = await fetch(`/api/orders/${orderId}/fulfillments`)
      const data = await res.json()
      setFulfillments(data.fulfillments)
    }
    
    fetchFulfillments()
    
    // Poll every 30 seconds
    const interval = setInterval(fetchFulfillments, 30000)
    return () => clearInterval(interval)
  }, [orderId])
  
  const getStatusDisplay = (status) => {
    const statusMap = {
      pending: { label: "Đang xử lý", icon: "🕐", color: "gray" },
      processing: { label: "Đang chuẩn bị", icon: "📦", color: "blue" },
      shipped: { label: "Đã giao shipper", icon: "🚚", color: "purple" },
      out_for_delivery: { label: "Đang giao", icon: "🏃", color: "orange" },
      delivered: { label: "Đã giao", icon: "✅", color: "green" },
      failed: { label: "Giao thất bại", icon: "❌", color: "red" },
      canceled: { label: "Đã hủy", icon: "🚫", color: "gray" },
    }
    return statusMap[status] || {}
  }
  
  return (
    <div>
      {fulfillments.map((f) => {
        const status = getStatusDisplay(f.status)
        
        return (
          <div key={f.id}>
            <h3>
              {status.icon} {status.label}
            </h3>
            <p>Tracking: {f.tracking_number}</p>
            <p>Location: {f.location}</p>
            <p>Note: {f.notes}</p>
            <p>ETA: {new Date(f.estimated_delivery_date).toLocaleDateString()}</p>
          </div>
        )
      })}
    </div>
  )
}
```

---

## 8. Authentication (Optional but Recommended)

### 8.1 Customer Registration
```typescript
const { customer } = await medusa.store.customer.create({
  email: "customer@example.com",
  password: "secure_password",
  first_name: "John",
  last_name: "Doe",
  phone: "+84123456789",
})
```

### 8.2 Customer Login
```typescript
const { customer } = await medusa.auth.authenticate("customer", "emailpass", {
  email: "customer@example.com",
  password: "secure_password",
})

// Save token
localStorage.setItem("medusa_token", customer.token)
```

### 8.3 Associate Cart with Customer
```typescript
// After login, associate cart with customer
const { cart } = await medusa.store.cart.update(cartId, {
  customer_id: customer.id,
})
```

### 8.4 Zalo Mini App Login Flow
```typescript
import jwtDecode from "jwt-decode"

type MedusaCustomerTokenPayload = {
  actor_id?: string
}

// 1) Get token from Zalo Mini App SDK
const accessToken = await zmpSdk.getAccessToken()

// 2) Authenticate with Medusa Zalo provider
const { customer } = await medusa.auth.authenticate("customer", "zalo", {
  access_token: accessToken,
})

let token = customer.token
let payload = jwtDecode<MedusaCustomerTokenPayload>(token)

// 3) New user: actor_id is empty -> create customer then refresh token
if (!payload.actor_id) {
  await medusa.store.customer.create({
    email: `zalo_${Date.now()}@miniapp.local`,
    first_name: "Zalo",
    last_name: "User",
  })

  const refreshed = await fetch(`${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL}/auth/token/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).then((res) => res.json())

  token = refreshed.customer.token
  payload = jwtDecode<MedusaCustomerTokenPayload>(token)
}

// 4) Persist token and use it in next requests
localStorage.setItem("medusa_token", token)
```

> Nếu team đang gọi REST trực tiếp thay vì SDK, backend cũng cung cấp alias `POST /auth/zalo` để đi qua cùng luồng Zalo auth hiện tại.

---

## 9. Error Handling

### Best Practices
```typescript
const handleCartOperation = async () => {
  try {
    const { cart } = await medusa.store.cart.createLineItem(cartId, {
      variant_id: variantId,
      quantity: 1,
    })
    
    return { success: true, cart }
  } catch (error) {
    // Medusa errors have specific structure
    if (error.response) {
      const { message, type } = error.response.data
      
      switch (type) {
        case "not_found":
          return { success: false, error: "Cart không tồn tại" }
        case "invalid_data":
          return { success: false, error: "Dữ liệu không hợp lệ" }
        case "insufficient_inventory":
          return { success: false, error: "Sản phẩm hết hàng" }
        default:
          return { success: false, error: message }
      }
    }
    
    return { success: false, error: "Đã xảy ra lỗi" }
  }
}
```

### Common Errors

#### 1. Cart not found
```typescript
// Always check if cart exists
const cartId = localStorage.getItem("cart_id")

if (!cartId) {
  // Create new cart
  const { cart } = await medusa.store.cart.create({ region_id })
  localStorage.setItem("cart_id", cart.id)
}
```

#### 2. Payment session not initialized
```typescript
// Always initialize payment sessions before complete
if (!cart.payment_sessions || cart.payment_sessions.length === 0) {
  await medusa.store.cart.initializePaymentSession(cartId)
}
```

#### 3. Missing required fields
```typescript
// Validate before complete
if (!cart.shipping_address || !cart.email) {
  throw new Error("Vui lòng điền đầy đủ thông tin")
}

if (!cart.shipping_methods || cart.shipping_methods.length === 0) {
  throw new Error("Vui lòng chọn phương thức vận chuyển")
}

if (!cart.payment_session) {
  throw new Error("Vui lòng chọn phương thức thanh toán")
}
```

---

## 10. React/Next.js Integration Examples

### 10.1 Cart Context (React Context API)
```typescript
// src/contexts/CartContext.tsx
import { createContext, useContext, useState, useEffect } from "react"
import { medusa } from "@/lib/medusa"

const CartContext = createContext(null)

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadCart()
  }, [])
  
  const loadCart = async () => {
    try {
      const cartId = localStorage.getItem("cart_id")
      
      if (cartId) {
        const { cart } = await medusa.store.cart.retrieve(cartId)
        setCart(cart)
      }
    } catch (error) {
      // Cart not found, will create new one when needed
      localStorage.removeItem("cart_id")
    } finally {
      setLoading(false)
    }
  }
  
  const createCart = async () => {
    const { cart } = await medusa.store.cart.create({
      region_id: "reg_xxx",
    })
    localStorage.setItem("cart_id", cart.id)
    setCart(cart)
    return cart
  }
  
  const addItem = async (variantId, quantity = 1) => {
    let currentCart = cart
    
    if (!currentCart) {
      currentCart = await createCart()
    }
    
    const { cart: updatedCart } = await medusa.store.cart.createLineItem(
      currentCart.id,
      { variant_id: variantId, quantity }
    )
    
    setCart(updatedCart)
    return updatedCart
  }
  
  return (
    <CartContext.Provider value={{ cart, loading, addItem, loadCart }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
```

### 10.2 Checkout Page Component
```tsx
// src/pages/checkout.tsx
import { useState } from "react"
import { useCart } from "@/contexts/CartContext"
import { useRouter } from "next/router"

export default function CheckoutPage() {
  const { cart } = useCart()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState("stripe")
  
  const handleComplete = async () => {
    setLoading(true)
    
    try {
      // Set payment provider
      await medusa.store.cart.setPaymentSession(cart.id, {
        provider_id: selectedPayment,
      })
      
      // Complete cart
      const { type, data, order } = await medusa.store.cart.complete(cart.id)
      
      if (type === "order") {
        // COD payment - order created
        localStorage.removeItem("cart_id")
        router.push(`/order/${order.id}`)
      } else if (selectedPayment === "stripe") {
        // Stripe - redirect to checkout
        const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
        await stripe.redirectToCheckout({
          sessionId: data.stripe_session_id,
        })
      } else if (selectedPayment === "zalopay") {
        // ZaloPay - redirect
        window.location.href = data.order_url
      }
    } catch (error) {
      alert("Checkout failed: " + error.message)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div>
      <h1>Checkout</h1>
      
      {/* Payment Method Selection */}
      <div>
        <label>
          <input
            type="radio"
            value="stripe"
            checked={selectedPayment === "stripe"}
            onChange={(e) => setSelectedPayment(e.target.value)}
          />
          Thẻ tín dụng (Stripe)
        </label>
        
        <label>
          <input
            type="radio"
            value="cod"
            checked={selectedPayment === "cod"}
            onChange={(e) => setSelectedPayment(e.target.value)}
          />
          Thanh toán khi nhận hàng (COD)
        </label>
        
        <label>
          <input
            type="radio"
            value="zalopay"
            checked={selectedPayment === "zalopay"}
            onChange={(e) => setSelectedPayment(e.target.value)}
          />
          ZaloPay
        </label>
      </div>
      
      {/* Complete Button */}
      <button onClick={handleComplete} disabled={loading}>
        {loading ? "Processing..." : "Hoàn tất đặt hàng"}
      </button>
    </div>
  )
}
```

---

## 11. Testing Checklist

### Local Development
- [ ] Create cart
- [ ] Add/remove items
- [ ] Update quantities
- [ ] Set shipping address
- [ ] Select shipping option
- [ ] Initialize payment sessions
- [ ] Complete checkout with Stripe (test mode)
- [ ] Complete checkout with COD
- [ ] Track fulfillment status
- [ ] Test error scenarios

### Stripe Testing Cards
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0027 6000 3184
```

---

## 12. Performance Optimization

### Caching Cart Data
```typescript
// Use SWR or React Query for caching
import useSWR from "swr"

const useCart = (cartId) => {
  const { data, error, mutate } = useSWR(
    cartId ? `/cart/${cartId}` : null,
    () => medusa.store.cart.retrieve(cartId),
    {
      refreshInterval: 30000, // Refresh every 30s
      revalidateOnFocus: false,
    }
  )
  
  return {
    cart: data?.cart,
    loading: !error && !data,
    error,
    mutate,
  }
}
```

### Optimistic UI Updates
```typescript
const addItem = async (variantId) => {
  // Optimistically update UI
  setCart((prev) => ({
    ...prev,
    items: [...prev.items, { variant_id: variantId, quantity: 1 }],
  }))
  
  try {
    const { cart } = await medusa.store.cart.createLineItem(cartId, {
      variant_id: variantId,
      quantity: 1,
    })
    setCart(cart)
  } catch (error) {
    // Revert on error
    loadCart()
    throw error
  }
}
```

---

## Support & Resources

- **Medusa Documentation**: https://docs.medusajs.com
- **Backend API Reference**: See `API_REFERENCE.md`
- **Example Storefront**: https://github.com/medusajs/nextjs-starter-medusa

For questions or issues, contact: tech@company.com
