"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Defers mounting `children` until the placeholder scrolls near the viewport,
 * then keeps them mounted. Stops heavy, animation-/timer-driven sections from
 * mounting (and burning the main thread) while far off-screen. Renders a
 * min-height placeholder first to avoid layout shift.
 *
 * Client-only by design — use it only for decorative sections without
 * SEO-critical text; text-bearing sections should stay server-rendered.
 */
export default function LazyMount({
  children,
  minHeight,
  rootMargin = "400px",
}: {
  children: ReactNode;
  minHeight?: number | string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    // Environments without IntersectionObserver (very old browsers): mount now.
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show, rootMargin]);

  if (show) return <>{children}</>;
  return <div ref={ref} aria-hidden style={{ minHeight }} />;
}
