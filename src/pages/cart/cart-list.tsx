import { useAtomValue } from "jotai";
import { cartState } from "@/state";
import CartItem from "./cart-item";
import Section from "@/components/section";
import { Icon } from "zmp-ui";
import HorizontalDivider from "@/components/horizontal-divider";

export default function CartList() {
  const cart = useAtomValue(cartState);

  // Lấy mảng items từ object cart của Medusa, nếu chưa có thì để mảng rỗng
  const cartItems = cart?.items || [];

  return (
    <Section
      title={
        <div className="flex items-center space-x-2">
          <Icon icon="zi-calendar" />
          <div>
            <span className="font-normal text-sm">Thời gian nhận:</span>{" "}
            <span className="font-medium text-sm">Từ 16h, 20/1/2025</span>
          </div>
        </div>
      }
      className="flex-1 overflow-y-auto rounded-lg"
    >
      <div className="w-full">
        {cartItems.length > 0 ? (
          // Nếu có hàng thì render danh sách
          cartItems.map((item: any) => (
            // Truyền item={item} để khớp với CartItem mới độ lại lúc nãy
            <CartItem key={item.id} item={item} />
          ))
        ) : (
          // Nếu giỏ trống thì hiện thông báo cho đẹp
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Icon icon="zi-add-member" className="text-4xl mb-2 opacity-50" />
            <p className="text-sm">Giỏ hàng của ông đang trống trơn!</p>
          </div>
        )}
      </div>
      <HorizontalDivider />
      <div className="flex items-center px-4 pt-3 pb-2 space-x-4">
        <div className="text-sm font-medium">Ghi chú</div>
        <input
          type="text"
          placeholder="Lưu ý cho người bán..."
          className="text-sm text-right flex-1 focus:outline-none"
        />
      </div>
    </Section>
  );
}