"use client"
import Image from "next/image"
import { useState, useEffect } from "react"
import { bricolage, inter } from "@/lib/fonts";
import { motion, AnimatePresence } from "framer-motion"


type Testimonial = {
  name: string
  role: string
  text: string
  image?: string
}

const all: Testimonial[] = [
  {
    name: "Richard K. Segal",
    role: "Founder of Iron & Water Co.",
    text: "Vierra built our digital core. Not a one-off project, but a living system that keeps growing with us. What really sets them apart is how they teach. They take complex things like SEO, funnel design, and analytics and make them simple enough for anyone on our team to use. Vierra has genuinely become part of our growth and our culture.",
    image: "/assets/Testimonials/TestimonialProfiles/Richard.jpg",
  },
  {
    name: "Long Doan",
    role: "CEO of eCyberForce",
    text: "I used to struggle to win even a fraction of the leads my competitors were getting. After signing with Vierra, my leads jumped from around 20 a month to over 3,000.",
    image: "/assets/Testimonials/TestimonialProfiles/LongDoan.jpg",
  },
  {
    name: "Nowfal Ebrahim",
    role: "CFO of Invisalign",
    text: "Vierra has driven doctor referrals, grown our presence in offices, and increased our revenue. Every month we expand and see higher profits.",
    image: "/assets/Testimonials/TestimonialProfiles/NowfalEbrahim.png",
  },
  {
    name: "Lynne Nicole Smith",
    role: "Founder of Qigong Infused Yoga",
    text: "Vierra is fantastic to work with and genuinely skilled across web, SEO, and the technical side. They fixed longstanding issues I didn't even know I had.",
    image: "/assets/Testimonials/TestimonialProfiles/Lynne.jpg",
  },
  {
    name: "Deanna Mazzeo",
    role: "Business Operations of Somerville Dental Associates",
    text: "Our office had almost no online presence. Vierra grew our Yelp reviews and brought in new monthly patients, filling the gaps in our schedule.",
    image: "/assets/Testimonials/TestimonialProfiles/DeannaMazzeo.png",
  },
  {
    name: "Alexander Lombardi",
    role: "Co-Founder, Air-Gen",
    text: "Vierra did a great job building our website. The process was smooth, with clear communication and on-time delivery. Highly recommend.",
    image: "/assets/Testimonials/TestimonialProfiles/Alexander.jpg",
  },
  {
    name: "Hannah Lowney",
    role: "Owner of Salon Renee",
    text: "Within three months of Vierra taking over my marketing, I was getting more than triple the clients I used to.",
    image: "/assets/Testimonials/TestimonialProfiles/HannahLowney.jpg",
  },
  {
    name: "Dennis Zax",
    role: "CEO of ezML",
    text: "Vierra's approach is simple, structured, and intentional. They've made a real impact on my business, and it won't stay small for long.",
    image: "/assets/Testimonials/TestimonialProfiles/DennisZax.jpg",
  },
]

const featured = all.find((t) => t.name === "Richard K. Segal") as Testimonial
const pinned = all.find((t) => t.name === "Long Doan") as Testimonial
const rotating = all.filter((t) => t.name !== featured.name && t.name !== pinned.name)

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()

function Person({ t, size = 48 }: { t: Testimonial; size?: number }) {
  return t.image ? (
    <Image
      src={t.image}
      alt={t.name}
      width={size}
      height={size}
      quality={80}
      draggable={false}
      className="shrink-0 rounded-full object-cover select-none ring-1 ring-white/15"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#701CC0] to-[#8F42FF] font-semibold text-white ${bricolage.className}`}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials(t.name)}
    </span>
  )
}

// Content is grouped at the top (quote then attribution) — no footer pushed to
// the bottom, so short quotes don't leave an awkward gap mid-card.
function Body({
  t,
  featured = false,
}: {
  t: Testimonial
  featured?: boolean
}) {
  const quoteSize = featured
    ? "text-base md:text-xl md:leading-[1.75]"
    : "text-lg leading-relaxed md:text-2xl md:leading-snug"
  return (
    <>
      <span aria-hidden className={`block text-3xl leading-none text-[#8F42FF]/70 ${bricolage.className}`}>
        &ldquo;
      </span>
      <blockquote className={`mt-3 font-light text-white/90 ${inter.className} ${quoteSize}`}>
        {t.text}
      </blockquote>
      <figcaption className="flex items-center gap-3 mt-7">
        <Person t={t} size={featured ? 52 : 48} />
        <div className="min-w-0">
          <div className={`font-semibold leading-tight ${bricolage.className}`}>{t.name}</div>
          <div className={`mt-0.5 text-sm leading-snug text-white/60 ${inter.className}`}>{t.role}</div>
        </div>
      </figcaption>
    </>
  )
}

const glassTile =
  "rounded-3xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] p-7 md:p-10"
const spaceTile =
  "rounded-3xl border border-[#42345099] bg-[radial-gradient(125%_125%_at_30%_20%,#34125F_0%,#1C0838_55%,#120426_100%)]"

export default function TestimonialsSection() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setIdx((p) => (p + 1) % rotating.length), 5000)
    return () => clearInterval(i)
  }, [])
  const rot = rotating[idx]

  return (
    <section
      id="testimonials"
      className="relative w-full overflow-hidden bg-[#010205] text-white px-4 md:px-8 pt-20 md:pt-28 pb-16 md:pb-28 scroll-mt-24"
    >
      {/* Purple glow, top-right — gives the glass tiles depth to refract without
          a hard-edged shape competing with the content. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[18%] -right-28 hidden md:block h-[460px] w-[460px] rounded-full bg-[#701CC0] opacity-20 blur-[150px]"
      />
      {/* Soft purple glow, lower-left — kept fully inside the section so it fades
          out before the team border instead of cutting off. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[50%] -left-44 hidden md:block h-[400px] w-[400px] rounded-full bg-[#701CC0] opacity-20 blur-[150px]"
      />

      <div className="relative z-10 text-center max-w-[900px] mx-auto mb-12 md:mb-16">
        <span className={`text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF] ${inter.className}`}>
          Success Stories
        </span>
        <h2 className={`mt-4 text-4xl md:text-6xl font-bold leading-[1.05] ${bricolage.className}`}>
          See How We{" "}
          <span className="bg-[#701CC0B3] box-decoration-clone px-1">Increased Profits For Top Experts</span>{" "}
          In The Industry.
        </h2>
      </div>

      {/* Bento — top row tall (spotlight + featured), bottom row shorter (two tiles).
          Rows size to content (no forced equal-height), like HappyStack. */}
      <div className="relative z-10 mx-auto grid max-w-7xl gap-6 md:grid-cols-6">
        {/* Top-left — client spotlight photo (spans the tall featured row) */}
        <div className="relative md:col-span-2 min-h-[300px] overflow-hidden rounded-3xl border border-[#42345099]">
          <Image
            src="/assets/Testimonials/spotlight.webp"
            alt="Vierra clients"
            fill
            quality={80}
            draggable={false}
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover object-center select-none grayscale"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-7">
            <span className={`text-[11px] font-semibold uppercase tracking-[0.3em] text-[#C99DFF] ${inter.className}`}>
              Client Spotlight
            </span>
            <p className={`mt-1.5 text-xl font-semibold leading-tight text-white ${bricolage.className}`}>
              Real founders.
              <br />
              Real results.
            </p>
          </div>
        </div>

        {/* Top-right — featured / biggest */}
        <figure className={`flex flex-col md:col-span-4 ${glassTile}`}>
          <Body t={featured} featured />
        </figure>

        {/* Bottom-left — Long Doan. Its natural content height sets the row;
            the rotating tile stretches to match it on desktop. */}
        <figure className={`flex flex-col md:col-span-3 ${glassTile}`}>
          <Body t={pinned} />
        </figure>

        {/* Bottom-right — auto-rotating, on animated space backdrop. min-h is a
            mobile floor only; on desktop it stretches to the Long Doan height. */}
        <div className={`relative md:col-span-3 min-h-[340px] md:min-h-0 overflow-hidden ${spaceTile}`}>
          <div aria-hidden className="cta-stars" />
          <div aria-hidden className="cta-stars cta-stars--2" />
          <AnimatePresence mode="wait">
            <motion.figure
              key={rot.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="absolute inset-0 z-10 flex flex-col p-7 md:p-10 [text-shadow:0_1px_10px_rgba(0,0,0,0.45)]"
            >
              <Body t={rot} />
            </motion.figure>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
