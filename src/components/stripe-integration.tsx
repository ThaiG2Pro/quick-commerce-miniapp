import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "zmp-ui";

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

export function StripeCheckoutFormWrapper({ clientSecret, onComplete, onCancel }: any) {
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

function StripeCheckoutFormInner({ onComplete, onCancel }: any) {
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
          const result: any = await stripe.confirmPayment({
            elements,
            confirmParams: {
              return_url: window.location.href,
            },
            redirect: "if_required",
          });

          if (result.error) {
            setMessage(result.error.message || "Thanh toán Stripe thất bại.");
            setLoading(false);
            return;
          }

          if (
            result.paymentIntent?.status === "succeeded" ||
            result.paymentIntent?.status === "requires_capture"
          ) {
            const status = result.paymentIntent.status;
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

          setMessage("Stripe đang xử lý thanh toán. Vui lòng chờ chuyển hướng.");
          setLoading(false);
        } catch (error) {
          const errorMessage = error instanceof Error && error.message ? error.message : "Thanh toán Stripe thất bại.";
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

export function StripeRedirectReturnWrapper({ clientSecret, onComplete }: any) {
  const [message, setMessage] = useState("Đang xác minh kết quả thanh toán Stripe...");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!stripePromise) {
        throw new Error("Thiếu cấu hình Stripe publishable key.");
      }

      const stripe = await stripePromise;
      if (!stripe || cancelled) return;

      const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret);
      if (cancelled) return;

      if (error) throw new Error(error.message || "Không thể xác minh thanh toán Stripe.");
      if (!paymentIntent) throw new Error("Không nhận được payment intent từ Stripe.");

      if (paymentIntent.status !== "succeeded" && paymentIntent.status !== "requires_capture") {
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
      if (cancelled) return;
      const errorMessage = error instanceof Error && error.message ? error.message : "Không thể hoàn tất xác minh Stripe.";
      setMessage(errorMessage);
    });

    return () => {
      cancelled = true;
    };
  }, [clientSecret, onComplete]);

  return <div className="px-4 pb-3 text-xs text-subtitle">{message}</div>;
}
