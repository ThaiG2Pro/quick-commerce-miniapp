import { useRouteHandle } from "@/hooks";
import { FC, useEffect } from "react";
import { useLocation, useMatches } from "react-router";

const scrollPositions = {};

function findElementWithScrollbar() {
  // Prefer the browser's scrolling element; fall back to body
  return (document.scrollingElement as Element) || document.body;
}

export const ScrollRestoration: FC = () => {
  const location = useLocation();
  const [handle] = useRouteHandle();

  useEffect(() => {
    // Look for the main scroll element on the page
    const content = findElementWithScrollbar();
    if (content) {
      if (handle?.scrollRestoration !== undefined) {
        content.scrollTo(0, handle.scrollRestoration);
      } else {
        const key = `${location.pathname}${location.search}`;
        if (scrollPositions[key]) {
          // Scroll to the previous position on this new location
          content.scrollTo(0, scrollPositions[key]);
        }
        let ticking = false;
        const saveScrollPosition = () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            scrollPositions[key] = (content as Element).scrollTop;
            ticking = false;
          });
        };
        content.addEventListener("scroll", saveScrollPosition, { passive: true });
        return () => content.removeEventListener("scroll", saveScrollPosition, { passive: true });
      }
    }
    return () => {};
  }, [location]);

  return <></>;
};
