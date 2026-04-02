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

// --- 📦 LOGIC LẤY SẢN PHẨM (SỬA THEO "LONG MẠCH" MỚI) ---
export const productsState = atom(async (get) => {
  try {
    const MY_REGION_ID = "reg_01KN1H836G62BN9306B3P6EA68";

    // Gọi API với fields chuẩn như documentation ông tìm được
    const { products } = await medusa.products.list(
      {
        region_id: MY_REGION_ID,
        // Ép lấy calculated_price để có giá cuối cùng
        fields: "*variants.calculated_price",
      },
      {
        "x-publishable-api-key":
          "pk_c4c2e2da3439360ceea472142d633c8c408ac63c99365de339faad78bc058805",
      },
    );

    return products.map((p: any) => {
      const variant = p.variants?.[0];

      // LẤY GIÁ THẬT: Truy xuất đúng vào calculated_amount như trong hình image_3d4a80.jpg
      const finalPrice = variant?.calculated_price?.calculated_amount || 0;

      // KHÔNG CÒN DÙNG "BÙA" NỮA - LẤY TRỰC TIẾP TỪ SERVER
      return {
        id: String(p.id),
        name: p.title,
        price: Number(finalPrice), // Đảm bảo là kiểu số
        image: p.thumbnail || "https://via.placeholder.com/150",
        description: p.description || "",
        categoryId: p.categories?.[0]?.id || "default",
        categoryName: p.categories?.[0]?.name || "Khác",
      };
    });
  } catch (error) {
    console.error("❌ Lỗi gọi API Medusa:", error);
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

// --- Giỏ hàng & Tìm kiếm ---
export const cartState = atom<Cart>([]);
export const selectedCartItemIdsState = atom<number[]>([]);
export const cartTotalState = atom((get) => {
  const items = get(cartState);
  return {
    totalItems: items.length,
    totalAmount: items.reduce(
      (t, i) => t + (i.product?.price || 0) * i.quantity,
      0,
    ),
  };
});

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
