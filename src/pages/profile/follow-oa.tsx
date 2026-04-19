import { useEffect } from "react";
import { showOAWidget } from "@/lib/zmp";

export default function FollowOAWidget() {
  useEffect(() => {
    // lazy-load zmp SDK when widget mounts
    showOAWidget({
      id: "oaWidget",
      guidingText: "Quan tâm OA để nhận các đặc quyền ưu đãi",
      color: "#F7F7F8",
    }).catch(() => {
      // ignore if running outside Zalo environment
    });
  }, []);

  return <div id="oaWidget" />;
}
