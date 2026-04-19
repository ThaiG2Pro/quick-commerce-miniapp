import { Product } from "@/types";
import { formatPrice } from "@/utils/format";
import TransitionLink from "./transition-link";
import { useState } from "react";
import { Button } from "zmp-ui";
import { useAddToCart } from "@/hooks";
import QuantityInput from "./quantity-input";
import OptimizedImage from "./optimized-image";

export interface ProductItemProps {
  product: Product;
  /**
   * Whether to replace the current page when user clicks on this product item. Default behavior is to push a new page to the history stack.
   * This prop should be used when navigating to a new product detail from a current product detail page (related products, etc.)
   */
  replace?: boolean;
}

export default function ProductItem(props: ProductItemProps) {
  const [selected, setSelected] = useState(false);
  const { addToCart, cartQuantity, isPending, isPurchasable } = useAddToCart(
    props.product
  );
  const hasPriceRange =
    typeof props.product.priceMin === "number" &&
    typeof props.product.priceMax === "number" &&
    props.product.priceMin !== props.product.priceMax;
  const inlineDiscountPercent = props.product.originalPrice
    ? 100 -
      Math.round((props.product.price * 100) / props.product.originalPrice)
    : 0;

  return (
    <div
      className="flex flex-col cursor-pointer group bg-section rounded-xl shadow-[0_10px_24px_#0D0D0D17]"
      onClick={() => setSelected(true)}
    >
      <TransitionLink
        to={`/product/${props.product.id}`}
        replace={props.replace}
        className="p-2 pb-0"
      >
        {({ isTransitioning }) => (
          <>
            <OptimizedImage
              src={props.product.image}
              alt={props.product.name}
              className="w-full aspect-square object-cover rounded-lg"
              style={{
                viewTransitionName:
                  isTransitioning && selected // only animate the "clicked" product item in related products list
                    ? `product-image-${props.product.id}`
                    : undefined,
              }}
            />
            <div className="pt-2 pb-1.5">
              <div className="pt-1 pb-0.5">
                <div className="text-xs h-9 line-clamp-2">
                  {props.product.name}
                </div>
                {props.product.type && (
                  <div className="text-3xs text-subtitle mt-0.5 line-clamp-1">
                    {props.product.type}
                  </div>
                )}
              </div>
              <div className="mt-0.5 text-sm font-bold text-primary truncate">
                {hasPriceRange
                  ? `Từ ${formatPrice(
                      props.product.priceMin,
                      props.product.currencyCode
                    )}`
                  : formatPrice(props.product.price, props.product.currencyCode)}
              </div>
                {/* Inventory display: show exact quantity for single-variant products,
                    otherwise show a concise in-stock / out-of-stock label */}
                {props.product.variants && props.product.variants.length === 1 ? (
                  (() => {
                    const v = props.product.variants[0];
                    const qty = v.inventoryQuantity ?? 0;
                    const inStock = v.manageInventory === false || qty > 0;
                    return (
                      <div className={`text-3xs mt-0.5 ${inStock ? "text-green-600" : "text-red-600"}`}>
                        Tồn kho: {qty}
                      </div>
                    );
                  })()
                ) : (
                  <div className={`text-3xs mt-0.5 ${props.product.isPurchasable ? "text-green-600" : "text-red-600"}`}>
                    {props.product.isPurchasable ? "Còn hàng" : "Hết hàng"}
                  </div>
                )}
              {props.product.hasCampaignPrice && (
                <div className="text-3xs text-primary mt-0.5">
                  Giá theo chương trình khuyến mãi
                </div>
              )}
              {props.product.maxDiscountPercent && (
                <div className="text-3xs text-danger mt-0.5">
                  Giảm đến {props.product.maxDiscountPercent}%
                </div>
              )}
              {!isPurchasable && (
                <div className="text-3xs text-danger mt-0.5">
                  Hết hàng hoặc chưa có giá hợp lệ để mua
                </div>
              )}
              {props.product.originalPrice && !hasPriceRange && (
                <div className="text-3xs space-x-0.5 truncate">
                  <span className="text-subtitle line-through">
                    {formatPrice(
                      props.product.originalPrice,
                      props.product.currencyCode
                    )}
                  </span>
                  <span className="text-danger">
                    -{inlineDiscountPercent}%
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </TransitionLink>
      <div className="p-2">
        {cartQuantity === 0 ? (
          <Button
            variant="secondary"
            size="small"
            fullWidth
            onClick={(e) => {
              e.stopPropagation();
              addToCart(1, {
                toast: true,
              });
            }}
            disabled={isPending || !isPurchasable}
          >
            {isPurchasable ? "Thêm vào giỏ" : "Chưa sẵn sàng"}
          </Button>
        ) : (
          <QuantityInput value={cartQuantity} onChange={addToCart} />
        )}
      </div>
    </div>
  );
}
