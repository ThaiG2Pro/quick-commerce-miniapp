// @ts-ignore
import medusa from "./medusa-client";
import { atom } from "jotai";
import {
  atomFamily,
  atomWithRefresh,
  atomWithStorage,
  loadable,
  unwrap,
} from "jotai/utils";
import {
  Cart,
  Category,
  Delivery,
  Location,
  Order,
  OrderStatus,
  Product,
  ShippingAddress,
  Station,
  UserInfo,
} from "@/types";
import { requestWithFallback } from "@/utils/request";
import {
  getSetting,
  getUserInfo,
  getPhoneNumber,
  getLocation,
  getStorage, // ĐÃ GOM LÊN TRÊN CÙNG
  setStorage, // ĐÃ GOM LÊN TRÊN CÙNG
} from "zmp-sdk/apis";
import toast from "react-hot-toast";
import { calculateDistance } from "./utils/location";
import { formatDistant } from "./utils/format";
import CONFIG from "./config";

// --- Quản lý thông tin User ---
export const userInfoKeyState = atom(0);
export const userInfoState = atom<Promise<UserInfo>>(async (get) => {
  get(userInfoKeyState);
  const savedUserInfo = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_INFO);
  if (savedUserInfo) return JSON.parse(savedUserInfo);
  const { authSetting } = await getSetting({});
  const isDev = !window.ZJSBridge;
  if (authSetting?.["scope.userInfo"] || isDev) {
    const { userInfo } = await getUserInfo({});
    const phone =
      authSetting?.["scope.userPhonenumber"] || isDev
        ? await get(phoneState)
        : "";
    return {
      id: userInfo.id,
      name: userInfo.name,
      avatar: userInfo.avatar,
      phone,
      email: "",
      address: "",
    };
  }
});
export const loadableUserInfoState = loadable(userInfoState);
export const phoneState = atom(async () => {
  let phone = "";
  try {
    const { token } = await getPhoneNumber({});
    await new Promise((res) => setTimeout(res, 1000));
    phone = "0912345678";
  } catch (e) {
    console.warn(e);
  }
  return phone;
});

// --- Giao diện chung ---
export const bannersState = atom(() =>
  requestWithFallback<string[]>("/banners", []),
);
export const tabsState = atom(["Tất cả", "Nam", "Nữ", "Trẻ em"]);
export const selectedTabIndexState = atom(0);
export const categoriesState = atom(() =>
  requestWithFallback<Category[]>("/categories", []),
);
export const categoriesStateUpwrapped = unwrap(categoriesState, (p) => p ?? []);

// --- 📦 LOGIC LẤY SẢN PHẨM (ĐÃ VƯỢT ẢI NGROK) ---
// --- 📦 LOGIC LẤY SẢN PHẨM (ĐÃ UPDATE TỰ ĐỘNG LẤY REGION) ---
// --- 📦 LOGIC LẤY SẢN PHẨM (ĐÃ UPDATE TỰ ĐỘNG LẤY REGION & SỬA LỖI VARIANT_ID) ---
export const productsState = atom(async (get) => {
  try {
    // 1. Tự động "hỏi thăm" server xem có những Region nào
    const { regions } = await medusa.regions.list();
    if (!regions || regions.length === 0) {
      console.error("❌ Server chưa cấu hình Region!");
      return [];
    }
    const currentRegionId = regions[0].id; // Lấy ID đầu tiên động 100%

    // 2. Gọi API với Region lấy được và LỆNH BÀI
    const { products } = await medusa.products.list(
      {
        region_id: currentRegionId,
        fields: "*variants.calculated_price",
      },
      {
        "ngrok-skip-browser-warning": "true", 
      }
    );

    return products.map((p: any) => {
      const variant = p.variants?.[0];
      const finalPrice = variant?.calculated_price?.calculated_amount || 0;

      return {
        id: String(p.id),
        variantId: String(variant?.id), // 👉 ĐÂY LÀ DÒNG CHÍ MẠNG QUYẾT ĐỊNH GIỎ HÀNG SỐNG HAY CHẾT NÈ
        name: p.title,
        price: Number(finalPrice), 
        image: p.thumbnail || "https://via.placeholder.com/150",
        description: p.description || "",
        categoryId: p.categories?.[0]?.id || "default",
        categoryName: p.categories?.[0]?.name || "Khác",
      };
    });
  } catch (error) {
    console.error("❌ Lỗi gọi API lấy sản phẩm:", error);
    return [];
  }
});
export const flashSaleProductsState = atom((get) => get(productsState));
export const recommendedProductsState = atom((get) => get(productsState));

export const productState = atomFamily((id: string) =>
  atom(async (get) => {
    const products = await get(productsState);
    return products.find((p) => String(p.id) === id);
  }),
);

export const productsByCategoryState = atomFamily((id: string) =>
  atom(async (get) => {
    const products = await get(productsState);
    return products.filter((p) => String(p.categoryId) === id);
  }),
);

// --- 🛒 GIỎ HÀNG (Cart) ---

// 1. Lưu ID giỏ hàng (Chỉ chứa ID string)
export const cartIdState = atom<string | null>(null);

// 2. Chứa toàn bộ dữ liệu giỏ hàng (Items, Total,...) từ Medusa
export const cartState = atom<any | null>(null);

// 3. Atom tính tổng số lượng món để hiện cái Badge màu đỏ
export const cartTotalState = atom((get) => {
  const cart = get(cartState);
  if (!cart || !cart.items) return { totalItems: 0, totalAmount: 0 };
  
  return {
    totalItems: cart.items.reduce((total: number, item: any) => total + item.quantity, 0),
    totalAmount: cart.total || 0,
  };
});

// ==========================================
// CÁC HÀM XỬ LÝ GIỎ HÀNG (ACTIONS)
// ==========================================

// ==========================================
// CÁC HÀM XỬ LÝ GIỎ HÀNG (ACTIONS)
// ==========================================

export const initializeCartAtom = atom(null, async (get, set) => {
  try {
    // 1. Lấy Region động trước (kiểu gì cũng cần xài)
    const { regions } = await medusa.regions.list();
    if (!regions || regions.length === 0) return;
    const currentRegionId = regions[0].id;
    
    // 2. Đọc Zalo Storage xem có giỏ hàng cũ không
    const { medusa_cart_id } = await getStorage({ keys: ["medusa_cart_id"] });

    if (medusa_cart_id) {
      try {
        // Có giỏ cũ -> Cố gắng lấy data từ Medusa
        const { cart } = await medusa.carts.retrieve(medusa_cart_id);
        set(cartIdState, cart.id);
        set(cartState, cart);
        return; // Thành công thì thoát hàm
      } catch (retrieveError) {
        // BƯỚC PHÒNG NGỰ CỰC GẮT LÀ ĐÂY!
        // Nếu server bị reset (như Onrender nãy giờ), mã giỏ cũ sẽ chết.
        // Bắt lỗi 400 ở đây, không cho app sập, tự động bỏ qua để tạo giỏ mới!
        console.warn("⚠️ Giỏ hàng cũ đã bốc hơi khỏi server, tiến hành dọn rác và tạo mới...");
        await setStorage({ data: { medusa_cart_id: "" } }); 
      }
    } 
    
    // 3. Khách mới (hoặc giỏ cũ bị lỗi 400) -> Tạo giỏ hàng mới tinh theo Region động
    const { cart } = await medusa.carts.create({ region_id: currentRegionId });
    
    // LƯU VÀO ZALO STORAGE
    await setStorage({ data: { medusa_cart_id: cart.id } });
    
    set(cartIdState, cart.id);
    set(cartState, cart);
    
  } catch (error) {
    console.error("❌ Lỗi khởi tạo giỏ hàng:", error);
  }
});

// Hàm Thêm sản phẩm
export const addToCartAtom = atom(null, async (get, set, payload: { variantId: string, quantity: number }) => {
  const cartId = get(cartIdState);
  if (!cartId) return;

  try {
    const { cart } = await medusa.carts.lineItems.create(cartId, {
      variant_id: payload.variantId,
      quantity: payload.quantity,
    });
    set(cartState, cart); 
  } catch (error) {
    console.error("Lỗi thêm vào giỏ:", error);
  }
});

// Hàm Cập nhật số lượng (+ / -)
export const updateCartItemAtom = atom(null, async (get, set, payload: { lineId: string, quantity: number }) => {
  const cartId = get(cartIdState);
  if (!cartId) return;

  try {
    const { cart } = await medusa.carts.lineItems.update(cartId, payload.lineId, {
      quantity: payload.quantity,
    });
    set(cartState, cart);
  } catch (error) {
    console.error("Lỗi update giỏ:", error);
  }
});

// Hàm Xóa món
export const removeCartItemAtom = atom(null, async (get, set, lineId: string) => {
  const cartId = get(cartIdState);
  if (!cartId) return;

  try {
    const { cart } = await medusa.carts.lineItems.delete(cartId, lineId);
    set(cartState, cart);
  } catch (error) {
    console.error("Lỗi xóa món:", error);
  }
});

// --- Tìm kiếm ---
export const keywordState = atom("");
export const searchResultState = atom(async (get) => {
  const k = get(keywordState);
  const products = await get(productsState);
  return products.filter((p) => p.name.toLowerCase().includes(k.toLowerCase()));
});

// --- Vị trí và Trạm ---
export const stationsState = atom(async () => {
  const location = { lat: 10.773756, lng: 106.689247 };
  const stations = await requestWithFallback<Station[]>("/stations", []);
  return stations.map((s) => ({
    ...s,
    distance: formatDistant(
      calculateDistance(
        location.lat,
        location.lng,
        s.location.lat,
        s.location.lng,
      ),
    ),
  }));
});
export const selectedStationIndexState = atom(0);
export const selectedStationState = atom(async (get) => {
  const idx = get(selectedStationIndexState);
  const stas = await get(stationsState);
  return stas[idx];
});

export const shippingAddressState = atomWithStorage<
  ShippingAddress | undefined
>(CONFIG.STORAGE_KEYS.SHIPPING_ADDRESS, undefined);

export const ordersState = atomFamily((s: OrderStatus) =>
  atomWithRefresh(async () => {
    const orders = await requestWithFallback<Order[]>("/orders", []);
    return orders.filter((o) => o.status === s);
  }),
);

export const deliveryModeState = atomWithStorage<Delivery["type"]>(
  CONFIG.STORAGE_KEYS.DELIVERY,
  "shipping",
);
// --- TRẠNG THÁI HIỂN THỊ MÃ QR TRANH TOÁN ---
// Nút bật/tắt bảng QR
export const showQRState = atom(false); 

// Biến để hứng cái chuỗi ZaloPay siêu dài từ ông Giang gửi về
export const zaloPayQRStringState = atom("");