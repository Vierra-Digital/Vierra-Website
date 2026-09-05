import NotFoundContent from "@/components/NotFoundContent"

/**
 * App Router 404. The body is shared with pages/404.tsx — Next requires a not-found page per
 * router and neither serves the other's routes, so the only difference is which router mounts it.
 */
export default function NotFound() {
  return <NotFoundContent />
}
