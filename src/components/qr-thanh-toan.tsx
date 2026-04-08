import React from "react";
import { QRCodeSVG } from "qrcode.react"; 
import { useAtom, useAtomValue } from "jotai";
// 👉 Import các biến State mình vừa tạo
import { cartTotalState, showQRState, zaloPayQRStringState } from "@/state";

export default function QRCodeThanhToan() {
  const { totalAmount } = useAtomValue(cartTotalState);
  
  // Lấy công tắc và chuỗi QR ra xài
  const [showQR, setShowQR] = useAtom(showQRState);
  const qrString = useAtomValue(zaloPayQRStringState);

  // 👉 Nếu công tắc đang TẮT, thì ẩn cái Popup này đi (return null)
  if (!showQR) return null;

  return (
    // Lớp nền đen mờ bao phủ màn hình
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60 px-4">
      
      {/* Khung Popup màu trắng */}
      <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center relative w-full max-w-sm">
        
        {/* Nút X để tắt Popup */}
        <button
          onClick={() => setShowQR(false)}
          className="absolute top-3 right-4 text-gray-400 hover:text-red-500 font-bold text-2xl"
        >
          ✕
        </button>

        <div className="mb-4 text-center mt-2">
          <h3 className="font-extrabold text-xl text-blue-600">THANH TOÁN ZALOPAY</h3>
          <p className="text-sm text-gray-500">Mở ứng dụng ZaloPay để quét mã</p>
        </div>

        {/* Vẽ mã QR từ chuỗi nhận được */}
        <div className="p-3 bg-white border-4 border-blue-50 rounded-2xl shadow-inner">
          <QRCodeSVG 
            value={qrString} 
            size={220}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="mt-6 w-full border-t border-dashed border-gray-200 pt-4 text-center">
          <p className="text-gray-500 text-sm mb-1">Số tiền cần thanh toán:</p>
          <p className="text-2xl font-black text-red-500">
            {totalAmount.toLocaleString()} VNĐ
          </p>
        </div>
        
        <p className="text-xs text-gray-400 mt-4 text-center">
          *Hệ thống sẽ tự động xác nhận đơn hàng sau khi bạn thanh toán thành công.
        </p>
      </div>
    </div>
  );
}