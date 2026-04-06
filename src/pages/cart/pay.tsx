import React from "react";
import { QRCodeSVG } from "qrcode.react"; 
import { useAtomValue } from "jotai";
import { cartTotalState, zaloPayQRStringState } from "@/state";

export default function QRCodeThanhToan() {
  const { totalAmount } = useAtomValue(cartTotalState);
  const qrString = useAtomValue(zaloPayQRStringState);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 text-center">
        <p className="text-sm text-gray-500">Mở ứng dụng Zalo/ZaloPay để quét mã</p>
      </div>

      <div className="p-3 bg-white border-2 border-blue-100 rounded-2xl shadow-inner">
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
        *Hệ thống sẽ tự động xác nhận đơn hàng sau khi thanh toán thành công.
      </p>
    </div>
  );
}