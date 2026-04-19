import { atom } from "jotai";
import {
  atomFamily,
  atomWithRefresh,
  atomWithReset,
  atomWithStorage,
  loadable,
  unwrap,
} from "jotai/utils";
import {
  Cart,
  CartPricing,
  Category,
  Delivery,
  Location,
  Order,
  OrderStatus,
  Product,
  PaymentProviderOption,
  ShippingOption,
  ShippingAddress,
  Station,
  StorefrontProfile,
  UserInfo,
} from "@/types";
import { requestWithFallback } from "@/utils/request";
import { getConfig } from "@/utils/template";
import {
  getLocation,
  getPhoneNumber,
} from "zmp-sdk/apis";
import { calculateDistance } from "./utils/location";
import { formatDistant } from "./utils/format";
import CONFIG from "./config";
import {
  clearMedusaAuthFromStorage,
  applyPromotionCodes,
  addToCart as addLineItem,
  addShippingMethod as addCartShippingMethod,
  calculateShippingOption,
  createCart,
  getCategories,
  getCart,
  getCurrentCustomerAddress,
  getProducts,
  getRegions,
  getLoyaltyProfile,
  getStorefrontProfile,
  getOrder,
  getOrders,
  getCurrentCustomer,
  transformMedusaCustomerToUserInfo,
  hydrateMedusaAuthFromStorage,
  listCartPaymentProviders,
  listCartShippingOptions,
  removeLineItem,
  removePromotionCodes,
  updateLineItem,
  updateCartAddresses,
  updateCartContact,
  ensureGuestAuthOnBootstrap,
  getStoredGuestEmail,
} from "@/lib/medusa-sdk";
import { DEFAULT_AVATAR_URL } from "@/lib/medusa-sdk";
import {
  normalizeMockCategory,
  transformCategory,
  transformMedusaCart,
  transformMedusaCartPricing,
  transformMedusaOrders,
  transformProducts,
  filterOrdersByTab,
} from "@/lib/medusa-transformers";

const PRODUCT_QUERY_FIELDS =
  "+*variants,+*variants.options,+*variants.prices,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder,+*options,+*tags,+*type,+*categories,+*images,+*description,+*metadata";
type MedusaRegionLite = {
  id: string;
  name?: string;
  currency_code?: string;
};
const DEFAULT_STOREFRONT_PROFILE: StorefrontProfile = {
  shopName: getConfig((config) => config.template.shopName),
  shopAddress: getConfig((config) => config.template.shopAddress),
  logoUrl: getConfig((config) => config.template.logoUrl),
};

export const userInfoKeyState = atom(0);
// A simple refresh key to force re-evaluation of orders atoms after bootstrap
export const ordersRefreshKeyState = atom(0);

function readStoredUserInfo(): UserInfo | undefined {
  const savedUserInfo = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_INFO);
  if (!savedUserInfo) {
    return undefined;
  }

  try {
    return JSON.parse(savedUserInfo) as UserInfo;
  } catch (error) {
    console.warn("Cannot parse stored user info:", error);
    return undefined;
  }
}

export const userInfoState = atom<Promise<UserInfo | undefined>>(async (get) => {
  get(userInfoKeyState);
  const storedUserInfo = readStoredUserInfo();
  const hasStoredMedusaAuthToken = Boolean(
    localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN)
  );

  if (!hasStoredMedusaAuthToken) {
    return storedUserInfo;
  }

  try {
    await hydrateMedusaAuthFromStorage();
    const medusaCustomer = await getCurrentCustomer();
    const medusaUserInfo = transformMedusaCustomerToUserInfo(medusaCustomer);
    if (medusaUserInfo) {
      const mergedUserInfo: UserInfo = {
        id: storedUserInfo?.id || medusaUserInfo.id || "",
        name: storedUserInfo?.name || medusaUserInfo.name || "",
        avatar: storedUserInfo?.avatar || medusaUserInfo.avatar || DEFAULT_AVATAR_URL,
        phone: storedUserInfo?.phone || medusaUserInfo.phone || "",
        email: storedUserInfo?.email || medusaUserInfo.email || "",
        address: storedUserInfo?.address || medusaUserInfo.address || "",
      };

      localStorage.setItem(CONFIG.STORAGE_KEYS.USER_INFO, JSON.stringify(mergedUserInfo));
      return mergedUserInfo;
    }
  } catch (error) {
    if (isAuthError(error)) {
      await clearMedusaAuthFromStorage();
      return storedUserInfo;
    }
    console.warn("Cannot load Medusa customer profile from stored token:", error);
  }

  return storedUserInfo;
});

export const loadableUserInfoState = loadable(userInfoState);

export const storefrontProfileState = atom(async () => {
  const profile = await getStorefrontProfile();
  return profile || DEFAULT_STOREFRONT_PROFILE;
});

export const storefrontProfileStateUnwrapped = unwrap(
  storefrontProfileState,
  (prev) => prev ?? DEFAULT_STOREFRONT_PROFILE
);

export function createPickupCheckoutAddress(): ShippingAddress {
  return {
    alias: "Tự đến lấy",
    address: "Uit",
    address2: undefined,
    city: "Hồ Chí Minh",
    province: undefined,
    postalCode: "73000",
    countryCode: "vn",
    name: "Thái hàng",
    phone: "0566464459",
  };
}

export function createDefaultShippingAddress(): ShippingAddress {
  return {
    alias: "Địa chỉ mặc định",
    address: "Uit",
    address2: undefined,
    city: "Hồ Chí Minh",
    province: undefined,
    postalCode: "73000",
    countryCode: "vn",
    name: "Thái hàng",
    phone: "0566464459",
  };
}

export const pickupCheckoutEmail = "zalo_8563448330806889665@miniapp.local";

export const loyaltyProfileState = atom(async (get) => {
  get(userInfoKeyState);
  const profile = await getLoyaltyProfile();
  return profile;
});

export const phoneState = atom(async () => {
  let phone = "";
  try {
    await getPhoneNumber({});
    // Phía tích hợp làm theo hướng dẫn tại https://mini.zalo.me/documents/api/getPhoneNumber/ để chuyển đổi token thành số điện thoại người dùng ở server.
    // phone = await decodeToken(token);
  } catch (error) {
    console.warn(error);
  }
  return phone;
});

export const bannersState = atom(() =>
  requestWithFallback<string[]>("/banners", [])
);

export const tabsState = atom(["Tất cả", "Nam", "Nữ", "Trẻ em"]);

export const selectedTabIndexState = atom(0);

export const categoriesState = atom(async () => {
  try {
    const medusaCategories = await getCategories({
      limit: 100,
      fields: "*product_category_image,+metadata",
    });
    return medusaCategories.map(transformCategory);
  } catch (error) {
    console.error("Failed to load categories from Medusa, falling back to mock:", error);
    // Fallback to mock data if Medusa fails
    const categories = await requestWithFallback<
      { id: number; name: string; image: string }[]
    >("/categories", []);
    return categories.map(normalizeMockCategory);
  }
});

export const categoriesStateUpwrapped = unwrap(
  categoriesState,
  (prev) => prev ?? []
);

export const productsState = atom(async (get) => {
  const categories = await get(categoriesState);
  const fallbackCategory: Category = {
    id: 0,
    handle: "uncategorized",
    name: "Uncategorized",
    image: "https://via.placeholder.com/150?text=Category",
  };
  
  try {
    const medusaProducts = await getProducts({
      limit: 100,
      fields: PRODUCT_QUERY_FIELDS,
    });
    return transformProducts(medusaProducts, categories);
  } catch (error) {
    console.error("Failed to load products from Medusa, falling back to mock:", error);
    // Fallback to mock data if Medusa fails
    const products = await requestWithFallback<
      (Product & { categoryId: number })[]
    >("/products", []);
    return products.map((product) => ({
      ...product,
      category:
        categories.find(
        (category) => category.id === product.categoryId
        ) || fallbackCategory,
    }));
  }
});

export const flashSaleProductsState = atom((get) => get(productsState));

export const recommendedProductsState = atom((get) => get(productsState));

export const productState = atomFamily((id: number) =>
  atom(async (get) => {
    const products = await get(productsState);
    return products.find((product) => product.id === id);
  })
);

export const cartState = atom<Cart>([]);
export const cartPricingState = atom<CartPricing | null>(null);
export const cartIdState = atomWithStorage<string | null>(
  CONFIG.STORAGE_KEYS.CART_ID,
  null
);
export const regionsCacheState = atom<MedusaRegionLite[]>([]);
export const regionsState = atom(async (get) => {
  const cached = get(regionsCacheState);
  if (cached && cached.length) {
    return cached as MedusaRegionLite[];
  }
  const regions = (await getRegions()) as MedusaRegionLite[];
  return regions ?? [];
});
export const shippingOptionsCacheState = atom<ShippingOption[]>([]);
export const shippingOptionsCacheCartIdState = atom<string | null>(null);
export const storefrontBootstrapStatusState = atom<"idle" | "running" | "done">("idle");
export const cartInitializingState = atom(false);
export const cartMutatingState = atom(false);
export const cartPromotionMutatingState = atom(false);
export const cartErrorState = atom<string | null>(null);
export const selectedShippingOptionIdState = atomWithStorage<string | null>(
  CONFIG.STORAGE_KEYS.SHIPPING_OPTION_ID,
  null
);
export const selectedPaymentProviderIdState = atomWithStorage<string | null>(
  CONFIG.STORAGE_KEYS.PAYMENT_PROVIDER_ID,
  null
);

export type StripeCheckoutState = {
  paymentCollectionId: string | null;
  clientSecret: string | null;
  providerId: string | null;
  status: "idle" | "preparing" | "ready" | "confirming" | "waiting_confirmation" | "error";
  error: string | null;
};

export const stripeCheckoutState = atom<StripeCheckoutState>({
  paymentCollectionId: null,
  clientSecret: null,
  providerId: null,
  status: "idle",
  error: null,
});

export type QRCheckoutState = {
  qrCodeUrl: string | null;
  transferAmount: number | null;
  transferContent: string | null;
  currencyCode: string | null;
  cartId: string | null;
  status:
    | "idle"
    | "preparing"
    | "ready"
    | "confirming"
    | "waiting_confirmation"
    | "error";
  error: string | null;
};

export const qrCheckoutState = atom<QRCheckoutState>({
  qrCodeUrl: null,
  transferAmount: null,
  transferContent: null,
  currencyCode: null,
  cartId: null,
  status: "idle",
  error: null,
});

function getErrorStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const candidate = error as {
    status?: number;
    response?: { status?: number };
  };
  return candidate.status || candidate.response?.status;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  const status = getErrorStatusCode(error);
  if (status === 404) {
    return "Giỏ hàng không còn tồn tại.";
  }
  if (status === 409) {
    return "Sản phẩm đã thay đổi tồn kho. Vui lòng thử lại.";
  }
  if (status === 400) {
    return "Dữ liệu giỏ hàng chưa hợp lệ. Vui lòng kiểm tra lại.";
  }
  if (status === 500) {
    return "Dịch vụ giỏ hàng đang gặp lỗi phía máy chủ. Vui lòng thử lại sau.";
  }
  return fallbackMessage;
}

function isAuthError(error: unknown) {
  const status = getErrorStatusCode(error);
  return status === 401 || status === 403;
}

export const initializeCartState = atom(null, async (get, set) => {
  const cartId = get(cartIdState);
  if (!cartId) {
    set(cartState, []);
    set(cartPricingState, null);
    set(shippingOptionsCacheState, []);
    set(shippingOptionsCacheCartIdState, null);
    set(cartErrorState, null);
    return;
  }
  set(cartInitializingState, true);
  set(cartErrorState, null);

  try {
    if (typeof window !== "undefined") {
      console.debug("state: initializeCartState - fetching cart for cartId", { cartId });
    }
    const medusaCart = await getCart(cartId);
    if (typeof window !== "undefined") {
      console.debug("state: initializeCartState - fetched cart", { cartId, items: medusaCart.items?.length });
    }
    set(cartState, transformMedusaCart(medusaCart));
    set(cartPricingState, transformMedusaCartPricing(medusaCart));
    set(
      selectedShippingOptionIdState,
      medusaCart.shipping_methods?.[0]?.shipping_option?.id ?? null
    );
    set(shippingOptionsCacheCartIdState, cartId);
  } catch (error) {
    const status = getErrorStatusCode(error);
    if (status === 404) {
      set(cartIdState, null);
      set(cartState, []);
      set(cartPricingState, null);
      set(shippingOptionsCacheState, []);
      set(shippingOptionsCacheCartIdState, null);
      set(selectedShippingOptionIdState, null);
      set(cartErrorState, "Giỏ hàng không còn tồn tại. Đã tạo lại trạng thái giỏ.");
      return;
    }

    console.error("Failed to initialize cart from Medusa:", error);
    set(
      cartErrorState,
      getErrorMessage(error, "Không thể đồng bộ giỏ hàng từ máy chủ.")
    );
  } finally {
    set(cartInitializingState, false);
  }
});

export const refreshCartState = atom(null, async (get, set) => {
  const cartId = get(cartIdState);
  if (!cartId) {
    set(cartState, []);
    set(cartPricingState, null);
    set(shippingOptionsCacheState, []);
    set(shippingOptionsCacheCartIdState, null);
    return;
  }

  const medusaCart = await getCart(cartId);
  set(cartState, transformMedusaCart(medusaCart));
  set(cartPricingState, transformMedusaCartPricing(medusaCart));
  set(
    selectedShippingOptionIdState,
    medusaCart.shipping_methods?.[0]?.shipping_option?.id ?? null
  );
  set(shippingOptionsCacheCartIdState, cartId);
});

export const addOrUpdateCartItemState = atom(
  null,
  async (
    get,
    set,
    payload: {
      product: Product;
      quantity: number | ((oldQuantity: number) => number);
    }
  ) => {
    if (get(cartMutatingState)) {
      return;
    }

    set(cartMutatingState, true);
    set(cartErrorState, null);

    try {
      const cart = get(cartState);
      const existingItem = cart.find((item) =>
        payload.product.variantId
          ? item.product.variantId === payload.product.variantId
          : item.product.id === payload.product.id
      );

      const currentQuantity = existingItem?.quantity ?? 0;
      const newQuantity =
        typeof payload.quantity === "function"
          ? payload.quantity(currentQuantity)
          : payload.quantity;

      const hasStoredMedusaAuthToken = Boolean(
        localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN)
      );
      const existingCartId = get(cartIdState);

      // If user is unauthenticated AND we don't already have a server cart id,
      // operate in local-only mode. If a guest cartId exists (created during
      // bootstrap), continue with server-sync flow below.
      if (!hasStoredMedusaAuthToken && !existingCartId) {
        if (newQuantity <= 0) {
          set(
            cartState,
            cart.filter((item) =>
              payload.product.variantId
                ? item.product.variantId !== payload.product.variantId
                : item.product.id !== payload.product.id
            )
          );
          set(cartPricingState, null);
          return;
        }

        if (existingItem) {
          set(
            cartState,
            cart.map((item) =>
              (payload.product.variantId
                ? item.product.variantId === payload.product.variantId
                : item.product.id === payload.product.id)
                ? { ...item, quantity: newQuantity }
                : item
            )
          );
        } else {
          set(cartState, [
            ...cart,
            {
              product: payload.product,
              quantity: newQuantity,
            },
          ]);
        }
        set(cartPricingState, null);
        set(selectedShippingOptionIdState, null);
        return;
      }

      let currentCartId = get(cartIdState);
      if (!currentCartId) {
        let regions = get(regionsCacheState);
        if (!regions.length) {
          regions = await getRegions();
          set(regionsCacheState, regions as MedusaRegionLite[]);
        }
        const defaultRegionId = regions[0]?.id;
        if (!defaultRegionId) {
          throw new Error(
            "No available Medusa region. Please configure at least one store region."
          );
        }
        if (typeof window !== "undefined") {
          console.debug("state: addOrUpdateCartItemState - creating cart because none existed", { defaultRegionId });
        }
        const createdCart = await createCart(defaultRegionId);
        currentCartId = createdCart.id;
        set(cartIdState, currentCartId);
      }

      const ensuredCartId = currentCartId as string;

      let updatedCart: import("@/types").MedusaCart | undefined;
      if (newQuantity <= 0) {
        if (existingItem?.lineItemId) {
          updatedCart = (await removeLineItem(ensuredCartId, existingItem.lineItemId)) as import("@/types").MedusaCart;
        } else {
          updatedCart = (await getCart(ensuredCartId)) as import("@/types").MedusaCart;
        }
      } else if (existingItem?.lineItemId) {
        updatedCart = (await updateLineItem(
          ensuredCartId,
          existingItem.lineItemId,
          newQuantity
        )) as import("@/types").MedusaCart;
      } else {
        if (!payload.product.variantId) {
          throw new Error("Missing variantId for product, cannot add to cart.");
        }
        if (!payload.product.isPurchasable) {
          throw new Error(
            "Product is not purchasable because calculated price is missing."
          );
        }
        updatedCart = (await addLineItem(
          ensuredCartId,
          payload.product.variantId,
          newQuantity
        )) as import("@/types").MedusaCart;
      }

      if (!updatedCart) {
        updatedCart = (await getCart(ensuredCartId)) as import("@/types").MedusaCart;
      }

      set(cartState, transformMedusaCart(updatedCart));
      set(cartPricingState, transformMedusaCartPricing(updatedCart));
      set(
        selectedShippingOptionIdState,
        updatedCart.shipping_methods?.[0]?.shipping_option?.id ?? null
      );
      set(shippingOptionsCacheCartIdState, ensuredCartId);
    } catch (error) {
      console.error("Failed cart mutation:", error);
      set(
        cartErrorState,
        getErrorMessage(error, "Không thể cập nhật giỏ hàng. Vui lòng thử lại.")
      );
      throw error;
    } finally {
      set(cartMutatingState, false);
    }
  }
);

export const selectedCartItemIdsState = atom<number[]>([]);

export const cartTotalState = atom((get) => {
  const items = get(cartState);
  const pricing = get(cartPricingState);
  const itemsTotalAmount = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  return {
    totalItems: items.reduce((total, item) => total + item.quantity, 0),
    subtotalAmount: itemsTotalAmount,
    discountAmount: pricing?.discountTotal ?? 0,
    shippingAmount: pricing?.shippingTotal ?? 0,
    taxAmount: pricing?.taxTotal ?? 0,
    totalAmount: pricing?.total ?? itemsTotalAmount,
    currencyCode: pricing?.currencyCode ?? "VND",
    isTaxInclusive: Boolean(pricing?.isTaxInclusive),
    promotionCodes: pricing?.promotionCodes ?? [],
    shippingMethodName: pricing?.shippingMethodName,
  };
});



export function pickPreferredShippingOption(options: ShippingOption[]) {
  if (!options.length) {
    return null;
  }
  // Filter to shipping-type options only, sort by price (cheapest first)
  const shippingOptions = options.filter(
    (opt) => opt.fulfillment_set_type === "shipping"
  );
  if (!shippingOptions.length) {
    // Fallback to all options if no explicit type set
    return [...options].sort((a, b) => a.amount - b.amount)[0];
  }
  return [...shippingOptions].sort((a, b) => a.amount - b.amount)[0];
}

export function pickPreferredPickupOption(options: ShippingOption[]) {
  if (!options.length) {
    return null;
  }
  // Find first pickup option by fulfillment_set_type
  const pickupOption = options.find(
    (option) => option.fulfillment_set_type === "pickup"
  );
  return pickupOption ?? null;
}

function resolveFulfillmentSetType(option: {
  fulfillment_set_type?: string;
  service_zone?: { fulfillment_set?: { type?: string } };
  data?: { fulfillment_set_type?: string; type?: string };
}) {
  const rawType =
    option.fulfillment_set_type ||
    option.service_zone?.fulfillment_set?.type ||
    option.data?.fulfillment_set_type ||
    option.data?.type;

  if (rawType === "shipping" || rawType === "pickup") {
    return rawType;
  }

  return undefined;
}

async function resolveShippingOptionsForCart(cartId: string, currencyCode?: string) {
  const options = await listCartShippingOptions(cartId);
  const calculatedPrices: Array<readonly [string, number | undefined | null]> =
    await Promise.all(
    options.map(async (option) => {
      const optionPriceType = (option as { price_type?: string }).price_type;
      const optionAmount: number | undefined | null =
        (option as { amount?: number }).amount ??
        (option as { price_incl_tax?: number }).price_incl_tax ??
        (option as { price?: number }).price;
      if (optionPriceType !== "calculated") {
        return [option.id, optionAmount] as const;
      }
      try {
        const calculated = await calculateShippingOption(option.id, cartId);
        return [option.id, calculated.amount] as const;
      } catch (error) {
        console.error("Failed to calculate shipping option amount:", error);
        return [option.id, undefined] as const;
      }
    })
    );

  const amountMap = new Map<string, number | undefined | null>(calculatedPrices);

  return options
    .map((option) => {
      const amount = amountMap.get(option.id);
      if (amount == null) {
        return null;
      }
      // Resolve fulfillment type from known Medusa response shapes.
      const fulfillment_set_type = resolveFulfillmentSetType(
        option as {
          fulfillment_set_type?: string;
          service_zone?: { fulfillment_set?: { type?: string } };
          data?: { fulfillment_set_type?: string; type?: string };
        }
      );
      
      return {
        id: option.id,
        name: option.name,
        description: option.data?.description as string | undefined,
        amount,
        currencyCode,
        fulfillment_set_type,
      } satisfies ShippingOption;
    })
    .filter((option): option is ShippingOption => option !== null);
}

export const prefetchShippingOptionsState = atom(
  null,
  async (get, set, explicitCartId?: string) => {
    const cartId = explicitCartId || get(cartIdState);
    if (!cartId) {
      set(shippingOptionsCacheState, []);
      set(shippingOptionsCacheCartIdState, null);
      return [] as ShippingOption[];
    }

    const pricing = get(cartPricingState);
    const options = await resolveShippingOptionsForCart(cartId, pricing?.currencyCode);
    set(shippingOptionsCacheState, options);
    set(shippingOptionsCacheCartIdState, cartId);
    return options;
  }
);

export const bootstrapStorefrontState = atom(null, async (get, set) => {
  const status = get(storefrontBootstrapStatusState);
  if (status === "running" || status === "done") {
    return;
  }

  set(storefrontBootstrapStatusState, "running");
  try {
    // Ensure guest authentication on bootstrap
    // If no token exists, silently register and login a guest account
    await ensureGuestAuthOnBootstrap();

    // Initialize user info from Medusa customer
    try {
      const customer = await getCurrentCustomer();
      const userInfo = transformMedusaCustomerToUserInfo(customer);
      if (userInfo) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
        // Notify atoms that user info changed so UI updates immediately
        set(userInfoKeyState, (v) => (typeof v === "number" ? v + 1 : 1));
      }
    } catch (error) {
      console.warn("Failed to initialize user info during bootstrap:", error);
    }

    let regions = get(regionsCacheState);
    if (!regions.length) {
      regions = (await getRegions()) as MedusaRegionLite[];
      set(regionsCacheState, regions);
    }

    try {
      const customerAddress = await getCurrentCustomerAddress();
      if (customerAddress) {
        set(shippingAddressState, customerAddress);
        set(billingAddressState, customerAddress);
      } else {
        // Fallback to default address for guest users
        const defaultAddress = createDefaultShippingAddress();
        set(shippingAddressState, defaultAddress);
        set(billingAddressState, defaultAddress);
      }
    } catch (error) {
      console.warn("Failed to prefetch customer address during bootstrap:", error);
      // Still use default address as fallback on error
      const defaultAddress = createDefaultShippingAddress();
      set(shippingAddressState, defaultAddress);
      set(billingAddressState, defaultAddress);
    }

    try {
      await get(stationsState);
    } catch (error) {
      console.warn("Failed to prefetch stations during bootstrap:", error);
    }

    

    let cartId = get(cartIdState);

    // Always create a guest cart during bootstrap when no cartId exists.
    // Previously this only created a cart for authenticated users (token present).
    if (!cartId) {
      const defaultRegionId = regions[0]?.id;
      if (defaultRegionId) {
        try {
          const createdCart = await createCart(defaultRegionId);
          cartId = createdCart.id;
          set(cartIdState, cartId);

          // If guest email was generated during bootstrap, attach it to the cart
          try {
            const storedGuestEmail = typeof window !== "undefined" ? getStoredGuestEmail() : null;
            if (storedGuestEmail) {
              try {
                await updateCartContact(cartId as string, { email: storedGuestEmail });
              } catch (e) {
                console.warn("Failed to attach guest email to cart during bootstrap:", e);
              }
            }
          } catch (e) {
            // ignore storage access errors
          }
        } catch (error) {
          console.warn("Failed to create cart during bootstrap:", error);
        }
      }
    }

    if (cartId) {
      try {
        const medusaCart = await getCart(cartId);
        set(cartState, transformMedusaCart(medusaCart));
        set(cartPricingState, transformMedusaCartPricing(medusaCart));
        set(
          selectedShippingOptionIdState,
          medusaCart.shipping_methods?.[0]?.shipping_option?.id ?? null
        );
        // get shipping option from cart exis previous 
        try {
          await set(prefetchShippingOptionsState, cartId as string);
        } catch (prefetchError) {
          console.warn("Failed to prefetch shipping options during bootstrap:", prefetchError);
        }
      } catch (error) {
        const statusCode = getErrorStatusCode(error);
        if (statusCode === 404) {
          set(cartIdState, null);
          set(cartState, []);
          set(cartPricingState, null);
          set(selectedShippingOptionIdState, null);
          set(shippingOptionsCacheState, []);
          set(shippingOptionsCacheCartIdState, null);
        } else {
          throw error;
        }
      }
    }
    try {
      await get(paymentProvidersState);
    } catch (error) {
      console.warn("Failed to prefetch payment providers during bootstrap:", error);
    }

    set(storefrontBootstrapStatusState, "done");

    // Notify orders atoms to refresh (some runtimes may skip auto-auth)
    try {
      set(ordersRefreshKeyState, (v) => (typeof v === "number" ? v + 1 : 1));
    } catch (e) {
      // ignore
    }
  } catch (error) {
    console.error("Failed storefront bootstrap:", error);
    set(storefrontBootstrapStatusState, "idle");
  }
});

export const shippingOptionsState = atom(async (get) => {
  const cartId = get(cartIdState);
  if (!cartId) {
    return [] as ShippingOption[];
  }

  const cachedCartId = get(shippingOptionsCacheCartIdState);
  const cachedOptions = get(shippingOptionsCacheState);
  if (cachedCartId === cartId && cachedOptions.length) {
    return cachedOptions;
  }

  const pricing = get(cartPricingState);
  return await resolveShippingOptionsForCart(cartId, pricing?.currencyCode);
});

export const paymentProvidersState = atom(async (get) => {
  const cartId = get(cartIdState);
  const regions = await get(regionsState);
  const regionId = regions?.[0]?.id;
  if (!regionId && !cartId) {
    return [] as PaymentProviderOption[];
  }
  const providers = await listCartPaymentProviders(cartId ?? undefined, regionId ?? undefined);
  return providers.map((provider) => ({
    id: provider.id,
    name:
      provider.name?.trim() ||
      provider.id
        .replace(/^pp_/, "")
        .replace(/_/g, " "),
  }));
});

export const selectShippingOptionState = atom(
  null,
  async (
    get,
    set,
    shippingOptionId: string,
    payload?: {
      shippingAddress?: ShippingAddress;
      billingAddress?: ShippingAddress;
      email?: string;
    }
  ) => {
    if (get(cartMutatingState)) {
      return;
    }
    const cartId = get(cartIdState);
    if (!cartId) {
      throw new Error("Cart is not initialized.");
    }

    set(cartMutatingState, true);
    set(cartErrorState, null);
    try {
      if (payload?.shippingAddress) {
        await updateCartAddresses(cartId, {
          shippingAddress: payload.shippingAddress,
          billingAddress: payload.billingAddress || payload.shippingAddress,
          email: payload.email,
        });
      }

      const updatedCart = (await addCartShippingMethod(cartId, shippingOptionId)) as import("@/types").MedusaCart;
      set(cartState, transformMedusaCart(updatedCart));
      set(cartPricingState, transformMedusaCartPricing(updatedCart));
      set(
        selectedShippingOptionIdState,
        updatedCart.shipping_methods?.[0]?.shipping_option?.id ?? shippingOptionId
      );
    } catch (error) {
      console.error("Failed to set shipping option:", error);
      set(
        cartErrorState,
        getErrorMessage(error, "Không thể áp dụng phương thức vận chuyển.")
      );
      throw error;
    } finally {
      set(cartMutatingState, false);
    }
  }
);

export const applyPromotionCodeState = atom(
  null,
  async (get, set, promoCode: string) => {
    if (get(cartPromotionMutatingState)) {
      return;
    }

    const normalizedCode = promoCode.trim();
    if (!normalizedCode) {
      return;
    }

    const cartId = get(cartIdState);
    if (!cartId) {
      throw new Error("Cart is not initialized.");
    }

    set(cartPromotionMutatingState, true);
    set(cartErrorState, null);
    try {
      const updatedCart = (await applyPromotionCodes(cartId, [normalizedCode])) as import("@/types").MedusaCart;
      set(cartState, transformMedusaCart(updatedCart));
      set(cartPricingState, transformMedusaCartPricing(updatedCart));
      set(
        selectedShippingOptionIdState,
        updatedCart.shipping_methods?.[0]?.shipping_option?.id ?? null
      );
    } catch (error) {
      console.error("Failed to apply promotion:", error);
      set(cartErrorState, "Không thể áp dụng mã giảm giá.");
      throw error;
    } finally {
      set(cartPromotionMutatingState, false);
    }
  }
);

export const removePromotionCodeState = atom(
  null,
  async (get, set, promoCode: string) => {
    if (get(cartPromotionMutatingState)) {
      return;
    }

    const normalizedCode = promoCode.trim();
    if (!normalizedCode) {
      return;
    }

    const cartId = get(cartIdState);
    if (!cartId) {
      throw new Error("Cart is not initialized.");
    }

    set(cartPromotionMutatingState, true);
    set(cartErrorState, null);
    try {
      const updatedCart = (await removePromotionCodes(cartId, [normalizedCode])) as import("@/types").MedusaCart;
      set(cartState, transformMedusaCart(updatedCart));
      set(cartPricingState, transformMedusaCartPricing(updatedCart));
      set(
        selectedShippingOptionIdState,
        updatedCart.shipping_methods?.[0]?.shipping_option?.id ?? null
      );
    } catch (error) {
      console.error("Failed to remove promotion:", error);
      set(cartErrorState, "Không thể gỡ mã giảm giá.");
      throw error;
    } finally {
      set(cartPromotionMutatingState, false);
    }
  }
);

export const keywordState = atom("");

export const searchResultState = atom(async (get) => {
  const keyword = get(keywordState);
  const products = await get(productsState);
  if (import.meta.env.DEV) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return products.filter((product) =>
    product.name.toLowerCase().includes(keyword.toLowerCase())
  );
});

export const productsByCategoryHandleState = atomFamily((handle: string) =>
  atom(async (get) => {
    if (import.meta.env.DEV) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const categories = await get(categoriesState);
    const selectedCategory = categories.find((category) => category.handle === handle);

    if (!selectedCategory) {
      return [];
    }

    try {
      if (!selectedCategory.medusaId) {
        throw new Error("Selected category does not have medusaId");
      }

      const medusaProducts = await getProducts({
        limit: 100,
        category_id: selectedCategory.medusaId,
        fields: PRODUCT_QUERY_FIELDS,
      });

      const transformedProducts = transformProducts(medusaProducts, categories);
      return transformedProducts.map((product) => ({
        ...product,
        category:
          product.category.handle === "uncategorized"
            ? selectedCategory
            : product.category,
      }));
    } catch (error) {
      console.error(
        "Failed to load products by category from Medusa, falling back to mock:",
        error
      );

      const products = await requestWithFallback<
        (Product & { categoryId: number })[]
      >("/products", []);

      return products
        .filter((product) => product.categoryId === selectedCategory.id)
        .map((product) => ({
          ...product,
          category: selectedCategory,
        }));
    }
  })
);

export const stationsState = atom(async (get) => {
  let location: Location | undefined;
  try {
    await getLocation({});
    // Phía tích hợp làm theo hướng dẫn tại https://mini.zalo.me/documents/api/getLocation/ để chuyển đổi token thành thông tin vị trí người dùng ở server.
    // location = await decodeToken(token);
  } catch (error) {
    console.warn(error);
  }

  const mockStations = await requestWithFallback<Station[]>("/stations", []);
  const stations = mockStations.length ? mockStations : [];
  const stationsWithDistance = stations.map((station) => ({
    ...station,
    distance: location
      ? formatDistant(
          calculateDistance(
            location.lat,
            location.lng,
            station.location.lat,
            station.location.lng
          )
        )
      : undefined,
  }));

  return stationsWithDistance;
});

export const selectedStationIndexState = atom(0);

export const selectedStationState = atom(async (get) => {
  const index = get(selectedStationIndexState);
  const stations = await get(stationsState);
  return stations[index];
});

export const shippingAddressState = atomWithReset<ShippingAddress | undefined>(
  undefined
);
export const billingAddressState = atomWithReset<ShippingAddress | undefined>(
  undefined
);

export const ordersState = atomFamily((tabStatus: string) =>
  atomWithRefresh(async (get) => {
    // Re-evaluate when bootstrap status changes so orders are fetched after guest auth completes
    get(storefrontBootstrapStatusState);
    // Also re-evaluate when ordersRefreshKeyState increments
    get(ordersRefreshKeyState);

    // Debug: log token presence when ordersState runs (use console.log so visible in all consoles)
    try {
      // eslint-disable-next-line no-console
      console.log("[ordersState] medusa token present:", !!localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN));
    } catch (e) {
      // ignore storage access errors
    }

    if (!localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN)) {
      return []; 
    }

    try {
      const medusaOrders = await getOrders({
        limit: 50,
        offset: 0,
      });

      // Debug: inspect counts through the transformation pipeline
      try {
        // eslint-disable-next-line no-console
        console.log("[ordersState] medusaOrders length:", Array.isArray(medusaOrders) ? medusaOrders.length : 0);
      } catch (e) {}

      const transformedOrders = transformMedusaOrders(medusaOrders);
      try {
        // eslint-disable-next-line no-console
        console.log("[ordersState] transformedOrders length:", Array.isArray(transformedOrders) ? transformedOrders.length : 0);
      } catch (e) {}

      const filteredOrders = filterOrdersByTab(transformedOrders, tabStatus)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      try {
        // eslint-disable-next-line no-console
        console.log("[ordersState] filteredOrders length for tab", tabStatus, ":", Array.isArray(filteredOrders) ? filteredOrders.length : 0);
      } catch (e) {}

      return filteredOrders;
    } catch (error) {
      console.error("Cannot load orders from Medusa:", error);
      const statusCode = getErrorStatusCode(error);
      if (statusCode === 401 || statusCode === 403) {
        await clearMedusaAuthFromStorage();
        return [];
      }
      throw new Error("Không thể tải danh sách đơn hàng từ máy chủ.");
    }
  })
);

export const orderDetailState = atomFamily((orderId: string) =>
  atomWithRefresh(async () => {
    const normalizedOrderId = orderId.trim();
    if (!normalizedOrderId) {
      return undefined as Order | undefined;
    }

    try {
      const medusaOrder = await getOrder(normalizedOrderId);
      const transformedOrders = transformMedusaOrders([medusaOrder]);
      return transformedOrders[0];
    } catch (error) {
      console.error("Cannot load order detail from Medusa:", error);
      const statusCode = getErrorStatusCode(error);
      if (statusCode === 401 || statusCode === 403) {
        await clearMedusaAuthFromStorage();
        return undefined as Order | undefined;
      }
      if (statusCode === 404) {
        return undefined as Order | undefined;
      }
      throw new Error("Không thể tải chi tiết đơn hàng từ máy chủ.");
    }
  })
);

export const deliveryModeState = atomWithStorage<Delivery["type"]>(
  CONFIG.STORAGE_KEYS.DELIVERY,
  "pickup"
);
