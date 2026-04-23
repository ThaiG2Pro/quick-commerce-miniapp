/**
 * Medusa Data Transformers
 * 
 * Transform Medusa backend data structures to match our app's schema.
 * This allows us to keep all existing components unchanged.
 */

import type { 
  Product, 
  Category, 
  MedusaProduct, 
  MedusaCategory,
  MedusaCart,
  Cart,
  CartPricing,
  ProductVariant,
  Order,
  OrderStatus,
  PaymentStatus,
  CartItem
} from "@/types";

/**
 * Convert string ID to numeric hash for compatibility with app schema
 */
export function hashId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function toCategoryHandle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeMockCategory(category: {
  id: number;
  name: string;
  image: string;
}): Category {
  const handle = toCategoryHandle(category.name) || `category-${category.id}`;
  return {
    ...category,
    handle,
  };
}

/**
 * Transform Medusa Category to App Category
 */
export function transformCategory(medusaCategory: MedusaCategory): Category {
  const categoryImageUrl =
    medusaCategory.product_category_image?.url ||
    (medusaCategory.metadata?.category_image as string | undefined) ||
    (medusaCategory.metadata?.image as string | undefined);
  return {
    id: hashId(medusaCategory.id),
    medusaId: medusaCategory.id,
    handle: medusaCategory.handle,
    name: medusaCategory.name,
    image:
      categoryImageUrl ||
      `https://via.placeholder.com/150?text=${encodeURIComponent(medusaCategory.name)}`,
  };
}

/**
 * Transform Medusa Product to App Product
 */
export function transformProduct(
  medusaProduct: MedusaProduct,
  categories: Category[] = []
): Product {
  const variants: ProductVariant[] = (medusaProduct.variants ?? []).map(
    (variant) => {
      const hasCalculatedPrice =
        typeof variant.calculated_price?.calculated_amount === "number";
      const manageInventory = variant.manage_inventory !== false;
      const inventoryQuantity = variant.inventory_quantity ?? 0;
      const isInStock =
        !manageInventory ||
        Boolean(variant.allow_backorder) ||
        inventoryQuantity > 0;
      const price = variant.calculated_price?.calculated_amount ?? 0;
      const originalPrice = variant.calculated_price?.original_amount;
      return {
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        price,
        originalPrice:
          originalPrice && originalPrice !== price ? originalPrice : undefined,
        currencyCode: variant.calculated_price?.currency_code?.toUpperCase(),
        isTaxInclusive: Boolean(
          variant.calculated_price?.is_calculated_price_tax_inclusive
        ),
        isPurchasable: Boolean(variant.id && hasCalculatedPrice && isInStock),
        isInStock,
        inventoryQuantity,
        manageInventory,
        allowBackorder: variant.allow_backorder,
        isCampaignPrice: Boolean(
          variant.calculated_price?.is_calculated_price_price_list
        ),
        optionValues: (variant.options ?? []).map((option) => ({
          optionId: option.option?.id || option.id,
          optionTitle: option.option?.title || "Option",
          value: option.value,
        })),
      };
    }
  );

  const firstVariant = variants[0];
  const purchasableVariantPrices = variants
    .filter((variant) => variant.isPurchasable)
    .map((variant) => variant.price);
  const priceMin =
    purchasableVariantPrices.length > 0
      ? Math.min(...purchasableVariantPrices)
      : undefined;
  const priceMax =
    purchasableVariantPrices.length > 0
      ? Math.max(...purchasableVariantPrices)
      : undefined;
  const maxDiscountPercent = variants.reduce((max, variant) => {
    if (!variant.originalPrice || variant.originalPrice <= variant.price) {
      return max;
    }
    const discount = Math.round(
      ((variant.originalPrice - variant.price) * 100) / variant.originalPrice
    );
    return Math.max(max, discount);
  }, 0);

  // Find matching category from the categories list
  const categoryId = medusaProduct.categories?.[0]?.id;
  const categoryHash = categoryId ? hashId(categoryId) : undefined;
  const category = categoryId
    ? categories.find(
        (cat) => cat.medusaId === categoryId || cat.id === categoryHash
      )
    : undefined;

  // Fallback category if not found
  const defaultCategory: Category = {
    id: 0,
    handle: "uncategorized",
    name: "Uncategorized",
    image: "https://via.placeholder.com/150?text=Category",
  };

  return {
    id: hashId(medusaProduct.id),
    medusaId: medusaProduct.id,
    variantId: firstVariant?.id,
    isPurchasable: variants.some((variant) => variant.isPurchasable),
    currencyCode: firstVariant?.currencyCode,
    isTaxInclusive: firstVariant?.isTaxInclusive,
    priceMin,
    priceMax,
    type: medusaProduct.type?.value,
    tags: (medusaProduct.tags ?? []).map((tag) => tag.value),
    hasPromotion:
      maxDiscountPercent > 0 || variants.some((variant) => variant.isCampaignPrice),
    hasCampaignPrice: variants.some((variant) => variant.isCampaignPrice),
    maxDiscountPercent: maxDiscountPercent || undefined,
    variants,
    name: medusaProduct.title,
    price: firstVariant?.price ?? 0,
    originalPrice: firstVariant?.originalPrice,
    image: medusaProduct.thumbnail || 
           medusaProduct.images?.[0]?.url || 
           `https://via.placeholder.com/400?text=${encodeURIComponent(medusaProduct.title)}`,
    category: category || defaultCategory,
    detail: medusaProduct.description,
    // These could be extracted from variants if needed
    sizes: undefined,
    colors: undefined,
  };
}

/**
 * Batch transform products with category matching
 */
export function transformProducts(
  medusaProducts: MedusaProduct[],
  categories: Category[]
): Product[] {
  return medusaProducts.map(product => transformProduct(product, categories));
}

export function transformMedusaCart(cart: MedusaCart): Cart {
  const defaultCategory: Category = {
    id: 0,
    handle: "uncategorized",
    name: "Uncategorized",
    image: "https://via.placeholder.com/150?text=Category",
  };

  return (cart.items ?? []).map((item) => {
    const variantId = item.variant_id || item.variant?.id;
    const productId = item.product_id || item.variant?.product_id || variantId || item.id;
    const productTitle =
      item.title || item.variant?.product?.title || item.variant?.title || "Sản phẩm";

    return {
      lineItemId: item.id,
      variantTitle: item.subtitle || item.variant?.title,
      subtotal: item.subtotal,
      taxTotal: item.tax_total,
      total: item.total,
      quantity: item.quantity,
      product: {
        id: hashId(productId),
        medusaId: productId,
        variantId,
        isPurchasable: true,
        name: productTitle,
        price: item.unit_price || 0,
        image:
          item.thumbnail ||
          item.variant?.product?.thumbnail ||
          `https://via.placeholder.com/400?text=${encodeURIComponent(productTitle)}`,
        category: defaultCategory,
      },
    };
  });
}

export function transformMedusaCartPricing(cart: MedusaCart): CartPricing {
  const currencyCode = (
    cart.currency_code ||
    cart.region?.currency_code ||
    "VND"
  ).toUpperCase();

  const subtotal = cart.subtotal ?? 0;
  const discountTotal = cart.discount_total ?? 0;
  const shippingTotal = cart.shipping_total ?? 0;
  const taxTotal = cart.tax_total ?? 0;
  const total = cart.total ?? 0;
  const selectedShippingMethod = cart.shipping_methods?.[0];
  const isTaxInclusive = (cart.items ?? []).some(
    (item) => item.variant?.calculated_price?.is_calculated_price_tax_inclusive === true
  );

  return {
    currencyCode,
    subtotal,
    discountTotal,
    shippingTotal,
    taxTotal,
    total,
    isTaxInclusive,
    promotionCodes: (cart.promotions ?? [])
      .map((promotion) => promotion.code)
      .filter((code): code is string => Boolean(code)),
    promotions: (cart.promotions ?? [])
      .map((p: any) => ({ code: p.code, isAutomatic: Boolean(p.is_automatic) }))
      .filter((p: any) => typeof p.code === "string"),
    shippingMethodName: selectedShippingMethod?.shipping_option?.name,
  };
}

function mapOrderStatus(order: any): OrderStatus {
  const fulfillment = String(order?.fulfillment_status || "").toLowerCase();
  
  switch (fulfillment) {
    case "fulfilled":
      return "fulfilled";
    case "shipped":
      return "shipping";
    case "delivered":
      return "completed";
    case "not_fulfilled":
    default:
      return "pending";
  }
}

function mapPaymentStatus(order: any): PaymentStatus {
  const payment = String(order?.payment_status || "").toLowerCase();
  if (payment.includes("captured") || payment.includes("paid")) {
    return "success";
  }
  if (payment.includes("fail") || payment.includes("cancel")) {
    return "failed";
  }
  return "pending";
}

function parseDateValue(value: unknown): Date | null {
  if (!value || typeof value !== "string") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapReceivedAt(order: any, createdAt: Date): Date {
  const fulfillmentCandidate = order?.fulfillments?.[0];
  const etaFromMetadata = parseDateValue(order?.metadata?.received_at);
  const deliveredAt = parseDateValue(
    fulfillmentCandidate?.delivered_at || fulfillmentCandidate?.updated_at
  );
  const shippedAt = parseDateValue(fulfillmentCandidate?.shipped_at);

  return etaFromMetadata || deliveredAt || shippedAt || createdAt;
}

function mapOrderItems(order: any): CartItem[] {
  const defaultCategory: Category = {
    id: 0,
    handle: "uncategorized",
    name: "Uncategorized",
    image: "https://via.placeholder.com/150?text=Category",
  };

  return (order?.items || []).map((item: any) => {
    const productId =
      item?.product_id || item?.variant?.product_id || item?.id || "product";
    const productName =
      item?.title || item?.variant?.title || "Sản phẩm";

    return {
      lineItemId: item?.id,
      variantTitle: item?.variant?.title,
      subtotal: item?.subtotal,
      taxTotal: item?.tax_total,
      total: item?.total,
      quantity: item?.quantity || 0,
      product: {
        id: hashId(String(productId)),
        medusaId: String(productId),
        variantId: item?.variant_id || item?.variant?.id,
        isPurchasable: true,
        name: productName,
        price: item?.unit_price || 0,
        image:
          item?.thumbnail ||
          item?.variant?.product?.thumbnail ||
          `https://via.placeholder.com/400?text=${encodeURIComponent(productName)}`,
        category: defaultCategory,
      },
    };
  });
}

export function transformMedusaOrders(orders: any[]): Order[] {
  return orders.map((order) => {
    const createdAt = new Date(order?.created_at || Date.now());
    const shippingAddress = order?.shipping_address;
    const alias =
      shippingAddress?.first_name || shippingAddress?.last_name
        ? `${shippingAddress?.first_name || ""} ${shippingAddress?.last_name || ""}`.trim()
        : "Địa chỉ nhận hàng";

    return {
      id: hashId(String(order?.id || order?.display_id || Date.now())),
      medusaId: typeof order?.id === "string" ? order.id : undefined,
      status: mapOrderStatus(order),
      paymentStatus: mapPaymentStatus(order),
      createdAt,
      receivedAt: mapReceivedAt(order, createdAt),
      items: mapOrderItems(order),
      delivery: shippingAddress
        ? {
            type: "shipping",
            alias,
            address: shippingAddress?.address_1 || "",
            city: shippingAddress?.city || "",
            name: alias,
            phone: shippingAddress?.phone || "",
          }
        : {
            type: "pickup",
            stationId: 0,
          },
      // Use order.total if present; otherwise compute from item totals as fallback
      total: (typeof order?.total === "number" && order.total > 0)
        ? order.total
        : (order?.items || []).reduce((sum: number, it: any) => sum + (typeof it?.total === "number" ? it.total : (typeof it?.unit_price === "number" && typeof it?.quantity === "number" ? it.unit_price * it.quantity : 0)), 0),
      note:
        (order?.metadata?.note as string | undefined) ||
        (order?.customer_note as string | undefined) ||
        "",
      
      // Store raw Medusa status for advanced filtering
      medusaStatus: order?.status,
      fulfillmentStatus: order?.fulfillment_status,
      paymentStatusRaw: order?.payment_status,
    } satisfies Order;
  });
}

/**
 * Filter orders by tab status based on Medusa order statuses
 * 
 * Tab mappings:
 * - pending_confirmation: status=pending (awaiting fulfillment)
 * - shipping: fulfillment_status=shipped OR contains "deliver" in fulfillment_status
 * - completed: status=completed
 */
export function filterOrdersByTab(orders: Order[], tabStatus: string): Order[] {
  // Use the already mapped order.status (pending/fulfilled/shipping/completed) for filtering.
  return orders.filter((order) => {
    const mappedStatus = String(order.status || "").toLowerCase();

    switch (tabStatus) {
      case "pending_confirmation":
        return mappedStatus === "pending";

      case "shipping":
        return mappedStatus === "shipping" || mappedStatus === "fulfilled";

      case "completed":
        return mappedStatus === "completed";

      default:
        return true;
    }
  });
}

/**
 * Calculate discount percentage
 */
export function calculateDiscount(price: number, originalPrice?: number): number {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

/**
 * Fallback placeholder image generator
 */
export function getPlaceholderImage(text: string, size = 400): string {
  return `https://via.placeholder.com/${size}?text=${encodeURIComponent(text)}`;
}
