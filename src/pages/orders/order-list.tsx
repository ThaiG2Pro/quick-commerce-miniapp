import { Order } from "@/types";
import { Atom, useAtomValue } from "jotai";
import { loadable } from "jotai/utils";
import { useMemo } from "react";
import { EmptyOrder } from "@/components/empty";
import OrderSummary from "./order-summary";
import { OrderSummarySkeleton } from "@/components/skeleton";

function OrderList(props: { ordersState: Atom<Promise<Order[]>> }) {
  const orderList = useAtomValue(
    useMemo(() => loadable(props.ordersState), [props.ordersState])
  );

  // Debug: log loadable state so we can see what UI receives
  try {
    // eslint-disable-next-line no-console
    console.log("[OrderList] loadable state:", orderList.state, "dataLength:", orderList.state === "hasData" ? (orderList.data as any).length : 0);
  } catch (e) {
    // ignore
  }

  if (orderList.state === "hasData" && orderList.data.length === 0) {
    return <EmptyOrder />;
  }

  if (orderList.state === "hasError") {
    return (
      <div className="space-y-2 p-4">
        <div className="rounded-lg bg-danger/10 text-danger text-sm px-3 py-2">
          {orderList.error instanceof Error
            ? orderList.error.message
            : "Không thể tải danh sách đơn hàng."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {orderList.state !== "hasData" ? (
        <>
          <OrderSummarySkeleton />
          <OrderSummarySkeleton />
          <OrderSummarySkeleton />
        </>
      ) : (
        orderList.data.map((order) => (
          <OrderSummary key={order.id} order={order} />
        ))
      )}
    </div>
  );
}

export default OrderList;
