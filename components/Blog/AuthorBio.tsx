import Image from "next/image"
import Link from "next/link"
import { Bricolage_Grotesque, Inter } from "next/font/google"
import { getAuthorProfile } from "@/lib/authorProfiles"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

/**
 * "About the author" card — a visible E-E-A-T signal that pairs with the Person
 * schema. Renders nothing until the author has a `bio` in lib/authorProfiles,
 * so it's safe to drop onto every post.
 */
export default function AuthorBio({ name }: { name: string }) {
  const profile = getAuthorProfile(name)
  if (!profile.bio) return null

  const authorUrl = `/blog/author/${encodeURIComponent(name)}`
  const linkedIn = profile.sameAs?.find((u) => u.includes("linkedin.com"))

  return (
    <aside
      className={`mt-10 overflow-hidden rounded-2xl border border-[#ECE6F5] bg-white shadow-[0_10px_40px_-24px_rgba(112,28,192,0.45)] ${inter.className}`}
    >
      {/* Brand accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-[#701CC0] via-[#8F42FF] to-[#C99DFF]" />
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center md:p-7">
        {profile.image ? (
          <Image
            src={profile.image}
            alt={`${name}, ${profile.jobTitle ?? "author"} at Vierra Digital`}
            width={76}
            height={76}
            draggable={false}
            className="h-[76px] w-[76px] flex-shrink-0 select-none rounded-full object-cover ring-2 ring-[#8F42FF]/40 ring-offset-2 ring-offset-white [-webkit-user-drag:none]"
          />
        ) : (
          <div className="flex h-[76px] w-[76px] flex-shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-[#701CC0] to-[#8F42FF] text-2xl font-bold text-white ring-2 ring-[#8F42FF]/40 ring-offset-2 ring-offset-white">
            {name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9A93AE]">
            About the author
          </p>
          <div className="mt-1">
            <Link
              href={authorUrl}
              className={`block text-xl font-bold leading-tight text-[#18042A] transition-colors hover:text-[#701CC0] ${bricolage.className}`}
            >
              {name}
            </Link>
            {profile.jobTitle && (
              <p className="mt-0.5 text-sm font-medium text-[#701CC0]">
                {profile.jobTitle}, {profile.company ?? "Vierra Digital"}
              </p>
            )}
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-[#4B4460]">{profile.bio}</p>
          {linkedIn && (
            <a
              href={linkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#701CC0] transition-colors hover:text-[#8F42FF]"
            >
              Connect On LinkedIn
              <span aria-hidden className="animate-arrow-nudge">
                →
              </span>
            </a>
          )}
        </div>
      </div>
    </aside>
  )
}
