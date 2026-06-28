import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bricolage_Grotesque, Inter, Figtree } from 'next/font/google';
import Head from 'next/head';
import Image from 'next/image';
import { Header } from '@/components/Header';
import Footer from '@/components/FooterSection/Footer';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'] });
const inter = Inter({ subsets: ['latin'] });
const figtree = Figtree({ subsets: ['latin'] });

type SectionMeta = { id: string; title: string };

const SECTIONS: SectionMeta[] = [
  { id: 'overview', title: 'Brand Overview' },
  { id: 'logo', title: 'Logo & Mark' },
  { id: 'logo-variants', title: 'Logo Variants' },
  { id: 'color-palette', title: 'Color Palette' },
  { id: 'gradients', title: 'Gradients' },
  { id: 'typography', title: 'Typography' },
  { id: 'type-scale', title: 'Text Styles & Scale' },
  { id: 'motifs', title: 'Visual Motifs' },
  { id: 'assets', title: 'Asset Library' },
];

type Swatch = { name: string; hex: string; usage: string; dark: boolean };

const PRIMARY: Swatch[] = [
  { name: 'Royal Purple', hex: '#701CC0', usage: 'Primary brand color — CTAs, links, accents', dark: true },
];

const ACCENTS: Swatch[] = [
  { name: 'Electric Violet', hex: '#8F42FF', usage: 'Highlights, gradient mid-tone, hover states', dark: true },
  { name: 'Lavender', hex: '#D4A5FF', usage: 'Gradient end, soft emphasis on dark', dark: false },
  { name: 'Soft Lilac', hex: '#C99DFF', usage: 'Eyebrows & labels on dark surfaces', dark: false },
];

const NEUTRALS: Swatch[] = [
  { name: 'Midnight', hex: '#18042A', usage: 'Primary dark surface — heroes, footer', dark: true },
  { name: 'Deep Plum', hex: '#2E0A4F', usage: 'Dark gradient mid-tone', dark: true },
  { name: 'Ink', hex: '#1A1033', usage: 'Headings & strong text on light', dark: true },
  { name: 'Slate', hex: '#4B4460', usage: 'Body copy on light surfaces', dark: true },
];

const SURFACES: Swatch[] = [
  { name: 'Off-White', hex: '#F3F3F3', usage: 'Primary light page surface', dark: false },
  { name: 'Pure White', hex: '#FFFFFF', usage: 'Cards & elevated surfaces', dark: false },
];

const Section: React.FC<{ id: string; index: number; title: string; children: React.ReactNode }> = ({
  id,
  index,
  title,
  children,
}) => (
  <section
    id={id}
    className="scroll-mt-28 rounded-[26px] border border-[#701CC0]/10 bg-white/90 p-6 shadow-[0_10px_40px_-18px_rgba(112,28,192,0.25)] ring-1 ring-black/[0.02] backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_18px_50px_-18px_rgba(112,28,192,0.35)] md:p-9"
  >
    <div className="flex items-center gap-4">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#701CC0] to-[#8F42FF] text-sm font-semibold tabular-nums text-white shadow-[0_6px_16px_-4px_rgba(112,28,192,0.5)] ${bricolage.className}`}
      >
        {String(index).padStart(2, '0')}
      </span>
      <h2 className={`text-xl md:text-2xl font-semibold tracking-tight text-[#1A1033] ${bricolage.className}`}>
        {title}
      </h2>
    </div>
    <div className="mt-5 mb-6 h-px w-full bg-gradient-to-r from-[#8F42FF]/50 via-[#701CC0]/15 to-transparent" />
    <div className="space-y-4 text-[15px] leading-7 text-[#4B4460] [&_a]:text-[#701CC0] [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-[#8F42FF] [&_a]:transition-colors [&_strong]:font-semibold [&_strong]:text-[#1A1033] [&_em]:text-[#3A3352]">
      {children}
    </div>
  </section>
);

const SwatchCard: React.FC<{ swatch: Swatch }> = ({ swatch }) => (
  <div className="overflow-hidden rounded-2xl border border-[#701CC0]/10 bg-white shadow-[0_8px_30px_-18px_rgba(112,28,192,0.3)]">
    <div
      className="flex h-24 items-end p-3"
      style={{ backgroundColor: swatch.hex }}
    >
      <span
        className={`rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums backdrop-blur-sm ${
          swatch.dark ? 'bg-black/20 text-white' : 'bg-black/5 text-[#1A1033]'
        }`}
      >
        {swatch.hex}
      </span>
    </div>
    <div className="p-4">
      <p className="text-sm font-semibold text-[#1A1033]">{swatch.name}</p>
      <p className="mt-1 text-[13px] leading-snug text-[#6B6480]">{swatch.usage}</p>
    </div>
  </div>
);

const BrandingPage: React.FC = () => {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setProgress(scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0);
      setShowTop(doc.scrollTop > 600);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <Head>
        <title>Vierra | Brand Kit</title>
        <meta name="description" content="The Vierra brand kit — logo styles, color palette, gradients, typography, and visual guidelines for a consistent Vierra identity." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://vierradev.com/branding" />
        <meta property="og:title" content="Vierra | Brand Kit" />
        <meta property="og:description" content="Logo styles, colors, gradients, and typography that make up the Vierra visual identity." />
        <meta property="og:url" content="https://vierradev.com/branding" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Vierra | Brand Kit" />
        <meta name="twitter:description" content="Logo styles, colors, gradients, and typography that make up the Vierra visual identity." />
      </Head>

      <div className={`relative min-h-screen bg-[#F3F3F3] text-[#2A2140] ${inter.className}`}>
        {/* Hide the main page scrollbar (scrolling still works) */}
        <style jsx global>{`
          html { scroll-behavior: smooth; scrollbar-width: none !important; -ms-overflow-style: none !important; }
          html::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
        `}</style>

        {/* Reading progress bar */}
        <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent">
          <div
            className="h-full bg-gradient-to-r from-[#701CC0] via-[#B366FF] to-[#8F42FF] transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Dark hero band — same format as the legal pages */}
        <div className="relative flex min-h-[60vh] flex-col overflow-hidden bg-[#18042A] text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <motion.div
              className="absolute -top-28 left-[6%] h-[440px] w-[440px] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] opacity-70 blur-[70px]"
              animate={{ x: [0, 70, -30, 0], y: [0, 40, 80, 0], scale: [1, 1.12, 0.94, 1] }}
              transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -bottom-44 right-[2%] h-[480px] w-[480px] rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] opacity-60 blur-[80px]"
              animate={{ x: [0, -60, 25, 0], y: [0, -35, -70, 0], scale: [1, 0.93, 1.12, 1] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <div className="relative z-20">
            <Header />
          </div>
          <header className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]">Brand Guidelines</span>
            <h1 className={`mt-4 text-5xl font-bold tracking-tight md:text-7xl ${bricolage.className}`}>
              Brand{' '}
              <span className="bg-gradient-to-r from-[#8F42FF] via-[#D4A5FF] to-[#8F42FF] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient">
                Kit
              </span>
            </h1>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/70 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8F42FF]" />
              Vierra Visual Identity System
            </div>
          </header>
        </div>

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-14 md:px-8">
          <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-12">
            {/* Sticky table of contents (desktop) */}
            <aside className="hidden lg:block">
              <nav className="sticky top-10 max-h-[calc(100vh-5rem)] overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(112,28,192,0.25)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#701CC0]/25 hover:[&::-webkit-scrollbar-thumb]:bg-[#701CC0]/40">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9A93AA]">On this page</p>
                <ul className="space-y-1 border-l border-[#701CC0]/15">
                  {SECTIONS.map((s, i) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className={`-ml-px flex items-start gap-2 border-l-2 py-1.5 pl-4 text-[13px] leading-snug transition-colors ${
                          activeId === s.id
                            ? 'border-[#8F42FF] font-medium text-[#701CC0]'
                            : 'border-transparent text-[#6B6480] hover:text-[#1A1033]'
                        }`}
                      >
                        <span className="tabular-nums text-[#B3ABC4]">{String(i + 1).padStart(2, '0')}</span>
                        <span>{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            {/* Content */}
            <main>
              {/* Mobile contents disclosure */}
              <details className="mb-8 rounded-2xl border border-[#701CC0]/12 bg-white/90 shadow-[0_8px_30px_-16px_rgba(112,28,192,0.3)] backdrop-blur-sm lg:hidden">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-[#1A1033]">On this page</summary>
                <ul className="space-y-1 px-5 pb-4">
                  {SECTIONS.map((s, i) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="block py-1 text-[13px] text-[#6B6480] hover:text-[#701CC0]">
                        {String(i + 1).padStart(2, '0')} &nbsp; {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>

              <div className="space-y-6">
                <Section id="overview" index={1} title="Brand Overview">
                  <p>
                    <strong>Vierra</strong> is a modern marketing &amp; sales company built on a bold, premium, tech-forward identity. The brand pairs a deep <strong>midnight</strong> canvas with vivid <strong>purple-to-violet gradients</strong> to feel innovative, confident, and high-end.
                  </p>
                  <p>
                    Three principles guide every application of the brand:
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      { t: 'Bold', d: 'High contrast, confident type, and saturated purple accents.' },
                      { t: 'Premium', d: 'Generous spacing, soft shadows, and refined gradients.' },
                      { t: 'Modern', d: 'Clean geometry, subtle motion, and a tech-forward feel.' },
                    ].map((p) => (
                      <div key={p.t} className="rounded-2xl border border-[#701CC0]/10 bg-white p-5 shadow-[0_8px_30px_-20px_rgba(112,28,192,0.4)]">
                        <p className={`text-base font-semibold text-[#1A1033] ${bricolage.className}`}>{p.t}</p>
                        <p className="mt-1.5 text-[13px] leading-snug text-[#6B6480]">{p.d}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section id="logo" index={2} title="Logo & Mark">
                  <p>
                    The Vierra logo is a <strong>lockup</strong> of two parts: the <strong>mark</strong>, a stylized gradient <strong>“V” drawn as an upward check</strong>, symbolizing momentum and validation, and the <strong>“Vierra” wordmark</strong> in a custom lowercase italic logotype. Whenever possible, use the full lockup.
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[#701CC0]/10 bg-white p-8 shadow-[0_8px_30px_-20px_rgba(112,28,192,0.4)]">
                      <Image src="/assets/vierra-logo.png" alt="Vierra primary logo lockup" width={464} height={188} className="h-auto w-56" />
                      <span className="text-[12px] font-medium uppercase tracking-wide text-[#9A93AA]">Primary Lockup</span>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#18042A] p-8 shadow-[0_8px_30px_-20px_rgba(112,28,192,0.6)]">
                      <Image src="/assets/vierra-logo-panel.png" alt="Vierra reversed logo on dark" width={152} height={56} className="h-auto w-56" />
                      <span className="text-[12px] font-medium uppercase tracking-wide text-[#C99DFF]">Reversed (on dark)</span>
                    </div>
                  </div>
                </Section>

                <Section id="logo-variants" index={3} title="Logo Variants">
                  <p>
                    Choose the variant that gives the logo the most contrast against its background. Three official variants cover every surface:
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[#701CC0]/10 bg-white p-6 text-center shadow-[0_8px_30px_-20px_rgba(112,28,192,0.4)]">
                      <div className="flex h-24 items-center justify-center">
                        <Image src="/assets/vierra-logo.png" alt="Full color lockup" width={464} height={188} className="h-auto w-40" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-[#1A1033]">Full Color</p>
                      <p className="mt-1 text-[12px] leading-snug text-[#6B6480]">Light backgrounds &amp; white surfaces.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#18042A] p-6 text-center shadow-[0_8px_30px_-20px_rgba(112,28,192,0.6)]">
                      <div className="flex h-24 items-center justify-center">
                        <Image src="/assets/vierra-logo-panel.png" alt="White reversed lockup" width={152} height={56} className="h-auto w-40" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-white">White / Reversed</p>
                      <p className="mt-1 text-[12px] leading-snug text-white/60">Dark backgrounds, photos &amp; the footer.</p>
                    </div>
                    <div className="rounded-2xl border border-[#701CC0]/10 bg-white p-6 text-center shadow-[0_8px_30px_-20px_rgba(112,28,192,0.4)]">
                      <div className="flex h-24 items-center justify-center">
                        <Image src="/icon-512.png" alt="Vierra app icon" width={512} height={512} className="h-20 w-20 rounded-2xl" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-[#1A1033]">App Icon</p>
                      <p className="mt-1 text-[12px] leading-snug text-[#6B6480]">Favicons, avatars &amp; app tiles.</p>
                    </div>
                  </div>
                </Section>

                <Section id="color-palette" index={4} title="Color Palette">
                  <p>
                    Vierra&apos;s palette is anchored by <strong>Royal Purple</strong> and a cascade of violets, set against a deep midnight base and clean off-white surfaces.
                  </p>
                  <div>
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#9A93AA]">Primary</p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {PRIMARY.map((s) => <SwatchCard key={s.hex} swatch={s} />)}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#9A93AA]">Accents</p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {ACCENTS.map((s) => <SwatchCard key={s.hex} swatch={s} />)}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#9A93AA]">Darks &amp; Neutrals</p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {NEUTRALS.map((s) => <SwatchCard key={s.hex} swatch={s} />)}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#9A93AA]">Surfaces</p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {SURFACES.map((s) => <SwatchCard key={s.hex} swatch={s} />)}
                    </div>
                  </div>
                </Section>

                <Section id="gradients" index={5} title="Gradients">
                  <p>
                    Gradients are central to the Vierra look. Use them on headings, buttons, accents, and large surfaces, never on body text.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="overflow-hidden rounded-2xl border border-[#701CC0]/10 bg-white shadow-[0_8px_30px_-20px_rgba(112,28,192,0.4)]">
                      <div className="h-28 bg-gradient-to-br from-[#701CC0] to-[#8F42FF]" />
                      <div className="p-4">
                        <p className="text-sm font-semibold text-[#1A1033]">Brand Gradient</p>
                        <p className="mt-1 text-[12px] text-[#6B6480]">#701CC0 → #8F42FF · Buttons, Badges, the Mark</p>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-[#701CC0]/10 bg-white shadow-[0_8px_30px_-20px_rgba(112,28,192,0.4)]">
                      <div className="h-28 bg-gradient-to-r from-[#8F42FF] via-[#D4A5FF] to-[#8F42FF]" />
                      <div className="p-4">
                        <p className="text-sm font-semibold text-[#1A1033]">Heading Gradient</p>
                        <p className="mt-1 text-[12px] text-[#6B6480]">#8F42FF → #D4A5FF → #8F42FF · Gradient Text</p>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-[#701CC0]/10 bg-white shadow-[0_8px_30px_-20px_rgba(112,28,192,0.4)]">
                      <div className="h-28 bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A]" />
                      <div className="p-4">
                        <p className="text-sm font-semibold text-[#1A1033]">Hero / Dark Gradient</p>
                        <p className="mt-1 text-[12px] text-[#6B6480]">#4F1488 → #2E0A4F → #18042A · Hero &amp; Footer</p>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-[#701CC0]/10 bg-white shadow-[0_8px_30px_-20px_rgba(112,28,192,0.4)]">
                      <div className="h-28" style={{ background: 'conic-gradient(from 0deg, #701cc0, #8f42ff, #d4a5ff, #8f42ff, #701cc0)' }} />
                      <div className="p-4">
                        <p className="text-sm font-semibold text-[#1A1033]">Glow Conic</p>
                        <p className="mt-1 text-[12px] text-[#6B6480]">Animated trim on the “Let’s Talk” button</p>
                      </div>
                    </div>
                  </div>
                </Section>

                <Section id="typography" index={6} title="Typography">
                  <p>
                    Three typefaces carry the brand. <strong>Bricolage Grotesque</strong> for display &amp; headings, <strong>Inter</strong> for body &amp; UI, and <strong>Figtree</strong> for select labels and footer headings.
                  </p>
                  <div className="space-y-4">
                    {[
                      { font: bricolage.className, name: 'Bricolage Grotesque', role: 'Display & Headings', sample: 'Grow your business with Vierra' },
                      { font: inter.className, name: 'Inter', role: 'Body & Interface', sample: 'Clear, legible copy for everything from paragraphs to buttons.' },
                      { font: figtree.className, name: 'Figtree', role: 'Labels & Accents', sample: 'Company · Legal · Connect' },
                    ].map((t) => (
                      <div key={t.name} className="rounded-2xl border border-[#701CC0]/10 bg-white p-6 shadow-[0_8px_30px_-20px_rgba(112,28,192,0.4)]">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className={`text-base font-semibold text-[#1A1033] ${t.font}`}>{t.name}</p>
                          <span className="text-[11px] font-medium uppercase tracking-wide text-[#9A93AA]">{t.role}</span>
                        </div>
                        <p className={`mt-3 text-2xl font-semibold text-[#1A1033] md:text-3xl ${t.font}`}>{t.sample}</p>
                        <p className={`mt-2 text-sm text-[#6B6480] ${t.font}`}>ABCDEFGHIJKLM nopqrstuvwxyz 0123456789</p>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section id="type-scale" index={7} title="Text Styles & Scale">
                  <p>
                    Consistent text styles keep layouts on-brand. These are the core roles used across the site:
                  </p>
                  <div className="divide-y divide-[#701CC0]/10 overflow-hidden rounded-2xl border border-[#701CC0]/10 bg-white shadow-[0_8px_30px_-20px_rgba(112,28,192,0.4)]">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 p-5">
                      <span className={`text-xs font-semibold uppercase tracking-[0.35em] text-[#C99DFF] ${bricolage.className}`}>Eyebrow</span>
                      <span className="text-[12px] text-[#9A93AA]">Bricolage · 12px · uppercase · 0.35em tracking</span>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 p-5">
                      <span className={`text-3xl font-bold tracking-tight text-[#1A1033] ${bricolage.className}`}>Display Heading</span>
                      <span className="text-[12px] text-[#9A93AA]">Bricolage · 48–72px · bold</span>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 p-5">
                      <span className={`text-xl font-semibold tracking-tight text-[#1A1033] ${bricolage.className}`}>Section Heading</span>
                      <span className="text-[12px] text-[#9A93AA]">Bricolage · 20–24px · semibold</span>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 p-5">
                      <span className={`text-[15px] leading-7 text-[#4B4460] ${inter.className}`}>Body Copy — The default reading style for paragraphs.</span>
                      <span className="text-[12px] text-[#9A93AA]">Inter · 15px · 1.75 line-height</span>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 p-5">
                      <span className={`text-[13px] text-[#6B6480] ${inter.className}`}>Caption &amp; Meta — Supporting detail and labels.</span>
                      <span className="text-[12px] text-[#9A93AA]">Inter · 13px · muted</span>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 p-5">
                      <span className="text-[15px]">
                        <span className="bg-gradient-to-r from-[#8F42FF] via-[#D4A5FF] to-[#8F42FF] bg-clip-text font-semibold text-transparent">Heading Gradient</span>
                      </span>
                      <span className="text-[12px] text-[#9A93AA]">Heading Gradient · clip to text only</span>
                    </div>
                  </div>
                </Section>

                <Section id="motifs" index={8} title="Visual Motifs">
                  <p>
                    Recurring visual elements tie the brand together across pages. Use them sparingly to add depth without clutter.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#18042A]">
                      <motion.div
                        className="absolute h-32 w-32 rounded-full bg-gradient-to-l from-[#701CC0] to-[#18042A] opacity-70 blur-2xl"
                        animate={{ x: [0, 20, -10, 0], y: [0, 12, 24, 0], scale: [1, 1.15, 0.95, 1] }}
                        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <span className="relative z-10 text-[12px] font-medium uppercase tracking-wide text-[#C99DFF]">Animated Blobs</span>
                    </div>
                    <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#18042A]">
                      <div aria-hidden className="pointer-events-none absolute inset-0">
                        {[120, 170, 220].map((sz) => (
                          <div key={sz} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#701CC0]/40" style={{ width: sz, height: sz }} />
                        ))}
                      </div>
                      <span className="relative z-10 text-[12px] font-medium uppercase tracking-wide text-[#C99DFF]">Concentric Rings</span>
                    </div>
                    <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#18042A]">
                      <span className="audit-glow inline-flex items-center gap-2 rounded-lg border-2 border-[#701CC0] bg-transparent px-6 py-3 text-sm text-white">
                        Glowing Trim
                      </span>
                    </div>
                  </div>
                </Section>

                <Section id="assets" index={9} title="Asset Library">
                  <p>
                    Download the official logo files below. Always use these source assets rather than recreating or screenshotting the logo.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: 'Primary Logo (Color)', file: '/assets/vierra-logo.png' },
                      { label: 'Reversed Logo (White)', file: '/assets/vierra-logo-panel.png' },
                      { label: 'Black Lockup', file: '/assets/vierra-logo-black.png' },
                      { label: 'App Icon (512×512)', file: '/icon-512.png' },
                    ].map((a) => (
                      <a
                        key={a.file}
                        href={a.file}
                        download
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-[#701CC0]/10 bg-white p-4 !no-underline shadow-[0_8px_30px_-20px_rgba(112,28,192,0.4)] transition-shadow duration-300 hover:shadow-[0_18px_50px_-18px_rgba(112,28,192,0.35)]"
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#701CC0] to-[#8F42FF] text-white">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>
                          </span>
                          <span className="text-sm font-medium text-[#1A1033]">{a.label}</span>
                        </span>
                        <span className="text-[12px] font-medium uppercase tracking-wide text-[#9A93AA] group-hover:text-[#701CC0]">PNG</span>
                      </a>
                    ))}
                  </div>
                </Section>
              </div>
            </main>
          </div>
        </div>

        <Footer />

        {/* Back to top */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className={`fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#701CC0]/80 text-white shadow-[0_4px_20px_rgba(112,28,192,0.5)] backdrop-blur-md transition-all duration-300 hover:bg-[#8F42FF] ${
            showTop ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </>
  );
};

export default BrandingPage;
