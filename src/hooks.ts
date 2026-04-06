// @ts-ignore
import medusa from "./medusa-client";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { MutableRefObject, useLayoutEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { UIMatch, useMatches, useNavigate } from "react-router-dom";
import {
  cartIdState, 
  cartState,
  cartTotalState,
  ordersState,
  userInfoKeyState,
  userInfoState,
  addToCartAtom,
  updateCartItemAtom,
  removeCartItemAtom,
  showQRState, // Đã thêm
  zaloPayQRStringState // 👉 Đã thêm biến này
} from "@/state";
import { Product } from "@/types";
import { getConfig } from "@/utils/template";
import { authorize, openChat, setStorage } from "zmp-sdk/apis";
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

// 🚀 HÀM CHECKOUT HOÀN CHỈNH CHO ZALOPAY
export function useCheckout() {
  const cartId = useAtomValue(cartIdState);
  const [cart, setCart] = useAtom(cartState);
  
  const setShowQR = useSetAtom(showQRState); 
  const setZaloPayQR = useSetAtom(zaloPayQRStringState); // 👉 Khai báo hàm để lưu chuỗi QR
  
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

      // BƯỚC 1: Cập nhật địa chỉ
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

      // BƯỚC 1.5: Ép phương thức vận chuyển
      const { shipping_options } = await medusa.shippingOptions.listCartOptions(cartId);
      if (shipping_options && shipping_options.length > 0) {
        await medusa.carts.addShippingMethod(cartId, {
          option_id: shipping_options[0].id as string, 
        });
      } else {
        toast.error("Backend chưa tạo Phí Vận Chuyển. Kêu Giang tạo lẹ!", { id: toastId });
        return; 
      }
      
      // BƯỚC 2: Set Provider là ZaloPay
      await medusa.carts.createPaymentSessions(cartId);
      await medusa.carts.setPaymentSession(cartId, {
        provider_id: "zalopay"
      });

      // BƯỚC 3: CHỐT ĐƠN VÀ LẤY CHUỖI QR TỪ BACKEND
      const { type, data } = await medusa.carts.complete(cartId);

      if (type === "order") {
        
        // 👉 Hứng chuỗi QR từ data backend trả về (Lưu ý: Tùy cấu trúc trả về của ông Giang)
        // Nếu Giang trả về data.payment_session.data.qr_code (ví dụ vậy)
        // Ở đây tui demo lưu cứng mã để ông test giao diện trước, chừng nào test API thật thì đổi lại
        const maQRGiaLap = "00020101021226530010vn.zalopay01061800050203001031817718612500414873838620010A00000072701320006970454011899ZP26096O025982170208QRIBFTTA5204739953037045405110005802VN630456DA";
        
        setZaloPayQR(maQRGiaLap); // Lưu mã QR vào State
        
        setCart(null);
        await setStorage({ data: { medusa_cart_id: "" } }); 
        refreshNewOrders();
        toast.success("Chốt đơn thành công! Quét mã nhé.", { id: toastId });
        
        setShowQR(true); // Bật Popup QR
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