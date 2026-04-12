# 📦 Medusa SDK Integration - Quick Reference

## 🎯 TÓM TẮT NHANH

Đã hoàn thành:
- ✅ Cài đặt `@medusajs/js-sdk` version 2.13.6
- ✅ Tạo SDK wrapper với 20+ helper functions
- ✅ Setup environment variables template
- ✅ Tạo documentation chi tiết
- ✅ Tạo ví dụ migration cụ thể

## 📁 CÁC FILE QUAN TRỌNG

| File | Mục đích |
|------|----------|
| **`src/lib/medusa-sdk.ts`** | SDK wrapper - Import để sử dụng |
| **`docs/MEDUSA_INTEGRATION.md`** | Hướng dẫn chi tiết đầy đủ |
| **`docs/INTEGRATION_SUMMARY.md`** | Tóm tắt nhanh và checklist |
| **`src/examples/products-medusa-migration.example.ts`** | Ví dụ migration cụ thể |
| **`.env.example`** | Template environment variables |

## 🚀 CÁCH SỬ DỤNG

### 1. Setup Environment

```bash
# Copy env template
cp .env.example .env

# Edit .env với Medusa credentials của bạn
VITE_MEDUSA_BACKEND_URL=http://localhost:9000
VITE_MEDUSA_PUBLISHABLE_KEY=pk_your_key_here
```

### 2. Import SDK

```typescript
// Import individual functions (Recommended)
import { getProducts, getCart, addToCart } from "@/lib/medusa-sdk";

// Or import SDK instance
import sdk from "@/lib/medusa-sdk";
```

### 3. Sử dụng trong Atoms

```typescript
import { atom } from "jotai";
import { getProducts } from "@/lib/medusa-sdk";

export const productsState = atom(async () => {
  const products = await getProducts({ limit: 100 });
  return products;
});
```

## 📍 VỊ TRÍ MOCK DATA CẦN THAY

| Mock File | State Atom | Medusa Function |
|-----------|------------|-----------------|
| `mock/products.json` | `productsState` | `getProducts()` |
| `mock/categories.json` | `categoriesState` | `getCategories()` |
| `mock/orders.json` | `ordersState` | `getOrders()` |
| `mock/banners.json` | `bannersState` | Custom API |
| `mock/stations.json` | `stationsState` | Custom API |

**Xem chi tiết:** `docs/MEDUSA_INTEGRATION.md` section 3

## 🔄 LUỒNG NGHIỆP VỤ PHỨC TẠP

### 🛒 Cart Management
```typescript
// 1. Create or get cart
const cart = await createCart();
localStorage.setItem("medusa_cart_id", cart.id);

// 2. Add item
await addToCart(cartId, variantId, quantity);

// 3. Update item
await updateLineItem(cartId, lineItemId, newQuantity);

// 4. Remove item
await removeLineItem(cartId, lineItemId);
```

### 💳 Checkout Flow (7 bước)
```
Validate → Add Address → Add Phone → 
Select Shipping → Payment → Complete → Process Payment
```

**Xem chi tiết:** `docs/MEDUSA_INTEGRATION.md` section 4

## 📚 AVAILABLE FUNCTIONS

### Products
- `getProducts(params?)` - List products
- `getProduct(id)` - Get product detail
- `searchProducts(query, params?)` - Search

### Categories
- `getCategories(params?)` - List categories

### Cart
- `createCart(regionId?)` - Create cart
- `getCart(cartId)` - Get cart
- `addToCart(cartId, variantId, quantity)` - Add item
- `updateLineItem(cartId, lineItemId, quantity)` - Update
- `removeLineItem(cartId, lineItemId)` - Remove

### Checkout
- `addShippingAddress(cartId, address)` - Add address
- `addShippingMethod(cartId, methodId)` - Select shipping
- `completeCart(cartId)` - Complete order

### Orders
- `getOrders(params?)` - List orders
- `getOrder(orderId)` - Get order detail

### Auth
- `loginCustomer(email, password)` - Login
- `registerCustomer(email, password, ...)` - Register
- `getCurrentCustomer()` - Get customer info

### Other
- `getRegions()` - Get supported regions

**Full documentation:** `src/lib/medusa-sdk.ts`

## 🎓 VÍ DỤ THỰC TẾ

Xem file `src/examples/products-medusa-migration.example.ts` để xem:
- ✅ 4 options migration khác nhau
- ✅ Transform functions
- ✅ Atom families
- ✅ Derived atoms
- ✅ Usage trong components
- ✅ Testing guide

## ⚡ QUICK START

```bash
# 1. Test connection
node -e "
  import('@/lib/medusa-sdk').then(async ({ getProducts }) => {
    const products = await getProducts({ limit: 5 });
    console.log('Connected!', products);
  });
"

# 2. Bắt đầu migrate - Ví dụ: Products
# Edit src/state.ts
export const productsState = atom(async () => {
  const products = await getProducts();
  return products.map(transformProduct);
});
```

## 📋 MIGRATION CHECKLIST

### Phase 1: Setup ✅
- [x] Install SDK
- [x] Create wrapper
- [x] Setup env vars
- [ ] Test connection với backend

### Phase 2: Products & Categories
- [ ] Migrate `productsState`
- [ ] Migrate `categoriesState`
- [ ] Test listing/detail/search

### Phase 3: Cart
- [ ] Implement server-synced cart
- [ ] Refactor `useAddToCart`
- [ ] Test cart operations

### Phase 4: Checkout & Orders
- [ ] Multi-step checkout
- [ ] Payment integration
- [ ] Orders history

**Full checklist:** `docs/INTEGRATION_SUMMARY.md`

## ⚠️ LƯU Ý QUAN TRỌNG

1. **Cart ID**: Luôn lưu vào localStorage
2. **Type Safety**: Transform Medusa schema sang app schema
3. **Error Handling**: Always try/catch với fallback
4. **Performance**: Use pagination, caching, debouncing
5. **Testing**: Test từng step trước khi deploy

## 🔗 LINKS

- [Medusa JS SDK Docs](https://docs.medusajs.com/resources/js-sdk)
- [Medusa Store API](https://docs.medusajs.com/api/store)
- [Jotai Documentation](https://jotai.org/)

## 📞 NEED HELP?

1. Check `docs/MEDUSA_INTEGRATION.md` (Full guide)
2. Check `docs/INTEGRATION_SUMMARY.md` (Quick summary)
3. Check `src/examples/*.example.ts` (Code examples)
4. Check browser console for errors
5. Check Medusa backend logs

---

**Created:** 2026-04-08  
**SDK Version:** @medusajs/js-sdk@2.13.6  
**By:** GitHub Copilot CLI
