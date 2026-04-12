import { useLocation, useParams } from "react-router-dom";
import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { loadable } from "jotai/utils";
import { Order } from "@/types";
import { orderDetailState } from "@/state";
import OrderSummary from "./order-summary";
import OrderInfo from "./order-info";
import { EmptyOrder } from "@/components/empty";

function OrderDetailPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const routeOrderId = Number(id);
  const orderFromRouteState = state as Order | undefined;
  const orderFromStore = useAtomValue(
    useMemo(
      () => loadable(orderDetailState(Number.isFinite(routeOrderId) ? routeOrderId : -1)),
      [routeOrderId]
    )
  );

  const order =
    orderFromRouteState ||
    (orderFromStore.state === "hasData" ? orderFromStore.data : undefined);

  if (!order && orderFromStore.state === "loading") {
    return <div className="w-full p-4 text-sm text-subtitle">Đang tải đơn hàng...</div>;
  }

  if (!order) {
    return <EmptyOrder />;
  }

  return (
    <div className="w-full p-4 space-y-2">
      <OrderInfo order={order} />
      <OrderSummary full order={order} />
    </div>
  );
}

export default OrderDetailPage;
