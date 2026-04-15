import Barcode from "./barcode";
import barcodeIllusLeft from "@/static/barcode-illus-left.svg";
import barcodeIllusRight from "@/static/barcode-illus-right.svg";
import { useAtomValue } from "jotai";
import { loyaltyProfileState } from "@/state";
import { useRequestInformation } from "@/hooks";
import { Button } from "zmp-ui";

function formatExpiryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("vi-VN");
}

export default function Points() {
  const loyalty = useAtomValue(loyaltyProfileState);
  const requestInfo = useRequestInformation();

  if (!loyalty) {
    return (
      <div className="rounded-lg bg-primary text-white p-6 text-center space-y-3">
        <div className="text-lg font-medium">Chưa có dữ liệu tích điểm</div>
        <div className="text-2xs opacity-90">
          Đăng nhập để đồng bộ điểm tích lũy từ server.
        </div>
        <Button onClick={requestInfo} fullWidth>
          Đăng nhập
        </Button>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg bg-primary text-white p-8 pt-6 bg-cover text-center"
      style={{
        backgroundImage: `url(${barcodeIllusLeft}), url(${barcodeIllusRight})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "top left, bottom right",
        backgroundSize: "auto, auto",
      }}
    >
      <div className="text-xl font-medium opacity-95">{loyalty.points} điểm</div>
      <div className="opacity-95 text-2xs">HSD: {formatExpiryDate(loyalty.expiryDate)}</div>
      <div className="bg-white rounded-lg mt-2 py-2.5 space-y-2.5 flex flex-col items-center">
        <div className="text-2xs text-subtitle text-center">
          Quét mã để tích điểm
        </div>
        <Barcode value={loyalty.barcodeValue} />
      </div>
    </div>
  );
}
