import {
  billingAddressState,
  cartIdState,
  refreshCartState,
  shippingAddressState,
} from "@/state";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useResetAtom } from "jotai/utils";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Button, Icon, Input } from "zmp-ui";
import {
  getCurrentCustomer,
  updateCartAddresses,
  upsertCurrentCustomerAddress,
  updateCurrentCustomer,
} from "@/lib/medusa-sdk";
import { useEffect, useState } from "react";
import { useHydrateCheckoutAddresses } from "@/hooks";

function ShippingAddressPage() {
  const [address, setAddress] = useAtom(shippingAddressState);
  const [, setBillingAddress] = useAtom(billingAddressState);
  const cartId = useAtomValue(cartIdState);
  const refreshCart = useSetAtom(refreshCartState);
  const resetAddress = useResetAtom(shippingAddressState);
  const resetBillingAddress = useResetAtom(billingAddressState);
  const navigate = useNavigate();
  const hydrateCheckoutAddresses = useHydrateCheckoutAddresses();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void hydrateCheckoutAddresses();
  }, [hydrateCheckoutAddresses]);

  return (
    <form
      key={`${address?.alias || ""}-${address?.address || ""}-${address?.city || ""}-${address?.name || ""}-${address?.phone || ""}`}
      className="h-full flex flex-col justify-between"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const newAddress: Record<string, string> = {};
        data.forEach((value, key) => {
          newAddress[key] = String(value);
        });

        // Validate required address fields
        if (!newAddress.address || !newAddress.city || !newAddress.name) {
          toast.error("Vui lòng điền đủ thông tin địa chỉ (địa chỉ, thành phố, tên)");
          return;
        }

        try {
          setSaving(true);
          const customer = await getCurrentCustomer();
          const normalizedAddress = {
            alias: newAddress.alias || "",
            address: newAddress.address || "",
            address2: newAddress.address2 || "",
            city: newAddress.city || "",
            postalCode: newAddress.postalCode || "",
            province: newAddress.province || "",
            countryCode: "vn",
            name:
              newAddress.name ||
              [customer?.first_name, customer?.last_name].filter(Boolean).join(" "),
            phone: newAddress.phone || customer?.phone || "",
          };

          await upsertCurrentCustomerAddress(normalizedAddress);

          // Sync customer profile name/phone from address if provided
          try {
            function splitFullNameLocal(name: string) {
              const parts = (name || "").trim().split(/\s+/).filter(Boolean);
              return { first_name: parts[0] || "", last_name: parts.slice(1).join(" ") || "" };
            }

            const { first_name, last_name } = splitFullNameLocal(normalizedAddress.name || "");
            const updatePayload: { first_name?: string; last_name?: string; phone?: string } = {};
            if (first_name) updatePayload.first_name = first_name;
            if (last_name) updatePayload.last_name = last_name;
            if (normalizedAddress.phone) updatePayload.phone = normalizedAddress.phone;

            if (Object.keys(updatePayload).length) {
              await updateCurrentCustomer(updatePayload);
            }
          } catch (err) {
            console.warn("Failed to sync customer profile from address form:", err);
          }

          if (cartId) {
            await updateCartAddresses(cartId, {
              shippingAddress: normalizedAddress,
              billingAddress: normalizedAddress,
              email: customer?.email || "",
            });
            await refreshCart();
          }

          setAddress(normalizedAddress);
          setBillingAddress(normalizedAddress);
          toast.success("Đã cập nhật địa chỉ");
          navigate(-1);
        } catch (error) {
          console.error("Failed to update checkout address:", error);
          toast.error("Không thể lưu địa chỉ lên giỏ hàng.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="py-2 space-y-2">
        <div className="bg-section p-4 grid gap-4">
          <Input
            name="alias"
            label="Tên địa chỉ"
            placeholder="Ví dụ: công ty, trường học"
            defaultValue={address?.alias}
          />
          <Input
            name="address"
            label={
              <>
                Địa chỉ <span className="text-danger">*</span>
              </>
            }
            placeholder="Nhập địa chỉ"
            required
            defaultValue={address?.address}
            onInvalid={(e) => {
              e.currentTarget.setCustomValidity("Vui lòng nhập địa chỉ");
              e.currentTarget.reportValidity();
            }}
            onInput={(e) => {
              e.currentTarget.setCustomValidity("");
            }}
          />
          <Input
            name="postalCode"
            label={
              <>
                Mã bưu điện <span className="text-danger">*</span>
              </>
            }
            placeholder="700000"
            required
            defaultValue={address?.postalCode}
            onInvalid={(e) => {
              e.currentTarget.setCustomValidity("Vui lòng nhập mã bưu điện");
              e.currentTarget.reportValidity();
            }}
            onInput={(e) => {
              e.currentTarget.setCustomValidity("");
            }}
          />
          <Input
            name="city"
            label={
              <>
                Thành phố <span className="text-danger">*</span>
              </>
            }
            placeholder="Ví dụ: Hồ Chí Minh"
            required
            defaultValue={address?.city}
            onInvalid={(e) => {
              e.currentTarget.setCustomValidity("Vui lòng nhập thành phố");
              e.currentTarget.reportValidity();
            }}
            onInput={(e) => {
              e.currentTarget.setCustomValidity("");
            }}
          />
        </div>
        <div className="bg-section p-4 grid gap-4">
          <Input
            name="name"
            label="Tên người nhận"
            placeholder="Nhập tên người nhận"
            defaultValue={address?.name}
          />
          <Input
            name="phone"
            label="Số điện thoại"
            placeholder="0912345678"
            defaultValue={address?.phone}
          />
        </div>
        <Button
          fullWidth
          className="!bg-section !text-danger !rounded-none"
          type="danger"
          prefixIcon={<Icon icon="zi-delete" />}
          onClick={() => {
            if (saving) {
              return;
            }
            resetAddress();
            resetBillingAddress();
            toast.success("Đã xóa địa chỉ");
            navigate(-1);
          }}
          disabled={saving}
        >
          Xóa địa chỉ này
        </Button>
      </div>
      <div className="p-6 pt-4 bg-section">
        <Button htmlType="submit" fullWidth disabled={saving}>
          {saving ? "Đang lưu..." : "Xong"}
        </Button>
      </div>
    </form>
  );
}

export default ShippingAddressPage;
