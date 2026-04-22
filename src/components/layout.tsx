import { Outlet } from "react-router-dom";
import Header from "./header";
import Footer from "./footer";
import { lazy, Suspense, useEffect } from "react";
import PageSkeleton from "./page-skeleton";
import { Toaster } from "react-hot-toast";
import { ScrollRestoration } from "./scroll-restoration";
import FloatingCartPreview from "./floating-cart-preview";
import { useBootstrapStorefront } from "@/hooks";

const DemoNotice = lazy(() => import("./demo-notice"));

export default function Layout() {
  const bootstrapStorefront = useBootstrapStorefront();

  useEffect(() => {
    bootstrapStorefront();
  }, [bootstrapStorefront]);

  return (
    <div className="w-screen h-screen flex flex-col bg-section text-foreground">
      <Header />
      <div className="flex-1 overflow-y-auto bg-background">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </div>
      <Footer />
      <Suspense>
        <DemoNotice />
      </Suspense>
      <Toaster
        containerClassName="toast-container"
        containerStyle={{
          top: "calc(50% - 24px)",
        }}
      />
      <FloatingCartPreview />
      <ScrollRestoration />
    </div>
  );
}
