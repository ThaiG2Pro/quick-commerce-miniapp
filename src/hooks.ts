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
  cartTotalState,
  addOrUpdateCartItemState,
  initializeCartState,
  ordersState,
  refreshCartState,
  selectedShippingOptionIdState,
  userInfoKeyState,
  userInfoState,
} from "@/state";
import { Product, UserInfo } from "@/types";
import { getConfig } from "@/utils/template";
import CONFIG from "@/config";
import { authorize, createOrder, getAccessToken, getUserInfo, openChat } from "zmp-sdk/apis";
import { useAtomCallback } from "jotai/utils";
import { authenticateWithZaloAccessToken } from "@/lib/medusa-sdk";

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
};

function normalizeUserInfo(
  authResponse: ZaloAuthResponse,
  fallbackUserInfo: UserInfo
): UserInfo {
  const authUser =
    authResponse.user ||
    authResponse.customer ||
    authResponse.profile ||
    authResponse;

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

  return async () => {
    const userInfo = await getStoredUserInfo();
    if (!userInfo) {
      await authorize({
        scopes: ["scope.userInfo", "scope.userPhonenumber"],
      }).then(refreshPermissions);

      const accessToken = await getAccessToken();
      const authResponse = await authenticateWithZaloAccessToken(accessToken);
      const refreshedUserInfo = await getStoredUserInfo();
      const fallbackUserInfo =
        refreshedUserInfo ||
        (await getUserInfo({}).then(({ userInfo: profile }) => ({
          id: profile.id,
          name: profile.name,
          avatar: profile.avatar,
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
    return userInfo;
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
  const { totalAmount } = useAtomValue(cartTotalState);
  const [cart, setCart] = useAtom(cartState);
  const [, setCartId] = useAtom(cartIdState);
  const setSelectedShippingOptionId = useSetAtom(selectedShippingOptionIdState);
  const setCartPricing = useSetAtom(cartPricingState);
  const requestInfo = useRequestInformation();
  const navigate = useNavigate();
  const refreshNewOrders = useSetAtom(ordersState("pending"));

  return async () => {
    try {
      await requestInfo();
      await createOrder({
        amount: totalAmount,
        desc: "Thanh toán đơn hàng",
        item: cart.map((item) => ({
          id: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
        })),
      });
      setCart([]);
      setCartId(null);
      setSelectedShippingOptionId(null);
      setCartPricing(null);
      refreshNewOrders();
      navigate("/orders", {
        viewTransition: true,
      });
      toast.success("Thanh toán thành công. Cảm ơn bạn đã mua hàng!", {
        icon: "🎉",
        duration: 5000,
      });
    } catch (error) {
      console.warn(error);
      toast.error(
        "Thanh toán thất bại. Vui lòng kiểm tra nội dung lỗi bên trong Console."
      );
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
