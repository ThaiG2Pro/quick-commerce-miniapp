import { useAtomValue, useSetAtom } from "jotai";
import { MutableRefObject, useLayoutEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { UIMatch, useMatches, useNavigate } from "react-router-dom";
import {
  cartState,
  cartTotalState,
  ordersState,
  userInfoKeyState,
  userInfoState,
  addToCartAtom,
  updateCartItemAtom,
  removeCartItemAtom,
} from "@/state";
import { Product } from "@/types";
import { getConfig } from "@/utils/template";
import { authorize, createOrder, openChat } from "zmp-sdk/apis";
import { useAtomCallback } from "jotai/utils";

export function useRealHeight(
  element: MutableRefObject<HTMLDivElement | null>,
  defaultValue?: number,
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
  const getStoredUserInfo = useAtomCallback(async (get) => {
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
      return await getStoredUserInfo();
    }
    return userInfo;
  };
}

export function useAddToCart(product: Product) {
  const cart = useAtomValue(cartState);
  
  const add = useSetAtom(addToCartAtom);
  const update = useSetAtom(updateCartItemAtom);
  const remove = useSetAtom(removeCartItemAtom);

  const currentCartItem = useMemo(
    () => cart?.items?.find((item: any) => item.title === product.name || item.variant?.product_id === product.id),
    [cart, product.id, product.name],
  );

  const addToCart = async (
    quantity: number | ((oldQuantity: number) => number),
    options?: { toast: boolean },
  ) => {
    const oldQuantity = currentCartItem?.quantity ?? 0;
    const newQuantity = typeof quantity === "function" ? quantity(oldQuantity) : quantity;

    try {
      if (newQuantity <= 0) {
        if (currentCartItem) await remove(currentCartItem.id);
      } else {
        if (currentCartItem) {
          await update({ lineId: currentCartItem.id, quantity: newQuantity });
        } else {
          // FIX TRỌNG TÂM LÀ Ở ĐÂY 👇
          await add({ variantId: (product as any).variantId, quantity: newQuantity });
        }
      }

      if (options?.toast) {
        toast.success("Đã cập nhật giỏ hàng");
      }
    } catch (error) {
      toast.error("Có lỗi khi cập nhật giỏ hàng!");
      console.error(error);
    }
  };

  return { addToCart, cartQuantity: currentCartItem?.quantity ?? 0 };
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
  const cart = useAtomValue(cartState); 
  const requestInfo = useRequestInformation();
  const navigate = useNavigate();
  const refreshNewOrders = useSetAtom(ordersState("pending"));

  return async () => {
    try {
      await requestInfo();
      await createOrder({
        amount: totalAmount,
        desc: "Thanh toán đơn hàng",
        item: cart?.items?.map((item: any) => ({
          id: item.id,
          name: item.title,
          price: item.unit_price,
          quantity: item.quantity,
        })) || [],
      });
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
        "Thanh toán thất bại. Vui lòng kiểm tra nội dung lỗi bên trong Console.",
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