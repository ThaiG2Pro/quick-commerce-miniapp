import { Icon, Tabs } from "zmp-ui";
import OrderList from "./order-list";
import { ordersState, showRatingNotificationState } from "@/state";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";

function OrdersPage() {
  const { status } = useParams();
  const navigate = useNavigate();
  const [showRatingNotification, setShowRatingNotification] = useAtom(showRatingNotificationState);
  
  // Get the refresh function for current tab
  const refreshOrders = useSetAtom(ordersState(status || "pending_confirmation"));

  // Default to 'pending_confirmation' if no status provided
  const activeTab = status || "pending_confirmation";

  // Refresh orders data when page loads or tab changes
  useEffect(() => {
    void refreshOrders();
  }, [status, refreshOrders]);

  return (
    <div className="h-full flex flex-col">
      {showRatingNotification && (
        <div className="bg-primary/10 p-4 relative border-b border-primary/20">
          <div className="pr-6 text-sm text-primary font-medium">
            Hãy nhấn vào nút 3 chấm, nhấn vào dấu than, và đánh giá cho VilMart nhé!
          </div>
          <button
            onClick={() => setShowRatingNotification(false)}
            className="absolute top-2 right-2 p-1 text-primary hover:bg-primary/10 rounded-full"
          >
            <Icon icon="zi-close" size={16} />
          </button>
        </div>
      )}
      <Tabs
        className="flex-1 flex flex-col"
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
    </div>
  );
}

export default OrdersPage;
