import React, { useState } from "react";
import { Box, Text, Radio, Button, Sheet } from "zmp-ui";import { useAtomValue, useAtom } from "jotai";
import { cartTotalState, showQRState } from "@/state";
import { formatPrice } from "@/utils/format";
import { useCheckout } from "@/hooks";
import { useNavigate } from "react-router-dom";
import QRCodeThanhToan from "@/components/qr-thanh-toan"; 
import { toast } from "react-hot-toast";

export default function CheckoutPage() {
  const { totalAmount } = useAtomValue(cartTotalState);
  const checkout = useCheckout();
  const navigate = useNavigate();
  
  // State quản lý
  const [paymentMethod, setPaymentMethod] = useState<"manual" | "zalopay">("manual");
  const [paying, setPaying] = useState(false);
  const [showQR, setShowQR] = useAtom(showQRState);

 const handleChotDon = async () => {
    setPaying(true); // Bật trạng thái đang xử lý (hiện icon xoay xoay)
    try {
      // Gọi API thực tế để tạo đơn hàng trên Medusa
      await checkout(paymentMethod); 
      
      // Nếu API chạy ngon lành (không lỗi), mới hiện cái bảng QR lên
      setShowQR(true); 
    } catch (error) {
      // Nếu lỗi (như lỗi CORS nãy giờ), nó sẽ văng vào đây
      console.error("Lỗi đặt hàng:", error);
      toast.error("Thanh toán thất bại! Vui lòng thử lại sau.");
    } finally {
      setPaying(false); // Xong xuôi thì tắt trạng thái loading
    }
  };

  const handleXongThanhToan = () => {
    setShowQR(false);
    navigate("/orders"); 
  };

  return (
    // 👉 Thay <Page> bằng <div> bình thường
    <div className="pb-24 bg-background min-h-screen">
      
      {/* Thông tin giao hàng */}
      <Box className="p-4 bg-white mt-2">
        <Text.Title className="mb-2">📍 Địa chỉ nhận hàng</Text.Title>
        <Text size="small" className="font-bold">Trí Nguyễn | 0912345678</Text>
        <Text size="small" className="text-gray-500">Đại học CNTT UIT, Khu phố 6, Linh Trung, Thủ Đức</Text>
      </Box>

      {/* Chọn phương thức thanh toán */}
      <Box className="p-4 bg-white mt-2">
        <Text.Title className="mb-4">💳 Phương thức thanh toán</Text.Title>
        <Radio.Group 
          name="payment" 
          value={paymentMethod}
          onChange={(val) => setPaymentMethod(val as "manual" | "zalopay")}
        >
          <div className="flex flex-col space-y-4">
            <Radio value="manual" label="Thanh toán tiền mặt (COD)" />
            <Radio value="zalopay" label="Thanh toán qua ZaloPay" />
          </div>
        </Radio.Group>
      </Box>

      {/* Nút đặt hàng dính dưới đáy */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-between items-center z-50">
        <div>
          <Text size="small" className="text-gray-500">Tổng thanh toán</Text>
          <Text size="xLarge" className="font-bold text-red-500">{formatPrice(totalAmount)}</Text>
        </div>
        <Button onClick={handleChotDon} disabled={paying} size="large">
          ĐẶT HÀNG
        </Button>
      </div>

      {/* Modal QR ZaloPay */}
      {/* BẢNG TRƯỢT DƯỚI ĐÁY (REPLACE ĐOẠN LỖI BẰNG CỤM NÀY) */}
     {/* BẢNG TRƯỢT DƯỚI ĐÁY - PHIÊN BẢN FIX CỨNG CHIỀU CAO */}
      {/* BẢNG TRƯỢT DƯỚI ĐÁY - FIX LỖI CÚ PHÁP */}
      <Sheet
        visible={showQR}
        onClose={() => setShowQR(false)}
        autoHeight={false}
      >
        <div 
          className="bg-white rounded-t-2xl overflow-y-auto px-4 pt-2"
          style={{ 
            height: '75vh', 
            paddingBottom: 'env(safe-area-inset-bottom, 24px)' 
          }}
        >
          <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto my-3" />

          <Text.Title className="text-center mb-4 text-lg font-bold text-blue-700">
            THANH TOÁN ZALOPAY
          </Text.Title>
          
          <div className="flex flex-col items-center">
             <QRCodeThanhToan />
          </div>
          
          <div className="mt-8 mb-10">
            <Button 
              onClick={handleXongThanhToan} 
              fullWidth 
              size="large"
            >
              Hoàn tất thanh toán
            </Button>
            <p className="text-center text-gray-400 text-xs mt-4">
              Vui lòng không thoát ứng dụng khi đang giao dịch
            </p>
          </div>
        </div>
      </Sheet>
    </div> // Đảm bảo có thẻ đóng div này cho toàn bộ trang Checkout nhé!
  );
};