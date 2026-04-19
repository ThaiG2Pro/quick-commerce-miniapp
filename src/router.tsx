import Layout from "@/components/layout";
import React, { Suspense, lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { getBasePath } from "@/utils/zma";

// Route-based code-splitting: lazy-load pages to reduce initial bundle
const HomePage = lazy(() => import("@/pages/home"));
const CategoryListPage = lazy(() => import("@/pages/catalog/category-list"));
const CategoryDetailPage = lazy(() => import("@/pages/catalog/category-detail"));
const ProductDetailPage = lazy(() => import("@/pages/catalog/product-detail"));
const CartPage = lazy(() => import("@/pages/cart"));
const ShippingAddressPage = lazy(() => import("./pages/cart/shipping-address"));
const StationsPage = lazy(() => import("./pages/cart/stations"));
const OrdersPage = lazy(() => import("./pages/orders"));
const OrderDetailPage = lazy(() => import("./pages/orders/detail"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const ProfileEditorPage = lazy(() => import("./pages/profile/editor"));
const SearchPage = lazy(() => import("@/pages/search"));

function wrap(node: React.ReactNode) {
  return <Suspense fallback={<div />}>{node}</Suspense>;
}

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Layout />,
      children: [
        {
          path: "/",
          element: wrap(<HomePage />),
          handle: {
            logo: true,
            search: true,
          },
        },
        {
          path: "/categories",
          element: wrap(<CategoryListPage />),
          handle: {
            title: "Danh mục",
            noBack: true,
          },
        },
        {
          path: "/orders/:status?",
          element: wrap(<OrdersPage />),
          handle: {
            title: "Đơn hàng",
          },
        },
        {
          path: "/order/:id",
          element: wrap(<OrderDetailPage />),
          handle: {
            title: "Thông tin đơn hàng",
          },
        },
        {
          path: "/cart",
          element: wrap(<CartPage />),
          handle: {
            title: "Giỏ hàng",
            noBack: true,
            noFloatingCart: true,
          },
        },
        {
          path: "/shipping-address",
          element: wrap(<ShippingAddressPage />),
          handle: {
            title: "Địa chỉ nhận hàng",
            noFooter: true,
            noFloatingCart: true,
          },
        },
        {
          path: "/stations",
          element: wrap(<StationsPage />),
          handle: {
            title: "Điểm nhận hàng",
            noFooter: true,
          },
        },
        {
          path: "/profile",
          element: wrap(<ProfilePage />),
          handle: {
            logo: true,
          },
        },
        {
          path: "/profile/edit",
          element: wrap(<ProfileEditorPage />),
          handle: {
            title: "Thông tin tài khoản",
            noFooter: true,
            noFloatingCart: true,
          },
        },
        {
          path: "/category/:handle",
          element: wrap(<CategoryDetailPage />),
          handle: {
            search: true,
            title: ({ categories, params }) =>
              categories.find((c) => c.handle === params.handle)?.name,
          },
        },
        {
          path: "/product/:id",
          element: wrap(<ProductDetailPage />),
          handle: {
            scrollRestoration: 0, // when user selects another product in related products, scroll to the top of the page
            noFloatingCart: true,
          },
        },
        {
          path: "/search",
          element: wrap(<SearchPage />),
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
