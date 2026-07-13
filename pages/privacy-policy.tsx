import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import Head from 'next/head';
import { Header } from '@/components/Header';
import Footer from '@/components/FooterSection/Footer';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'] });
const inter = Inter({ subsets: ['latin'] });

type SectionMeta = { id: string; title: string };

const SECTIONS: SectionMeta[] = [
  { id: 'introduction', title: 'Introduction' },
  { id: 'summary', title: 'Summary of Key Points' },
  { id: 'what-we-collect', title: 'What Information Do We Collect?' },
  { id: 'how-we-process', title: 'How Do We Process Your Information?' },
  { id: 'legal-bases', title: 'What Legal Bases Do We Rely On?' },
  { id: 'sharing', title: 'When and With Whom Do We Share Your Information?' },
  { id: 'cookies', title: 'Do We Use Cookies and Tracking Technologies?' },
  { id: 'ai-products', title: 'Do We Offer AI-Based Products?' },
  { id: 'international', title: 'Is Your Information Transferred Internationally?' },
  { id: 'retention', title: 'How Long Do We Keep Your Information?' },
  { id: 'security', title: 'How Do We Keep Your Information Safe?' },
  { id: 'privacy-rights', title: 'What Are Your Privacy Rights?' },
  { id: 'dnt', title: 'Controls for Do-Not-Track Features' },
  { id: 'us-rights', title: 'Do United States Residents Have Specific Privacy Rights?' },
  { id: 'other-regions', title: 'Do Other Regions Have Specific Privacy Rights?' },
  { id: 'updates', title: 'Do We Make Updates to This Notice?' },
  { id: 'contact', title: 'How Can You Contact Us About This Notice?' },
  { id: 'review-data', title: 'How Can You Review, Update, or Delete Your Data?' },
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
    <div className="space-y-4 text-[15px] leading-7 text-[#4B4460] [&_a]:text-[#701CC0] [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-[#8F42FF] [&_a]:transition-colors [&_strong]:font-semibold [&_strong]:text-[#1A1033] [&_em]:text-[#3A3352] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:marker:text-[#8F42FF]">
      {children}
    </div>
  </section>
);

const PrivacyPolicyPage: React.FC = () => {
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
        <title>Vierra | Privacy Policy</title>
        <meta name="description" content="Vierra Digital Privacy Policy. Learn how we collect, use, and protect your personal information when using our services." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://vierradev.com/privacy-policy" />
        <meta property="og:title" content="Vierra | Privacy Policy" />
        <meta property="og:description" content="Vierra Digital Privacy Policy. Learn how we collect, use, and protect your personal information." />
        <meta property="og:url" content="https://vierradev.com/privacy-policy" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Vierra Digital" />
        <meta property="og:image" content="https://vierradev.com/assets/meta-banner.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://vierradev.com/assets/meta-banner.png" />
        <meta name="twitter:title" content="Vierra | Privacy Policy" />
        <meta name="twitter:description" content="Vierra Digital Privacy Policy. Learn how we collect, use, and protect your personal information." />
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

        {/* Dark hero band — same format as the Blog pages */}
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
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]">Legal</span>
            <h1 className={`mt-4 text-5xl font-bold tracking-tight md:text-7xl ${bricolage.className}`}>
              Privacy{' '}
              <span className="bg-gradient-to-r from-[#8F42FF] via-[#D4A5FF] to-[#8F42FF] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient">
                Policy
              </span>
            </h1>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/70 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8F42FF]" />
              Last Updated January 16th, 2025
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
                <Section id="introduction" index={1} title="Introduction">
                  <p>
                    This Privacy Notice for <strong>Vierra Digital LLC</strong> (<em>doing business as Vierra</em>) (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), describes how and why we might access, collect, store, use, and/or share (<em>&quot;process&quot;</em>) your personal information when you use our services (<em>&quot;Services&quot;</em>), including when you:
                  </p>
                  <ul>
                    <li>Visit our website at <strong>https://vierradev.com</strong>, or any website of ours that links to this Privacy Notice.</li>
                    <li>Use <strong>Vierra Digital LLC</strong>. Increase lead conversions and double your monthly profits. Stop wasting time and money on faulty and ineffective ad campaigns or attempting in-house marketing. Make your ad budget count by scaling your business and filling your calendar. At <strong>Vierra Digital</strong>, we use case-study-proven results-based services to produce millions of dollars in return on ad spending and marketing budgets. We optimize your spending and cut inefficient formalities you pay for by going to a standard marketing agency. We work closely with each of our clients, hand-selecting from a long waitlist of companies looking to stop wasting time with inefficient sales tricks and depleting marketing ad spending.</li>
                    <li>Engage with us in other related ways, including sales, marketing, or events.</li>
                  </ul>
                  <p>
                    Questions or concerns? Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have questions or concerns, please contact us at <a href="mailto:business@vierradev.com">business@vierradev.com</a>.
                  </p>
                </Section>

                <Section id="summary" index={2} title="Summary of Key Points">
                  <p>This summary provides key points from our Privacy Notice, but you can find more details about any of these topics by clicking the link following each key point.</p>
                  <p><strong>What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. Learn more about the personal information you disclose to us.</p>
                  <p><strong>Do we process any sensitive personal information?</strong> Some of the information may be considered &quot;special&quot; or &quot;sensitive&quot; in certain jurisdictions, for example, your racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information.</p>
                  <p><strong>Do we collect any information from third parties?</strong> We do not collect any information from third parties.</p>
                  <p><strong>How do we process your information?</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so. Learn more about how we process your information.</p>
                  <p><strong>In what situations and with which parties do we share personal information?</strong> We may share information in specific situations and with specific third parties. Learn more about when and with whom we share your personal information.</p>
                  <p><strong>How do we keep your information safe?</strong> We have adequate organizational and technical processes and procedures to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Learn more about how we keep your info safe.</p>
                  <p><strong>What are your rights?</strong> Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information. Learn more about your privacy rights.</p>
                  <p><strong>How do you exercise your rights?</strong> The easiest way to exercise your rights is by submitting a data subject access request or contacting us. We will consider and act upon any request per applicable data protection laws.</p>
                  <p>Want to learn more about what we do with any information we collect? Review the Privacy Notice in full.</p>
                </Section>

                <Section id="what-we-collect" index={3} title="What Information Do We Collect?">
                  <p><strong>We collect personal information that you provide to us.</strong></p>
                  <p>We collect personal information that you voluntarily provide us when you express an interest in obtaining information about us or our products and Services when you participate in activities on the Services or otherwise when you contact us.</p>
                  <p><strong>Personal Information Provided by You.</strong> The personal information we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:</p>
                  <ul>
                    <li>Names.</li>
                    <li>Phone numbers.</li>
                    <li>Email addresses.</li>
                    <li>Mailing addresses.</li>
                    <li>Job titles.</li>
                    <li>Contact preferences.</li>
                    <li>Contact or authentication data.</li>
                    <li>Billing addresses.</li>
                  </ul>
                  <p><strong>Sensitive Information.</strong> We do not process sensitive information. All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.</p>
                  <p>Some information such as your Internet Protocol (<em>IP</em>) address and/or browser and device characteristics is collected automatically when you visit our Services. We automatically collect certain information when you visit, use, or navigate the Services. This information does not reveal your specific identity (<em>like your name or contact information</em>) but may include device and usage information, such as your IP address, browser, and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Services, and other technical information. This information is primarily needed to maintain the security and operation of our Services and for our internal analytics and reporting purposes.</p>
                  <p>Like many businesses, we also collect information through cookies and similar technologies.</p>
                  <p>The information we collect includes:</p>
                  <ul>
                    <li><strong>Log and Usage Data.</strong> Log and usage data is service-related, diagnostic, usage, and performance information our servers automatically collect when you access or use our Services and which we record in log files. Depending on how you interact with us, this log data may include your IP address, device information, browser type, and settings and information about your activity in the Services (such as the date/time stamps associated with your usage, pages, and files viewed, searches, and other actions you take such as which features you use), device event information (such as system activity, error reports (sometimes called &quot;crash dumps&quot;), and hardware settings).</li>
                  </ul>
                  <p>Our use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.</p>
                </Section>

                <Section id="how-we-process" index={4} title="How Do We Process Your Information?">
                  <p>We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent.</p>
                  <p>We process your personal information for a variety of reasons, depending on how you interact with our Services, including:</p>
                  <ul>
                    <li><strong>To deliver and facilitate delivery of services to the user.</strong> We may process your information to provide you with the requested service.</li>
                    <li><strong>To respond to user inquiries/offer support to users.</strong> We may process your information to respond to your inquiries and solve any potential issues you might have with the requested service.</li>
                    <li><strong>To send administrative information to you.</strong> We may process your information to send you details about our products and services, changes to our terms and policies, and other similar information.</li>
                    <li><strong>To fulfill and manage your orders.</strong> We may process your information to fulfill and manage your orders, payments, returns, and exchanges made through the Services.</li>
                    <li><strong>To request feedback.</strong> We may process your information when necessary to request feedback and to contact you about your use of our Services.</li>
                    <li><strong>To send you marketing and promotional communications.</strong> We may process the personal information you send to us for our marketing purposes, if this is in accordance with your marketing preferences. You can opt out of our marketing emails at any time. For more information, see &quot;WHAT ARE YOUR PRIVACY RIGHTS?&quot; below.</li>
                    <li><strong>To protect our Services.</strong> We may process your information as part of our efforts to keep our Services safe and secure, including fraud monitoring and prevention.</li>
                    <li><strong>To identify usage trends.</strong> We may process information about how you use our Services to better understand how they are being used so we can improve them.</li>
                    <li><strong>To save or protect an individual&apos;s vital interest.</strong> We may process your information when necessary to save or protect an individual’s vital interest, such as to prevent harm.</li>
                  </ul>
                </Section>

                <Section id="legal-bases" index={5} title="What Legal Bases Do We Rely On to Process Your Information?">
                  <p>We only process your personal information when we believe it is necessary and we have a valid legal reason (<em>i.e., legal basis</em>) to do so under applicable law, like with your consent, to comply with laws, to provide you with services to enter into or fulfill our contractual obligations, to protect your rights, or to fulfill our legitimate business interests.</p>
                  <p>The General Data Protection Regulation (<em>GDPR</em>) and UK GDPR require us to explain the valid legal bases we rely on in order to process your personal information. As such, we may rely on the following legal bases to process your personal information:</p>
                  <ul>
                    <li><strong>Consent.</strong> We may process your information if you have given us permission (<em>i.e., consent</em>) to use your personal information for a specific purpose. You can withdraw your consent at any time. Learn more about withdrawing your consent.</li>
                    <li><strong>Performance of a Contract.</strong> We may process your personal information when we believe it is necessary to fulfill our contractual obligations to you, including providing our Services or at your request prior to entering into a contract with you.</li>
                    <li><strong>Legitimate Interests.</strong> We may process your information when we believe it is reasonably necessary to achieve our legitimate business interests and those interests do not outweigh your interests and fundamental rights and freedoms. For example, we may process your personal information for some of the purposes described in order to:
                      <ul>
                        <li>Send users information about special offers and discounts on our products and services.</li>
                        <li>Analyze how our Services are used so we can improve them to engage and retain users. Diagnose problems and/or prevent fraudulent activities.</li>
                        <li>Understand how our users use our products and services so we can improve user experience.</li>
                      </ul>
                    </li>
                    <li><strong>Legal Obligations.</strong> We may process your information where we believe it is necessary for compliance with our legal obligations, such as to cooperate with a law enforcement body or regulatory agency, exercise or defend our legal rights, or disclose your information as evidence in litigation in which we are involved.</li>
                    <li><strong>Vital Interests.</strong> We may process your information where we believe it is necessary to protect your vital interests or the vital interests of a third party, such as situations involving potential threats to the safety of any person.</li>
                  </ul>
                  <p>We may process your information if you have given us specific permission (<em>i.e., express consent</em>) to use your personal information for a specific purpose, or in situations where your permission can be inferred (<em>i.e., implied consent</em>). You can withdraw your consent at any time.</p>
                  <p>In some exceptional cases, we may be legally permitted under applicable law to process your information without your consent, including, for example:</p>
                  <ul>
                    <li>If collection is clearly in the interests of an individual and consent cannot be obtained in a timely way.</li>
                    <li>For investigations and fraud detection and prevention.</li>
                    <li>For business transactions provided certain conditions are met.</li>
                    <li>If it is contained in a witness statement and the collection is necessary to assess, process, or settle an insurance claim.</li>
                    <li>For identifying injured, ill, or deceased persons and communicating with next of kin.</li>
                    <li>If we have reasonable grounds to believe an individual has been, is, or may be victim of financial abuse.</li>
                    <li>If it is reasonable to expect collection and use with consent would compromise the availability or the accuracy of the information and the collection is reasonable for purposes related to investigating a breach of an agreement or a contravention of the laws of Canada or a province.</li>
                    <li>If disclosure is required to comply with a subpoena, warrant, court order, or rules of the court relating to the production of records.</li>
                    <li>If it was produced by an individual in the course of their employment, business, or profession and the collection is consistent with the purposes for which the information was produced.</li>
                    <li>If the collection is solely for journalistic, artistic, or literary purposes.</li>
                    <li>If the information is publicly available and is specified by the regulations.</li>
                  </ul>
                </Section>

                <Section id="sharing" index={6} title="When and With Whom Do We Share Your Personal Information?">
                  <p>We may share information in specific situations described in this section and/or with the following third parties.</p>
                  <p>We may need to share your personal information in the following situations:</p>
                  <ul>
                    <li><strong>Business Transfers.</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
                  </ul>
                </Section>

                <Section id="cookies" index={7} title="Do We Use Cookies and Other Tracking Technologies?">
                  <p>We may use cookies and other tracking technologies to collect and store your information.</p>
                  <p>We may use cookies and similar tracking technologies (<em>like web beacons and pixels</em>) to gather information when you interact with our Services. Some online tracking technologies help us maintain the security of our Services, prevent crashes, fix bugs, save your preferences, and assist with basic site functions.</p>
                  <p>We also permit third parties and service providers to use online tracking technologies on our Services for analytics and advertising, including to help manage and display advertisements, to tailor advertisements to your interests, or to send abandoned shopping cart reminders (<em>depending on your communication preferences</em>). The third parties and service providers use their technology to provide advertising about products and services tailored to your interests which may appear either on our Services or on other websites.</p>
                  <p>To the extent these online tracking technologies are deemed to be a &quot;sale&quot;/&quot;sharing&quot; (<em>which includes targeted advertising, as defined under the applicable laws</em>) under applicable US state laws, you can opt out of these online tracking technologies by submitting a request as described below under section &quot;DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?&quot;</p>
                  <p>Specific information about how we use such technologies and how you can refuse certain cookies is set out in our Cookie Notice.</p>
                  <p>We may share your information with Google Analytics to track and analyze the use of the Services. The Google Analytics Advertising Features that we may use include: Google Analytics Demographics and Interests Reporting. To opt out of being tracked by Google Analytics across the Services, visit <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">https://tools.google.com/dlpage/gaoptout</a>. You can opt out of Google Analytics Advertising Features through Ads Settings and Ad Settings for mobile apps. Other opt out means include <a href="http://optout.networkadvertising.org/" target="_blank" rel="noopener noreferrer">http://optout.networkadvertising.org/</a> and <a href="http://www.networkadvertising.org/mobile-choice" target="_blank" rel="noopener noreferrer">http://www.networkadvertising.org/mobile-choice</a>. For more information on the privacy practices of Google, please visit the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy &amp; Terms page</a>.</p>
                </Section>

                <Section id="ai-products" index={8} title="Do We Offer Artificial Intelligence-Based Products?">
                  <p>We offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies.</p>
                  <p>As part of our Services, we offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies (<em>collectively, &quot;AI Products&quot;</em>). These tools are designed to enhance your experience and provide you with innovative solutions. The terms in this Privacy Notice govern your use of the AI Products within our Services.</p>
                  <p>We provide the AI Products through third-party service providers (<em>&quot;AI Service Providers&quot;</em>), including Amazon Web Services (<em>AWS</em>) AI. As outlined in this Privacy Notice, your input, output, and personal information will be shared with and processed by these AI Service Providers to enable your use of our AI Products for purposes outlined in &quot;WHAT LEGAL BASES DO WE RELY ON TO PROCESS YOUR PERSONAL INFORMATION?&quot; You must not use the AI Products in any way that violates the terms or policies of any AI Service Provider.</p>
                  <p>Our AI Products are designed for the following functions:</p>
                  <ul>
                    <li>AI automation.</li>
                    <li>AI applications.</li>
                    <li>AI bots.</li>
                    <li>AI predictive analytics.</li>
                    <li>AI insights.</li>
                    <li>AI search.</li>
                    <li>Machine learning models.</li>
                    <li>Text analysis.</li>
                    <li>Video analysis.</li>
                  </ul>
                  <p>All personal information processed using our AI Products is handled in line with our Privacy Notice and our agreement with third parties. This ensures high security and safeguards your personal information throughout the process, giving you peace of mind about your data&apos;s safety.</p>
                </Section>

                <Section id="international" index={9} title="Is Your Information Transferred Internationally?">
                  <p>We may transfer, store, and process your information in countries other than your own.</p>
                  <p>Our servers are located in the United States. If you are accessing our Services from outside the United States, please be aware that your information may be transferred to, stored by, and processed by us in our facilities and in the facilities of the third parties with whom we may share your personal information (<em>see &quot;WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?&quot; above</em>), in the United States, and other countries.</p>
                  <p>If you are a resident in the European Economic Area (<em>EEA</em>), United Kingdom (<em>UK</em>), or Switzerland, then these countries may not necessarily have data protection laws or other similar laws as comprehensive as those in your country. However, we will take all necessary measures to protect your personal information in accordance with this Privacy Notice and applicable law.</p>
                  <p>
                    <strong>European Commission&apos;s Standard Contractual Clauses:</strong><br />
                    We have implemented measures to protect your personal information, including by using the European Commission&apos;s Standard Contractual Clauses for transfers of personal information between our group companies and between us and our third-party providers. These clauses require all recipients to protect all personal information that they process originating from the EEA or UK in accordance with European data protection laws and regulations. Our Standard Contractual Clauses can be provided upon request. We have implemented similar appropriate safeguards with our third-party service providers and partners and further details can be provided upon request.
                  </p>
                </Section>

                <Section id="retention" index={10} title="How Long Do We Keep Your Information?">
                  <p>We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law. We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (<em>such as tax, accounting, or other legal requirements</em>).</p>
                  <p>When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (<em>for example, because your personal information has been stored in backup archives</em>), then we will securely store your personal information and isolate it from any further processing until deletion is possible.</p>
                </Section>

                <Section id="security" index={11} title="How Do We Keep Your Information Safe?">
                  <p>We aim to protect your personal information through a system of organizational and technical security measures.</p>
                  <p>We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment.</p>
                </Section>

                <Section id="privacy-rights" index={12} title="What Are Your Privacy Rights?">
                  <p>Depending on your state of residence in the US or in some regions, such as the European Economic Area (<em>EEA</em>), United Kingdom (<em>UK</em>), Switzerland, and Canada, you have rights that allow you greater access to and control over your personal information. You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.</p>
                  <p>In some regions (<em>like the EEA, UK, Switzerland, and Canada</em>), you have certain rights under applicable data protection laws. These may include the right (i) to request access and obtain a copy of your personal information, (ii) to request rectification or erasure; (iii) to restrict the processing of your personal information; (iv) if applicable, to data portability; and (v) not to be subject to automated decision-making. In certain circumstances, you may also have the right to object to the processing of your personal information. You can make such a request by contacting us by using the contact details provided in the section &quot;HOW CAN YOU CONTACT US ABOUT THIS NOTICE?&quot; below.</p>
                  <p>We will consider and act upon any request in accordance with applicable data protection laws.</p>
                  <p>If you are located in the EEA or UK and you believe we are unlawfully processing your personal information, you also have the right to complain to your Member State data protection authority or UK data protection authority.</p>
                  <p>If you are located in Switzerland, you may contact the Federal Data Protection and Information Commissioner.</p>
                  <p><strong>Withdrawing your consent:</strong> If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us by using the contact details provided in the section &quot;HOW CAN YOU CONTACT US ABOUT THIS NOTICE?&quot; below. However, please note that this will not affect the lawfulness of the processing before its withdrawal nor, when applicable law allows, will it affect the processing of your personal information conducted in reliance on lawful processing grounds other than consent.</p>
                  <p><strong>Opting out of marketing and promotional communications:</strong> You can unsubscribe from our marketing and promotional communications at any time by clicking on the unsubscribe link in the emails that we send, or by contacting us using the details provided in the section &quot;HOW CAN YOU CONTACT US ABOUT THIS NOTICE?&quot; below. You will then be removed from the marketing lists. However, we may still communicate with you — for example, to send you service-related messages that are necessary for the administration and use of your account, to respond to service requests, or for other non-marketing purposes.</p>
                  <p><strong>Cookies and similar technologies:</strong> Most Web browsers are set to accept cookies by default. If you prefer, you can usually choose to set your browser to remove cookies and to reject cookies. If you choose to remove cookies or reject cookies, this could affect certain features or services of our Services.</p>
                  <p>If you have questions or comments about your privacy rights, you may email us at <a href="mailto:business@vierradev.com">business@vierradev.com</a>.</p>
                </Section>

                <Section id="dnt" index={13} title="Controls for Do-Not-Track Features">
                  <p>Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track (<em>&quot;DNT&quot;</em>) feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice.</p>
                  <p>California law requires us to let you know how we respond to web browser DNT signals. Because there currently is not an industry or legal standard for recognizing or honoring DNT signals, we do not respond to them at this time.</p>
                </Section>

                <Section id="us-rights" index={14} title="Do United States Residents Have Specific Privacy Rights?">
                  <p>If you are a resident of California, Colorado, Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Tennessee, Texas, Utah, or Virginia, you may have the right to request access to and receive details about the personal information we maintain about you and how we have processed it, correct inaccuracies, get a copy of, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. More information is provided below.</p>
                  <p>We have collected the following categories of personal information in the past twelve (<em>12</em>) months:</p>
                  <div className="not-prose grid grid-cols-[1fr_2fr_auto] overflow-hidden rounded-xl border border-[#701CC0]/15 text-sm text-[#4B4460]">
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2 font-semibold text-[#1A1033]">Category</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2 font-semibold text-[#1A1033]">Examples</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center font-semibold text-[#1A1033]">Collected</div>

                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Identifiers</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Contact details, such as real name, alias, postal address, telephone or mobile contact number, unique personal identifier, online identifier, Internet Protocol address, email address, and account name.</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center">NO</div>

                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Personal information as defined in the California Customer Records statute.</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Name, contact information, education, employment, employment history, and financial information.</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center">NO</div>

                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Protected classification characteristics under state or federal law.</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Gender, age, date of birth, race and ethnicity, national origin, marital status, and other demographic data.</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center">NO</div>

                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Commercial Information</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Transaction information, purchase history, financial details, and payment information.</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center">NO</div>

                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Biometric Information</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Fingerprints and voiceprints.</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center">NO</div>

                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Internet or other similar network activity</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Browsing history, search history, online behavior, interest data, and interactions with our and other websites, applications, systems, and advertisements.</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center">NO</div>

                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Geolocation Data</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Device location.</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center">NO</div>

                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Audio, electronic, sensory, or similar information</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Images and audio, video or call recordings created in connection with our business activities.</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center">NO</div>

                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Professional or employment-related information</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Business contact details in order to provide you our Services at a business level or job title, work history, and professional qualifications if you apply for a job with us.</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center">NO</div>

                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Education Information</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Student records and directory information.</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center">NO</div>

                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Inferences drawn from collected personal information</div>
                    <div className="border-b border-r border-[#701CC0]/15 px-3 py-2">Inferences drawn from any of the collected personal information listed above to create a profile or summary about, for example, an individual’s preferences and characteristics.</div>
                    <div className="border-b border-[#701CC0]/15 px-3 py-2 text-center">YES</div>

                    <div className="border-r border-[#701CC0]/15 px-3 py-2">Sensitive personal Information</div>
                    <div className="border-r border-[#701CC0]/15 px-3 py-2"></div>
                    <div className="px-3 py-2 text-center">NO</div>
                  </div>
                  <p>We may also collect other personal information outside of these categories through instances where you interact with us in person, online, or by phone or mail in the context of:</p>
                  <ul>
                    <li>Receiving help through our customer support channels;</li>
                    <li>Participation in customer surveys or contests; and</li>
                    <li>Facilitation in the delivery of our Services and to respond to your inquiries.</li>
                  </ul>
                  <p>We will use and retain the collected personal information as needed to provide the Services or for:</p>
                  <ul>
                    <li>Category H - As long as the user has an account with us.</li>
                    <li>Category K - As long as the user has an account with us.</li>
                  </ul>
                  <p>Learn more about the sources of personal information we collect in &quot;WHAT INFORMATION DO WE COLLECT?&quot;</p>
                  <p>Learn more about how we use your personal information in the section, &quot;HOW DO WE PROCESS YOUR INFORMATION?&quot;</p>
                  <p>We may disclose your personal information with our service providers pursuant to a written contract between us and each service provider. Learn more about how we disclose personal information to in the section, &quot;WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?&quot;</p>
                  <p>We may use your personal information for our own business purposes, such as for undertaking internal research for technological development and demonstration. This is not considered to be &quot;selling&quot; of your personal information.</p>
                  <p>We have not disclosed, sold, or shared any personal information to third parties for a business or commercial purpose in the preceding twelve (<em>12</em>) months. We will not sell or share personal information in the future belonging to website visitors, users, and other consumers.</p>
                  <p>You have rights under certain US state data protection laws. However, these rights are not absolute, and in certain cases, we may decline your request as permitted by law. These rights include:</p>
                  <ul>
                    <li>Right to know whether or not we are processing your personal data.</li>
                    <li>Right to access your personal data.</li>
                    <li>Right to correct inaccuracies in your personal data.</li>
                    <li>Right to request the deletion of your personal data.</li>
                    <li>Right to obtain a copy of the personal data you previously shared with us.</li>
                    <li>Right to non-discrimination for exercising your rights.</li>
                    <li>Right to opt out of the processing of your personal data if it is used for targeted advertising (<em>or sharing as defined under California’s privacy law</em>), the sale of personal data, or profiling in furtherance of decisions that produce legal or similarly significant effects (<em>&quot;profiling&quot;</em>).</li>
                  </ul>
                  <p>Depending upon the state where you live, you may also have the following rights:</p>
                  <ul>
                    <li>Right to access the categories of personal data being processed (<em>as permitted by applicable law, including Minnesota’s privacy law</em>).</li>
                    <li>Right to obtain a list of the categories of third parties to which we have disclosed personal data (<em>as permitted by applicable law, including California&apos;s and Delaware&apos;s privacy law</em>).</li>
                    <li>Right to obtain a list of specific third parties to which we have disclosed personal data (<em>as permitted by applicable law, including Minnesota&apos;s and Oregon&apos;s privacy law</em>).</li>
                    <li>Right to review, understand, question, and correct how personal data has been profiled (<em>as permitted by applicable law, including Minnesota’s privacy law</em>).</li>
                    <li>Right to limit use and disclosure of sensitive personal data (<em>as permitted by applicable law, including California’s privacy law</em>).</li>
                    <li>Right to opt out of the collection of sensitive data and personal data collected through the operation of a voice or facial recognition feature (<em>as permitted by applicable law, including Florida’s privacy law</em>).</li>
                  </ul>
                  <p>To exercise these rights, you can contact us by submitting a data subject access request, by emailing us at <a href="mailto:business@vierradev.com">business@vierradev.com</a>, or by referring to the contact details at the bottom of this document.</p>
                  <p>We will honor your opt-out preferences if you enact the Global Privacy Control (<em>GPC</em>) opt-out signal on your browser.</p>
                  <p>Under certain US state data protection laws, you can designate an authorized agent to make a request on your behalf. We may deny a request from an authorized agent that does not submit proof that they have been validly authorized to act on your behalf in accordance with applicable laws.</p>
                  <p>Upon receiving your request, we will need to verify your identity to determine you are the same person about whom we have the information in our system. We will only use personal information provided in your request to verify your identity or authority to make the request.</p>
                  <p>However, if we cannot verify your identity from the information already maintained by us, we may request that you provide additional information for the purposes of verifying your identity and for security or fraud-prevention purposes.</p>
                  <p>If you submit the request through an authorized agent, we may need to collect additional information to verify your identity before processing your request and the agent will need to provide a written and signed permission from you to submit such request on your behalf.</p>
                  <p>Under certain US state data protection laws, if we decline to take action regarding your request, you may appeal our decision by emailing us at <a href="mailto:business@vierradev.com">business@vierradev.com</a>. We will inform you in writing of any action taken or not taken in response to the appeal, including a written explanation of the reasons for the decisions. If your appeal is denied, you may submit a complaint to your state attorney general.</p>
                  <p>California Civil Code Section 1798.83, also known as the &quot;Shine The Light&quot; law, permits our users who are California residents to request and obtain from us, once a year and free of charge, information about categories of personal information (<em>if any</em>) we disclosed to third parties for direct marketing purposes and the names and addresses of all third parties with which we shared personal information in the immediately preceding calendar year. If you are a California resident and would like to make such a request, please submit your request in writing to us by using the contact details provided in the section &quot;HOW CAN YOU CONTACT US ABOUT THIS NOTICE?&quot;</p>
                </Section>

                <Section id="other-regions" index={15} title="Do Other Regions Have Specific Privacy Rights?">
                  <p>You may have additional rights based on the country you reside in.</p>
                  <p>We collect and process your personal information under the obligations and conditions set by Australia&apos;s Privacy Act 1988 and New Zealand&apos;s Privacy Act 2020 (<em>Privacy Act</em>). This Privacy Notice satisfies the notice requirements defined in both Privacy Acts, in particular: what personal information we collect from you, from which sources, for which purposes, and other recipients of your personal information.</p>
                  <p>If you do not wish to provide the personal information necessary to fulfill their applicable purpose, it may affect our ability to provide our services, in particular:</p>
                  <ul>
                    <li>Offer you the products or services that you want.</li>
                    <li>Respond to or help with your requests.</li>
                  </ul>
                  <p>At any time, you have the right to request access to or correction of your personal information. You can make such a request by contacting us by using the contact details provided in the section &quot;HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?&quot;</p>
                  <p>If you believe we are unlawfully processing your personal information, you have the right to submit a complaint about a breach of the Australian Privacy Principles to the Office of the Australian Information Commissioner and a breach of New Zealand&apos;s Privacy Principles to the Office of New Zealand Privacy Commissioner.</p>
                  <p>At any time, you have the right to request access to or correction of your personal information. You can make such a request by contacting us by using the contact details provided in the section &quot;HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?&quot;</p>
                  <p>If you are unsatisfied with the manner in which we address any complaint with regard to our processing of personal information, you can contact the office of the regulator, the details of which are:</p>
                  <p>
                    The Information Regulator (<em>South Africa</em>)<br />
                    General enquiries: <a href="mailto:enquiries@inforegulator.org.za">enquiries@inforegulator.org.za</a><br />
                    Complaints (<em>complete POPIA/PAIA form 5</em>): <a href="mailto:PAIAComplaints@inforegulator.org.za">PAIAComplaints@inforegulator.org.za</a> &amp; <a href="mailto:POPIAComplaints@inforegulator.org.za">POPIAComplaints@inforegulator.org.za</a>
                  </p>
                </Section>

                <Section id="updates" index={16} title="Do We Make Updates to This Notice?">
                  <p>Yes, we will update this notice as necessary to stay compliant with relevant laws.</p>
                  <p>We may update this Privacy Notice from time to time. The updated version will be indicated by an updated &quot;Revised&quot; date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information.</p>
                </Section>

                <Section id="contact" index={17} title="How Can You Contact Us About This Notice?">
                  <p>If you have questions or comments about this notice, you may email us at <a href="mailto:business@vierradev.com">business@vierradev.com</a> or contact us by post at:</p>
                  <div className="mt-2 rounded-2xl border border-[#701CC0]/15 bg-gradient-to-br from-[#701CC0]/[0.06] to-transparent p-6">
                    <p className="not-prose text-[#3A3352]">
                      <strong className="text-[#1A1033]">Vierra Digital LLC</strong><br />
                      Cambridge, MA 02138<br />
                      United States
                    </p>
                  </div>
                </Section>

                <Section id="review-data" index={18} title="How Can You Review, Update, or Delete the Data We Collect From You?">
                  <p>Based on the applicable laws of your country or state of residence in the US, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. To request to review, update, or delete your personal information, please fill out and submit a data subject access request.</p>
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

export default PrivacyPolicyPage;
