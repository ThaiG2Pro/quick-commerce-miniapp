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
  ordersState,
  refreshCartState,
  selectedPaymentProviderIdState,
  selectedShippingOptionIdState,
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
  addShippingAddress,
  addShippingMethod,
  authenticateWithZaloAccessToken,
  completeCart,
  getCurrentCustomer,
  getCart,
  initiateCartPaymentSession,
  listCartPaymentProviders,
  transformMedusaCustomerToUserInfo,
  updateCartContact,
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

  const refreshMedusaCustomerProfile = async (baseUserInfo: UserInfo) => {
    const storedAuthToken = localStorage.getItem(CONFIG.STORAGE_KEYS.MEDUSA_AUTH_TOKEN);
    if (storedAuthToken) {
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
        console.warn("Cannot refresh Medusa customer profile from stored token:", error);
        return baseUserInfo;
      }
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return baseUserInfo;
    }

    const authResponse = await authenticateWithZaloAccessToken(accessToken);
    const normalizedUserInfo = normalizeUserInfo(
      authResponse as ZaloAuthResponse,
      baseUserInfo
    );

    localStorage.setItem(
      CONFIG.STORAGE_KEYS.USER_INFO,
      JSON.stringify(normalizedUserInfo)
    );

    return normalizedUserInfo;
  };

  return async () => {
    const userInfo = await getStoredUserInfo();
    if (!userInfo) {
      await authorize({
        scopes: ["scope.userInfo", "scope.userPhonenumber"],
      }).then(refreshPermissions);

      const accessToken = await getAccessToken();
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
    }

    try {
      return await refreshMedusaCustomerProfile(userInfo);
    } catch (error) {
      console.warn("Cannot refresh Medusa customer profile from Zalo token:", error);
      return userInfo;
    }
  };
}

export function useAddToCart(product: Product) {
  const cart = useAtomValue(cartState);
  const mutateCartItem = useSetAtom(addOrUpdateCartItemState);
  const isPending = useAtomValue(cartMutatingState);

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
        console.error("Add to cart failed:", error);
        toast.error(getCartMutationErrorMessage(error));
      }
    },
    [mutateCartItem, product]
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
  const selectedShippingOptionId = useAtomValue(selectedShippingOptionIdState);
  const shippingAddress = useAtomValue(shippingAddressState);
  const setSelectedShippingOptionId = useSetAtom(selectedShippingOptionIdState);
  const setCartPricing = useSetAtom(cartPricingState);
  const setCartError = useSetAtom(cartErrorState);
  const requestInfo = useRequestInformation();
  const navigate = useNavigate();
  const refreshNewOrders = useSetAtom(ordersState("pending"));

  return async () => {
    try {
      setCartError(null);
      if (!cartId) {
        throw new Error("Giỏ hàng chưa được khởi tạo.");
      }
      if (!cart.length) {
        throw new Error("Giỏ hàng đang trống.");
      }
      if (!shippingAddress?.address || !shippingAddress?.name || !shippingAddress?.city) {
        throw new Error("Vui lòng nhập địa chỉ nhận hàng trước khi thanh toán.");
      }

      const userInfo = await requestInfo();
      const normalizedEmail = (userInfo.email || "").trim() || `${userInfo.id}@zalo.local`;
      const normalizedPhone = (shippingAddress.phone || userInfo.phone || "").trim();
      const nameParts = (shippingAddress.name || userInfo.name || "Khách hàng")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      await updateCartContact(cartId, {
        email: normalizedEmail,
      });

      await addShippingAddress(cartId, {
        first_name: nameParts[0] || "Khach",
        last_name: nameParts.slice(1).join(" ") || "hàng",
        address_1: shippingAddress.address,
        city: shippingAddress.city,
        country_code: "vn",
        phone: normalizedPhone || undefined,
      });

      const latestCart = await getCart(cartId);
      const hasShippingMethod = (latestCart.shipping_methods?.length || 0) > 0;
      if (!hasShippingMethod) {
        if (!selectedShippingOptionId) {
          throw new Error("Vui lòng chọn phương thức vận chuyển.");
        }
        await addShippingMethod(cartId, selectedShippingOptionId);
      }

      let paymentProviderId = selectedPaymentProviderId;
      if (!paymentProviderId) {
        const providers = await listCartPaymentProviders(cartId);
        paymentProviderId = providers[0]?.id;
      }
      if (!paymentProviderId) {
        throw new Error("Không có phương thức thanh toán khả dụng.");
      }

      await initiateCartPaymentSession(cartId, paymentProviderId);
      await completeCart(cartId);

      setCart([]);
      setCartId(null);
      setSelectedShippingOptionId(null);
      setSelectedPaymentProviderId(null);
      setCartPricing(null);
      refreshNewOrders();
      navigate("/orders", {
        viewTransition: true,
      });
      toast.success("Đặt hàng thành công. Cảm ơn bạn đã mua hàng!");
    } catch (error) {
      console.warn(error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Thanh toán thất bại. Vui lòng thử lại.";
      setCartError(message);
      toast.error(message);
    }
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
