import CartList from "./cart-list";
import ApplyVoucher from "./apply-voucher";
import CartSummary from "./cart-summary";
import { useAtomValue, useSetAtom } from "jotai";
import { cartErrorState, cartInitializingState, cartState, shippingAddressState, billingAddressState } from "@/state";
import { useRefreshCart } from "@/hooks";
import { EmptyCart } from "@/components/empty";
import Delivery from "./delivery";
import HorizontalDivider from "@/components/horizontal-divider";
import Pay from "./pay";
import { Button } from "zmp-ui";
import { useState, useEffect } from "react";
import { getCurrentCustomerAddress } from "@/lib/medusa-sdk";

export default function CartPage() {
  const cart = useAtomValue(cartState);
  const cartInitializing = useAtomValue(cartInitializingState);
  const cartError = useAtomValue(cartErrorState);
  const refreshCart = useRefreshCart();
  const [refreshing, setRefreshing] = useState(false);
  const setShippingAddress = useSetAtom(shippingAddressState);
  const setBillingAddress = useSetAtom(billingAddressState);

  // Refresh customer address on cart page entry (Bước 8: fetch customer address từ server)
  useEffect(() => {
    let mounted = true;

    const refreshAddress = async () => {
      try {
        const customerAddress = await getCurrentCustomerAddress();
        if (mounted && customerAddress) {
          setShippingAddress(customerAddress);
          setBillingAddress(customerAddress);
        }
      } catch (error) {
        console.warn("Failed to refresh address on cart entry:", error);
        // Keep existing address as fallback
      }
    };

    refreshAddress();

    return () => {
      mounted = false;
    };
  }, [setShippingAddress, setBillingAddress]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshCart();
    setRefreshing(false);
  };

  if (cartInitializing) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-subtitle">
        Đang tải giỏ hàng...
      </div>
    );
  }

  if (!cart.length) {
    return (
      <div className="w-full h-full">
        {cartError && (
          <div className="m-4 px-3 py-2 rounded-lg text-xs bg-danger/10 text-danger">
            <div>{cartError}</div>
            <Button
              size="small"
              variant="tertiary"
              className="mt-2"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? "Đang tải lại..." : "Thử tải lại giỏ hàng"}
            </Button>
          </div>
        )}
        <EmptyCart />
      </div>
    );
  }
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {cartError && (
          <div className="px-3 py-2 rounded-lg text-xs bg-danger/10 text-danger">
            <div>{cartError}</div>
            <Button
              size="small"
              variant="tertiary"
              className="mt-2"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? "Đang tải lại..." : "Thử tải lại giỏ hàng"}
            </Button>
          </div>
        )}
        <Delivery />
        <CartList />
        <ApplyVoucher />
        <CartSummary />
      </div>
      <HorizontalDivider />
      <Pay />
    </div>
  );
}
