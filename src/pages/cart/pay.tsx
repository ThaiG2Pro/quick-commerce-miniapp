import { useCheckout } from "@/hooks";
import {
  cartInitializingState,
  cartMutatingState,
  cartTotalState,
  paymentProvidersState,
  selectedPaymentProviderIdState,
  selectedShippingOptionIdState,
  stripeCheckoutState,
  qrCheckoutState,
} from "@/state";
import { formatPrice } from "@/utils/format";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useAtom, useAtomValue } from "jotai";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "zmp-ui";

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

function isStripeProvider(provider?: { id: string; name?: string } | null) {
  if (!provider) {
    return false;
  }

  return /stripe/i.test(`${provider.id} ${provider.name || ""}`);
}

function isQRProvider(provider?: { id: string; name?: string } | null) {
  if (!provider) {
    return false;
  }

  return /qr/i.test(`${provider.id} ${provider.name || ""}`);
}

function QRCodeDisplay({
  qrCodeUrl,
  onPaymentComplete,
}: {
  qrCodeUrl: string;
  onPaymentComplete: () => Promise<void>;
}) {
  const [message, setMessage] = useState("Quét mã QR để thanh toán...");
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const run = async () => {
      setMessage("Đang xác nhận thanh toán...");
      setIsCompleting(true);
      try {
        await onPaymentComplete();
      } catch (error) {
        setMessage("Lỗi: " + (error instanceof Error ? error.message : "Không xác định"));
        setIsCompleting(false);
      }
    };

    timeout = setTimeout(() => {
      run().catch(console.error);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [onPaymentComplete]);

  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="text-xs text-subtitle text-center mb-2">{message}</div>
      <div className="flex justify-center bg-white p-4 rounded-lg">
        <img
          src={qrCodeUrl}
          alt="QR Code"
          className="w-48 h-48"
          onError={() => setMessage("Không thể tải mã QR")}
        />
      </div>
      {isCompleting && (
        <div className="text-xs text-subtitle text-center">Đang xác nhận... ⏳</div>
      )}
    </div>
  );
}

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
  const selectedShippingOptionId = useAtomValue(selectedShippingOptionIdState);
  const selectedPaymentProviderId = useAtomValue(selectedPaymentProviderIdState);
  const providers = useAtomValue(paymentProvidersState);
  const stripeCheckout = useAtomValue(stripeCheckoutState);
  const qrCheckout = useAtomValue(qrCheckoutState);
  const [searchParams] = useSearchParams();
  const {
    startPayment,
    completeStripePayment,
    completeQRPayment,
    resetStripeCheckout,
    resetQRCheckout,
  } = useCheckout();
  const [paying, setPaying] = useState(false);
  const selectedPaymentProvider = useMemo(
    () =>
      providers.find((provider) => provider.id === selectedPaymentProviderId) ||
      providers[0] ||
      null,
    [providers, selectedPaymentProviderId]
  );
  const redirectClientSecret = searchParams.get("payment_intent_client_secret");
  const isStripeSelected = isStripeProvider(selectedPaymentProvider);
  const isQRSelected = isQRProvider(selectedPaymentProvider);
  const canRenderStripeForm =
    isStripeSelected &&
    stripeCheckout.status === "ready" &&
    stripeCheckout.clientSecret !== null &&
    stripeCheckout.providerId === selectedPaymentProvider?.id;
  const canRenderQRCode =
    isQRSelected &&
    qrCheckout.status === "ready" &&
    qrCheckout.qrCodeUrl !== null;
  const canHandleStripeReturn = Boolean(redirectClientSecret);

  useEffect(() => {
    if (!isStripeSelected && stripeCheckout.status !== "idle") {
      resetStripeCheckout();
    }
  }, [isStripeSelected, resetStripeCheckout, stripeCheckout.status]);

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
          <div className="text-[11px] text-subtitle">
            Medusa tính lại thuế/khuyến mãi/phí ship theo cấu hình của cửa hàng.
          </div>
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

      {stripeCheckout.error && (
        <div className="px-4 pb-2 text-xs text-red-600">{stripeCheckout.error}</div>
      )}

      {qrCheckout.error && (
        <div className="px-4 pb-2 text-xs text-red-600">{qrCheckout.error}</div>
      )}

      {canHandleStripeReturn ? (
        <StripeRedirectReturn
          clientSecret={redirectClientSecret}
          onComplete={completeStripePayment}
        />
      ) : canRenderStripeForm ? (
        <StripeCheckoutForm
          clientSecret={stripeCheckout.clientSecret}
          onComplete={completeStripePayment}
          onCancel={resetStripeCheckout}
        />
      ) : canRenderQRCode ? (
        <QRCodeDisplay
          qrCodeUrl={qrCheckout.qrCodeUrl}
          onPaymentComplete={completeQRPayment}
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
                // toast/error state handled inside the checkout hook
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
            {paying || stripeCheckout.status === "preparing" || qrCheckout.status === "preparing"
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

function StripeCheckoutForm({
  clientSecret,
  onComplete,
  onCancel,
}: {
  clientSecret: string;
  onComplete: () => Promise<void>;
  onCancel: () => void;
}) {
  if (!stripePromise) {
    return (
      <div className="px-4 pb-3 text-xs text-red-600">
        Thiếu VITE_STRIPE_PUBLISHABLE_KEY nên không thể hiển thị form Stripe.
      </div>
    );
  }

  return (
    <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
      <StripeCheckoutFormInner onComplete={onComplete} onCancel={onCancel} />
    </Elements>
  );
}

function StripeCheckoutFormInner({
  onComplete,
  onCancel,
}: {
  onComplete: () => Promise<void>;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="px-4 pb-3 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!stripe || !elements) {
          setMessage("Stripe chưa sẵn sàng. Vui lòng thử lại.");
          return;
        }

        setLoading(true);
        setMessage(null);
        try {
          console.log("[Stripe Payment] Starting confirmPayment...");
          const result = await stripe.confirmPayment({
            elements,
            confirmParams: {
              return_url: window.location.href,
            },
            redirect: "if_required",
          });

          console.log("[Stripe Payment] confirmPayment result:", {
            error: result.error?.message,
            paymentIntentStatus: result.paymentIntent?.status,
            paymentIntentId: result.paymentIntent?.id,
          });

          if (result.error) {
            console.error("[Stripe Payment] Error:", result.error.message);
            setMessage(result.error.message || "Thanh toán Stripe thất bại.");
            setLoading(false);
            return;
          }

          if (result.paymentIntent?.status === "succeeded") {
            console.log("[Stripe Payment] Payment succeeded, calling onComplete");
            await onComplete();
            return;
          }

          if (result.paymentIntent?.status) {
            console.warn(
              "[Stripe Payment] Unexpected status:",
              result.paymentIntent.status
            );
            setMessage(
              `Stripe trả về trạng thái ${result.paymentIntent.status}. Vui lòng thử lại.`
            );
            setLoading(false);
            return;
          }

          console.warn("[Stripe Payment] No payment intent returned");
          setMessage("Stripe đang xử lý thanh toán. Vui lòng chờ chuyển hướng.");
          setLoading(false);
        } catch (error) {
          const errorMessage =
            error instanceof Error && error.message
              ? error.message
              : "Thanh toán Stripe thất bại.";
          setMessage(errorMessage);
        } finally {
          setLoading(false);
        }
      }}
    >
      <PaymentElement />
      {message && <div className="text-xs text-red-600">{message}</div>}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? "Đang xác nhận..." : "Xác nhận thanh toán"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Đổi phương thức
        </Button>
      </div>
    </form>
  );
}

function StripeRedirectReturn({
  clientSecret,
  onComplete,
}: {
  clientSecret: string;
  onComplete: () => Promise<void>;
}) {
  const [message, setMessage] = useState("Đang xác minh kết quả thanh toán Stripe...");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!stripePromise) {
        throw new Error("Thiếu cấu hình Stripe publishable key.");
      }

      const stripe = await stripePromise;
      if (!stripe || cancelled) {
        return;
      }

      const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret);
      if (cancelled) {
        return;
      }

      if (error) {
        throw new Error(error.message || "Không thể xác minh thanh toán Stripe.");
      }

      if (!paymentIntent) {
        throw new Error("Không nhận được payment intent từ Stripe.");
      }

      if (paymentIntent.status !== "succeeded") {
        setMessage(`Stripe trả về trạng thái ${paymentIntent.status}.`);
        return;
      }

      await onComplete();
    };

    run().catch((error) => {
      if (cancelled) {
        return;
      }

      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Không thể hoàn tất xác minh Stripe.";
      setMessage(errorMessage);
    });

    return () => {
      cancelled = true;
    };
  }, [clientSecret, onComplete]);

  return <div className="px-4 pb-3 text-xs text-subtitle">{message}</div>;
}
