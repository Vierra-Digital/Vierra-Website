"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  return (
    <Link
      href="/"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        // Hand in the router so leaving another page for the home section is a client-side
        // transition rather than a full document load.
        scrollToHomeSection(sectionId, (path) => router.push(path));
      }}
    >
      {children}
    </Link>
  );
}
