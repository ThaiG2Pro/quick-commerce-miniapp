import CONFIG from "@/config";
import { userInfoKeyState, userInfoState } from "@/state";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "zmp-ui";
import { getCurrentCustomer, upsertCurrentCustomerAddress, updateCurrentCustomer, DEFAULT_AVATAR_URL } from "@/lib/medusa-sdk";
import { useRequestInformation } from "@/hooks";

function splitName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { first_name: "", last_name: "" };
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "" };
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

function ProfileEditorPage() {
  const navigate = useNavigate();
  const userInfo = useAtomValue(userInfoState);
  const requestInfo = useRequestInformation();
  const setUserInfoKey = useSetAtom(userInfoKeyState);
  const refreshUserInfo = () => setUserInfoKey((key) => key + 1);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="h-full flex flex-col justify-between"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const name = String(data.get("name") || "").trim();
        const nameParts = splitName(name || userInfo?.name || "");

        setSaving(true);
        try {
          // Update customer name
          try {
            await updateCurrentCustomer({
              first_name: nameParts.first_name || undefined,
              last_name: nameParts.last_name || undefined,
            });
          } catch (error) {
            const status =
              typeof error === "object" && error !== null
                ? ((error as { status?: number; response?: { status?: number } }).status ||
                  (error as { status?: number; response?: { status?: number } }).response?.status)
                : undefined;
            if (status === 401 || status === 403) {
              await requestInfo();
              await updateCurrentCustomer({
                first_name: nameParts.first_name || undefined,
                last_name: nameParts.last_name || undefined,
              });
            } else {
              throw error;
            }
          }

          // Update customer address if address fields are provided
          const addressFields = {
            alias: String(data.get("alias") || "").trim() || userInfo?.address?.split(",")[0] || "",
            address: String(data.get("address") || "").trim(),
            address2: String(data.get("address2") || "").trim() || "",
            city: String(data.get("city") || "").trim(),
            postalCode: String(data.get("postalCode") || "").trim() || "",
            province: String(data.get("province") || "").trim() || "",
            countryCode: "vn",
            name: `${nameParts.first_name} ${nameParts.last_name}`.trim(),
            phone: String(data.get("phone") || "").trim() || userInfo?.phone || "",
          };

          if (addressFields.address && addressFields.city) {
            await upsertCurrentCustomerAddress(addressFields);
          }

          const newUserInfo = {
            id: userInfo?.id || "",
            name: name || userInfo?.name || "",
            avatar: userInfo?.avatar || DEFAULT_AVATAR_URL,
            phone: addressFields.phone || userInfo?.phone || "",
            email: userInfo?.email || "",
            address: addressFields.address || userInfo?.address || "",
          };

          localStorage.setItem(
            CONFIG.STORAGE_KEYS.USER_INFO,
            JSON.stringify(newUserInfo)
          );
          refreshUserInfo();
          toast.success("Đã cập nhật thông tin tài khoản");
          navigate(-1);
        } catch (error) {
          console.error("Failed to update profile:", error);
          toast.error("Không thể lưu thông tin. Vui lòng thử lại.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="bg-section p-4 grid gap-4">
        <Input name="name" label="Họ tên" defaultValue={userInfo?.name} />
        <Input
          name="phone"
          label="Số điện thoại"
          placeholder="Nhập số điện thoại"
          defaultValue={userInfo?.phone}
        />
        <Input
          name="alias"
          label="Tên địa chỉ"
          placeholder="Ví dụ: nhà, công ty"
          defaultValue={""}
        />
        <Input
          name="address"
          label="Địa chỉ"
          placeholder="Nhập địa chỉ"
          defaultValue={""}
        />
        <Input
          name="address2"
          label="Địa chỉ (tiếp)"
          placeholder="Tòa nhà, số căn (không bắt buộc)"
          defaultValue={""}
        />
        <Input
          name="city"
          label="Thành phố/Tỉnh"
          placeholder="Nhập thành phố"
          defaultValue={""}
        />
        <Input
          name="province"
          label="Quận/Huyện"
          placeholder="Nhập quận/huyện"
          defaultValue={""}
        />
        <Input
          name="postalCode"
          label="Mã bưu điện"
          placeholder="Nhập mã bưu điện"
          defaultValue={""}
        />
      </div>
      <div className="p-6 pt-4 bg-section">
        <Button htmlType="submit" fullWidth loading={saving} disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}

export default ProfileEditorPage;
