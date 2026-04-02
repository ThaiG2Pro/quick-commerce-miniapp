import React, { useState } from "react";
import { getAccessToken } from "zmp-sdk/apis";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "zmp-ui"; 
import { jwtDecode } from "jwt-decode";

// Lấy thông tin từ file .env cho chuyên nghiệp
const BACKEND_URL = import.meta.env.VITE_MEDUSA_BACKEND_URL;
const API_KEY = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY;

export const LoginPage = () => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginWithZalo = async () => {
    try {
      setIsLoading(true);

      // 1. Lấy "Hộ chiếu" từ Zalo
      const accessToken = await getAccessToken({});
      if (!accessToken) throw new Error("Không lấy được Token Zalo");

      // 2. Gửi Token qua cho Giang xác thực
      const authResponse = await fetch(`${BACKEND_URL}/auth/customer/zalo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": API_KEY,
          "ngrok-skip-browser-warning": "true", // Vượt rào Ngrok
        },
        body: JSON.stringify({ access_token: accessToken }),
      });

      if (!authResponse.ok) throw new Error("Backend từ chối xác thực (401/500)");

      const { token } = await authResponse.json();
      let finalToken = token;

      // 3. Kiểm tra xem là khách quen hay khách mới
      const decoded = jwtDecode<{ actor_id: string; user_metadata?: any }>(finalToken);

      if (!decoded.actor_id) {
        // Khách mới -> Tạo hồ sơ trên Medusa
        const fullName = decoded.user_metadata?.name || "Zalo User";
        const dummyEmail = `zalo_${Date.now()}@quickcommerce.uit`;

        const createRes = await fetch(`${BACKEND_URL}/store/customers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${finalToken}`,
            "x-publishable-api-key": API_KEY,
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({
            first_name: fullName,
            email: dummyEmail,
          }),
        });

        if (!createRes.ok) throw new Error("Lỗi tạo hồ sơ khách hàng");

        // Lấy lại token mới có chứa Customer ID
        const refreshRes = await fetch(`${BACKEND_URL}/auth/token/refresh`, {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${finalToken}`,
            "ngrok-skip-browser-warning": "true" 
          },
        });
        const refreshData = await refreshRes.json();
        finalToken = refreshData.token;
      }

      // 4. Hoàn tất - Cất vé và về trang chủ
      localStorage.setItem("medusa_token", finalToken);
      openSnackbar({ text: "Đăng nhập thành công!", type: "success" });
      navigate("/");

    } catch (error) {
      console.error("Lỗi Login:", error);
      openSnackbar({ text: "Lỗi kết nối, thử lại sau nhé Trí!", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-white p-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-blue-600 italic">Quick Commerce</h1>
        <p className="text-gray-500 mt-2 italic">Dự án E-commerce @ UIT</p>
      </div>

      <button 
        onClick={handleLoginWithZalo} 
        disabled={isLoading}
        className={`w-full max-w-xs py-4 text-white rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${
          isLoading ? "bg-gray-400" : "bg-[#0068FF] hover:bg-blue-700"
        }`}
      >
        {isLoading ? "Đang xác thực..." : "ĐĂNG NHẬP BẰNG ZALO"}
      </button>
    </div>
  );
};

export default LoginPage;