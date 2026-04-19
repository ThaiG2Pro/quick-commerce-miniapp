import { Tabs } from "zmp-ui";
import OrderList from "./order-list";
import { ordersState } from "@/state";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useSetAtom } from "jotai";

function OrdersPage() {
  const { status } = useParams();
  const navigate = useNavigate();
  
  // Get the refresh function for current tab
  const refreshOrders = useSetAtom(ordersState(status || "pending_confirmation"));

  // Default to 'pending_confirmation' if no status provided
  const activeTab = status || "pending_confirmation";

  // Refresh orders data when page loads or tab changes
  useEffect(() => {
    void refreshOrders();
  }, [status, refreshOrders]);

  return (
    <Tabs
      className="h-full flex flex-col"
      activeKey={activeTab}
      onChange={(tabStatus) => navigate(`/orders/${tabStatus}`)}
    >
      <Tabs.Tab key="pending_confirmation" label="Chờ xác nhận">
        <OrderList ordersState={ordersState("pending_confirmation")} />
      </Tabs.Tab>
      <Tabs.Tab key="shipping" label="Đang giao">
        <OrderList ordersState={ordersState("shipping")} />
      </Tabs.Tab>
      <Tabs.Tab key="completed" label="Hoàn thành">
        <OrderList ordersState={ordersState("completed")} />
      </Tabs.Tab>
    </Tabs>
  );
}

export default OrdersPage;
