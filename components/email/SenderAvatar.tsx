import { useState } from "react";

/**
 * The avatar shown against a sender in the message list.
 *
 * The list previously had no avatar of any kind — only the opened message did — so every row looked
 * anonymous and "profile pictures don't work" was simply true here. One request per sender to
 * /api/avatar resolves a Gravatar or the sending domain's logo; a 204 (no avatar exists) leaves the
 * <img> empty and onError falls through to initials.
 *
 * The initials are coloured deterministically from the address rather than shown in one flat grey,
 * so a sender without a picture reads as a deliberate identity instead of a broken image.
 */

const PALETTE = [
  { bg: "#3B2A5E", fg: "#D9C7FF" },
  { bg: "#1F3A5F", fg: "#BEDCFF" },
  { bg: "#1E4A42", fg: "#B6EBDD" },
  { bg: "#4A3A1E", fg: "#F3DDA8" },
  { bg: "#4A2436", fg: "#F7C6D9" },
  { bg: "#2E3A5C", fg: "#C6D2F7" },
  { bg: "#3F2E4E", fg: "#E4C9F5" },
  { bg: "#1F4030", fg: "#BFE9CC" },
];

/** Stable across renders and sessions, so a sender keeps the same colour every time. */
function paletteFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function SenderAvatar({
  email,
  initials,
  size = 26,
}: {
  email: string;
  initials: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const address = email.trim().toLowerCase();
  const showImage = Boolean(address.includes("@")) && !failed;
  const colors = paletteFor(address || initials);

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: colors.bg }}
      aria-hidden
    >
      {/* Initials sit underneath: they show through for a 204 (empty image) with no second paint. */}
      <span className="absolute text-[10px] font-semibold leading-none" style={{ color: colors.fg }}>
        {initials}
      </span>
      {showImage ? (
        /* Plain <img>: next/image rejects hosts outside images.remotePatterns, and this URL is our
           own proxy precisely so the browser never sends a referrer to Gravatar or Google. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={`/api/avatar?email=${encodeURIComponent(address)}`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="relative h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}
