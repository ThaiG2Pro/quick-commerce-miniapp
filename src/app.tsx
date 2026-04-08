// React core
import React, { useEffect } from "react"; // Thêm useEffect và React
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

// Jotai & State (Thêm phần này để gọi giỏ hàng)
import { useSetAtom } from "jotai";
import { initializeCartAtom } from "@/state";

// Router
import router from "@/router";

// ZaUI stylesheet
import "zmp-ui/zaui.css";
// Tailwind stylesheet
import "@/css/tailwind.scss";
// Your stylesheet
import "@/css/app.scss";

// Expose app configuration
import appConfig from "../app-config.json";

if (!window.APP_CONFIG) {
  window.APP_CONFIG = appConfig;
}

// 🚀 TẠO COMPONENT BỌC NGOÀI ĐỂ KHỞI TẠO APP
const AppWrapper = () => {
  const initCart = useSetAtom(initializeCartAtom);

  // Vừa vào app là âm thầm gọi hàm này để chuẩn bị giỏ hàng ngay
  useEffect(() => {
    initCart();
  }, [initCart]);

  // Trả về cái Router y như cũ
  return <RouterProvider router={router} />;
};

// Mount the app
const root = createRoot(document.getElementById("app")!);
root.render(<AppWrapper />); // Gắn cái cục vừa tạo vào đây