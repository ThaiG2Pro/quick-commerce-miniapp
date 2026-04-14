import Medusa from "@medusajs/js-sdk";
import { LoyaltyProfile, Station, StorefrontProfile, UserInfo } from "@/types";
import CONFIG from "@/config";

// Cấu hình Medusa SDK
const MEDUSA_BACKEND_URL = import.meta.env.VITE_MEDUSA_BACKEND_URL || "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY || "";

if (!MEDUSA_PUBLISHABLE_KEY && typeof window !== "undefined") {
  console.warn(
    "VITE_MEDUSA_PUBLISHABLE_KEY is empty. Store APIs may fail with 400 missing x-publishable-api-key."
  );
}

// Khởi tạo Medusa SDK client
export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: import.meta.env.DEV,
  publishableKey: MEDUSA_PUBLISHABLE_KEY,
  auth: {
    type: "jwt",
  },
});

let cachedDefaultRegionId: string | null | undefined;
const CALCULATED_PRICE_FIELD = "*variants.calculated_price";

async function getDefaultRegionId() {
  if (cachedDefaultRegionId !== undefined) {
    return cachedDefaultRegionId;
  }

  const response = await sdk.store.region.list();
  cachedDefaultRegionId = response.regions?.[0]?.id || null;
  return cachedDefaultRegionId;
}

function ensureCalculatedPriceField(fields?: string) {
  if (!fields) {
    return CALCULATED_PRICE_FIELD;
  }

  const normalized = fields
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);

  if (normalized.includes(CALCULATED_PRICE_FIELD)) {
    return fields;
  }

  return `${CALCULATED_PRICE_FIELD},${fields}`;
}

// Helper functions để làm việc với Medusa

/**
 * Lấy danh sách sản phẩm
 */
export async function getProducts(params?: {
  limit?: number;
  offset?: number;
  region_id?: string;
  country_code?: string;
  province?: string;
  cart_id?: string;
  fields?: string;
  category_id?: string | string[];
  collection_id?: string[];
  q?: string; // search query
}) {
  try {
    const regionId = params?.region_id || (await getDefaultRegionId());
    const response = await sdk.store.product.list({
      ...params,
      fields: ensureCalculatedPriceField(params?.fields),
      ...(regionId ? { region_id: regionId } : {}),
    });
    return response.products;
  } catch (error) {
    console.error("Error fetching products:", error);
    throw error;
  }
}

/**
 * Lấy chi tiết sản phẩm
 */
export async function getProduct(
  id: string,
  params?: {
    region_id?: string;
    country_code?: string;
    province?: string;
    cart_id?: string;
    fields?: string;
  }
) {
  try {
    const regionId = params?.region_id || (await getDefaultRegionId());
    const response = await sdk.store.product.retrieve(id, {
      ...params,
      fields: ensureCalculatedPriceField(params?.fields),
      ...(regionId ? { region_id: regionId } : {}),
    });
    return response.product;
  } catch (error) {
    console.error("Error fetching product:", error);
    throw error;
  }
}

/**
 * Lấy danh sách categories
 */
export async function getCategories(params?: {
  limit?: number;
  offset?: number;
  parent_category_id?: string;
}) {
  try {
    // Medusa v2 uses 'category' not 'productCategory'
    const response = await sdk.store.category.list(params);
    return response.product_categories;
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw error;
  }
}

/**
 * Tạo giỏ hàng mới hoặc lấy giỏ hàng hiện tại
 */
export async function createCart(regionId?: string) {
  try {
    const response = await sdk.store.cart.create(
      regionId ? { region_id: regionId } : {}
    );
    return response.cart;
  } catch (error) {
    console.error("Error creating cart:", error);
    throw error;
  }
}

/**
 * Lấy thông tin giỏ hàng
 */
export async function getCart(cartId: string) {
  try {
    const response = await sdk.store.cart.retrieve(cartId);
    return response.cart;
  } catch (error) {
    console.error("Error fetching cart:", error);
    throw error;
  }
}

/**
 * Thêm sản phẩm vào giỏ hàng
 */
export async function addToCart(cartId: string, variantId: string, quantity: number) {
  try {
    const response = await sdk.store.cart.createLineItem(cartId, {
      variant_id: variantId,
      quantity,
    });
    return response.cart;
  } catch (error) {
    console.error("Error adding to cart:", error);
    throw error;
  }
}

/**
 * Cập nhật số lượng sản phẩm trong giỏ hàng
 */
export async function updateLineItem(
  cartId: string,
  lineItemId: string,
  quantity: number
) {
  try {
    const response = await sdk.store.cart.updateLineItem(cartId, lineItemId, {
      quantity,
    });
    return response.cart;
  } catch (error) {
    console.error("Error updating line item:", error);
    throw error;
  }
}

/**
 * Xóa sản phẩm khỏi giỏ hàng
 */
export async function removeLineItem(cartId: string, lineItemId: string) {
  try {
    const response = await sdk.store.cart.deleteLineItem(cartId, lineItemId);
    return response.parent;
  } catch (error) {
    console.error("Error removing line item:", error);
    throw error;
  }
}

/**
 * Thêm địa chỉ giao hàng
 */
export async function addShippingAddress(
  cartId: string,
  address: {
    first_name: string;
    last_name: string;
    address_1: string;
    city: string;
    country_code: string;
    address_2?: string;
    province?: string;
    postal_code?: string;
    phone?: string;
  }
) {
  try {
    const response = await sdk.store.cart.update(cartId, {
      shipping_address: address,
    });
    return response.cart;
  } catch (error) {
    console.error("Error adding shipping address:", error);
    throw error;
  }
}

/**
 * Cập nhật thông tin liên hệ của cart (email là bắt buộc cho checkout).
 */
export async function updateCartContact(
  cartId: string,
  payload: {
    email?: string;
  }
) {
  try {
    const response = await sdk.store.cart.update(cartId, {
      ...(payload.email ? { email: payload.email } : {}),
    });
    return response.cart;
  } catch (error) {
    console.error("Error updating cart contact:", error);
    throw error;
  }
}

/**
 * Chọn phương thức vận chuyển
 */
export async function addShippingMethod(
  cartId: string,
  shippingMethodId: string
) {
  try {
    const response = await sdk.store.cart.addShippingMethod(cartId, {
      option_id: shippingMethodId,
    });
    return response.cart;
  } catch (error) {
    console.error("Error adding shipping method:", error);
    throw error;
  }
}

/**
 * Lấy danh sách shipping options khả dụng cho cart hiện tại
 */
export async function listCartShippingOptions(cartId: string) {
  try {
    const response = await sdk.store.cart.listShippingOptions(cartId);
    return response.shipping_options;
  } catch (error) {
    console.error("Error fetching cart shipping options:", error);
    throw error;
  }
}

/**
 * Lấy danh sách payment providers khả dụng dựa theo region của cart.
 */
export async function listCartPaymentProviders(cartId: string, regionId?: string) {
  try {
    const cartWithProviders = await sdk.store.cart.retrieve(cartId, {
      fields: "+payment_providers",
    });
    const embeddedProviders =
      (cartWithProviders.cart as { payment_providers?: Array<{ id: string; name?: string }> })
        .payment_providers || [];
    if (embeddedProviders.length > 0) {
      return embeddedProviders;
    }

    let resolvedRegionId = regionId;
    if (!resolvedRegionId) {
      const cartResponse = await sdk.store.cart.retrieve(cartId);
      resolvedRegionId = cartResponse.cart?.region?.id;
    }
    if (!resolvedRegionId) {
      return [];
    }

    const response = await sdk.store.payment.listPaymentProviders({
      region_id: resolvedRegionId,
    });
    return response.payment_providers || [];
  } catch (error) {
    console.error("Error listing cart payment providers:", error);
    throw error;
  }
}

/**
 * Khởi tạo payment sessions cho cart.
 */
export async function initializeCartPaymentSessions(cartId: string) {
  try {
    const response = await sdk.store.cart.initializePaymentSession(cartId);
    return response.cart;
  } catch (error) {
    console.error("Error initializing cart payment sessions:", error);
    throw error;
  }
}

/**
 * Chọn payment session cho cart theo provider.
 */
export async function setCartPaymentSession(
  cartId: string,
  providerId: string
) {
  try {
    const response = await sdk.store.cart.setPaymentSession(cartId, {
      provider_id: providerId,
    });
    return response.cart;
  } catch (error) {
    console.error("Error setting cart payment session:", error);
    throw error;
  }
}

/**
 * Tính giá cho shipping option dạng calculated
 */
export async function calculateShippingOption(
  shippingOptionId: string,
  cartId: string
) {
  try {
    const response = await sdk.store.fulfillment.calculate(shippingOptionId, {
      cart_id: cartId,
    });
    return response.shipping_option;
  } catch (error) {
    console.error("Error calculating shipping option:", error);
    throw error;
  }
}

/**
 * Áp dụng mã khuyến mãi cho giỏ hàng
 */
export async function applyPromotionCodes(cartId: string, promoCodes: string[]) {
  try {
    const response = await sdk.client.fetch<{ cart: unknown }>(
      `/store/carts/${cartId}/promotions`,
      {
        method: "POST",
        body: {
          promo_codes: promoCodes,
        },
      }
    );
    return response.cart;
  } catch (error) {
    console.error("Error applying promotions:", error);
    throw error;
  }
}

/**
 * Gỡ mã khuyến mãi khỏi giỏ hàng
 */
export async function removePromotionCodes(cartId: string, promoCodes: string[]) {
  try {
    const response = await sdk.client.fetch<{ cart: unknown }>(
      `/store/carts/${cartId}/promotions`,
      {
        method: "DELETE",
        body: {
          promo_codes: promoCodes,
        },
      }
    );
    return response.cart;
  } catch (error) {
    console.error("Error removing promotions:", error);
    throw error;
  }
}

/**
 * Hoàn tất đơn hàng
 */
export async function completeCart(cartId: string) {
  try {
    const response = await sdk.store.cart.complete(cartId);

    if (response.type === "cart") {
      const errorCode =
        typeof response.error === "string"
          ? response.error
          : "cart_not_completed";
      throw new Error(
        `Medusa checkout chưa hoàn tất cart. error=${errorCode}`
      );
    }

    return response.order;
  } catch (error) {
    console.error("Error completing cart:", error);
    throw error;
  }
}

/**
 * Lấy danh sách đơn hàng của khách hàng
 */
export async function getOrders(params?: {
  limit?: number;
  offset?: number;
}) {
  try {
    const response = await sdk.store.order.list(params);
    return response.orders;
  } catch (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }
}

/**
 * Lấy chi tiết đơn hàng
 */
export async function getOrder(orderId: string) {
  try {
    const response = await sdk.store.order.retrieve(orderId);
    return response.order;
  } catch (error) {
    console.error("Error fetching order:", error);
    throw error;
  }
}

/**
 * Đăng nhập khách hàng
 */
export async function loginCustomer(email: string, password: string) {
  try {
    const response = await sdk.auth.login("customer", "emailpass", {
      email,
      password,
    });
    return response;
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
}

/**
 * Đăng ký khách hàng mới
 */
export async function registerCustomer(email: string, password: string, firstName?: string, lastName?: string) {
  try {
    const response = await sdk.auth.register("customer", "emailpass", {
      email,
      password,
      ...(firstName && { first_name: firstName }),
      ...(lastName && { last_name: lastName }),
    });
    return response;
  } catch (error) {
    console.error("Error registering customer:", error);
    throw error;
  }
}

/**
 * Lấy thông tin khách hàng hiện tại
 */
export async function getCurrentCustomer() {
  try {
    const response = await sdk.store.customer.retrieve();
    return response.customer;
  } catch (error) {
    console.error("Error fetching customer:", error);
    throw error;
  }
}

/**
 * Cập nhật thông tin customer hiện tại trên Medusa.
 */
export async function updateCurrentCustomer(payload: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const response = await sdk.store.customer.update(payload);
    return response.customer;
  } catch (error) {
    console.error("Error updating customer:", error);
    throw error;
  }
}

/**
 * Chuyển Medusa customer thành UserInfo của app.
 */
export function transformMedusaCustomerToUserInfo(customer: unknown): UserInfo | null {
  if (!customer || typeof customer !== "object") {
    return null;
  }

  const record = customer as {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    image?: string;
    metadata?: Record<string, unknown>;
  };

  const firstName = typeof record.first_name === "string" ? record.first_name.trim() : "";
  const lastName = typeof record.last_name === "string" ? record.last_name.trim() : "";
  const name = [firstName, lastName].filter(Boolean).join(" ");
  const metadata = record.metadata || {};
  const address =
    (typeof metadata.address === "string" && metadata.address) ||
    (typeof metadata.address_1 === "string" && metadata.address_1) ||
    (typeof metadata.city === "string" && metadata.city) ||
    "";

  return {
    id: record.id || "",
    name: name || (typeof metadata.name === "string" ? metadata.name : ""),
    avatar:
      record.avatar ||
      record.image ||
      (typeof metadata.avatar === "string" ? metadata.avatar : "") ||
      "",
    phone:
      record.phone ||
      (typeof metadata.phone === "string" ? metadata.phone : "") ||
      "",
    email: record.email || "",
    address,
  };
}

/**
 * Tìm kiếm sản phẩm
 */
export async function searchProducts(query: string, params?: {
  limit?: number;
  offset?: number;
  region_id?: string;
  country_code?: string;
  province?: string;
  cart_id?: string;
  fields?: string;
}) {
  try {
    const regionId = params?.region_id || (await getDefaultRegionId());
    const response = await sdk.store.product.list({
      q: query,
      ...params,
      fields: ensureCalculatedPriceField(params?.fields),
      ...(regionId ? { region_id: regionId } : {}),
    });
    return response.products;
  } catch (error) {
    console.error("Error searching products:", error);
    throw error;
  }
}

/**
 * Lấy danh sách regions (khu vực hỗ trợ)
 */
export async function getRegions() {
  try {
    const response = await sdk.store.region.list();
    return response.regions;
  } catch (error) {
    console.error("Error fetching regions:", error);
    throw error;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseStorefrontProfile(source: unknown): StorefrontProfile | null {
  if (!isObject(source)) {
    return null;
  }

  const metadata = isObject(source.metadata) ? source.metadata : {};
  const shopName =
    toNonEmptyString(source.shop_name) ||
    toNonEmptyString(source.name) ||
    toNonEmptyString(metadata.shop_name) ||
    toNonEmptyString(metadata.shopName);
  const shopAddress =
    toNonEmptyString(source.shop_address) ||
    toNonEmptyString(source.address) ||
    toNonEmptyString(metadata.shop_address) ||
    toNonEmptyString(metadata.shopAddress);
  const logoUrl =
    toNonEmptyString(source.logo_url) ||
    toNonEmptyString(source.logoUrl) ||
    toNonEmptyString(metadata.logo_url) ||
    toNonEmptyString(metadata.logoUrl);

  if (!shopName || !shopAddress || !logoUrl) {
    return null;
  }

  return { shopName, shopAddress, logoUrl };
}

type BranchPayload = {
  id?: string | number;
  name?: string;
  address?: string;
  image?: string;
  latitude?: number;
  longitude?: number;
  location?: {
    lat?: number;
    lng?: number;
  };
};

function mapBranchToStation(branch: BranchPayload, index: number): Station | null {
  const name = toNonEmptyString(branch.name);
  const address = toNonEmptyString(branch.address);
  if (!name || !address) {
    return null;
  }

  const lat = branch.location?.lat ?? branch.latitude;
  const lng = branch.location?.lng ?? branch.longitude;

  return {
    id:
      typeof branch.id === "number"
        ? branch.id
        : 2_000_000 + index,
    name,
    image: toNonEmptyString(branch.image) || "",
    address,
    location: {
      lat: typeof lat === "number" ? lat : 10.773756,
      lng: typeof lng === "number" ? lng : 106.689247,
    },
    source: "medusa",
  };
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parseLoyaltyProfile(source: unknown): LoyaltyProfile | null {
  if (!isObject(source)) {
    return null;
  }

  const points = toNumber(source.points);
  const expiryDate =
    toNonEmptyString(source.expiry_date) ||
    toNonEmptyString(source.expiryDate) ||
    toNonEmptyString(source.expires_at) ||
    toNonEmptyString(source.expiresAt);
  const barcodeValue =
    toNonEmptyString(source.barcode_value) ||
    toNonEmptyString(source.barcodeValue) ||
    toNonEmptyString(source.member_code) ||
    toNonEmptyString(source.memberCode) ||
    toNonEmptyString(source.code);

  if (points === undefined || !expiryDate || !barcodeValue) {
    return null;
  }

  return {
    points,
    expiryDate,
    barcodeValue,
  };
}

/**
 * Lấy thông tin branding của storefront từ Medusa.
 * Ưu tiên custom route `/store/storefront-profile`, fallback về `/store/store`.
 */
export async function getStorefrontProfile(): Promise<StorefrontProfile | null> {
  try {
    const customResponse = await sdk.client.fetch<{
      storefront?: unknown;
      profile?: unknown;
      store?: unknown;
    }>("/store/storefront-profile");
    const profile =
      parseStorefrontProfile(customResponse.storefront) ||
      parseStorefrontProfile(customResponse.profile) ||
      parseStorefrontProfile(customResponse.store);
    if (profile) {
      return profile;
    }
  } catch (error) {
    console.warn("Custom storefront profile endpoint unavailable:", error);
  }

  if (!MEDUSA_PUBLISHABLE_KEY) {
    return null;
  }

  try {
    const storeResponse = await sdk.client.fetch<{
      store?: unknown;
    }>("/store/store");
    return parseStorefrontProfile(storeResponse.store);
  } catch (error) {
    console.warn("Default store endpoint unavailable:", error);
    return null;
  }
}

/**
 * Lấy danh sách chi nhánh/kho từ custom Medusa route.
 */
export async function getStoreBranches(): Promise<Station[]> {
  try {
    const response = await sdk.client.fetch<{
      branches?: BranchPayload[];
      stations?: BranchPayload[];
      locations?: BranchPayload[];
    }>("/store/branches");
    const rows = response.branches || response.stations || response.locations || [];
    return rows
      .map(mapBranchToStation)
      .filter((station): station is Station => station !== null);
  } catch (error) {
    console.warn("Store branches endpoint unavailable:", error);
    return [];
  }
}

/**
 * Lấy điểm tích lũy thành viên cho màn hình Profile.
 */
export async function getLoyaltyProfile(): Promise<LoyaltyProfile | null> {
  try {
    const response = await sdk.client.fetch<{
      loyalty?: unknown;
      points?: unknown;
      member?: unknown;
      profile?: unknown;
      data?: unknown;
    }>("/store/loyalty-profile");
    const profile =
      parseLoyaltyProfile(response.loyalty) ||
      parseLoyaltyProfile(response.points) ||
      parseLoyaltyProfile(response.member) ||
      parseLoyaltyProfile(response.profile) ||
      parseLoyaltyProfile(response.data) ||
      parseLoyaltyProfile(response);
    return profile;
  } catch (error) {
    console.warn("Loyalty profile endpoint unavailable:", error);
    return null;
  }
}

/**
 * Xác thực khách hàng bằng access token từ Zalo Mini App.
 * Backend chịu trách nhiệm verify token với Zalo Open API và tạo/tìm customer tương ứng.
 */
export async function authenticateWithZaloAccessToken(accessToken: string) {
  try {
    const response = await sdk.client.fetch<{
      token?: string;
      jwt?: string;
      accessToken?: string;
      user?: unknown;
      customer?: unknown;
      profile?: unknown;
      id?: string;
      name?: string;
      avatar?: string;
    }>("/auth/zalo", {
      method: "POST",
      body: {
        accessToken,
      },
    });

    const authToken = response.jwt || response.token || response.accessToken;
    if (!authToken) {
      throw new Error(
        "Auth response missing token/jwt/accessToken. Cannot call user-scoped Store APIs."
      );
    }

    await sdk.client.setToken(authToken);
    if (typeof window !== "undefined") {
      localStorage.setItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN, authToken);
    }

    return response;
  } catch (error) {
    console.error("Error authenticating with Zalo access token:", error);
    throw error;
  }
}

/**
 * Khôi phục token phiên customer đã lưu để SDK gọi được các endpoint cần auth.
 */
export async function hydrateMedusaAuthFromStorage() {
  if (typeof window === "undefined") {
    return false;
  }

  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN);
  if (!token) {
    return false;
  }

  await sdk.client.setToken(token);
  return true;
}

export default sdk;
