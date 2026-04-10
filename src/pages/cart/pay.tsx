import { useCheckout } from "@/hooks";
import { useAtomValue } from "jotai";
import { cartInitializingState, cartMutatingState, cartTotalState } from "@/state";
import { formatPrice } from "@/utils/format";
import { Button } from "zmp-ui";
import { useState } from "react";

export default function Pay() {
  const {
    subtotalAmount,
    discountAmount,
    shippingAmount,
    taxAmount,
    totalAmount,
    currencyCode,
    isTaxInclusive,
    shippingMethodName,
  } = useAtomValue(cartTotalState);
  const cartMutating = useAtomValue(cartMutatingState);
  const cartInitializing = useAtomValue(cartInitializingState);
  const checkout = useCheckout();
  const [paying, setPaying] = useState(false);

  return (
    <div className="flex-none bg-section">
      <div className="px-4 pt-3 pb-2">
        <div className="text-xs text-subtitle mb-2">Thanh toán</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-subtitle">Tạm tính</span>
            <span>{formatPrice(subtotalAmount, currencyCode)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-subtitle">Giảm giá</span>
            <span>- {formatPrice(discountAmount, currencyCode)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-subtitle">Phí vận chuyển</span>
            <span>{formatPrice(shippingAmount, currencyCode)}</span>
          </div>
          {shippingMethodName && (
            <div className="text-[11px] text-subtitle text-right -mt-1">
              Phương thức: {shippingMethodName}
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-subtitle">Thuế</span>
            <span>{formatPrice(taxAmount, currencyCode)}</span>
          </div>
          {isTaxInclusive && taxAmount > 0 && (
            <div className="text-[11px] text-subtitle text-right">
              Đã bao gồm {formatPrice(taxAmount, currencyCode)} tiền thuế VAT
            </div>
          )}
          {!isTaxInclusive && taxAmount > 0 && (
            <div className="text-[11px] text-subtitle text-right">
              Thuế được tính theo cấu hình khu vực và phương thức giao hàng.
            </div>
          )}
          <div className="h-px bg-black/10 my-1" />
          <div className="flex justify-between text-sm font-medium text-primary">
            <span>Tổng thanh toán</span>
            <span>{formatPrice(totalAmount, currencyCode)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center py-2 px-4">
        <div className="flex-1" />
        <Button
          className="w-full"
          onClick={async () => {
            setPaying(true);
            await checkout();
            setPaying(false);
          }}
          disabled={paying || cartMutating || cartInitializing}
        >
          {paying ? "Đang xử lý..." : "Thanh toán"}
        </Button>
      </div>
    </div>
  );
}
