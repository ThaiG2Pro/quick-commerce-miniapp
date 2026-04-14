import { useCheckout } from "@/hooks";
import { useAtom, useAtomValue } from "jotai";
import {
  cartInitializingState,
  cartMutatingState,
  cartTotalState,
  paymentProvidersState,
  selectedPaymentProviderIdState,
} from "@/state";
import { formatPrice } from "@/utils/format";
import { Button } from "zmp-ui";
import { Suspense, useEffect, useMemo, useState } from "react";

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
      <Suspense
        fallback={<div className="px-4 pb-2 text-xs text-subtitle">Đang tải phương thức thanh toán...</div>}
      >
        <PaymentProviderSelector />
      </Suspense>
      <div className="flex items-center py-2 px-4">
        <div className="flex-1" />
        <Button
          className="w-full"
          onClick={async () => {
            setPaying(true);
            try {
              await checkout();
            } finally {
              setPaying(false);
            }
          }}
          disabled={paying || cartMutating || cartInitializing}
        >
          {paying ? "Đang xử lý..." : "Thanh toán"}
        </Button>
      </div>
    </div>
  );
}

function PaymentProviderSelector() {
  const providers = useAtomValue(paymentProvidersState);
  const [selectedPaymentProviderId, setSelectedPaymentProviderId] = useAtom(
    selectedPaymentProviderIdState
  );

  const effectiveSelectedId = useMemo(() => {
    if (
      selectedPaymentProviderId &&
      providers.some((provider) => provider.id === selectedPaymentProviderId)
    ) {
      return selectedPaymentProviderId;
    }
    return providers[0]?.id || null;
  }, [providers, selectedPaymentProviderId]);

  useEffect(() => {
    if (!effectiveSelectedId || selectedPaymentProviderId === effectiveSelectedId) {
      return;
    }
    setSelectedPaymentProviderId(effectiveSelectedId);
  }, [effectiveSelectedId, selectedPaymentProviderId, setSelectedPaymentProviderId]);

  if (!providers.length) {
    return (
      <div className="px-4 pb-2 text-xs text-subtitle">
        Chưa có phương thức thanh toán khả dụng.
      </div>
    );
  }

  return (
    <div className="px-4 pb-2">
      <div className="text-xs text-subtitle mb-2">Phương thức thanh toán</div>
      <div className="space-y-2">
        {providers.map((provider) => {
          const isSelected = provider.id === effectiveSelectedId;
          return (
            <button
              key={provider.id}
              className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${
                isSelected ? "border-primary bg-primary/5" : "border-black/10"
              }`}
              onClick={() => setSelectedPaymentProviderId(provider.id)}
            >
              {provider.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
