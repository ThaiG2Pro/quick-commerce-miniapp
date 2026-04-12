import React from "react";
import { useAtomValue } from "jotai";
import { zaloPayQRStringState } from "@/state";

export default function QRCodeThanhToan() {
  const qrString = useAtomValue(zaloPayQRStringState);

  if (!qrString) return <div className="p-4 text-gray-500 text-center">Đang tạo mã QR...</div>;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrString)}`;

  return (
    <div className="flex justify-center items-center p-2">
      <img src={qrImageUrl} alt="ZaloPay QR" className="w-48 h-48 rounded-lg shadow-sm" />
    </div>
  );
}