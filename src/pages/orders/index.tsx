import { Tabs } from "zmp-ui";
import OrderList from "./order-list";
import { ordersState } from "@/state";
import { useNavigate, useParams } from "react-router-dom";

function OrdersPage() {
  const { status } = useParams();
  const navigate = useNavigate();

  // Default to 'all' if no status provided
  const activeTab = status || "all";

  return (
    <Tabs
      className="h-full flex flex-col"
      activeKey={activeTab}
      onChange={(tabStatus) => navigate(`/orders/${tabStatus}`)}
    >
      <Tabs.Tab key="all" label="Tất cả">
        <OrderList ordersState={ordersState("all")} />
      </Tabs.Tab>
      <Tabs.Tab key="pending_confirmation" label="Chờ xác nhận">
        <OrderList ordersState={ordersState("pending_confirmation")} />
      </Tabs.Tab>
      <Tabs.Tab key="shipping" label="Đang giao">
        <OrderList ordersState={ordersState("shipping")} />
      </Tabs.Tab>
      <Tabs.Tab key="awaiting_payment" label="Chờ thu tiền">
        <OrderList ordersState={ordersState("awaiting_payment")} />
      </Tabs.Tab>
      <Tabs.Tab key="completed" label="Hoàn thành">
        <OrderList ordersState={ordersState("completed")} />
      </Tabs.Tab>
      <Tabs.Tab key="cancelled" label="Đã hủy">
        <OrderList ordersState={ordersState("cancelled")} />
      </Tabs.Tab>
    </Tabs>
  );
}

export default OrdersPage;
