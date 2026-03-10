import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setIsMobile(false);
      return;
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    // Safari/older browsers: MediaQueryList may not support addEventListener.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
    } else {
      (mql as any).addListener?.(onChange);
    }

    onChange();

    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onChange);
      } else {
        (mql as any).removeListener?.(onChange);
      }
    };
  }, []);

  return !!isMobile;
}
