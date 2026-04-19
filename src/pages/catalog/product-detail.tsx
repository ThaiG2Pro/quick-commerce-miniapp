import HorizontalDivider from "@/components/horizontal-divider";
import { useAtomValue } from "jotai";
import { useNavigate, useParams } from "react-router-dom";
import { productState } from "@/state";
import { formatPrice } from "@/utils/format";
import ShareButton from "./share-buttont";
import RelatedProducts from "./related-products";
import { useAddToCart } from "@/hooks";
import { Button } from "zmp-ui";
import Section from "@/components/section";
import { useEffect, useMemo, useState } from "react";
import OptimizedImage from "@/components/optimized-image";

export default function ProductDetailPage() {
  const { id } = useParams();
  const product = useAtomValue(productState(Number(id)))!;
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variantId || product.variants?.[0]?.id
  );

  useEffect(() => {
    setSelectedVariantId(product.variantId || product.variants?.[0]?.id);
  }, [product.id, product.variantId, product.variants]);

  const selectedVariant = useMemo(
    () => product.variants?.find((variant) => variant.id === selectedVariantId),
    [product.variants, selectedVariantId]
  );

  const displayProduct = useMemo(
    () => ({
      ...product,
      variantId: selectedVariant?.id || product.variantId,
      price: selectedVariant?.price ?? product.price,
      originalPrice: selectedVariant?.originalPrice ?? product.originalPrice,
      currencyCode: selectedVariant?.currencyCode ?? product.currencyCode,
      isTaxInclusive:
        selectedVariant?.isTaxInclusive ?? product.isTaxInclusive ?? false,
      isPurchasable:
        selectedVariant?.isPurchasable ?? product.isPurchasable ?? false,
    }),
    [product, selectedVariant]
  );

  const navigate = useNavigate();
  const { addToCart, isPending, isPurchasable } = useAddToCart(displayProduct);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full p-4 pb-2 space-y-4 bg-section">
          <OptimizedImage
            key={product.id}
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover rounded-lg"
            style={{
              viewTransitionName: `product-image-${product.id}`,
            }}
          />
          <div>
            <div className="text-xl font-bold text-primary">
              {formatPrice(displayProduct.price, displayProduct.currencyCode)}
            </div>
            {displayProduct.originalPrice && (
              <div className="text-2xs space-x-0.5">
                <span className="text-subtitle line-through">
                  {formatPrice(
                    displayProduct.originalPrice,
                    displayProduct.currencyCode
                  )}
                </span>
                <span className="text-danger">
                  -
                  {100 -
                    Math.round(
                      (displayProduct.price * 100) /
                        displayProduct.originalPrice
                    )}
                  %
                </span>
              </div>
            )}
            <div className="text-sm mt-1">{product.name}</div>
            {product.type && (
              <div className="text-2xs text-subtitle mt-1">
                Loại: {product.type}
              </div>
            )}
            {selectedVariant && (
              <div className="text-2xs mt-1">
                {selectedVariant.manageInventory === false ? (
                  <span className="text-subtitle">Không quản lý tồn kho</span>
                ) : typeof selectedVariant.inventoryQuantity === "number" ? (
                  <span
                    className={
                      selectedVariant.inventoryQuantity > 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    Tồn kho: {selectedVariant.inventoryQuantity}
                  </span>
                ) : (
                  <span className="text-subtitle">Tồn kho: —</span>
                )}
              </div>
            )}
            {product.tags && product.tags.length > 0 && (
              <div className="text-2xs text-subtitle mt-1 line-clamp-1">
                Tags: {product.tags.join(", ")}
              </div>
            )}
            {displayProduct.isTaxInclusive && (
              <div className="text-2xs text-subtitle mt-1">
                Giá đã bao gồm thuế
              </div>
            )}
            {product.hasCampaignPrice && (
              <div className="text-xs text-primary mt-1">
                Giá đang áp dụng chương trình khuyến mãi
              </div>
            )}
            {!isPurchasable && (
              <div className="text-xs text-danger mt-1">
                {selectedVariant?.isInStock === false
                  ? "Biến thể này đang hết hàng"
                  : "Sản phẩm chưa có giá hợp lệ để mua"}
              </div>
            )}
          </div>
          {product.variants && product.variants.length > 1 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Biến thể</div>
              <div className="grid grid-cols-2 gap-2">
                {product.variants.map((variant) => {
                  const label =
                    variant.optionValues.map((option) => option.value).join(" / ") ||
                    variant.title;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      className={`text-xs px-3 py-2 rounded-lg border ${
                        selectedVariantId === variant.id
                          ? "border-primary text-primary bg-primary/5"
                          : "border-black/10 text-foreground"
                      } ${!variant.isPurchasable ? "opacity-60" : ""}`}
                      onClick={() => setSelectedVariantId(variant.id)}
                    >
                      <div>{label}</div>
                      <div className="mt-1 font-medium">
                        {formatPrice(variant.price, variant.currencyCode)}
                      </div>
                      {variant.isInStock === false && (
                        <div className="mt-1 text-danger">Hết hàng</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <ShareButton product={product} />
        </div>
        {product.detail && (
          <>
            <div className="bg-background h-2 w-full"></div>
            <Section title="Mô tả sản phẩm">
              <div className="text-sm whitespace-pre-wrap text-subtitle p-4 pt-2">
                {product.detail}
              </div>
            </Section>
          </>
        )}
        <div className="bg-background h-2 w-full"></div>
        <Section title="Sản phẩm khác">
          <RelatedProducts currentProductId={product.id} />
        </Section>
      </div>

      <HorizontalDivider />
      <div className="flex-none grid grid-cols-2 gap-2 py-3 px-4 bg-section">
        <Button
          variant="tertiary"
          onClick={() => {
            addToCart(1, {
              toast: true,
            });
          }}
          disabled={isPending || !isPurchasable}
        >
          {isPurchasable ? "Thêm vào giỏ" : "Chưa sẵn sàng"}
        </Button>
        <Button
          onClick={async () => {
            await addToCart(1);
            navigate("/cart", {
              viewTransition: true,
            });
          }}
          disabled={isPending || !isPurchasable}
        >
          {isPurchasable ? "Mua ngay" : "Chưa sẵn sàng"}
        </Button>
      </div>
    </div>
  );
}
