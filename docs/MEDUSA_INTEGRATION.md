# Hướng dẫn tích hợp Medusa SDK vào Quick Commerce Zalo Mini App

## 📦 1. Cài đặt và Khởi tạo Medusa SDK

### Cài đặt package
```bash
pnpm add @medusajs/js-sdk
```

### Cấu hình environment variables
Tạo file `.env` trong thư mục gốc của project:
```env
VITE_MEDUSA_BACKEND_URL=http://localhost:9000
VITE_MEDUSA_PUBLISHABLE_KEY=your_publishable_key_here
```

### Sử dụng SDK trong code
```typescript
import { sdk, getProducts, getCategories } from "@/lib/medusa-sdk";

// Hoặc sử dụng trực tiếp
import sdk from "@/lib/medusa-sdk";
```

---

## 🔍 2. Chi tiết triển khai logic nghiệp vụ trong Template

### 2.1. Quản lý State với Jotai
Template sử dụng **Jotai** cho state management với các pattern sau:

#### **Atoms cơ bản** (`atom`)
- Lưu trữ state đơn giản: `cartState`, `keywordState`, `selectedTabIndexState`
- Client-side state, không persist

#### **Async Atoms** (`atom` với Promise)
- Fetch data từ API: `productsState`, `categoriesState`, `userInfoState`
- Tự động handle loading/error states

#### **Persisted Atoms** (`atomWithStorage`)
- Lưu vào localStorage: `shippingAddressState`, `deliveryModeState`
- Survive page refresh

#### **Refreshable Atoms** (`atomWithRefresh`)
- Có thể trigger refresh: `ordersState`
- Dùng để refetch data sau mutations

#### **Derived Atoms** (computed)
- Tính toán từ atoms khác: `cartTotalState`, `searchResultState`
- Tự động re-compute khi dependencies thay đổi

#### **Atom Families** (`atomFamily`)
- Tạo dynamic atoms: `productState(id)`, `ordersState(status)`
- Mỗi parameter tạo một atom riêng biệt

### 2.2. Flow xử lý dữ liệu

```
Mock JSON → requestWithFallback() → Atom State → React Component
     ↓                                    ↓              ↓
 /mock/*.json                      Jotai atoms      useAtomValue()
```

### 2.3. Các hooks tùy chỉnh

| Hook | Mục đích | File |
|------|----------|------|
| `useAddToCart(product)` | Thêm/cập nhật/xóa sản phẩm trong giỏ | `hooks.ts` |
| `useCheckout()` | Xử lý thanh toán và tạo đơn hàng | `hooks.ts` |
| `useRequestInformation()` | Yêu cầu quyền truy cập user info | `hooks.ts` |
| `useCustomerSupport()` | Mở chat với OA support | `hooks.ts` |

---

## 📍 3. Vị trí Data đang được Mock và Cần thay thế

### 3.1. Danh sách Mock Data Files

| File Mock | Atom State | Component sử dụng | Medusa SDK Replacement |
|-----------|------------|-------------------|------------------------|
| **`/mock/products.json`** | `productsState` | Home, Catalog, Search | `getProducts()` |
| **`/mock/categories.json`** | `categoriesState` | Home, Catalog | `getCategories()` |
| **`/mock/banners.json`** | `bannersState` | Home | Custom API hoặc Medusa Admin |
| **`/mock/orders.json`** | `ordersState` | Orders page | `getOrders()`, `getOrder(id)` |
| **`/mock/stations.json`** | `stationsState` | Cart (Pickup stations) | Custom API hoặc Store Locations |

### 3.2. Chi tiết từng file

#### 📦 **Products** (`src/mock/products.json`)
**Vị trí sử dụng:**
- `src/state.ts` → `productsState` (dòng 114-125)
- `src/pages/home/flash-sales.tsx`
- `src/pages/catalog/category-detail.tsx`
- `src/pages/catalog/product-detail.tsx`

**Cách thay thế:**
```typescript
// CŨ (Mock)
export const productsState = atom(async (get) => {
  const categories = await get(categoriesState);
  const products = await requestWithFallback<(Product & { categoryId: number })[]>("/products", []);
  return products.map(product => ({ ...product, category: categories.find(c => c.id === product.categoryId)! }));
});

// MỚI (Medusa)
export const productsState = atom(async (get) => {
  const medusaProducts = await getProducts();
  return medusaProducts.map(product => ({
    id: product.id,
    name: product.title,
    price: product.variants[0]?.calculated_price || 0,
    originalPrice: product.variants[0]?.original_price || 0,
    image: product.thumbnail || product.images?.[0]?.url,
    detail: product.description,
    category: product.categories?.[0], // Medusa categories
  }));
});
```

#### 🗂️ **Categories** (`src/mock/categories.json`)
**Vị trí sử dụng:**
- `src/state.ts` → `categoriesState` (dòng 106-107)
- `src/pages/home/category.tsx`
- `src/pages/catalog/category-list.tsx`

**Cách thay thế:**
```typescript
// CŨ
export const categoriesState = atom(() => 
  requestWithFallback<Category[]>("/categories", [])
);

// MỚI
export const categoriesState = atom(async () => {
  const medusaCategories = await getCategories({ limit: 100 });
  return medusaCategories.map(cat => ({
    id: cat.id,
    name: cat.name,
    icon: cat.metadata?.icon || "📦", // Custom metadata
    image: cat.metadata?.image,
  }));
});
```

#### 🛍️ **Cart State** (Client-side → Server-side)
**Vị trí hiện tại:**
- `src/state.ts` → `cartState` (dòng 138) - Chỉ lưu trên client
- `src/hooks.ts` → `useAddToCart()` - Chỉ update local state

**Cần thay đổi thành:**
```typescript
// Lưu cartId vào localStorage
export const cartIdState = atomWithStorage<string | null>("medusa_cart_id", null);

// Cart state sync với Medusa
export const cartState = atom(async (get) => {
  const cartId = get(cartIdState);
  if (!cartId) return [];
  
  const medusaCart = await getCart(cartId);
  return medusaCart.items.map(item => ({
    product: {
      id: item.variant.product.id,
      name: item.variant.product.title,
      price: item.unit_price,
      image: item.thumbnail,
    },
    quantity: item.quantity,
  }));
});

// Hook thêm vào giỏ - sync với server
export function useAddToCart(product: Product) {
  const [cartId, setCartId] = useAtom(cartIdState);
  
  const addToCart = async (quantity: number) => {
    let currentCartId = cartId;
    
    // Tạo cart nếu chưa có
    if (!currentCartId) {
      const newCart = await createCart();
      currentCartId = newCart.id;
      setCartId(currentCartId);
    }
    
    // Thêm sản phẩm vào cart
    await addToCart(currentCartId, product.variant_id, quantity);
    toast.success("Đã thêm vào giỏ hàng");
  };
  
  return { addToCart };
}
```

#### 📋 **Orders** (`src/mock/orders.json`)
**Vị trí sử dụng:**
- `src/state.ts` → `ordersState` (dòng 227-237)
- `src/pages/orders/order-list.tsx`
- `src/pages/orders/detail.tsx`

**Cách thay thế:**
```typescript
// CŨ
export const ordersState = atomFamily((status: OrderStatus) =>
  atomWithRefresh(async () => {
    const allMockOrders = await requestWithFallback<Order[]>("/orders", []);
    return allMockOrders.filter(order => order.status === status);
  })
);

// MỚI
export const ordersState = atomFamily((status: OrderStatus) =>
  atomWithRefresh(async () => {
    const medusaOrders = await getOrders();
    
    // Map Medusa order status sang app status
    const statusMap = {
      pending: ["pending", "requires_action"],
      completed: ["completed", "fulfilled"],
      cancelled: ["canceled"],
    };
    
    return medusaOrders
      .filter(order => statusMap[status]?.includes(order.status))
      .map(order => ({
        id: order.id,
        code: order.display_id,
        status: status,
        createdAt: order.created_at,
        total: order.total,
        items: order.items.map(item => ({
          product: {
            name: item.variant.product.title,
            image: item.thumbnail,
          },
          quantity: item.quantity,
        })),
      }));
  })
);
```

#### 🏪 **Stations** (`src/mock/stations.json`)
**Vị trí sử dụng:**
- `src/state.ts` → `stationsState` (dòng 172-213)
- `src/pages/cart/stations.tsx`

**Lưu ý:** Medusa không có built-in pickup stations. Cần:
1. Tạo custom module trong Medusa backend
2. Hoặc dùng Store Locations từ Medusa Admin
3. Hoặc tạo API riêng cho stations

### 3.3. Hình thức lấy dữ liệu

#### Pattern 1: Direct Replacement (Đơn giản)
```typescript
// Thay đổi trong atom definition
export const productsState = atom(() => getProducts());
```

#### Pattern 2: Transformation Layer (Khuyến nghị)
```typescript
// Tạo adapter để transform Medusa data sang app format
export const productsState = atom(async () => {
  const medusaProducts = await getProducts();
  return transformMedusaProducts(medusaProducts); // Adapter function
});

function transformMedusaProducts(medusaProducts) {
  return medusaProducts.map(p => ({
    id: p.id,
    name: p.title,
    price: p.variants[0]?.calculated_price,
    // ... mapping logic
  }));
}
```

#### Pattern 3: Gradual Migration (Fallback)
```typescript
// Giữ cả mock và real data, switch bằng env var
export const productsState = atom(async () => {
  const useMedusa = import.meta.env.VITE_USE_MEDUSA === "true";
  
  if (useMedusa) {
    return await getProducts();
  } else {
    return await requestWithFallback<Product[]>("/products", []);
  }
});
```

---

## 🔄 4. Các luồng logic nghiệp vụ phức tạp (Client ↔ Server)

### 4.1. 🛒 **Cart Management Flow** (Quan trọng nhất)

**Hiện tại (Mock):**
```
User clicks "Add to Cart" 
  → Update local state (Jotai atom)
  → No server sync
  → Lost on page refresh (nếu không persist)
```

**Cần thiết (Medusa):**
```
User clicks "Add to Cart"
  ↓
1. Check if cart exists in localStorage
  ├─ No  → Create new cart (POST /store/carts)
  └─ Yes → Use existing cart ID
  ↓
2. Add line item (POST /store/carts/:id/line-items)
  ↓
3. Update local cart state from server response
  ↓
4. Save cart ID to localStorage
```

**Implementation:**
```typescript
// File: src/hooks.ts
export function useAddToCart(product: Product) {
  const [cartId, setCartId] = useAtom(cartIdState);
  const setCart = useSetAtom(cartState);
  
  const addToCart = async (quantity: number) => {
    try {
      // 1. Get or create cart
      let currentCartId = cartId;
      if (!currentCartId) {
        const newCart = await createCart();
        currentCartId = newCart.id;
        setCartId(currentCartId);
      }
      
      // 2. Add item to cart
      const updatedCart = await addToCart(
        currentCartId,
        product.variant_id,
        quantity
      );
      
      // 3. Update local state
      setCart(transformMedusaCart(updatedCart));
      
      toast.success("Đã thêm vào giỏ hàng");
    } catch (error) {
      toast.error("Không thể thêm vào giỏ hàng");
    }
  };
  
  return { addToCart };
}
```

### 4.2. 💳 **Checkout Flow** (Multi-step, phức tạp)

**Các bước trong Medusa checkout:**

```
1. Validate Cart
   ↓
2. Add Shipping Address (POST /store/carts/:id)
   ↓
3. Add Email/Phone (POST /store/carts/:id)
   ↓
4. Select Shipping Method (POST /store/carts/:id/shipping-methods)
   ↓
5. Add Payment Session (POST /store/carts/:id/payment-sessions)
   ↓
6. Select Payment Session (POST /store/carts/:id/payment-session)
   ↓
7. Complete Cart → Create Order (POST /store/carts/:id/complete)
   ↓
8. Handle Payment (Zalo Pay integration)
   ↓
9. Order Confirmation
```

**Implementation:**
```typescript
// File: src/hooks.ts
export function useCheckout() {
  const cartId = useAtomValue(cartIdState);
  const shippingAddress = useAtomValue(shippingAddressState);
  const userInfo = useAtomValue(userInfoState);
  const navigate = useNavigate();
  
  return async () => {
    try {
      // 1. Add shipping address
      await addShippingAddress(cartId, {
        first_name: userInfo.name.split(" ")[0],
        last_name: userInfo.name.split(" ").slice(1).join(" "),
        address_1: shippingAddress.address,
        city: shippingAddress.city,
        country_code: "VN",
        phone: userInfo.phone,
      });
      
      // 2. Get available shipping options
      const cart = await getCart(cartId);
      const shippingOptions = cart.shipping_options;
      
      // 3. Select first available shipping method
      if (shippingOptions.length > 0) {
        await addShippingMethod(cartId, shippingOptions[0].id);
      }
      
      // 4. Initialize payment (Zalo Pay hoặc Medusa payment)
      // TODO: Implement payment gateway integration
      
      // 5. Complete cart
      const order = await completeCart(cartId);
      
      // 6. Clear cart and navigate
      setCartId(null);
      navigate(`/orders/${order.id}`);
      toast.success("Đặt hàng thành công!");
      
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Thanh toán thất bại");
    }
  };
}
```

### 4.3. 🔐 **Authentication & User Management**

**Hiện tại:**
- Chỉ lấy thông tin từ Zalo SDK (`getUserInfo`, `getPhoneNumber`)
- Không có authentication với backend

**Cần thiết:**
```
1. Get Zalo User Info (Zalo SDK)
   ↓
2. Send to Backend để verify/create customer
   ↓
3. Backend tạo Medusa customer (nếu chưa có)
   ↓
4. Return access token (JWT hoặc session)
   ↓
5. Store token và sync với Medusa SDK
   ↓
6. Tất cả requests sau đó include authentication
```

**Implementation:**
```typescript
// File: src/lib/auth.ts
export async function authenticateWithMedusa() {
  // 1. Get Zalo user info
  const { userInfo } = await getUserInfo();
  const { token: phoneToken } = await getPhoneNumber();
  
  // 2. Send to your backend endpoint
  const response = await fetch(`${BACKEND_URL}/auth/zalo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zaloUserId: userInfo.id,
      phoneToken: phoneToken,
      name: userInfo.name,
      avatar: userInfo.avatar,
    }),
  });
  
  const { customerId, email } = await response.json();
  
  // 3. Login to Medusa với credentials từ backend
  await loginCustomer(email, generatedPassword);
  
  // 4. SDK sẽ tự động lưu session
  return customerId;
}
```

### 4.4. 🔍 **Real-time Search & Filtering**

**Complexity:**
- Debouncing user input
- Server-side filtering/searching
- Pagination
- Cache management

**Implementation:**
```typescript
// File: src/state.ts
export const searchResultState = atom(async (get) => {
  const keyword = get(keywordState);
  
  if (!keyword || keyword.length < 2) {
    return [];
  }
  
  // Debounce được handle bởi React component
  const products = await searchProducts(keyword, {
    limit: 20,
    offset: 0,
  });
  
  return products;
});

// Component với debouncing
export function SearchInput() {
  const [keyword, setKeyword] = useAtom(keywordState);
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [keyword]);
  
  useEffect(() => {
    if (debouncedKeyword) {
      setKeyword(debouncedKeyword); // Trigger atom update
    }
  }, [debouncedKeyword]);
  
  return <input onChange={(e) => setKeyword(e.target.value)} />;
}
```

### 4.5. 📦 **Order Tracking & Updates**

**Real-time requirements:**
- Order status updates
- Delivery tracking
- Push notifications

**Potential solutions:**
1. **Polling** (Simple)
```typescript
export const orderDetailState = atomFamily((orderId: string) =>
  atomWithRefresh(async () => {
    return await getOrder(orderId);
  })
);

// Component
useEffect(() => {
  const interval = setInterval(() => {
    refreshOrder(); // Refresh every 30s
  }, 30000);
  return () => clearInterval(interval);
}, []);
```

2. **Webhooks + Server Push** (Advanced)
```typescript
// Backend sends Zalo notification when order updates
// Mini app refetches when user opens notification
```

3. **WebSocket** (Real-time)
```typescript
// Connect to Medusa via WebSocket for real-time updates
const ws = new WebSocket(`${MEDUSA_WS_URL}/orders/${orderId}`);
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  updateOrderState(update);
};
```

---

## 🎯 5. Checklist Migration

### Phase 1: Setup ✅
- [x] Cài đặt Medusa SDK
- [x] Tạo SDK wrapper với helper functions
- [x] Setup environment variables
- [ ] Test connection với Medusa backend

### Phase 2: Product & Categories
- [ ] Migrate `productsState` to Medusa
- [ ] Migrate `categoriesState` to Medusa
- [ ] Update type definitions để match Medusa schema
- [ ] Test product listing, detail, search

### Phase 3: Cart Management
- [ ] Implement `cartIdState` với localStorage
- [ ] Refactor `useAddToCart` để sync với server
- [ ] Implement cart CRUD operations
- [ ] Test add/update/remove items

### Phase 4: Checkout
- [ ] Implement multi-step checkout flow
- [ ] Integrate shipping address
- [ ] Integrate shipping methods
- [ ] Setup payment gateway (Zalo Pay)
- [ ] Test complete checkout flow

### Phase 5: Orders & User
- [ ] Migrate `ordersState` to Medusa
- [ ] Implement authentication flow
- [ ] Sync Zalo user với Medusa customer
- [ ] Test order history and details

### Phase 6: Advanced Features
- [ ] Real-time order tracking
- [ ] Push notifications
- [ ] Advanced search & filters
- [ ] Inventory management
- [ ] Promotions & discounts

---

## 📚 6. Resources

- [Medusa JS SDK Documentation](https://docs.medusajs.com/resources/js-sdk)
- [Medusa Store API Reference](https://docs.medusajs.com/api/store)
- [Jotai Documentation](https://jotai.org/)
- [Zalo Mini App APIs](https://mini.zalo.me/docs/)

---

## ⚠️ Important Notes

1. **Cart ID Management**: Luôn lưu cart ID vào localStorage để maintain cart state
2. **Error Handling**: Implement proper error handling và fallback cho tất cả API calls
3. **Type Safety**: Update TypeScript types để match với Medusa schema
4. **Performance**: Sử dụng caching và pagination cho large datasets
5. **Security**: Không expose sensitive data (API keys, tokens) ở client-side
6. **Testing**: Test thoroughly mỗi step của checkout flow

---

## 🛠️ Next Steps

1. Setup Medusa backend (nếu chưa có)
2. Get publishable API key từ Medusa admin
3. Test connection với backend
4. Bắt đầu migrate từ products/categories (Phase 2)
5. Dần dần migrate các features phức tạp hơn
