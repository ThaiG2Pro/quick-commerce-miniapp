import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  MutableRefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";
import { UIMatch, useMatches, useNavigate } from "react-router-dom";
import {
  cartState,
  cartIdState,
  cartMutatingState,
  cartPricingState,
  cartErrorState,
  addOrUpdateCartItemState,
  initializeCartState,
  billingAddressState,
  ordersState,
  refreshCartState,
  selectedPaymentProviderIdState,
  selectedShippingOptionIdState,
  stripeCheckoutState,
  shippingAddressState,
  userInfoKeyState,
  userInfoState,
} from "@/state";
import { Product, UserInfo } from "@/types";
import { getConfig } from "@/utils/template";
import CONFIG from "@/config";
import { authorize, getAccessToken, getUserInfo, openChat } from "zmp-sdk/apis";
import { useAtomCallback } from "jotai/utils";
import {
  addToCart as addLineItem,
  addShippingMethod,
  clearMedusaAuthFromStorage,
  authenticateWithZaloAccessToken,
  completeCart,
  createCart,
  extractPaymentCollectionClientSecret,
  getCurrentCustomer,
  getCurrentCustomerAddress,
  getCart,
  getRegions,
  initializeCartPaymentSessions,
  listCartPaymentProviders,
  transformMedusaCustomerToUserInfo,
  upsertCurrentCustomerAddress,
  updateCartAddresses,
} from "@/lib/medusa-sdk";

type ZaloProfilePayload = {
  id?: string;
  name?: string;
  avatar?: string;
  phone?: string;
  email?: string;
  address?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
};

type ZaloAuthResponse = {
  user?: ZaloProfilePayload;
  customer?: ZaloProfilePayload;
  profile?: ZaloProfilePayload;
  id?: string;
  name?: string;
  avatar?: string;
  phone?: string;
  email?: string;
  address?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
};

function normalizeUserInfo(
  authResponse: ZaloAuthResponse,
  fallbackUserInfo: UserInfo
): UserInfo {
  const authUser: ZaloProfilePayload =
    authResponse.user ||
    authResponse.customer ||
    authResponse.profile ||
    {
      id: authResponse.id,
      name: authResponse.name,
      avatar: authResponse.avatar,
      phone: authResponse.phone,
      email: authResponse.email,
      address: authResponse.address,
      picture: authResponse.picture,
    };

  return {
    id: authUser.id || fallbackUserInfo.id,
    name: authUser.name || fallbackUserInfo.name,
    avatar: authUser.avatar || authUser.picture?.data?.url || fallbackUserInfo.avatar,
    phone: authUser.phone || fallbackUserInfo.phone,
    email: authUser.email || fallbackUserInfo.email,
    address: authUser.address || fallbackUserInfo.address,
  };
}

function getCartMutationErrorMessage(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return "Không thể cập nhật giỏ hàng";
  }
  const candidate = error as {
    status?: number;
    response?: { status?: number };
  };
  const status = candidate.status || candidate.response?.status;
  if (status === 409) return "Sản phẩm đã thay đổi tồn kho, vui lòng thử lại";
  if (status === 400) return "Dữ liệu giỏ hàng chưa hợp lệ";
  if (status === 404) return "Giỏ hàng không còn tồn tại, hãy tải lại";
  return "Không thể cập nhật giỏ hàng";
}

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

function getErrorMessageText(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (typeof error !== "object" || error === null) {
    return "";
  }

  const candidate = error as {
    message?: unknown;
    response?: {
      data?: { message?: unknown };
      message?: unknown;
    };
  };

  const directMessage = candidate.message;
  if (typeof directMessage === "string") {
    return directMessage;
  }

  const responseMessage = candidate.response?.data?.message || candidate.response?.message;
  if (typeof responseMessage === "string") {
    return responseMessage;
  }

  return "";
}

export function isIdentityRequiredError(error: unknown) {
  const status = getErrorStatusCode(error);
  if (status === 401 || status === 403) {
    return true;
  }

  const message = getErrorMessageText(error).toLowerCase();
  if (status === 400 && message.includes("customer_id")) {
    return true;
  }

  return /customer_id/i.test(message);
}

async function withSingleAuthRetry<T>(
  operation: () => Promise<T>,
  reauthenticate: () => Promise<void>
) {
  try {
    return await operation();
  } catch (error) {
    if (!isIdentityRequiredError(error)) {
      throw error;
    }
    await reauthenticate();
    return await operation();
  }
}

export function useRealHeight(
  element: MutableRefObject<HTMLDivElement | null>,
  defaultValue?: number
) {
  const [height, setHeight] = useState(defaultValue ?? 0);
  useLayoutEffect(() => {
    if (element.current && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver((entries: ResizeObserverEntry[]) => {
        const [{ contentRect }] = entries;
        setHeight(contentRect.height);
      });
      ro.observe(element.current);
      return () => ro.disconnect();
    }
    return () => {};
  }, [element.current]);

  if (typeof ResizeObserver === "undefined") {
    return -1;
  }
  return height;
}

export function useRequestInformation() {
  const getStoredUserInfo = useAtomCallback(async (get): Promise<UserInfo | undefined> => {
    const userInfo = await get(userInfoState);
    return userInfo;
  });
  const setInfoKey = useSetAtom(userInfoKeyState);
  const refreshPermissions = () => setInfoKey((key) => key + 1);

  const loginWithZalo = async () => {
    let accessToken = await getAccessToken();
    if (!accessToken) {
      await authorize({
        scopes: ["scope.userInfo", "scope.userPhonenumber"],
      });
      refreshPermissions();
      accessToken = await getAccessToken();
    }

    if (!accessToken) {
      throw new Error("Không thể lấy access token từ Zalo.");
    }

    const authResponse = await authenticateWithZaloAccessToken(accessToken);
    const refreshedUserInfo = await getStoredUserInfo();
    const fallbackUserInfo: UserInfo =
      refreshedUserInfo ||
      (await getUserInfo({}).then(({ userInfo: profile }) => ({
        id: profile.id || "",
        name: profile.name || "",
        avatar: profile.avatar || "",
        phone: "",
        email: "",
        address: "",
      })));

    const normalizedUserInfo = normalizeUserInfo(
      authResponse as ZaloAuthResponse,
      fallbackUserInfo
    );

    localStorage.setItem(
      CONFIG.STORAGE_KEYS.USER_INFO,
      JSON.stringify(normalizedUserInfo)
    );
    refreshPermissions();
    return normalizedUserInfo;
  };

  const refreshMedusaCustomerProfile = async (baseUserInfo: UserInfo) => {
    const storedAuthToken = localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN);
    if (!storedAuthToken) {
      return baseUserInfo;
    }

    try {
      const medusaCustomer = await getCurrentCustomer();
      const medusaUserInfo = transformMedusaCustomerToUserInfo(medusaCustomer);

      if (!medusaUserInfo) {
        return baseUserInfo;
      }

      const mergedUserInfo: UserInfo = {
        id: medusaUserInfo.id || baseUserInfo.id,
        name: medusaUserInfo.name || baseUserInfo.name,
        avatar: medusaUserInfo.avatar || baseUserInfo.avatar,
        phone: medusaUserInfo.phone || baseUserInfo.phone,
        email: medusaUserInfo.email || baseUserInfo.email,
        address: medusaUserInfo.address || baseUserInfo.address,
      };

      localStorage.setItem(
        CONFIG.STORAGE_KEYS.USER_INFO,
        JSON.stringify(mergedUserInfo)
      );

      return mergedUserInfo;
    } catch (error) {
      if (isIdentityRequiredError(error)) {
        await clearMedusaAuthFromStorage();
        throw error;
      }
      console.warn("Cannot refresh Medusa customer profile from stored token:", error);
      return baseUserInfo;
    }
  };

  return async () => {
    const userInfo = await getStoredUserInfo();
    const storedAuthToken = localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN);
    if (!storedAuthToken) {
      return await loginWithZalo();
    }

    if (!userInfo) {
      return await loginWithZalo();
    }

    try {
      return await refreshMedusaCustomerProfile(userInfo);
    } catch (error) {
      if (!isIdentityRequiredError(error)) {
        console.warn("Cannot refresh Medusa customer profile from Zalo token:", error);
        return userInfo;
      }
      return await loginWithZalo();
    }
  };
}

export function useHydrateCheckoutAddresses() {
  const [shippingAddress, setShippingAddress] = useAtom(shippingAddressState);
  const [billingAddress, setBillingAddress] = useAtom(billingAddressState);

  return useCallback(async () => {
    if (shippingAddress && billingAddress) {
      return {
        shippingAddress,
        billingAddress,
      };
    }

    const hasMedusaAuth = Boolean(
      localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN)
    );
    if (!hasMedusaAuth) {
      setShippingAddress(undefined);
      setBillingAddress(undefined);
      return {
        shippingAddress: undefined,
        billingAddress: undefined,
      };
    }

    const customerAddress = await getCurrentCustomerAddress();
    if (!customerAddress) {
      setShippingAddress(undefined);
      setBillingAddress(undefined);
      return {
        shippingAddress: undefined,
        billingAddress: undefined,
      };
    }

    const nextShippingAddress = customerAddress;
    const nextBillingAddress = customerAddress;

    setShippingAddress(nextShippingAddress);
    setBillingAddress(nextBillingAddress);

    return {
      shippingAddress: nextShippingAddress,
      billingAddress: nextBillingAddress,
    };
  }, [billingAddress, setBillingAddress, setShippingAddress, shippingAddress]);
}

export function useAddToCart(product: Product) {
  const cart = useAtomValue(cartState);
  const mutateCartItem = useSetAtom(addOrUpdateCartItemState);
  const isPending = useAtomValue(cartMutatingState);
  const requestInfo = useRequestInformation();

  const currentCartItem = useMemo(
    () =>
      cart.find((item) =>
        product.variantId
          ? item.product.variantId === product.variantId
          : item.product.id === product.id
      ),
    [cart, product.id, product.variantId]
  );

  const addToCart = useCallback(
    async (
      quantity: number | ((oldQuantity: number) => number),
      options?: { toast: boolean }
    ) => {
      if (!product.isPurchasable) {
        toast.error("Sản phẩm chưa có giá hợp lệ, chưa thể thêm vào giỏ hàng");
        return;
      }
      try {
        await mutateCartItem({
          product,
          quantity,
        });
        if (options?.toast) {
          toast.success("Đã thêm vào giỏ hàng");
        }
      } catch (error) {
        if (isIdentityRequiredError(error)) {
          try {
            await requestInfo();
            await mutateCartItem({
              product,
              quantity,
            });
            if (options?.toast) {
              toast.success("Đã thêm vào giỏ hàng");
            }
            return;
          } catch (retryError) {
            console.error("Add to cart failed after login retry:", retryError);
            toast.error(getCartMutationErrorMessage(retryError));
            return;
          }
        }
        console.error("Add to cart failed:", error);
        toast.error(getCartMutationErrorMessage(error));
      }
    },
    [mutateCartItem, product, requestInfo]
  );

  return {
    addToCart,
    cartQuantity: currentCartItem?.quantity ?? 0,
    isPending,
    isPurchasable: Boolean(product.isPurchasable),
  };
}

export function useInitializeCart() {
  const initializeCart = useSetAtom(initializeCartState);

  return useCallback(() => {
    initializeCart();
  }, [initializeCart]);
}

export function useRefreshCart() {
  const refreshCart = useSetAtom(refreshCartState);

  return useCallback(async () => {
    await refreshCart();
  }, [refreshCart]);
}

export function useCustomerSupport() {
  return () =>
    openChat({
      type: "oa",
      id: getConfig((config) => config.template.oaIDtoOpenChat),
    });
}

export function useToBeImplemented() {
  return () =>
    toast("Chức năng dành cho các bên tích hợp phát triển...", {
      icon: "🛠️",
    });
}

export function useCheckout() {
  const [cartId, setCartId] = useAtom(cartIdState);
  const [cart, setCart] = useAtom(cartState);
  const [selectedPaymentProviderId, setSelectedPaymentProviderId] = useAtom(
    selectedPaymentProviderIdState
  );
  const [, setStripeCheckout] = useAtom(stripeCheckoutState);
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useAtom(
    selectedShippingOptionIdState
  );
  const shippingAddress = useAtomValue(shippingAddressState);
  const billingAddress = useAtomValue(billingAddressState);
  const setCartPricing = useSetAtom(cartPricingState);
  const setCartError = useSetAtom(cartErrorState);
  const requestInfo = useRequestInformation();
  const hydrateCheckoutAddresses = useHydrateCheckoutAddresses();
  const navigate = useNavigate();
  const refreshNewOrders = useSetAtom(ordersState("pending"));

  const resetCheckoutStateAfterSuccess = useCallback(() => {
    setCartError(null);
    setCart([]);
    setCartId(null);
    setSelectedShippingOptionId(null);
    setSelectedPaymentProviderId(null);
    setStripeCheckout({
      paymentCollectionId: null,
      clientSecret: null,
      providerId: null,
      status: "idle",
      error: null,
    });
    setCartPricing(null);
    refreshNewOrders();
    navigate("/orders", {
      viewTransition: true,
    });
    toast.success("Đặt hàng thành công. Cảm ơn bạn đã mua hàng!");
  }, [
    navigate,
    refreshNewOrders,
    setCart,
    setCartId,
    setCartPricing,
    setCartError,
    setSelectedPaymentProviderId,
    setSelectedShippingOptionId,
    setStripeCheckout,
  ]);

  const ensureServerCartFromGuestCart = useCallback(
    async (currentCartId: string | null) => {
      if (currentCartId) {
        return currentCartId;
      }

      const regions = await getRegions();
      const defaultRegionId = regions[0]?.id;
      if (!defaultRegionId) {
        throw new Error(
          "No available Medusa region. Please configure at least one store region."
        );
      }

      let activeCart = await createCart(defaultRegionId);
      for (const item of cart) {
        if (!item.product.variantId || item.quantity <= 0) {
          continue;
        }
        activeCart = await addLineItem(
          activeCart.id,
          item.product.variantId,
          item.quantity
        );
      }

      setCartId(activeCart.id);
      return activeCart.id;
    },
    [cart, setCartId]
  );

  const prepareCheckout = useCallback(
    async (provider?: { id: string; name?: string }) => {
      setCartError(null);
      if (!cart.length) {
        throw new Error("Giỏ hàng đang trống.");
      }

      return await withSingleAuthRetry(
        async () => {
          const activeCartId = await ensureServerCartFromGuestCart(cartId);
          const hydratedAddresses = await hydrateCheckoutAddresses();
          const resolvedShippingAddress =
            shippingAddress || hydratedAddresses.shippingAddress;
          const resolvedBillingAddress = billingAddress || hydratedAddresses.billingAddress;

          if (
            !resolvedShippingAddress?.address ||
            !resolvedShippingAddress?.name ||
            !resolvedShippingAddress?.city ||
            !resolvedShippingAddress?.postalCode
          ) {
            throw new Error("Vui lòng nhập địa chỉ nhận hàng trước khi thanh toán.");
          }

          const savedUserInfoRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_INFO);
          let savedUserInfo: Partial<UserInfo> | undefined;
          if (savedUserInfoRaw) {
            try {
              savedUserInfo = JSON.parse(savedUserInfoRaw) as Partial<UserInfo>;
            } catch (error) {
              console.warn("Cannot parse saved user info in checkout:", error);
            }
          }
          const normalizedPhone = (
            resolvedShippingAddress.phone || savedUserInfo?.phone || ""
          ).trim();
          const normalizedName = (
            resolvedShippingAddress.name || savedUserInfo?.name || "Khách hàng"
          )
            .trim()
            .split(/\s+/)
            .filter(Boolean);

          const firstName = normalizedName[0] || "Khach";
          const lastName = normalizedName.slice(1).join(" ") || "hàng";

          const nextShippingAddress = {
            alias: resolvedShippingAddress.alias || "",
            address: resolvedShippingAddress.address,
            address2: resolvedShippingAddress.address2,
            city: resolvedShippingAddress.city,
            province: resolvedShippingAddress.province,
            postalCode: resolvedShippingAddress.postalCode,
            countryCode: resolvedShippingAddress.countryCode || "vn",
            name: `${firstName} ${lastName}`.trim(),
            phone: normalizedPhone,
          };

          const nextBillingAddress = resolvedBillingAddress
            ? {
                ...resolvedBillingAddress,
                countryCode:
                  resolvedBillingAddress.countryCode || nextShippingAddress.countryCode,
              }
            : nextShippingAddress;

          const currentCustomer = await getCurrentCustomer();
          const customerEmail =
            currentCustomer?.email?.trim() || savedUserInfo?.email?.trim() || "";
          if (!customerEmail) {
            throw new Error("Không tìm thấy email khách hàng để tiếp tục thanh toán.");
          }

          await updateCartAddresses(activeCartId, {
            shippingAddress: nextShippingAddress,
            billingAddress: nextBillingAddress,
            email: customerEmail,
          });

          let checkoutCart = await getCart(activeCartId);
          const hasShippingMethod = (checkoutCart.shipping_methods?.length || 0) > 0;
          if (!hasShippingMethod) {
            if (!selectedShippingOptionId) {
              throw new Error("Vui lòng chọn phương thức vận chuyển trước khi thanh toán.");
            }

            checkoutCart = await addShippingMethod(activeCartId, selectedShippingOptionId);
          }

          let paymentProviderId = provider?.id || selectedPaymentProviderId;
          if (!paymentProviderId) {
            const providers = await listCartPaymentProviders(
              activeCartId,
              checkoutCart.region?.id
            );
            paymentProviderId = providers[0]?.id;
          }
          if (!paymentProviderId) {
            throw new Error("Không có phương thức thanh toán khả dụng.");
          }

          // Normalize provider ID: remove 'pp_' prefix if present
          // Server might return 'pp_stripe' but expects 'stripe' in the request
          const normalizedProviderId = paymentProviderId
            .replace(/^pp_/, "")
            .toLowerCase();

          return {
            activeCartId,
            checkoutCart,
            paymentProviderId: normalizedProviderId,
            isStripeProvider:
              /stripe/i.test(`${normalizedProviderId} ${provider?.name || ""}`),
          };
        },
        async () => {
          await requestInfo();
        }
      );
    },
    [
      billingAddress,
      cart.length,
      cartId,
      ensureServerCartFromGuestCart,
      requestInfo,
      selectedPaymentProviderId,
      selectedShippingOptionId,
      shippingAddress,
      hydrateCheckoutAddresses,
      setCartError,
    ]
  );

  const startPayment = useCallback(
    async (provider?: { id: string; name?: string }) => {
      try {
        setCartError(null);
        if (!provider) {
          throw new Error("Vui lòng chọn phương thức thanh toán.");
        }

        const checkoutData = await prepareCheckout(provider);
        if (checkoutData.isStripeProvider) {
          setStripeCheckout({
            paymentCollectionId: null,
            clientSecret: null,
            providerId: checkoutData.paymentProviderId,
            status: "preparing",
            error: null,
          });

          const paymentSessionResponse = await initializeCartPaymentSessions(
            checkoutData.activeCartId,
            checkoutData.paymentProviderId
          );
          const paymentCollection = paymentSessionResponse.payment_collection || null;
          const clientSecret = extractPaymentCollectionClientSecret(
            paymentCollection,
            checkoutData.paymentProviderId
          );

          if (!clientSecret) {
            throw new Error("Không lấy được client_secret từ Stripe session.");
          }

          setStripeCheckout({
            paymentCollectionId: paymentCollection?.id || null,
            clientSecret,
            providerId: checkoutData.paymentProviderId,
            status: "ready",
            error: null,
          });

          return {
            mode: "stripe" as const,
            clientSecret,
            paymentCollectionId: paymentCollection?.id || null,
            cartId: checkoutData.activeCartId,
          };
        }

        await initializeCartPaymentSessions(
          checkoutData.activeCartId,
          checkoutData.paymentProviderId
        );
        await completeCart(checkoutData.activeCartId);
        resetCheckoutStateAfterSuccess();
        return { mode: "completed" as const };
      } catch (error) {
        console.warn(error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Thanh toán thất bại. Vui lòng thử lại.";
        setCartError(message);
        setStripeCheckout((current) => ({
          ...current,
          status: "error",
          error: message,
        }));
        toast.error(message);
        throw error;
      }
    },
    [
      completeCart,
      prepareCheckout,
      resetCheckoutStateAfterSuccess,
      setCartError,
      setStripeCheckout,
    ]
  );

  const completeStripePayment = useCallback(
    async (cartIdOverride?: string | null) => {
      try {
        const activeCartId = cartIdOverride || cartId;
        if (!activeCartId) {
          throw new Error("Giỏ hàng không còn tồn tại.");
        }

        setStripeCheckout((current) => ({
          ...current,
          status: "confirming",
          error: null,
        }));

        await completeCart(activeCartId);
        resetCheckoutStateAfterSuccess();
      } catch (error) {
        console.warn(error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Thanh toán Stripe thất bại. Vui lòng thử lại.";
        setCartError(message);
        setStripeCheckout((current) => ({
          ...current,
          status: "error",
          error: message,
        }));
        toast.error(message);
        throw error;
      }
    },
    [cartId, completeCart, resetCheckoutStateAfterSuccess, setCartError, setStripeCheckout]
  );

  const resetStripeCheckout = useCallback(() => {
    setStripeCheckout({
      paymentCollectionId: null,
      clientSecret: null,
      providerId: null,
      status: "idle",
      error: null,
    });
  }, [setStripeCheckout]);

  return {
    startPayment,
    completeStripePayment,
    resetStripeCheckout,
  };
}

export function useRouteHandle() {
  const matches = useMatches() as UIMatch<
    undefined,
    | {
        title?: string | Function;
        logo?: boolean;
        search?: boolean;
        noFooter?: boolean;
        noBack?: boolean;
        noFloatingCart?: boolean;
        scrollRestoration?: number;
      }
    | undefined
  >[];
  const lastMatch = matches[matches.length - 1];

  return [lastMatch.handle, lastMatch, matches] as const;
}
