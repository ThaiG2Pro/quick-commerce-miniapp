// @ts-ignore
import medusa from "./medusa-client";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { MutableRefObject, useLayoutEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { UIMatch, useMatches, useNavigate } from "react-router-dom";
import {
  cartIdState, // Đã thêm để lấy ID giỏ hàng
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
import { authorize, openChat, setStorage } from "zmp-sdk/apis"; // Thêm setStorage để dọn giỏ hàng
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

// 🚀 HÀM CHECKOUT "ĐÁNH NHANH THẮNG NHANH" DÀNH CHO DEMO ĐỒ ÁN
// 🚀 HÀM CHECKOUT ĐÃ BỔ SUNG PHÍ SHIP
export function useCheckout() {
  const cartId = useAtomValue(cartIdState);
  const [cart, setCart] = useAtom(cartState); 
  const requestInfo = useRequestInformation();
  const navigate = useNavigate();
  const refreshNewOrders = useSetAtom(ordersState("pending"));

  return async () => {
    if (!cartId) {
      toast.error("Giỏ hàng đang trống!");
      return;
    }

    const toastId = toast.loading("Đang chốt đơn, chờ xíu nha...");

    try {
      await requestInfo();

      // BƯỚC 1: Ép thẳng địa chỉ UIT vào cho lẹ
      await medusa.carts.update(cartId, {
        email: "khachhang@uit.edu.vn",
        shipping_address: {
          first_name: "Thanh Trí",
          last_name: "Nguyễn",
          address_1: "Đại học CNTT UIT, Khu phố 6, Linh Trung, Thủ Đức",
          city: "Hồ Chí Minh",
          country_code: "vn",
          phone: "0912345678"
        }
      });

      // BƯỚC 1.5: ÉP PHƯƠNG THỨC VẬN CHUYỂN (MEDUSA BẮT BUỘC) 👇👇👇
      // BƯỚC 1.5: ÉP PHƯƠNG THỨC VẬN CHUYỂN (MEDUSA BẮT BUỘC) 👇👇👇
      const { shipping_options } = await medusa.shippingOptions.listCartOptions(cartId);
      if (shipping_options && shipping_options.length > 0) {
        // Tự động lấy cái phí ship đầu tiên gắn vào giỏ hàng
        await medusa.carts.addShippingMethod(cartId, {
          option_id: shipping_options[0].id as string, // 👉 THÊM "as string" VÀO ĐÂY LÀ HẾT ĐỎ
        });
      } else {
        toast.error("Backend chưa tạo Phí Vận Chuyển. Kêu Giang tạo lẹ!", { id: toastId });
        return; 
      }
      // BƯỚC 2: Khởi tạo phiên thanh toán & Ép xài Manual (Tiền mặt/COD)
      await medusa.carts.createPaymentSessions(cartId);
      await medusa.carts.setPaymentSession(cartId, {
        provider_id: "manual"
      });

      // BƯỚC 3: CHỐT ĐƠN! 
      const { type } = await medusa.carts.complete(cartId);

      if (type === "order") {
        setCart(null);
        await setStorage({ data: { medusa_cart_id: "" } }); 
        refreshNewOrders();
        toast.success("Chốt đơn thành công! Cảm ơn bạn.", { id: toastId });
        navigate("/orders", { viewTransition: true });
      } else {
        toast.error("Thanh toán chưa hoàn tất, vui lòng thử lại.", { id: toastId });
      }

    } catch (error) {
      console.error("Lỗi khi Checkout Medusa:", error);
      toast.error("Thanh toán thất bại. Kiểm tra lại Console!", { id: toastId });
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