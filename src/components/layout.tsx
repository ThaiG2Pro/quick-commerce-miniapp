import { Outlet } from "react-router-dom";
import Header from "./header";
import Footer from "./footer";
import { Suspense, lazy, useEffect } from "react";
import { PageSkeleton } from "./skeleton";
import { ScrollRestoration } from "./scroll-restoration";
import FloatingCartPreview from "./floating-cart-preview";
import { useBootstrapStorefront } from "@/hooks";
const DemoNotice = lazy(() => import("./demo-notice"));
const LazyToaster = lazy(() =>
  import("react-hot-toast").then((m) => ({ default: m.Toaster }))
);

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
      <Suspense fallback={null}>
        <DemoNotice />
      </Suspense>
      <Suspense fallback={null}>
        <LazyToaster
          containerClassName="toast-container"
          containerStyle={{
            top: "calc(50% - 24px)",
          }}
        />
      </Suspense>
      <FloatingCartPreview />
      <ScrollRestoration />
    </div>
  );
}
