import Section from "@/components/section";
import { VoucherIcon } from "@/components/vectors";
import {
  applyPromotionCodeState,
  cartPromotionMutatingState,
  cartTotalState,
  removePromotionCodeState,
} from "@/state";
import { isIdentityRequiredError, useRequestInformation } from "@/hooks";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import toast from "react-hot-toast";
import { Icon } from "zmp-ui";

export default function ApplyVoucher() {
  const [promoCode, setPromoCode] = useState("");
  const { promotionCodes } = useAtomValue(cartTotalState);
  const promotionMutating = useAtomValue(cartPromotionMutatingState);
  const applyPromotion = useSetAtom(applyPromotionCodeState);
  const removePromotion = useSetAtom(removePromotionCodeState);
  const requestInfo = useRequestInformation();

  return (
    <Section title="Chọn mã giảm giá" className="rounded-lg">
      <div className="w-full py-2 px-4 space-y-2">
        <div className="flex items-center space-x-2">
          <VoucherIcon />
          <div className="text-sm flex-1">Mã giảm giá</div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.currentTarget.value.toUpperCase())}
            placeholder="Nhập mã"
            className="flex-1 text-sm border border-black/10 rounded-lg px-3 py-2 focus:outline-none"
          />
          <button
            className="text-sm font-medium px-3 py-2 rounded-lg border border-primary text-primary disabled:opacity-50"
            disabled={promotionMutating || !promoCode.trim()}
            onClick={async () => {
              try {
                await applyPromotion(promoCode);
                toast.success("Áp dụng mã thành công");
                setPromoCode("");
              } catch (error) {
                if (isIdentityRequiredError(error)) {
                  try {
                    await requestInfo();
                    await applyPromotion(promoCode);
                    toast.success("Áp dụng mã thành công");
                    setPromoCode("");
                    return;
                  } catch (retryError) {
                    console.error(retryError);
                    toast.error("Mã giảm giá không hợp lệ hoặc không áp dụng được");
                    return;
                  }
                }
                console.error(error);
                toast.error("Mã giảm giá không hợp lệ hoặc không áp dụng được");
              }
            }}
          >
            Áp dụng
          </button>
        </div>

        {promotionCodes.length > 0 && (
          <div className="space-y-1 pt-1">
            {promotionCodes.map((code) => (
              <div
                key={code}
                className="flex items-center justify-between bg-background rounded-lg px-3 py-2"
              >
                <div className="text-sm font-medium">{code}</div>
                <button
                  className="text-xs text-danger flex items-center space-x-1 disabled:opacity-50"
                  disabled={promotionMutating}
                  onClick={async () => {
                    try {
                      await removePromotion(code);
                      toast.success("Đã gỡ mã giảm giá");
                    } catch (error) {
                      console.error(error);
                      toast.error("Không thể gỡ mã giảm giá");
                    }
                  }}
                >
                  <span>Gỡ</span>
                  <Icon icon="zi-close" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
