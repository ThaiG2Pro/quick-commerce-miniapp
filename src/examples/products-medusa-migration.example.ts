/**
 * VÍ DỤ MIGRATION: Products State
 * 
 * File này minh họa cách migrate từ mock data sang Medusa SDK
 * Bạn có thể sử dụng pattern này cho các atoms khác
 */

import { atom } from "jotai";
import { getProducts, getProduct, searchProducts } from "@/lib/medusa-sdk";
import { Product, Category } from "@/types";
import { requestWithFallback } from "@/utils/request";

// ============================================================================
// OPTION 1: DIRECT REPLACEMENT (Đơn giản nhất)
// ============================================================================

// ❌ CŨ (Mock)
export const productsStateOld = atom(() =>
  requestWithFallback<Product[]>("/products", [])
);

// ✅ MỚI (Medusa - Direct)
export const productsStateDirect = atom(async () => {
  return await getProducts();
});

// ⚠️ VẤN ĐỀ: Medusa schema khác mock schema, cần transform

// ============================================================================
// OPTION 2: WITH TRANSFORMATION (Khuyến nghị)
// ============================================================================

/**
 * Transform Medusa product sang app schema
 */
function transformMedusaProduct(medusaProduct: any): Product {
  return {
    id: medusaProduct.id,
    name: medusaProduct.title,
    price: medusaProduct.variants?.[0]?.calculated_price || 0,
    originalPrice: medusaProduct.variants?.[0]?.original_price || 0,
    image: medusaProduct.thumbnail || medusaProduct.images?.[0]?.url || "",
    detail: medusaProduct.description || "",
    category: medusaProduct.categories?.[0] || null,
    categoryId: medusaProduct.categories?.[0]?.id || 0,
    
    // Extra fields từ Medusa
    variants: medusaProduct.variants || [],
    metadata: medusaProduct.metadata || {},
  };
}

// ✅ MỚI (Medusa - With Transform)
export const productsStateTransform = atom(async () => {
  const medusaProducts = await getProducts({ limit: 100 });
  return medusaProducts.map(transformMedusaProduct);
});

// ============================================================================
// OPTION 3: GRADUAL MIGRATION (An toàn nhất - có fallback)
// ============================================================================

export const productsStateGradual = atom(async () => {
  const useMedusa = import.meta.env.VITE_USE_MEDUSA === "true";
  
  try {
    if (useMedusa) {
      // Dùng Medusa
      const medusaProducts = await getProducts({ limit: 100 });
      return medusaProducts.map(transformMedusaProduct);
    } else {
      // Fallback mock
      return await requestWithFallback<Product[]>("/products", []);
    }
  } catch (error) {
    console.error("Failed to fetch products:", error);
    // Fallback về mock nếu Medusa fail
    return await requestWithFallback<Product[]>("/products", []);
  }
});

// ============================================================================
// OPTION 4: WITH CATEGORIES (Complete example)
// ============================================================================

import { categoriesState } from "./categories"; // Assume đã migrate

export const productsWithCategoriesState = atom(async (get) => {
  try {
    // Fetch products từ Medusa
    const medusaProducts = await getProducts({ 
      limit: 100,
      expand: "categories,variants", // Expand relationships
    });
    
    // Fetch categories (để map category info)
    const categories = await get(categoriesState);
    
    return medusaProducts.map(product => ({
      ...transformMedusaProduct(product),
      // Enhance với category info từ categories state
      category: categories.find(cat => 
        product.categories?.some(c => c.id === cat.id)
      ),
    }));
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return [];
  }
});

// ============================================================================
// DERIVED ATOMS (Computed states)
// ============================================================================

// Flash sale products (filter từ products)
export const flashSaleProductsState = atom(async (get) => {
  const products = await get(productsStateTransform);
  
  // Filter products có discount
  return products.filter(product => {
    const discount = product.originalPrice - product.price;
    return discount > 0;
  });
});

// Recommended products
export const recommendedProductsState = atom(async (get) => {
  const products = await get(productsStateTransform);
  
  // Lọc products có metadata.recommended = true
  return products.filter(product => 
    product.metadata?.recommended === true
  ).slice(0, 10);
});

// ============================================================================
// ATOM FAMILY (Dynamic atoms)
// ============================================================================

import { atomFamily } from "jotai/utils";

// ❌ CŨ (Mock)
export const productStateOld = atomFamily((id: number) =>
  atom(async (get) => {
    const products = await get(productsStateOld);
    return products.find(p => p.id === id);
  })
);

// ✅ MỚI (Medusa - Direct fetch)
export const productState = atomFamily((id: string) =>
  atom(async () => {
    try {
      const medusaProduct = await getProduct(id);
      return transformMedusaProduct(medusaProduct);
    } catch (error) {
      console.error(`Failed to fetch product ${id}:`, error);
      return null;
    }
  })
);

// ============================================================================
// SEARCH STATE
// ============================================================================

import { keywordState } from "./search"; // Assume keyword state exists

// ❌ CŨ (Mock - Client-side filter)
export const searchResultStateOld = atom(async (get) => {
  const keyword = get(keywordState);
  const products = await get(productsStateOld);
  
  // Client-side filtering
  await new Promise(resolve => setTimeout(resolve, 1000)); // Fake delay
  return products.filter(p => 
    p.name.toLowerCase().includes(keyword.toLowerCase())
  );
});

// ✅ MỚI (Medusa - Server-side search)
export const searchResultState = atom(async (get) => {
  const keyword = get(keywordState);
  
  if (!keyword || keyword.length < 2) {
    return [];
  }
  
  try {
    const results = await searchProducts(keyword, { 
      limit: 20,
      offset: 0,
    });
    return results.map(transformMedusaProduct);
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
});

// ============================================================================
// PRODUCTS BY CATEGORY
// ============================================================================

// ❌ CŨ (Mock)
export const productsByCategoryStateOld = atomFamily((categoryId: string) =>
  atom(async (get) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const products = await get(productsStateOld);
    return products.filter(p => String(p.categoryId) === categoryId);
  })
);

// ✅ MỚI (Medusa)
export const productsByCategoryState = atomFamily((categoryId: string) =>
  atom(async () => {
    try {
      const products = await getProducts({ 
        category_id: [categoryId],
        limit: 50,
      });
      return products.map(transformMedusaProduct);
    } catch (error) {
      console.error(`Failed to fetch products for category ${categoryId}:`, error);
      return [];
    }
  })
);

// ============================================================================
// USAGE IN COMPONENTS
// ============================================================================

/*
// Example component

import { useAtomValue } from "jotai";
import { productsStateTransform, productState } from "@/state/products-medusa";

export function ProductList() {
  const products = useAtomValue(productsStateTransform);
  
  if (!products.length) {
    return <div>No products found</div>;
  }
  
  return (
    <div className="grid grid-cols-2 gap-4">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export function ProductDetail({ productId }: { productId: string }) {
  const product = useAtomValue(productState(productId));
  
  if (!product) {
    return <div>Product not found</div>;
  }
  
  return (
    <div>
      <h1>{product.name}</h1>
      <img src={product.image} alt={product.name} />
      <p>{product.detail}</p>
      <p className="text-2xl font-bold">{formatPrice(product.price)}</p>
    </div>
  );
}
*/

// ============================================================================
// TESTING
// ============================================================================

/*
// Test connection
async function testMedusaConnection() {
  try {
    const products = await getProducts({ limit: 5 });
    console.log("✅ Connected to Medusa successfully");
    console.log("Sample products:", products);
  } catch (error) {
    console.error("❌ Failed to connect to Medusa:", error);
  }
}

// Run in browser console
testMedusaConnection();
*/

// ============================================================================
// MIGRATION STEPS
// ============================================================================

/*
STEP 1: Test Medusa connection
  - Verify backend URL and API key
  - Run testMedusaConnection()

STEP 2: Create transformation functions
  - transformMedusaProduct()
  - transformMedusaCategory()
  - etc.

STEP 3: Choose migration strategy
  - Option 1: Direct (simple projects)
  - Option 2: Transform (recommended)
  - Option 3: Gradual (production apps)

STEP 4: Update atoms one by one
  - Start with productsState
  - Then categoriesState
  - Then derived states

STEP 5: Test thoroughly
  - Product listing
  - Product detail
  - Search
  - Filters
  - Add to cart

STEP 6: Monitor errors
  - Check browser console
  - Log failed requests
  - Handle edge cases

STEP 7: Remove mock data
  - Only after everything works
  - Keep as fallback initially
*/

export {
  productsStateTransform as productsState, // Export as default
  productState,
  flashSaleProductsState,
  recommendedProductsState,
  searchResultState,
  productsByCategoryState,
};
