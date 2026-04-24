import { useCheckout } from "@/hooks";
import {
  cartInitializingState,
  cartMutatingState,
  cartTotalState,
  paymentProvidersState,
  selectedPaymentProviderIdState,
  selectedShippingOptionIdState,
  qrCheckoutState,
} from "@/state";
import { formatPrice } from "@/utils/format";
import { useAtom, useAtomValue } from "jotai";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Button } from "zmp-ui";

function isQRProvider(provider?: { id: string; name?: string } | null) {
  if (!provider) return false;
  return /qr/i.test(`${provider.id} ${provider.name || ""}`);
}

function QRCodeDisplay({
  qrCodeUrl,
  transferAmount,
  transferContent,
  currencyCode,
  waitingConfirmation,
  onConfirmTransferred,
}: {
  qrCodeUrl: string;
  transferAmount: number;
  transferContent: string;
  currencyCode: string;
  waitingConfirmation: boolean;
  onConfirmTransferred: () => Promise<{ confirmed: boolean }>;
}) {
  const [message, setMessage] = useState("Quét mã QR để thanh toán.");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (waitingConfirmation) {
      setMessage("Chờ xác nhận thanh toán từ hệ thống.");
    }
  }, [waitingConfirmation]);

  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="text-xs text-subtitle text-center mb-2">{message}</div>
      <div className="flex justify-center bg-white p-4 rounded-lg">
        <img
          src={qrCodeUrl}
          alt="QR Code"
          className="w-[300px] h-[300px] object-contain"
          onError={() => setMessage("Không thể tải mã QR")}
        />
      </div>
      <div className="rounded-lg bg-background px-3 py-2 text-xs space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-subtitle">Số tiền cần chuyển</span>
          <span className="font-medium">{formatPrice(transferAmount, currencyCode)}</span>
        </div>
        <div className="space-y-0.5">
          <div className="text-subtitle">Nội dung chuyển khoản</div>
          <div className="font-medium break-all">{transferContent}</div>
        </div>
      </div>
      {waitingConfirmation && (
        <div className="text-xs text-primary text-center">Chờ xác nhận</div>
      )}
      <Button
        className="w-full"
        disabled={confirming}
        onClick={async () => {
          setConfirming(true);
          setMessage("Đang kiểm tra thanh toán...");
          try {
            const result = await onConfirmTransferred();
            if (!result.confirmed) {
              setMessage("Chờ xác nhận thanh toán từ hệ thống.");
            }
          } catch (error) {
            setMessage(
              error instanceof Error && error.message
                ? error.message
                : "Không thể xác nhận thanh toán."
            );
          } finally {
            setConfirming(false);
          }
        }}
      >
        {confirming ? "Đang xác minh..." : "Đã chuyển khoản"}
      </Button>
    </div>
  );
}

export default function Pay() {
  const {
    subtotalAmount,
    discountAmount,
    shippingAmount,
    totalAmount,
    currencyCode,
    shippingMethodName,
  } = useAtomValue(cartTotalState);
  const cartMutating = useAtomValue(cartMutatingState);
  const cartInitializing = useAtomValue(cartInitializingState);
  const selectedShippingOptionId = useAtomValue(selectedShippingOptionIdState);
  const selectedPaymentProviderId = useAtomValue(selectedPaymentProviderIdState);
  const providers = useAtomValue(paymentProvidersState);
  const qrCheckout = useAtomValue(qrCheckoutState);
  const { startPayment, completeQRPayment, resetQRCheckout } = useCheckout();
  const [paying, setPaying] = useState(false);

  const selectedPaymentProvider = useMemo(
    () =>
      providers.find((provider) => provider.id === selectedPaymentProviderId) ||
      providers[0] ||
      null,
    [providers, selectedPaymentProviderId]
  );

  const isQRSelected = isQRProvider(selectedPaymentProvider);
  const canRenderQRCode =
    isQRSelected &&
    qrCheckout.status === "ready" &&
    qrCheckout.qrCodeUrl !== null;

  useEffect(() => {
    if (!isQRSelected && qrCheckout.status !== "idle") {
      resetQRCheckout();
    }
  }, [isQRSelected, resetQRCheckout, qrCheckout.status]);

  return (
    <div className="flex-none bg-section">
      <div className="px-4 pt-3 pb-2">
        <div className="text-xs text-subtitle mb-2">Thanh toán</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-subtitle">Giá gốc sản phẩm</span>
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
          <div className="flex justify-between text-sm font-medium text-primary">
            <span>Tổng thanh toán</span>
            <span>{formatPrice(totalAmount, currencyCode)}</span>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="px-4 pb-2 text-xs text-subtitle">
            Đang tải phương thức thanh toán...
          </div>
        }
      >
        <PaymentProviderSelector selectedShippingOptionId={selectedShippingOptionId} />
      </Suspense>

      {qrCheckout.error && (
        <div className="px-4 pb-2 text-xs text-red-600">{qrCheckout.error}</div>
      )}

      {canRenderQRCode ? (
        <QRCodeDisplay
          qrCodeUrl={qrCheckout.qrCodeUrl!}
          transferAmount={qrCheckout.transferAmount ?? totalAmount}
          transferContent={qrCheckout.transferContent || `Thanh toan don ${qrCheckout.cartId || ""}`}
          currencyCode={qrCheckout.currencyCode || currencyCode}
          waitingConfirmation={qrCheckout.status === "waiting_confirmation"}
          onConfirmTransferred={async () => await completeQRPayment(qrCheckout.cartId)}
        />
      ) : (
        <div className="flex items-center py-2 px-4">
          <div className="flex-1" />
          <Button
            className="w-full"
            onClick={async () => {
              setPaying(true);
              try {
                await startPayment(selectedPaymentProvider);
              } catch {
                // error state handled inside the checkout hook
              } finally {
                setPaying(false);
              }
            }}
            disabled={
              paying ||
              cartMutating ||
              cartInitializing ||
              !selectedShippingOptionId ||
              !selectedPaymentProvider
            }
          >
            {paying || qrCheckout.status === "preparing"
              ? "Đang xử lý..."
              : !selectedPaymentProvider
                ? "Đang tải phương thức..."
                : selectedShippingOptionId
                  ? "Thanh toán"
                  : "Chọn ship trước"}
          </Button>
        </div>
      )}
    </div>
  );
}

function PaymentProviderSelector({
  selectedShippingOptionId,
}: {
  selectedShippingOptionId: string | null;
}) {
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
      {!selectedShippingOptionId && (
        <div className="mb-2 text-[11px] text-subtitle">
          Chọn phương thức giao hàng trước để checkout ổn định hơn.
        </div>
      )}
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
