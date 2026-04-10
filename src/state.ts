import { atom } from "jotai";
import {
  atomFamily,
  atomWithRefresh,
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
  getSetting,
  getUserInfo,
} from "zmp-sdk/apis";
import { calculateDistance } from "./utils/location";
import { formatDistant } from "./utils/format";
import CONFIG from "./config";
import {
  applyPromotionCodes,
  addToCart as addLineItem,
  addShippingMethod as addCartShippingMethod,
  calculateShippingOption,
  createCart,
  getCategories,
  getCart,
  getProducts,
  getRegions,
  getStoreBranches,
  getStorefrontProfile,
  listCartShippingOptions,
  removeLineItem,
  removePromotionCodes,
  updateLineItem,
} from "@/lib/medusa-sdk";
import {
  normalizeMockCategory,
  transformCategory,
  transformMedusaCart,
  transformMedusaCartPricing,
  transformProducts,
} from "@/lib/medusa-transformers";

const PRODUCT_QUERY_FIELDS =
  "+*variants,+*variants.options,+*variants.prices,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder,+*options,+*tags,+*type,+*categories,+*images,+*description,+*metadata";
const DEFAULT_STOREFRONT_PROFILE: StorefrontProfile = {
  shopName: getConfig((config) => config.template.shopName),
  shopAddress: getConfig((config) => config.template.shopAddress),
  logoUrl: getConfig((config) => config.template.logoUrl),
};

export const userInfoKeyState = atom(0);

export const userInfoState = atom<Promise<UserInfo>>(async (get) => {
  get(userInfoKeyState);

  // Nếu người dùng đã chỉnh sửa thông tin tài khoản trước đó, sử dụng thông tin đã lưu trữ
  const savedUserInfo = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_INFO);
  // Phía tích hợp có thể thay đổi logic này thành fetch từ server
  // const savedUserInfo = await fetchUserInfo({ token: await getAccessToken() });
  if (savedUserInfo) {
    return JSON.parse(savedUserInfo);
  }

  const {
    authSetting: {
      "scope.userInfo": grantedUserInfo,
      "scope.userPhonenumber": grantedPhoneNumber,
    },
  } = await getSetting({});
  const isDev = !window.ZJSBridge;
  if (grantedUserInfo || isDev) {
    // Người dùng cho phép truy cập tên và ảnh đại diện
    const { userInfo } = await getUserInfo({});
    const phone =
      grantedPhoneNumber || isDev // Người dùng cho phép truy cập số điện thoại
        ? await get(phoneState)
        : "";
    return {
      id: userInfo.id,
      name: userInfo.name,
      avatar: userInfo.avatar,
      phone,
      email: "",
      address: "",
    };
  }
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
    const medusaCategories = await getCategories({ limit: 100 });
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
      category: categories.find(
        (category) => category.id === product.categoryId
      )!,
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
export const cartInitializingState = atom(false);
export const cartMutatingState = atom(false);
export const cartPromotionMutatingState = atom(false);
export const cartErrorState = atom<string | null>(null);
export const selectedShippingOptionIdState = atomWithStorage<string | null>(
  CONFIG.STORAGE_KEYS.SHIPPING_OPTION_ID,
  null
);

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

export const initializeCartState = atom(null, async (get, set) => {
  const cartId = get(cartIdState);
  if (!cartId) {
    set(cartState, []);
    set(cartPricingState, null);
    set(cartErrorState, null);
    return;
  }

  set(cartInitializingState, true);
  set(cartErrorState, null);

  try {
    const medusaCart = await getCart(cartId);
    set(cartState, transformMedusaCart(medusaCart));
    set(cartPricingState, transformMedusaCartPricing(medusaCart));
    set(
      selectedShippingOptionIdState,
      medusaCart.shipping_methods?.[0]?.shipping_option?.id ?? null
    );
  } catch (error) {
    const status = getErrorStatusCode(error);
    if (status === 404) {
      set(cartIdState, null);
      set(cartState, []);
      set(cartPricingState, null);
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
    return;
  }

  const medusaCart = await getCart(cartId);
  set(cartState, transformMedusaCart(medusaCart));
  set(cartPricingState, transformMedusaCartPricing(medusaCart));
  set(
    selectedShippingOptionIdState,
    medusaCart.shipping_methods?.[0]?.shipping_option?.id ?? null
  );
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

      let currentCartId = get(cartIdState);
      if (!currentCartId) {
        const regions = await getRegions();
        const defaultRegionId = regions[0]?.id;
        if (!defaultRegionId) {
          throw new Error(
            "No available Medusa region. Please configure at least one store region."
          );
        }
        const createdCart = await createCart(defaultRegionId);
        currentCartId = createdCart.id;
        set(cartIdState, currentCartId);
      }

      let updatedCart;
      if (newQuantity <= 0) {
        if (existingItem?.lineItemId) {
          updatedCart = await removeLineItem(currentCartId, existingItem.lineItemId);
        } else {
          updatedCart = await getCart(currentCartId);
        }
      } else if (existingItem?.lineItemId) {
        updatedCart = await updateLineItem(
          currentCartId,
          existingItem.lineItemId,
          newQuantity
        );
      } else {
        if (!payload.product.variantId) {
          throw new Error("Missing variantId for product, cannot add to cart.");
        }
        if (!payload.product.isPurchasable) {
          throw new Error(
            "Product is not purchasable because calculated price is missing."
          );
        }
        updatedCart = await addLineItem(
          currentCartId,
          payload.product.variantId,
          newQuantity
        );
      }

      if (!updatedCart) {
        updatedCart = await getCart(currentCartId);
      }

      set(cartState, transformMedusaCart(updatedCart));
      set(cartPricingState, transformMedusaCartPricing(updatedCart));
      set(
        selectedShippingOptionIdState,
        updatedCart.shipping_methods?.[0]?.shipping_option?.id ?? null
      );
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
  const fallbackTotalAmount = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  return {
    totalItems: items.reduce((total, item) => total + item.quantity, 0),
    subtotalAmount: pricing?.subtotal ?? fallbackTotalAmount,
    discountAmount: pricing?.discountTotal ?? 0,
    shippingAmount: pricing?.shippingTotal ?? 0,
    taxAmount: pricing?.taxTotal ?? 0,
    totalAmount: pricing?.total ?? fallbackTotalAmount,
    currencyCode: pricing?.currencyCode ?? "VND",
    isTaxInclusive: Boolean(pricing?.isTaxInclusive),
    promotionCodes: pricing?.promotionCodes ?? [],
    shippingMethodName: pricing?.shippingMethodName,
  };
});

export const shippingOptionsState = atom(async (get) => {
  const cartId = get(cartIdState);
  const pricing = get(cartPricingState);
  if (!cartId) {
    return [] as ShippingOption[];
  }

  const options = await listCartShippingOptions(cartId);
  const calculatedPrices = await Promise.all(
    options.map(async (option) => {
      if (option.price_type !== "calculated") {
        return [option.id, option.amount] as const;
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

  const amountMap = new Map(calculatedPrices);
  const currencyCode = pricing?.currencyCode;

  return options
    .map((option) => {
      const amount = amountMap.get(option.id);
      if (amount === undefined) {
        return null;
      }
      return {
        id: option.id,
        name: option.name,
        description: option.data?.description as string | undefined,
        amount,
        currencyCode,
      } satisfies ShippingOption;
    })
    .filter((option): option is ShippingOption => option !== null);
});

export const selectShippingOptionState = atom(
  null,
  async (get, set, shippingOptionId: string) => {
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
      const updatedCart = await addCartShippingMethod(cartId, shippingOptionId);
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
      const updatedCart = await applyPromotionCodes(cartId, [normalizedCode]);
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
      const updatedCart = await removePromotionCodes(cartId, [normalizedCode]);
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
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return products.filter((product) =>
    product.name.toLowerCase().includes(keyword.toLowerCase())
  );
});

export const productsByCategoryHandleState = atomFamily((handle: string) =>
  atom(async (get) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));

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
  const branchStations = await getStoreBranches();
  const cartId = get(cartIdState);
  const medusaShippingOptions = cartId
    ? await (async () => {
        try {
          return await listCartShippingOptions(cartId);
        } catch (error) {
          console.warn("Cannot load location source from Medusa shipping options:", error);
          return [];
        }
      })()
    : [];

  const medusaStations = medusaShippingOptions.map((option, index) => ({
    id: index + 1_000_000,
    name: option.name,
    image: "",
    address: "Nguồn từ Medusa shipping options",
    location: {
      lat: location?.lat ?? 10.773756,
      lng: location?.lng ?? 106.689247,
    },
    source: "medusa" as const,
  }));

  const stations = branchStations.length
    ? branchStations
    : medusaStations.length
      ? medusaStations
      : mockStations;
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

export const shippingAddressState = atomWithStorage<
  ShippingAddress | undefined
>(CONFIG.STORAGE_KEYS.SHIPPING_ADDRESS, undefined);

export const ordersState = atomFamily((status: OrderStatus) =>
  atomWithRefresh(async () => {
    // Phía tích hợp thay đổi logic filter server-side nếu cần:
    // const serverSideFilteredData = await requestWithFallback<Order[]>(`/orders?status=${status}`, []);
    const allMockOrders = await requestWithFallback<Order[]>("/orders", []);
    const clientSideFilteredData = allMockOrders.filter(
      (order) => order.status === status
    );
    return clientSideFilteredData;
  })
);

export const deliveryModeState = atomWithStorage<Delivery["type"]>(
  CONFIG.STORAGE_KEYS.DELIVERY,
  "shipping"
);
