import { lazy } from "react";
import Layout from "@/components/layout";
import { createBrowserRouter } from "react-router-dom";
import { getBasePath } from "@/utils/zma";

const HomePage = lazy(() => import("@/pages/home"));
const CartPage = lazy(() => import("@/pages/cart"));
const CategoryDetailPage = lazy(() => import("@/pages/catalog/category-detail"));
const CategoryListPage = lazy(() => import("@/pages/catalog/category-list"));
const ProductDetailPage = lazy(() => import("@/pages/catalog/product-detail"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const SearchPage = lazy(() => import("@/pages/search"));
const OrdersPage = lazy(() => import("./pages/orders"));
const ShippingAddressPage = lazy(() => import("./pages/cart/shipping-address"));
const StationsPage = lazy(() => import("./pages/cart/stations"));
const OrderDetailPage = lazy(() => import("./pages/orders/detail"));
const ProfileEditorPage = lazy(() => import("./pages/profile/editor"));

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Layout />,
      children: [
        {
          path: "/",
          element: <HomePage />,
          handle: {
            logo: true,
            search: true,
          },
        },
        {
          path: "/categories",
          element: <CategoryListPage />,
          handle: {
            title: "Danh mục",
            noBack: true,
          },
        },
        {
          path: "/orders/:status?",
          element: <OrdersPage />,
          handle: {
            title: "Đơn hàng",
          },
        },
        {
          path: "/order/:id",
          element: <OrderDetailPage />,
          handle: {
            title: "Thông tin đơn hàng",
          },
        },
        {
          path: "/cart",
          element: <CartPage />,
          handle: {
            title: "Giỏ hàng",
            noBack: true,
            noFloatingCart: true,
          },
        },
        {
          path: "/shipping-address",
          element: <ShippingAddressPage />,
          handle: {
            title: "Địa chỉ nhận hàng",
            noFooter: true,
            noFloatingCart: true,
          },
        },
        {
          path: "/stations",
          element: <StationsPage />,
          handle: {
            title: "Điểm nhận hàng",
            noFooter: true,
          },
        },
        {
          path: "/profile",
          element: <ProfilePage />,
          handle: {
            logo: true,
          },
        },
        {
          path: "/profile/edit",
          element: <ProfileEditorPage />,
          handle: {
            title: "Thông tin tài khoản",
            noFooter: true,
            noFloatingCart: true,
          },
        },
        {
          path: "/category/:handle",
          element: <CategoryDetailPage />,
          handle: {
            search: true,
            title: ({ categories, params }) =>
              categories.find((c) => c.handle === params.handle)?.name,
          },
        },
        {
          path: "/product/:id",
          element: <ProductDetailPage />,
          handle: {
            scrollRestoration: 0, // when user selects another product in related products, scroll to the top of the page
            noFloatingCart: true,
          },
        },
        {
          path: "/search",
          element: <SearchPage />,
          handle: {
            search: true,
            title: "Tìm kiếm",
            noFooter: true,
          },
        },
      ],
    },
  ],
  { basename: getBasePath() }
);

export default router;
