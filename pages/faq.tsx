import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import Head from 'next/head';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { Header } from '@/components/Header';
import Footer from '@/components/FooterSection/Footer';
import { Modal } from '@/components/Modal';
import { FAQ_ITEMS, FAQ_LAST_UPDATED } from '@/lib/faq';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'] });
const inter = Inter({ subsets: ['latin'] });

const CANONICAL = 'https://vierradev.com/faq';
const META_TITLE = 'Vierra | Frequently Asked Questions';
const META_DESCRIPTION =
  'Answers to common questions about Vierra Digital — what we do, how our risk-averse, results-based lead generation works, who we work with, pricing, and how to get started.';

const FaqPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // schema.org FAQPage for rich results in Google search and AI answer engines.
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${CANONICAL}#faqpage`,
    url: CANONICAL,
    dateModified: FAQ_LAST_UPDATED,
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  // BreadcrumbList — mirrors the blog/author pages so every non-home page exposes
  // its position in the site hierarchy to crawlers and AI answer engines.
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vierradev.com' },
      { '@type': 'ListItem', position: 2, name: 'FAQ', item: CANONICAL },
    ],
  };

  return (
    <>
      <Head>
        <title>{META_TITLE}</title>
        <meta name="description" content={META_DESCRIPTION} />
        <meta
          name="keywords"
          content="Vierra FAQ, lead generation questions, digital marketing agency FAQ, risk-averse lead generation, how Vierra works, Vierra Digital"
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content={META_TITLE} />
        <meta property="og:description" content={META_DESCRIPTION} />
        <meta property="og:url" content={CANONICAL} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Vierra Digital" />
        <meta property="og:image" content="https://vierradev.com/assets/meta-banner.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={META_TITLE} />
        <meta name="twitter:description" content={META_DESCRIPTION} />
        <meta name="twitter:image" content="https://vierradev.com/assets/meta-banner.png" />
      </Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        id="schema-org-breadcrumbs-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        id="schema-org-speakable-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            '@id': 'https://vierradev.com/faq#webpage',
            url: 'https://vierradev.com/faq',
            speakable: {
              '@type': 'SpeakableSpecification',
              cssSelector: ['.faq-item summary', '.faq-answer'],
            },
          }),
        }}
      />

      <div className={`relative min-h-screen bg-[#F3F3F3] text-[#2A2140] ${inter.className}`}>
        <style jsx global>{`
          html { scroll-behavior: smooth; scrollbar-width: none !important; -ms-overflow-style: none !important; }
          html::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }

          /* Collapsible FAQ via native <details> — answers stay in the DOM
             (crawlable / indexable) even while visually collapsed. */
          .faq-item summary { list-style: none; }
          .faq-item summary::-webkit-details-marker { display: none; }
          .faq-item summary:focus-visible { outline: 2px solid #8F42FF; outline-offset: 2px; border-radius: 26px; }
          .faq-chevron { transition: transform 0.3s ease; }
          .faq-item[open] .faq-chevron { transform: rotate(180deg); }
          .faq-item[open] .faq-answer { animation: faqReveal 0.28s ease; }
          @keyframes faqReveal {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .faq-chevron { transition: none; }
            .faq-item[open] .faq-answer { animation: none; }
          }
        `}</style>

        {/* Dark hero band — same centered format as the careers and legal pages */}
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
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]">
              <HelpCircle size={14} className="text-[#C99DFF]" />
              Support
            </span>
            <h1 className={`mt-4 text-5xl font-bold tracking-tight md:text-7xl ${bricolage.className}`}>
              Frequently Asked Questions
            </h1>
          </header>
        </div>

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-24 pt-14 md:px-8">
          <div className="space-y-5">
            {FAQ_ITEMS.map((item, i) => (
              <details
                key={i}
                className="faq-item rounded-[26px] border border-[#701CC0]/10 bg-white/90 shadow-[0_10px_40px_-18px_rgba(112,28,192,0.25)] ring-1 ring-black/[0.02] backdrop-blur-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 p-6 md:p-8">
                  <h2 className={`text-lg md:text-xl font-semibold tracking-tight text-[#1A1033] ${bricolage.className}`}>
                    {item.question}
                  </h2>
                  <ChevronDown
                    size={22}
                    aria-hidden
                    className="faq-chevron shrink-0 text-[#701CC0]"
                  />
                </summary>
                <div className="faq-answer px-6 pb-6 md:px-8 md:pb-8">
                  <div className="mb-5 h-px w-full bg-gradient-to-r from-[#8F42FF]/50 via-[#701CC0]/15 to-transparent" />
                  <p className="text-[15px] leading-7 text-[#4B4460]">{item.answer}</p>
                </div>
              </details>
            ))}

            {/* CTA */}
            <section className="overflow-hidden rounded-[26px] border border-[#701CC0]/30 bg-[#18042A] p-8 text-center md:p-12">
              <h2 className={`text-2xl font-semibold tracking-tight text-white md:text-3xl ${bricolage.className}`}>
                Still Have Questions?
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="audit-glow mt-7 inline-flex items-center gap-2 rounded-lg border-2 border-[#701CC0] bg-transparent px-8 py-4 font-medium text-white transition-all duration-300 hover:border-[#8F42FF]"
              >
                Let&apos;s Talk
              </button>
            </section>
          </div>
        </div>

        <Footer />
      </div>

      {isModalOpen && <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />}
    </>
  );
};

export default FaqPage;
