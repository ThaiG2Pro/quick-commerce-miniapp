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

// Feature flag: show/hide tax explanatory text
const SHOW_TAX_EXPLANATION = import.meta.env.VITE_SHOW_TAX_EXPLANATION === "true";

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
        <div className="text-xs text-primary text-center">
          Chờ xác nhận
        </div>
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

      {stripeCheckout.status === "waiting_confirmation" && (
        <div className="px-4 pb-2 text-xs text-subtitle">
          Stripe đã xác nhận thanh toán, đang chờ hệ thống hoàn tất đơn hàng.
        </div>
      )}

      {qrCheckout.error && (
        <div className="px-4 pb-2 text-xs text-red-600">{qrCheckout.error}</div>
      )}

      {canHandleStripeReturn ? (
        <StripeRedirectReturn
          clientSecret={redirectClientSecret!}
          onComplete={completeStripePayment}
        />
      ) : canRenderStripeForm ? (
        <StripeCheckoutForm
          clientSecret={stripeCheckout.clientSecret!}
          onComplete={completeStripePayment}
          onCancel={resetStripeCheckout}
        />
      ) : canRenderQRCode ? (
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
                // toast/error state handled inside the checkout hook
              } finally {
                setPaying(false);
              }
            }}
              disabled={
                paying ||
                cartMutating ||
                cartInitializing ||
                stripeCheckout.status === "waiting_confirmation" ||
                !selectedShippingOptionId ||
                !selectedPaymentProvider
              }
            >
            {paying ||
            stripeCheckout.status === "preparing" ||
            qrCheckout.status === "preparing"
              ? "Đang xử lý..."
              : stripeCheckout.status === "waiting_confirmation"
                ? "Đang chờ xác nhận..."
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
  onComplete: (cartIdOverride?: string | null, paymentIntentStatus?: string) => Promise<void>;
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
  onComplete: (cartIdOverride?: string | null, paymentIntentStatus?: string) => Promise<void>;
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

          if (
            result.paymentIntent?.status === "succeeded" ||
            result.paymentIntent?.status === "requires_capture"
          ) {
            const status = result.paymentIntent.status;
            console.log("[Stripe Payment] Payment confirmed, calling onComplete", status);
            setMessage(
              status === "requires_capture"
                ? "Stripe đã xác nhận thanh toán, đang hoàn tất đơn hàng..."
                : "Thanh toán thành công, đang hoàn tất đơn hàng..."
            );
            await onComplete(undefined, status);
            return;
          }

          if (result.paymentIntent?.status === "processing") {
            setMessage("Stripe đang xử lý thanh toán. Vui lòng chờ.");
            setLoading(false);
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
        <Button htmlType="submit" className="flex-1" disabled={loading}>
          {loading ? "Đang xác nhận..." : "Xác nhận thanh toán"}
        </Button>
        <Button htmlType="button" variant="secondary" onClick={onCancel} disabled={loading}>
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
  onComplete: (cartIdOverride?: string | null, paymentIntentStatus?: string) => Promise<void>;
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

      if (
        paymentIntent.status !== "succeeded" &&
        paymentIntent.status !== "requires_capture"
      ) {
        setMessage(`Stripe trả về trạng thái ${paymentIntent.status}.`);
        return;
      }

      setMessage(
        paymentIntent.status === "requires_capture"
          ? "Stripe đã xác nhận thanh toán, đang hoàn tất đơn hàng..."
          : "Thanh toán thành công, đang hoàn tất đơn hàng..."
      );
      await onComplete(undefined, paymentIntent.status);
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
