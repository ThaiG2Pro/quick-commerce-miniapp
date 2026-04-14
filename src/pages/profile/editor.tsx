import CONFIG from "@/config";
import { userInfoKeyState, userInfoState } from "@/state";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "zmp-ui";
import { updateCurrentCustomer } from "@/lib/medusa-sdk";
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
        const phone = String(data.get("phone") || "").trim();
        const email = String(data.get("email") || "").trim();
        const address = String(data.get("address") || "").trim();
        const nameParts = splitName(name || userInfo?.name || "");

        setSaving(true);
        try {
          try {
            await requestInfo();
            try {
              await updateCurrentCustomer({
                first_name: nameParts.first_name || undefined,
                last_name: nameParts.last_name || undefined,
                email: email || undefined,
                phone: phone || undefined,
                metadata: {
                  address,
                },
              });
            } catch (error) {
              const status =
                typeof error === "object" && error !== null
                  ? ((error as { status?: number; response?: { status?: number } }).status ||
                    (error as { status?: number; response?: { status?: number } }).response
                      ?.status)
                  : undefined;
              if (status === 401 || status === 403) {
                await requestInfo();
                await updateCurrentCustomer({
                  first_name: nameParts.first_name || undefined,
                  last_name: nameParts.last_name || undefined,
                  email: email || undefined,
                  phone: phone || undefined,
                  metadata: {
                    address,
                  },
                });
              } else {
                throw error;
              }
            }
          } catch (error) {
            console.warn("Cannot update Medusa customer profile, fallback to local save:", error);
          }

          const newUserInfo = {
            id: userInfo?.id || "",
            name: name || userInfo?.name || "",
            avatar: userInfo?.avatar || "",
            phone: phone || userInfo?.phone || "",
            email: email || userInfo?.email || "",
            address: address || userInfo?.address || "",
          };

          localStorage.setItem(
            CONFIG.STORAGE_KEYS.USER_INFO,
            JSON.stringify(newUserInfo)
          );
          refreshUserInfo();
          toast.success("Đã cập nhật thông tin tài khoản");
          navigate(-1);
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
          required
          defaultValue={userInfo?.phone}
        />
        <Input
          name="email"
          label="Email"
          placeholder="Email"
          defaultValue={userInfo?.email}
        />
        <Input
          name="address"
          label="Địa chỉ"
          placeholder="Nhập dịa chỉ"
          defaultValue={userInfo?.address}
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
