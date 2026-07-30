import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { bricolage, inter } from "@/lib/fonts";
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { MapPin, Briefcase, Clock, DollarSign, CheckCircle2 } from 'lucide-react';
import { Header } from '@/components/Header';
import Footer from '@/components/FooterSection/Footer';
import { CareerApplicationModal } from '@/components/CareerApplicationModal';
import { JOB_ROLES, getJobRole, type JobRole } from '@/lib/careers';


const APPLIED_STORAGE_KEY = 'vierra-applied-roles';

const getAppliedRoles = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(APPLIED_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const DetailBlock: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <section className="rounded-[26px] border border-[#701CC0]/10 bg-white/90 p-6 shadow-[0_10px_40px_-18px_rgba(112,28,192,0.25)] ring-1 ring-black/[0.02] backdrop-blur-sm md:p-9">
    <h2 className={`text-xl md:text-2xl font-semibold tracking-tight text-[#1A1033] ${bricolage.className}`}>
      {title}
    </h2>
    <div className="mt-5 mb-6 h-px w-full bg-gradient-to-r from-[#8F42FF]/50 via-[#701CC0]/15 to-transparent" />
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-[15px] leading-7 text-[#4B4460]">
          <CheckCircle2 size={18} className="mt-1 shrink-0 text-[#8F42FF]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </section>
);

// Stable fallback for JobPosting.datePosted — a fixed date, NOT new Date(), so
// each deploy doesn't reset the posting date (which Google Jobs reads as a re-post).
const DEFAULT_DATE_POSTED = '2026-06-01T00:00:00.000Z';

// Map our employment labels to schema.org JobPosting employmentType values.
const SCHEMA_EMPLOYMENT_TYPE: Record<JobRole['employmentType'], string> = {
  'Full-Time': 'FULL_TIME',
  'Part-Time': 'PART_TIME',
  Internship: 'INTERN',
};

// Parse a compensation string (e.g. "$175k / Year", "$50 / Hour") into a
// schema.org MonetaryAmount value + unit, when possible.
const parseSalary = (compensation: string): { value: number; unitText: string } | null => {
  const amountMatch = compensation.match(/\$\s*([\d.]+)\s*(k)?/i);
  if (!amountMatch) return null;
  const value = parseFloat(amountMatch[1]) * (amountMatch[2] ? 1000 : 1);
  if (!Number.isFinite(value)) return null;
  const unit = /hour/i.test(compensation)
    ? 'HOUR'
    : /month/i.test(compensation)
    ? 'MONTH'
    : /year/i.test(compensation)
    ? 'YEAR'
    : null;
  if (!unit) return null;
  return { value, unitText: unit };
};

const RolePage: React.FC<{ role: JobRole; datePosted: string; validThrough: string }> = ({ role, datePosted, validThrough }) => {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  useEffect(() => {
    if (!role) return;
    setAlreadyApplied(getAppliedRoles().includes(role.slug));
  }, [role]);

  const handleSubmitted = () => {
    const applied = getAppliedRoles();
    if (!applied.includes(role.slug)) {
      applied.push(role.slug);
      try {
        window.localStorage.setItem(APPLIED_STORAGE_KEY, JSON.stringify(applied));
      } catch {
        /* ignore storage failures */
      }
    }
    setAlreadyApplied(true);
  };

  // Fallback while statically generating
  if (router.isFallback || !role) {
    return null;
  }

  const facts = [
    { icon: Briefcase, label: role.typeLabel },
    { icon: Clock, label: role.experience },
    { icon: DollarSign, label: role.compensation },
    { icon: MapPin, label: role.location },
  ];

  const canonical = `https://vierradev.com/careers/${role.slug}`;
  const metaTitle = `Vierra | ${role.title}`;
  const salary = parseSalary(role.compensation);

  // schema.org JobPosting for rich results in Google Jobs / search.
  const jobPostingLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: role.title,
    description: [role.summary, ...role.about, ...role.responsibilities].join(' '),
    datePosted,
    validThrough,
    employmentType: SCHEMA_EMPLOYMENT_TYPE[role.employmentType],
    hiringOrganization: {
      '@type': 'Organization',
      '@id': 'https://vierradev.com/#organization',
      name: 'Vierra Digital',
      url: 'https://vierradev.com',
      logo: 'https://vierradev.com/assets/vierra-logo.png',
    },
    // Roles are remote/hybrid, so we declare TELECOMMUTE + applicant location
    // requirements instead of a physical jobLocation. This is Google's correct
    // shape for non-office-bound jobs and avoids emitting an incomplete address
    // (which triggered "missing streetAddress / postalCode" warnings in GSC).
    jobLocationType: 'TELECOMMUTE',
    applicantLocationRequirements: {
      '@type': 'Country',
      name: 'USA',
    },
    directApply: true,
    url: canonical,
    ...(salary && {
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'USD',
        value: {
          '@type': 'QuantitativeValue',
          value: salary.value,
          unitText: salary.unitText,
        },
      },
    }),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vierradev.com' },
      { '@type': 'ListItem', position: 2, name: 'Careers', item: 'https://vierradev.com/careers' },
      { '@type': 'ListItem', position: 3, name: role.title, item: canonical },
    ],
  };

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta
          name="description"
          content={`${role.summary} ${role.typeLabel} · ${role.compensation} · ${role.location}. Apply to join Vierra Digital.`}
        />
        <meta
          name="keywords"
          content={`${role.title}, ${role.department} jobs, Vierra careers, ${role.typeLabel}, NYC jobs, ${role.title} hiring`}
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={role.summary} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Vierra Digital" />
        <meta property="og:image" content="https://vierradev.com/assets/meta-banner.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={role.summary} />
        <meta name="twitter:image" content="https://vierradev.com/assets/meta-banner.png" />
      </Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <div className={`relative min-h-screen bg-[#F3F3F3] text-[#2A2140] ${inter.className}`}>
        <style jsx global>{`
          html { scroll-behavior: smooth; scrollbar-width: none !important; -ms-overflow-style: none !important; }
          html::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
        `}</style>

        {/* Dark hero band — same centered format as the legal pages */}
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
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]">
              {role.department}
            </span>
            <h1 className={`mt-4 text-5xl font-bold tracking-tight md:text-7xl ${bricolage.className}`}>
              {role.title}
            </h1>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {facts.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/80 backdrop-blur-md"
                >
                  <Icon size={14} className="text-[#C99DFF]" />
                  {label}
                </span>
              ))}
            </div>
          </header>
        </div>

        {/* Content */}
        <main className="relative z-10 mx-auto max-w-5xl px-5 pb-24 pt-14 md:px-8">
          <div className="space-y-6">
            <section className="rounded-[26px] border border-[#701CC0]/10 bg-white/90 p-6 shadow-[0_10px_40px_-18px_rgba(112,28,192,0.25)] ring-1 ring-black/[0.02] backdrop-blur-sm md:p-9">
              <h2 className={`text-xl md:text-2xl font-semibold tracking-tight text-[#1A1033] ${bricolage.className}`}>
                About This Position
              </h2>
              <div className="mt-5 mb-6 h-px w-full bg-gradient-to-r from-[#8F42FF]/50 via-[#701CC0]/15 to-transparent" />
              <div className="space-y-4 text-[15px] leading-7 text-[#4B4460]">
                {role.about.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>

            <DetailBlock title="Key Responsibilities" items={role.responsibilities} />
            <DetailBlock title="Qualifications" items={role.qualifications} />
            {role.niceToHave && role.niceToHave.length > 0 && (
              <DetailBlock title="Nice To Have" items={role.niceToHave} />
            )}
            <DetailBlock title="Benefits" items={role.benefits} />

            {/* Apply CTA */}
            <section className="overflow-hidden rounded-[26px] border border-[#701CC0]/30 bg-[#18042A] p-8 text-center md:p-12">
              <h2 className={`text-2xl font-semibold tracking-tight text-white md:text-3xl ${bricolage.className}`}>
                {alreadyApplied ? "You've Applied For This Position" : 'Ready To Apply?'}
              </h2>
              <motion.button
                type="button"
                onClick={() => setModalOpen(true)}
                disabled={alreadyApplied}
                className={`mt-7 inline-flex items-center gap-2 rounded-lg border-2 px-8 py-4 font-medium transition-all duration-300 ${
                  alreadyApplied
                    ? "cursor-not-allowed border-white/20 bg-transparent text-white/50"
                    : "audit-glow border-[#701CC0] bg-transparent text-white hover:border-[#8F42FF]"
                }`}
                whileTap={alreadyApplied ? undefined : { scale: 0.97 }}
              >
                {alreadyApplied ? (
                  <>
                    <CheckCircle2 size={18} /> Application Submitted
                  </>
                ) : (
                  'Apply Now'
                )}
              </motion.button>
            </section>
          </div>
        </main>

        <Footer />
      </div>

      <CareerApplicationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        roleSlug={role.slug}
        roleTitle={role.title}
        alreadyApplied={alreadyApplied}
        onSubmitted={handleSubmitted}
      />
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: JOB_ROLES.map((role) => ({ params: { slug: role.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = params?.slug as string;
  const role = getJobRole(slug);
  if (!role) {
    return { notFound: true };
  }
  // Both JobPosting dates are STABLE (not recomputed each build): datePosted is
  // fixed per role, and validThrough is a fixed 1-year window derived from it —
  // so redeploys never shift the posting dates (which Google Jobs can read as
  // churn). Bump the role's datePosted to re-open/refresh a listing.
  const datePosted = role.datePosted ?? DEFAULT_DATE_POSTED;
  const validThrough = new Date(
    new Date(datePosted).getTime() + 365 * 24 * 60 * 60 * 1000
  ).toISOString();
  return {
    props: {
      role,
      datePosted,
      validThrough,
    },
  };
};

export default RolePage;
