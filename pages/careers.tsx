import React from 'react';
import { motion } from 'framer-motion';
import { bricolage, inter } from "@/lib/fonts";
import Head from 'next/head';
import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { Header } from '@/components/Header';
import Footer from '@/components/FooterSection/Footer';
import { JOB_ROLES } from '@/lib/careers';


const CareersPage: React.FC = () => {
  return (
    <>
      <Head>
        <title>Vierra | Careers</title>
        <meta
          name="description"
          content="Join Vierra Digital. Explore open positions across engineering, design, operations, marketing, and sales — hybrid-friendly, NYC-based roles with real ownership and growth."
        />
        <meta
          name="keywords"
          content="Vierra careers, Vierra jobs, NYC tech jobs, software engineer jobs, marketing jobs, sales jobs, hiring, open positions, careers"
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://vierradev.com/careers" />
        <meta property="og:title" content="Vierra | Careers" />
        <meta property="og:description" content="Explore open positions at Vierra Digital and grow your career with us." />
        <meta property="og:url" content="https://vierradev.com/careers" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Vierra Digital" />
        <meta property="og:image" content="https://vierradev.com/assets/meta-banner.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Vierra | Careers" />
        <meta name="twitter:description" content="Explore open positions at Vierra Digital and grow your career with us." />
        <meta name="twitter:image" content="https://vierradev.com/assets/meta-banner.png" />
      </Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vierradev.com' },
              { '@type': 'ListItem', position: 2, name: 'Careers', item: 'https://vierradev.com/careers' },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Open Positions at Vierra Digital',
            itemListElement: JOB_ROLES.map((role, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: role.title,
              url: `https://vierradev.com/careers/${role.slug}`,
            })),
          }),
        }}
      />

      <div className={`relative min-h-screen bg-[#F3F3F3] text-[#2A2140] ${inter.className}`}>
        <style jsx global>{`
          html { scroll-behavior: smooth; scrollbar-width: none !important; -ms-overflow-style: none !important; }
          html::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
        `}</style>

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
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]">Careers</span>
            <h1 className={`mt-4 text-5xl font-bold tracking-tight md:text-7xl ${bricolage.className}`}>
              Join{' '}
              <span className="bg-gradient-to-r from-[#8F42FF] via-[#D4A5FF] to-[#8F42FF] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient">
                Our Team
              </span>
            </h1>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/70 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8F42FF]" />
              {JOB_ROLES.length} Open Positions
            </div>
          </header>
        </div>

        {/* Content — margins match the blog page system */}
        <main className="px-6 sm:px-8 lg:px-20">
          <div className="mx-auto max-w-7xl py-14 sm:py-20">
            {/* Intro / culture paragraph — left aligned */}
            <div className="space-y-4 text-[15px] leading-7 text-[#4B4460]">
              <p>
                At <strong className="font-semibold text-[#1A1033]">Vierra</strong>, we&apos;re an all-star
                dedicated team building the products and campaigns that scale the businesses we partner with. We
                move fast, take real ownership early, and care deeply about doing exceptional work. Working with us
                means high accountability, direct impact, and the room to grow your career alongside people who push
                you to be better.
              </p>
              <p>
                We hire for curiosity, drive, and craft over repetitive workflows. Every role here comes with
                mentorship, clear expectations, and the support to do the best work of your career whether
                you&apos;re shipping code, running delivery, or closing deals. To learn more about how we work, our
                values, and what to expect day to day, take a look at our{' '}
                <Link
                  href="/work-policy"
                  className="font-medium text-[#701CC0] underline underline-offset-2 transition-colors hover:text-[#8F42FF]"
                >
                  Work Policy
                </Link>{' '}
                for our full company culture and guidelines.
              </p>
            </div>

            {/* Open positions */}
            <h2 className={`mt-14 mb-6 text-2xl font-semibold tracking-tight text-[#1A1033] ${bricolage.className}`}>
              Open Positions
            </h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {JOB_ROLES.map((role) => (
                <Link
                  key={role.slug}
                  href={`/careers/${role.slug}`}
                  className="group flex flex-col rounded-[22px] border border-[#701CC0]/10 bg-white/90 p-6 shadow-[0_10px_40px_-18px_rgba(112,28,192,0.25)] ring-1 ring-black/[0.02] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-18px_rgba(112,28,192,0.35)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex items-center rounded-full bg-[#701CC0]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#701CC0]">
                      {role.department}
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#701CC0]/5 text-[#701CC0] transition-all duration-300 group-hover:bg-[#701CC0] group-hover:text-white">
                      <ArrowUpRight size={18} />
                    </span>
                  </div>

                  <h3
                    className={`mt-4 text-xl font-semibold tracking-tight text-[#1A1033] transition-colors group-hover:text-[#701CC0] ${bricolage.className}`}
                  >
                    {role.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#4B4460]">{role.summary}</p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#6B6480]">
                    <span className="rounded-md bg-[#701CC0]/[0.06] px-2.5 py-1">{role.typeLabel}</span>
                    <span className="rounded-md bg-[#701CC0]/[0.06] px-2.5 py-1">{role.experience}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#701CC0]/[0.06] px-2.5 py-1">
                      <MapPin size={12} className="text-[#8F42FF]" />
                      {role.location}
                    </span>
                    <span className="rounded-md bg-[#701CC0]/[0.06] px-2.5 py-1 font-medium text-[#701CC0]">
                      {role.compensation}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default CareersPage;
