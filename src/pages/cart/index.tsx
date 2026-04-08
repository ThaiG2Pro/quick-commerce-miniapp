import { useNavigate } from "react-router-dom";
import { Button } from "zmp-ui";
import CartList from "./cart-list";
import ApplyVoucher from "./apply-voucher";
import CartSummary from "./cart-summary";
import { useAtomValue } from "jotai";
import { cartState } from "@/state";
import { EmptyCart } from "@/components/empty";
import Delivery from "./delivery";
import HorizontalDivider from "@/components/horizontal-divider";
import Pay from "./pay";

export default function CartPage() {
  // 1. Gọi công cụ chuyển trang ở đây
  const navigate = useNavigate();

  const cart = useAtomValue(cartState);

  // 2. KHI GIỎ HÀNG TRỐNG (ĐÃ FIX BẢO VỆ 3 LỚP Ở ĐÂY 👇)
  // Nếu cart là null (lỗi server) HOẶC không có items HOẶC items rỗng -> Hiện giỏ trống
  if (!cart?.items?.length) {
    return (
      <div className="flex flex-col items-center pt-10 space-y-4 h-full">
        <Button onClick={() => navigate("/login")} variant="secondary">
          Đăng nhập tại đây
        </Button>
        <div className="w-full">
          <EmptyCart />
        </div>
      </div>
    );
  }

  // 3. KHI GIỎ HÀNG CÓ ĐỒ -> Nhét cái nút ở trên cùng luôn
  return (
    <div className="w-full h-full flex flex-col">
      <div className="p-4 bg-white z-10 border-b">
        <Button
          onClick={() => navigate("/login")}
          fullWidth
          variant="secondary"
        >
          Đăng nhập tại đây
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
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