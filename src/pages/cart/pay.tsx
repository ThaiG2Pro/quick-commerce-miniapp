import { useAtomValue } from "jotai";
import { cartTotalState } from "@/state";
import { formatPrice } from "@/utils/format";
import { Button } from "zmp-ui";
import { useNavigate } from "react-router-dom";

export default function Pay() {
  const { totalAmount } = useAtomValue(cartTotalState);
  const navigate = useNavigate(); // Dùng cái này để chuyển trang

  return (
    <div className="flex-none flex items-center py-3 px-4 space-x-2 bg-section border-t">
      <div className="space-y-1 flex-1">
        <div className="text-xs text-subtitle">Tổng thanh toán</div>
        <div className="text-sm font-medium text-primary">
          {formatPrice(totalAmount)}
        </div>
      </div>
      <Button
        onClick={() => navigate("/checkout")} // 👉 Đơn giản là đẩy qua trang Checkout!
      >
        Tiến hành Thanh toán
      </Button>
    </div>
  );
}