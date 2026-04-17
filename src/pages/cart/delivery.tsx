import HorizontalDivider from "@/components/horizontal-divider";
import Section from "@/components/section";
import { StationSkeleton } from "@/components/skeleton";
import TransitionLink from "@/components/transition-link";
import {
  HomeIcon,
  LocationMarkerLineIcon,
  LocationMarkerPackageIcon,
  PackageDeliveryIcon,
  PlusIcon,
  ShipperIcon,
} from "@/components/vectors";
import {
  cartMutatingState,
  deliveryModeState,
  pickPreferredPickupOption,
  pickPreferredShippingOption,
  selectedShippingOptionIdState,
  selectedStationState,
  selectShippingOptionState,
  shippingOptionsState,
  shippingAddressState,
  createPickupCheckoutAddress,
  pickupCheckoutEmail,
} from "@/state";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Suspense, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/utils/format";
import toast from "react-hot-toast";
import DeliverySummary from "./delivery-summary";
import { useHydrateCheckoutAddresses } from "@/hooks";

function ShippingAddressSummary() {
  const shippingAddress = useAtomValue(shippingAddressState);

  if (!shippingAddress) {
    return (
      <TransitionLink
        className="flex flex-col space-y-2 justify-center items-center p-4 w-full"
        to="/shipping-address"
      >
        <LocationMarkerPackageIcon />
        <div className="flex space-x-1 items-center text-center p-2">
          <PlusIcon width={16} height={16} />
          <span className="text-sm font-medium">Thêm địa chỉ nhận hàng</span>
        </div>
      </TransitionLink>
    );
  }

  return (
    <DeliverySummary
      icon={<LocationMarkerLineIcon />}
      title="Địa chỉ nhận hàng"
      subtitle={shippingAddress.alias}
      description={shippingAddress.address}
      linkTo="/shipping-address"
    />
  );
}

function SelectedStationSummary() {
  const selectedStation = useAtomValue(selectedStationState);
  return (
    <DeliverySummary
      icon={<HomeIcon />}
      title="Nhận hàng tại"
      subtitle={selectedStation.name}
      description={selectedStation.address}
      linkTo="/stations"
    />
  );
}

function Delivery() {
  const [selectedDeliveryMode, setSelectedDeliveryMode] =
    useAtom(deliveryModeState);
  const hydrateCheckoutAddresses = useHydrateCheckoutAddresses();

  useEffect(() => {
    void hydrateCheckoutAddresses();
  }, [hydrateCheckoutAddresses]);

  return (
    <Section title="Hình thức giao hàng" className="rounded-lg">
      <div className="grid grid-cols-2 gap-4 p-4 pt-2">
        {(
          [
            {
              type: "shipping",
              name: "Giao tận nơi",
              icon: <ShipperIcon />,
            },
            {
              type: "pickup",
              name: "Tự đến lấy",
              icon: <PackageDeliveryIcon />,
            },
          ] as const
        ).map((option) => (
          <button
            key={option.type}
            className={"flex justify-center items-center space-x-2 text-base font-medium bg-background rounded-full h-12 px-3.5 ".concat(
              selectedDeliveryMode === option.type
                ? "border border-primary text-primary"
                : ""
            )}
            onClick={() => setSelectedDeliveryMode(option.type)}
          >
            {option.icon}
            <span>{option.name}</span>
          </button>
        ))}
      </div>
      <Suspense fallback={null}>
        <AutoApplyDeliveryShippingOption />
      </Suspense>
      <HorizontalDivider />
      {selectedDeliveryMode === "shipping" ? (
        <>
          <ShippingAddressSummary />
          <Suspense fallback={<StationSkeleton />}>
            <ShippingOptions />
          </Suspense>
        </>
      ) : (
        <Suspense fallback={<StationSkeleton />}>
          <SelectedStationSummary />
        </Suspense>
      )}
    </Section>
  );
}

function AutoApplyDeliveryShippingOption() {
  const selectedDeliveryMode = useAtomValue(deliveryModeState);
  const shippingOptions = useAtomValue(shippingOptionsState);
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useAtom(
    selectedShippingOptionIdState
  );
  const applyShippingOption = useSetAtom(selectShippingOptionState);
  const cartMutating = useAtomValue(cartMutatingState);

  const targetOption = useMemo(() => {
    if (selectedDeliveryMode === "pickup") {
      return pickPreferredPickupOption(shippingOptions);
    }
    return pickPreferredShippingOption(shippingOptions);
  }, [selectedDeliveryMode, shippingOptions]);

  useEffect(() => {
    if (!targetOption || cartMutating || selectedShippingOptionId === targetOption.id) {
      return;
    }

    void (async () => {
      try {
        const pickupAddress = createPickupCheckoutAddress();
        await applyShippingOption(
          targetOption.id,
          selectedDeliveryMode === "pickup"
            ? {
                shippingAddress: pickupAddress,
                billingAddress: pickupAddress,
                email: pickupCheckoutEmail,
              }
            : undefined
        );
        setSelectedShippingOptionId(targetOption.id);
      } catch (error) {
        console.error("Failed to auto apply shipping option:", error);
      }
    })();
  }, [
    applyShippingOption,
    cartMutating,
    selectedDeliveryMode,
    selectedShippingOptionId,
    setSelectedShippingOptionId,
    targetOption,
  ]);

  return null;
}

function ShippingOptions() {
  const shippingOptions = useAtomValue(shippingOptionsState);
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useAtom(
    selectedShippingOptionIdState
  );
  const applyShippingOption = useSetAtom(selectShippingOptionState);
  const cartMutating = useAtomValue(cartMutatingState);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const shippingOnlyOptions = useMemo(() => {
    const pickupOption = pickPreferredPickupOption(shippingOptions);
    if (!pickupOption) {
      return shippingOptions;
    }
    const filtered = shippingOptions.filter((option) => option.id !== pickupOption.id);
    return filtered.length ? filtered : shippingOptions;
  }, [shippingOptions]);

  const effectiveSelectedId = useMemo(() => {
    if (
      selectedShippingOptionId &&
      shippingOnlyOptions.some((option) => option.id === selectedShippingOptionId)
    ) {
      return selectedShippingOptionId;
    }
    return null;
  }, [selectedShippingOptionId, shippingOnlyOptions]);

  if (!shippingOnlyOptions.length) {
    return (
      <div className="px-4 pb-4 text-xs text-subtitle">
        Chưa có phương thức vận chuyển khả dụng cho giỏ hàng hiện tại.
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 space-y-2">
      <div className="text-xs text-subtitle">Chọn phương thức vận chuyển</div>
      <div className="space-y-2">
        {shippingOnlyOptions.map((option) => {
          const isSelected = option.id === effectiveSelectedId;
          return (
            <button
              key={option.id}
              className={`w-full text-left rounded-lg border px-3 py-2 ${
                isSelected ? "border-primary bg-primary/5" : "border-black/10"
              }`}
              disabled={cartMutating}
              onClick={async () => {
                if (option.id === effectiveSelectedId) {
                  return;
                }
                try {
                  setSelectedShippingOptionId(option.id);
                  setPendingOptionId(option.id);
                  await applyShippingOption(option.id);
                } catch (error) {
                  console.error("Failed to apply shipping option:", error);
                  toast.error("Không thể áp dụng phương thức vận chuyển.");
                  setSelectedShippingOptionId(effectiveSelectedId);
                } finally {
                  setPendingOptionId(null);
                }
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{option.name}</span>
                <span className="text-sm">
                  {formatPrice(option.amount, option.currencyCode)}
                </span>
              </div>
              {pendingOptionId === option.id && (
                <div className="mt-0.5 text-xs text-subtitle">Đang cập nhật phí vận chuyển...</div>
              )}
              {option.description && (
                <div className="mt-0.5 text-xs text-subtitle">{option.description}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Delivery;
