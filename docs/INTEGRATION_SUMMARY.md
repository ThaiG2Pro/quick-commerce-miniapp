# TÓM TẮT PHÂN TÍCH QUICK COMMERCE MINIAPP

## 📊 TỔNG QUAN DỰ ÁN

**Tech Stack:**
- Framework: React 18 + Vite
- UI Library: Zalo Mini App UI (zmp-ui)
- State Management: Jotai (atoms-based)
- Styling: Tailwind CSS
- Router: React Router v7
- Platform: Zalo Mini App

## ✅ CẬP NHẬT TRIỂN KHAI MỚI NHẤT (Cart + Pricing)

- Product pricing đã được harden ở SDK layer:
  - Tự lấy/cached `region_id` mặc định khi gọi product list/search.
  - Tự đảm bảo query có `*variants.calculated_price` để tránh giá `0` khi thiếu pricing context.
- Cart đã đồng bộ server-side với Medusa:
  - CRUD line item qua Store API.
  - Persist `cartId` qua local storage.
  - Đồng bộ lại cart khi app khởi động.
- Cart totals hiện dùng **server totals**:
  - `subtotal`, `discount_total`, `shipping_total`, `tax_total`, `total`, `currency_code`.
- UI theo scope hiện tại:
  - Ở màn Cart: chỉ hiển thị `Tạm tính` + `Tổng dự kiến`.
  - Ở khu Checkout tạm thời (component `Pay` trong `/cart`): hiển thị đầy đủ breakdown từ server.
  - Có tax-inclusive note: `Đã bao gồm ... VAT` khi có thuế trong tổng.
- Error/loading/retry đã được bổ sung cho cart:
  - Loading khi init cart.
  - Banner lỗi có nút `Thử tải lại giỏ hàng`.
  - Guard trạng thái pending khi mutation/cart checkout đang chạy.

---

## 🎯 CÁC ĐIỂM QUAN TRỌNG ĐÃ PHÂN TÍCH

### 1. ✅ Cài đặt Medusa SDK
```bash
pnpm add @medusajs/js-sdk
```

**Files đã tạo:**
- `/src/lib/medusa-sdk.ts` - SDK wrapper với 20+ helper functions
- `/.env.example` - Template cho environment variables
- `/docs/MEDUSA_INTEGRATION.md` - Hướng dẫn chi tiết

**Cách sử dụng:**
```typescript
import { sdk, getProducts, getCategories } from "@/lib/medusa-sdk";

// Trong component hoặc atom
const products = await getProducts({ limit: 20 });
```

---

### 2. 📍 VỊ TRÍ MOCK DATA CẦN THAY THẾ

| Mock File | State Atom | Component | Độ ưu tiên |
|-----------|------------|-----------|------------|
| `mock/products.json` | `productsState` | Home, Catalog, Search | 🔴 Cao |
| `mock/categories.json` | `categoriesState` | Home, Catalog | 🔴 Cao |
| `mock/orders.json` | `ordersState` | Orders page | 🟡 Trung bình |
| `mock/banners.json` | `bannersState` | Home | 🟢 Thấp |
| `mock/stations.json` | `stationsState` | Cart (Pickup) | 🟡 Trung bình |

**Cách lấy dữ liệu:**

#### Option 1: Direct replacement (Đơn giản)
```typescript
// src/state.ts
export const productsState = atom(() => getProducts());
```

#### Option 2: Transform layer (Khuyến nghị) ✅
```typescript
export const productsState = atom(async () => {
  const medusaProducts = await getProducts();
  return medusaProducts.map(p => ({
    id: p.id,
    name: p.title,
    price: p.variants[0]?.calculated_price,
    image: p.thumbnail,
    // ... transform to match app schema
  }));
});
```

#### Option 3: Gradual migration (An toàn)
```typescript
export const productsState = atom(async () => {
  const useMedusa = import.meta.env.VITE_USE_MEDUSA === "true";
  return useMedusa 
    ? await getProducts() 
    : await requestWithFallback("/products", []);
});
```

---

### 3. 🔄 CÁC LUỒNG NGHIỆP VỤ PHỨC TẠP

#### A. 🛒 Cart Management (QUAN TRỌNG NHẤT)

**Vấn đề hiện tại:**
- Cart chỉ lưu local (Jotai atom)
- Mất data khi refresh (nếu không persist)
- Không sync với server

**Giải pháp Medusa:**

```typescript
// 1. Lưu Cart ID
export const cartIdState = atomWithStorage<string | null>(
  "medusa_cart_id", 
  null
);

// 2. Sync cart state với server
export const cartState = atom(async (get) => {
  const cartId = get(cartIdState);
  if (!cartId) return [];
  
  const medusaCart = await getCart(cartId);
  return transformMedusaCart(medusaCart);
});

// 3. Update hook để sync
export function useAddToCart(product: Product) {
  const [cartId, setCartId] = useAtom(cartIdState);
  
  const addToCart = async (quantity: number) => {
    // Create cart nếu chưa có
    if (!cartId) {
      const cart = await createCart();
      setCartId(cart.id);
    }
    
    // Add item to server
    await addToCart(cartId, product.variant_id, quantity);
  };
}
```

**Flow diagram:**
```
User Action → Check Cart Exists → Create/Get Cart → Add Line Item → Update State
                    ↓                    ↓              ↓
              localStorage        POST /carts    POST /line-items
```

---

#### B. 💳 Checkout Flow (7 BƯỚC)

```
1. Validate Cart
   ↓
2. Add Shipping Address
   ↓
3. Add Email/Phone
   ↓
4. Select Shipping Method
   ↓
5. Create Payment Session
   ↓
6. Complete Cart → Order
   ↓
7. Payment (Zalo Pay)
```

**Code implementation:**
```typescript
export function useCheckout() {
  return async () => {
    // Step 1: Add shipping address
    await addShippingAddress(cartId, addressData);
    
    // Step 2: Get shipping options
    const cart = await getCart(cartId);
    
    // Step 3: Select shipping method
    await addShippingMethod(cartId, cart.shipping_options[0].id);
    
    // Step 4: Complete cart
    const order = await completeCart(cartId);
    
    // Step 5: Process payment
    await processPayment(order);
  };
}
```

---

#### C. 🔐 Authentication (Zalo ↔ Medusa)

**Challenge:** Sync Zalo user với Medusa customer

```
Zalo SDK → Get User Info → Send to Backend → Create Medusa Customer
    ↓                           ↓                      ↓
getUserInfo()          POST /auth/zalo         Medusa Customer
getPhoneNumber()            ↓                         ↓
                     Return credentials         Login to Medusa
                            ↓                         ↓
                     Store session/JWT         SDK authenticated
```

**Implementation:**
```typescript
export async function authenticateWithMedusa() {
  // 1. Get Zalo info
  const { userInfo } = await getUserInfo();
  const { token: phoneToken } = await getPhoneNumber();
  
  // 2. Backend verify & create customer
  const response = await fetch("/api/auth/zalo", {
    method: "POST",
    body: JSON.stringify({ 
      zaloUserId: userInfo.id, 
      phoneToken 
    }),
  });
  
  const { email, password } = await response.json();
  
  // 3. Login to Medusa
  await loginCustomer(email, password);
}
```

---

#### D. 🔍 Real-time Search

**Phức tạp:**
- Debouncing
- Server-side filtering
- Performance optimization

```typescript
// State
export const keywordState = atom("");
export const searchResultState = atom(async (get) => {
  const keyword = get(keywordState);
  if (keyword.length < 2) return [];
  
  return await searchProducts(keyword, { limit: 20 });
});

// Component với debounce
const [keyword, setKeyword] = useState("");
const debouncedKeyword = useDebounce(keyword, 300);

useEffect(() => {
  if (debouncedKeyword) {
    // Trigger search
  }
}, [debouncedKeyword]);
```

---

#### E. 📦 Order Tracking

**3 phương pháp:**

1. **Polling** (Đơn giản)
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    refreshOrder();
  }, 30000); // Every 30s
  return () => clearInterval(interval);
}, []);
```

2. **Webhooks** (Khuyến nghị)
```typescript
// Backend webhook → Zalo notification → App refetch
```

3. **WebSocket** (Real-time)
```typescript
const ws = new WebSocket(`ws://backend/orders/${id}`);
ws.onmessage = (event) => updateOrderState(event.data);
```

---

## 🏗️ KIẾN TRÚC STATE MANAGEMENT

```
┌─────────────────────────────────────────┐
│         Jotai Atoms (State)             │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   Sync       │  │   Async      │   │
│  │   Atoms      │  │   Atoms      │   │
│  │              │  │              │   │
│  │ • cartState  │  │ • products   │   │
│  │ • keyword    │  │ • categories │   │
│  │ • tabIndex   │  │ • userInfo   │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │  Persisted   │  │  Computed    │   │
│  │   Atoms      │  │   Atoms      │   │
│  │              │  │              │   │
│  │ • shipping   │  │ • cartTotal  │   │
│  │ • delivery   │  │ • search     │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
│  ┌────────────────────────────────┐   │
│  │      Atom Families             │   │
│  │                                │   │
│  │  • productState(id)            │   │
│  │  • ordersState(status)         │   │
│  │  • productsByCategory(id)      │   │
│  └────────────────────────────────┘   │
└─────────────────────────────────────────┘
           ↓                    ↑
    useAtomValue()       useSetAtom()
           ↓                    ↑
┌─────────────────────────────────────────┐
│          React Components               │
└─────────────────────────────────────────┘
```

---

## 📋 MIGRATION CHECKLIST

### ✅ Phase 1: Setup (DONE)
- [x] Cài đặt `@medusajs/js-sdk`
- [x] Tạo SDK wrapper (`src/lib/medusa-sdk.ts`)
- [x] Setup environment variables
- [x] Tạo documentation

### 🔲 Phase 2: Products & Categories (NEXT)
- [ ] Test connection với Medusa backend
- [ ] Migrate `productsState`
- [ ] Migrate `categoriesState`
- [ ] Update TypeScript types
- [ ] Test product listing/detail/search

### 🔲 Phase 3: Cart (CRITICAL)
- [ ] Implement `cartIdState` với localStorage
- [ ] Refactor `useAddToCart` hook
- [ ] Sync cart với Medusa server
- [ ] Test cart operations

### 🔲 Phase 4: Checkout
- [ ] Implement multi-step checkout
- [ ] Integrate shipping methods
- [ ] Setup payment gateway
- [ ] Test end-to-end checkout

### 🔲 Phase 5: Orders & Auth
- [ ] Migrate orders state
- [ ] Implement Zalo ↔ Medusa auth
- [ ] Test order history

### 🔲 Phase 6: Polish
- [ ] Error handling
- [ ] Loading states
- [ ] Offline support
- [ ] Performance optimization

---

## 🎓 KEY LEARNINGS

### 1. Jotai Patterns hiện tại
```typescript
// Basic atom
const countState = atom(0);

// Async atom (auto loading)
const dataState = atom(async () => fetchData());

// Derived atom (computed)
const doubleState = atom((get) => get(countState) * 2);

// Persisted atom
const userState = atomWithStorage("user", null);

// Refreshable atom
const todoState = atomWithRefresh(async () => fetchTodos());

// Atom family (dynamic atoms)
const todoState = atomFamily((id) => atom(async () => fetchTodo(id)));
```

### 2. Request Flow hiện tại
```typescript
// utils/request.ts
request() → fetch mock JSON hoặc real API
  ↓
requestWithFallback() → try/catch với fallback
  ↓
atom state → lưu data
  ↓
useAtomValue() → component sử dụng
```

### 3. Custom Hooks pattern
```typescript
// hooks.ts
export function useAddToCart(product) {
  const [cart, setCart] = useAtom(cartState);
  
  const addToCart = (quantity) => {
    setCart(prev => [...prev, { product, quantity }]);
  };
  
  return { addToCart, cartQuantity };
}
```

---

## ⚠️ NHỮNG ĐIỀU CẦN LƯU Ý

### 1. Cart ID Management
- **CRITICAL:** Luôn lưu cart ID vào localStorage
- Clear cart ID sau khi checkout thành công
- Handle expired cart (timeout)

### 2. Type Safety
- Medusa schema khác với mock data structure
- Cần tạo adapter/transformer functions
- Update TypeScript interfaces

### 3. Error Handling
```typescript
try {
  const data = await getProducts();
} catch (error) {
  // Fallback to mock data hoặc empty array
  console.error(error);
  return [];
}
```

### 4. Performance
- Pagination cho large datasets
- Caching với Jotai
- Debouncing cho search
- Lazy loading images

### 5. Testing
- Test từng step của checkout flow
- Test cart persistence
- Test error scenarios

---

## 🚀 QUICK START

```bash
# 1. Copy env file
cp .env.example .env

# 2. Update với Medusa credentials
# VITE_MEDUSA_BACKEND_URL=https://your-medusa-backend.com
# VITE_MEDUSA_PUBLISHABLE_KEY=pk_xxx

# 3. Import SDK trong code
import { sdk, getProducts } from "@/lib/medusa-sdk";

# 4. Test connection
const products = await getProducts();
console.log(products);

# 5. Bắt đầu migrate atoms trong src/state.ts
```

---

## 📞 SUPPORT

- **Documentation:** `/docs/MEDUSA_INTEGRATION.md`
- **SDK Wrapper:** `/src/lib/medusa-sdk.ts`
- **Medusa Docs:** https://docs.medusajs.com
- **Jotai Docs:** https://jotai.org

---

**Tạo bởi:** GitHub Copilot CLI  
**Ngày:** 2026-04-08  
**Version:** 1.0
