import { formatPrice } from "@/utils/format";
import { animated, useSpring } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { useSetAtom } from "jotai";
import { removeCartItemAtom } from "@/state"; // Import hàm xóa chuẩn Medusa
import { Icon } from "zmp-ui";

const SWIPE_TO_DELTE_OFFSET = 80;

// Đổi type thành any tạm thời để hứng dữ liệu thật từ Medusa mà không bị báo lỗi TypeScript
export default function CartItem({ item, ...props }: any) {
  // 1. Lôi hàm xóa món của Medusa ra xài
  const removeCartItem = useSetAtom(removeCartItemAtom);

  // swipe left to delete animation (Giữ nguyên của ông vì nó đang làm rất tốt)
  const [{ x }, api] = useSpring(() => ({ x: 0 }));
  const bind = useDrag(
    ({ last, offset: [ox] }) => {
      if (last) {
        if (ox < -SWIPE_TO_DELTE_OFFSET) {
          api.start({ x: -SWIPE_TO_DELTE_OFFSET });
        } else {
          api.start({ x: 0 });
        }
      } else {
        api.start({ x: Math.min(ox, 0), immediate: true });
      }
    },
    {
      from: () => [x.get(), 0],
      axis: "x",
      bounds: { left: -100, right: 0, top: 0, bottom: 0 },
      rubberband: true,
      preventScroll: true,
    },
  );

  // 2. Map dữ liệu từ Medusa Line Item (Vì Medusa trả về cấu trúc hơi khác template mẫu)
  // Fallback về props.product để không bị crash nếu dữ liệu cũ còn sót lại
  const lineItemId = item?.id;
  const name = item?.title || props.product?.name || "Sản phẩm";
  const image = item?.thumbnail || props.product?.image || "https://via.placeholder.com/150";
  const price = item?.unit_price || props.product?.price || 0;
  const quantity = item?.quantity || props.quantity || 1;

  // 3. Hàm xử lý khi bấm nút XÓA
  const handleDelete = () => {
    if (lineItemId) {
      removeCartItem(lineItemId); // Gọi API Medusa xóa trên server
    }
  };

  return (
    <div className="relative after:border-b-[0.5px] after:border-black/10 after:absolute after:left-[88px] after:right-0 after:bottom-0 last:after:hidden">
      <div className="absolute right-0 top-0 bottom-0 w-20 py-px">
        <div
          className="bg-danger text-white/95 w-full h-full flex flex-col space-y-1 justify-center items-center cursor-pointer"
          onClick={handleDelete}
        >
          <Icon icon="zi-delete" />
          <div className="text-2xs font-medium">Xoá</div>
        </div>
      </div>

      <animated.div
        {...bind()}
        style={{ x }}
        className="bg-white p-4 flex items-center space-x-4 relative"
      >
        <img src={image} className="w-14 h-14 rounded-lg object-cover" />
        <div className="flex-1 space-y-1">
          <div className="text-sm">{name}</div>
          <div className="flex flex-col">
            <div className="text-sm font-bold">
              {formatPrice(price)}
            </div>
          </div>
        </div>
        <div className="text-sm font-medium">x{quantity}</div>
      </animated.div>
    </div>
  );
}