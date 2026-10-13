import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Scrolls to and briefly highlights the element named in the URL hash (e.g. links from the inbox). */
export function useScrollToHash(ready = true) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return undefined;
    const element = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!element) return undefined;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("ring-2", "ring-primary", "ring-offset-2");
    const timer = window.setTimeout(() => element.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2500);
    return () => window.clearTimeout(timer);
  }, [hash, ready]);
}
