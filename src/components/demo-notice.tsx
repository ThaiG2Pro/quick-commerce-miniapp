import { useEffect, useRef, useState } from "react";

export default function DemoNotice() {
  const [visible, setVisible] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(false);
  const continueRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (visible) {
      // prevent background scroll when modal is open
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return;
  }, [visible]);

  useEffect(() => {
    if (agreed && timerElapsed && continueRef.current) {
      continueRef.current.focus();
    }
  }, [agreed]);

  useEffect(() => {
    const t = setTimeout(() => setTimerElapsed(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Demo notice"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-xl bg-section rounded-lg shadow-lg p-6 text-sm md:text-base text-foreground">
        <h3 className="text-lg font-semibold mb-3">Thông báo — Phiên bản DEMO</h3>
        <div className="max-h-[50vh] overflow-y-auto mb-4 leading-relaxed text-subtitle">
          <p>
            Đây là phiên bản demo của ứng dụng. Chúng tôi không thu thập hay yêu cầu thông tin
            cá nhân của bạn (ví dụ: email, họ tên, số điện thoại, vị trí địa lý). Tất cả dữ liệu
            hiển thị trong ứng dụng đều là dữ liệu mẫu được tạo sẵn cho mục đích demo. Không
            có giao dịch thanh toán thực tế trong phiên bản này.
          </p>
          <p className="mt-3">
            Xin vui lòng đọc và đồng ý để tiếp tục trải nghiệm. Cảm ơn bạn đã thử nghiệm ứng dụng!
          </p>
        </div>

        <label className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            className="w-4 h-4 text-primary"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            aria-label="Tôi đồng ý với thông báo demo"
          />
          <span className="text-foreground">Tôi đã đọc và đồng ý</span>
        </label>

        <div className="flex justify-end items-center gap-4">
          {!timerElapsed && (
            <span className="text-xs text-subtitle">Vui lòng đọc thật kĩ...</span>
          )}
          <button
            ref={continueRef}
            className={`px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              agreed && timerElapsed
                ? "bg-primary text-primaryForeground hover:brightness-95"
                : "bg-section text-subtitle cursor-not-allowed border border-skeleton"
            }`}
            aria-disabled={!agreed || !timerElapsed}
            disabled={!agreed || !timerElapsed}
            onClick={() => setVisible(false)}
          >
            Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}
