"use client";

import Link from "next/link";
import { scrollToHomeSection } from "@/lib/sectionScroll";

/**
 * Link that scrolls to a homepage section without leaving a #hash in the URL.
 * Usable inside server components (e.g. the footer) since it's a client island.
 */
export function SectionScrollLink({
  sectionId,
  className,
  children,
}: {
  sectionId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href="/"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        scrollToHomeSection(sectionId);
      }}
    >
      {children}
    </Link>
  );
}
