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
  { id: 'introductions', title: 'Introductions' },
  { id: 'company-values', title: 'Company Values' },
  { id: 'our-project', title: 'Our Project' },
  { id: 'leadership-team', title: 'Leadership Team' },
  { id: 'internships', title: 'Internships and Initial Steps' },
  { id: 'work-expectations', title: 'Work Expectations' },
  { id: 'staffing-benefits', title: 'Staffing Benefits' },
  { id: 'team-divisions', title: 'Team Divisions' },
  { id: 'design-team', title: 'Design Team' },
  { id: 'development-team', title: 'Development Team' },
  { id: 'outreach-team', title: 'Outreach Team' },
  { id: 'agile-workflow', title: 'Agile Workflow Systems & Sprints' },
  { id: 'striking-system', title: 'The Striking System and Human Resources' },
  { id: 'harassment-policy', title: 'Harassment Policy' },
  { id: 'discrimination-dei', title: 'Discrimination & DEI Policy' },
  { id: 'termination-policies', title: 'Termination Policies' },
  { id: 'additional-resources', title: 'Additional Resources' },
  { id: 'acknowledgement', title: 'Acknowledgement' },
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
    <div className="space-y-4 text-[15px] leading-7 text-[#4B4460] [&_a]:text-[#701CC0] [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-[#8F42FF] [&_a]:transition-colors [&_strong]:font-semibold [&_strong]:text-[#1A1033] [&_em]:text-[#3A3352] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_li]:marker:text-[#8F42FF]">
      {children}
    </div>
  </section>
);

const WorkPolicyPage: React.FC = () => {
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
        <title>Vierra | Work Policy</title>
        <meta name="description" content="Vierra Digital Work Policy. Learn about our work standards, processes, and policies for delivering exceptional digital marketing services." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://vierradev.com/work-policy" />
        <meta property="og:title" content="Vierra | Work Policy" />
        <meta property="og:description" content="Vierra Digital Work Policy. Learn about our work standards and processes." />
        <meta property="og:url" content="https://vierradev.com/work-policy" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Vierra Digital" />
        <meta property="og:image" content="https://vierradev.com/assets/meta-banner.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://vierradev.com/assets/meta-banner.png" />
        <meta name="twitter:title" content="Vierra | Work Policy" />
        <meta name="twitter:description" content="Vierra Digital Work Policy. Learn about our work standards and processes." />
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
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#C99DFF]">Staffing Handbook</span>
            <h1 className={`mt-4 text-5xl font-bold tracking-tight md:text-7xl ${bricolage.className}`}>
              Work{' '}
              <span className="bg-gradient-to-r from-[#8F42FF] via-[#D4A5FF] to-[#8F42FF] bg-[length:200%_auto] bg-clip-text text-transparent animate-gradient">
                Policy
              </span>
            </h1>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/70 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8F42FF]" />
              Last Updated January 7th, 2025
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
                <Section id="introductions" index={1} title="Introductions">
                  <p>Congratulations on your acceptance into <strong>Vierra</strong>! We welcome you to our team of innovative individuals, all coming together to create groundbreaking and revolutionary products. The <strong>Vierra Staffing Handbook</strong> will provide adequate information regarding company descriptions, assets, systems, and formal introductions.</p>
                  <p>Upon joining our team, your initial access will be granted to our <strong>Staff Discord server</strong>, where you will have entry to a single text channel: the <strong>unverified channel</strong>. Before obtaining <strong>internship-level</strong> or <strong>staffing-level</strong> access within our team, you must complete the provided form within the <strong>unverified channel</strong>. This enables us to add your information to our <strong>Staff Orbital</strong>.</p>
                  <p>The <strong>Staff Orbital</strong> serves as our organizational tool, facilitating the tracking of each team member&apos;s roles, positions, time zones, emails, contact information, and skill sets. It is crucial to complete this form to commence your work with us.</p>
                  <p><strong>Staff-level</strong> individuals joining our team are required to sign a <strong>Non-Disclosure Agreement</strong> (<em>NDA</em>) before commencing work. The purpose of <strong>NDAs</strong> is to safeguard our ideas, ensuring they remain proprietary to the company and preventing any attempts by external individuals to replicate our innovative concepts.</p>
                  <p>After completing the form or signing the <strong>NDA</strong> (<em>for staff-level entrants</em>), kindly wait for a member of the <strong>management team</strong> to integrate your information into the <strong>Staff Orbital</strong> and assign your roles on the <strong>Staffing Discord</strong>. Rest assured, you will receive a notification once this process is concluded, eliminating the need for frequent checks on Discord to verify its completion.</p>
                  <p>Upon your addition, it is expected that you thoroughly comprehend and adhere to all the information outlined in this handbook. Additionally, anticipate receiving several emails inviting you to access various systems integral to our operations, such as <strong>Trello</strong> for task and sprint management, and any other relevant systems aligned with your specific role.</p>
                </Section>

                <Section id="company-values" index={2} title="Company Values">
                  <p>At <strong>Vierra</strong>, we hold specific company values in high regard, considering them integral to our shared community. Every team member is expected to follow and uphold these values as a foundation for our collective ethos. Here are some of our most prominent company values:</p>
                  <ol>
                    <li><strong>Capitalism And The Open Market</strong>: At <strong>Vierra</strong>, we hold a strong belief in <strong>capitalism</strong> and the <strong>open market</strong>. We recognize the power of <strong>free-market principles</strong> in fostering innovation, competition, and economic growth. Our commitment to these values shapes our business approach, emphasizing entrepreneurship, fair competition, and the pursuit of economic opportunities. We believe that a dynamic and <strong>open market</strong> environment not only benefits our company but also contributes to the overall prosperity of the communities we serve.</li>
                    <li><strong>Collaborative Workspaces</strong>: A fundamental aspect of our work culture at <strong>Vierra</strong> is the collective will to operate within a <strong>collaborative workspace</strong> and an <strong>open environment</strong>. We encourage and value teamwork, open communication, and the sharing of ideas among team members. This collaborative spirit allows us to leverage the diverse skills and perspectives within our team, fostering a dynamic and innovative work environment. We believe that a shared commitment to collaboration enhances the overall effectiveness and success of our collective efforts at <strong>Vierra</strong>.</li>
                    <li><strong>Respectful Conflict Of Opinions</strong>: At <strong>Vierra</strong>, we recognize and value the importance of <strong>respectful conflict of opinions</strong> within discussions. We believe that diverse perspectives and differing opinions contribute to robust decision-making and creative problem-solving. Our commitment to fostering an environment where team members feel comfortable expressing their viewpoints promotes healthy discourse and innovation. We encourage constructive debates and discussions, understanding that <strong>respectful conflict of opinions</strong> is an essential component of our collaborative and dynamic work culture.</li>
                    <li><strong>Scientific Fact And Law</strong>: At <strong>Vierra</strong>, we emphasize a comprehensive approach to decision-making, encouraging the use of <strong>scientific facts</strong>, legal principles, and statistical data to support arguments. We value evidence-based reasoning, where team members rely on sound scientific principles, applicable laws, and statistical analysis to ensure our discussions and decision-making processes are grounded in objective, well-established, and quantifiable information. This commitment to a data-driven and legally sound approach enhances the quality, credibility, and effectiveness of our collaborative efforts.</li>
                    <li><strong>Personal And Professional Development</strong>: <strong>Vierra</strong> places a strong emphasis on both <strong>personal</strong> and <strong>professional development</strong>, recognizing the importance of continuous self-improvement. We encourage our team members to actively engage in opportunities for personal growth, enhancing their skills, and expanding their knowledge base. This commitment to development not only contributes to individual success but also strengthens the overall capacity and effectiveness of our team. At <strong>Vierra</strong>, we view <strong>personal</strong> and <strong>professional growth</strong> as integral components of a thriving and dynamic work environment.</li>
                    <li><strong>Company’s Mission Statement</strong>: At <strong>Vierra</strong>, we foster a collective belief in the ability to pursue and achieve the <strong>company&apos;s mission</strong>. We encourage every team member to see themselves as integral contributors to the realization of the company&apos;s dream. This shared belief creates a sense of purpose and commitment, aligning individual aspirations with the overarching goals of <strong>Vierra</strong>. Our emphasis on this shared vision cultivates a motivated and engaged team, working collaboratively towards the fulfillment of our collective mission and the realization of our company&apos;s aspirations.</li>
                    <li><strong>High-Quality Products</strong>: At <strong>Vierra</strong>, we are unwavering in our commitment to delivering <strong>high-quality products</strong>. We believe that the foundation of our success lies in consistently providing products that meet and exceed the expectations of our customers. Our dedication to quality extends across all facets of our operations, from design and development to production and delivery. <strong>Vierra</strong> takes pride in maintaining rigorous standards to ensure that each product reflects our commitment to excellence and customer satisfaction.</li>
                    <li><strong>Innovation</strong>: <strong>Innovation</strong> stands as a cornerstone at <strong>Vierra</strong>. We are driven by a commitment to continuous improvement and the exploration of groundbreaking ideas. Encouraging a culture that embraces creativity and forward-thinking, we strive to pioneer innovative solutions across all aspects of our business. At <strong>Vierra</strong>, we recognize that <strong>innovation</strong> is key to staying at the forefront of our industry, meeting evolving customer needs, and shaping a future where our products and services make a meaningful impact.</li>
                  </ol>
                </Section>

                <Section id="our-project" index={3} title="Our Project">
                  <p><strong>Vierra</strong> is a cutting-edge <strong>marketing and sales company</strong> providing small business owners with a new solution to increasing ROI, leads, and conversions.</p>
                  <p className="italic">What else are you going to do but win?</p>
                  <p><strong>Vierra</strong> is a comprehensive company with various aspects of profit generation. We have simplified the process into:</p>
                  <p><strong>Small-Business Sales &amp; Consulting</strong>: We proudly offer business-to-business <strong>consulting</strong> and <strong>sales</strong> services. Our <strong>subscription-based system</strong> provides small-business owners with the opportunity to engage in discussions about business growth and marketing strategies aimed at elevating their enterprises to a corporate level. The services are divided into two categories: a <strong>combined sales/marketing service with consulting</strong>, or a <strong>standalone consulting service</strong>. <strong>Pricing</strong> for these services is customized based on the unique needs of each business, and detailed discussions on pricing, plans, and more are scheduled in individual meetings with clients. The baseline price for these services is set at $1,000 per month. Typically, we initiate the partnership with a 3-month <strong>upfront starting plan</strong>, allowing both parties to assess the viability of the partnership.</p>
                </Section>

                <Section id="leadership-team" index={4} title="Leadership Team">
                  <p>As a small company, the <strong>leadership team</strong> at <strong>Vierra</strong> is readily available to assist and address any questions that may arise. While team members are encouraged to reach out to their <strong>divisional supervisor</strong> as a first point of contact, it&apos;s important to note that these supervisors may also be members of the <strong>leadership team</strong>. This approach ensures that inquiries are directed to individuals with the most relevant expertise. Below is a list of the full <strong>leadership team</strong> along with brief profiles of each person for your reference.</p>
                  <ul className="!list-none !pl-0">
                    <li><span className="mr-2 text-[#701CC0]">➔</span> <strong>Alex</strong> [<em>Founder &amp; Chief Executive Officer</em>]: As the founder and visionary behind <strong>Vierra</strong>, Alex plays a pivotal role across nearly every division of the company. With a deep involvement from design and development to marketing, Alex&apos;s influence spans the entire spectrum of operations. In the capacity of the primary business operations manager, Alex takes charge of planning, tasking, and providing direction for every facet of the company. In addition to overseeing quality assurance and production, Alex ensures that creative endeavors and produced products at <strong>Vierra</strong> meet the highest standards. Crucially, Alex is dedicated to maintaining adherence to timelines and ensuring timely payments, underscoring a commitment to operational efficiency and excellence throughout the <strong>Vierra</strong> ecosystem.</li>
                    <li><span className="mr-2 text-[#701CC0]">➔</span> <strong>Paul</strong> [<em>Chief Operating Officer</em>]: As <strong>Vierra&apos;s</strong> Chief Operating Officer, Paul plays a critical role in steering the company’s day-to-day operations and ensuring seamless execution across departments. With a focus on recruitment, Paul identifies and attracts top talent to align with <strong>Vierra’s</strong> vision, building a team that drives innovation and success. In marketing, Paul develops strategies to elevate <strong>Vierra’s</strong> presence, connecting with target audiences and fostering impactful brand recognition. Additionally, Paul oversees operational workflows, ensuring efficiency and alignment with organizational goals. With a commitment to collaboration and operational excellence, Paul ensures that every aspect of <strong>Vierra’s</strong> recruitment, marketing, and operations reflects the company’s core values and mission.</li>
                  </ul>
                </Section>

                <Section id="internships" index={5} title="Internships and Initial Steps">
                  <p>As an intern at <strong>Vierra</strong>, your experience will provide hands-on exposure to the inner workings of a company that is continually expanding toward a corporate scale. This opportunity allows you to witness firsthand the operational dynamics and diverse facets inherent in various positions and teams within the organization. Even if your role is not directly aligned with a specific team or position, you&apos;ll gain valuable insights into the multifaceted aspects of company operations. This immersive experience is designed to foster a comprehensive understanding of the corporate environment and contribute to your professional development.</p>
                  <p>As an intern at <strong>Vierra</strong>, your access to resources and team members will be focused on a singular <strong>channel</strong>, serving as the primary communication channel between you and your respective <strong>supervisor</strong>. Typically, your <strong>supervisor</strong>, who is often the head of your assigned team, will oversee your training and guide your progression within the company. While your access may be initially limited, this structure is designed to ensure a streamlined and guided onboarding experience. Your <strong>supervisor</strong> will play a pivotal role in facilitating your development, ultimately paving the way for a potential transition into a fully functional full-time role at <strong>Vierra</strong>.</p>
                  <p>During your initial <strong>1-2 months</strong> at <strong>Vierra</strong>, you will undergo a comprehensive training program under your assigned <strong>supervisor</strong>. This training is tailored to equip you with the essential skills and expertise needed to thrive within <strong>Vierra</strong>&apos;s company culture. Lessons will be provided to ensure you acquire the technical skills necessary for your continued success.</p>
                  <p>Following this training period, you will be assigned <strong>1-2 tasks</strong> directly contributing to <strong>Vierra</strong>&apos;s progression. The completion of these tasks to the satisfaction of the <strong>divisional team manager</strong> will be a key milestone. Upon achieving this, you will be granted <strong>full access to the staff team</strong> at <strong>Vierra</strong>, signifying your readiness to contribute effectively to the broader operations of the company. This structured progression ensures a smooth onboarding experience and integration into <strong>Vierra</strong>&apos;s dynamic work environment.</p>
                  <p>Whether you&apos;re advancing from an <strong>internship</strong> or joining the team at the <strong>staff level</strong>, a mandatory step is signing a <strong>Non-Disclosure Agreement</strong> (<em>NDA</em>). This agreement is crucial in maintaining the confidentiality of information and safeguarding innovative ideas at <strong>Vierra</strong>. Once the <strong>NDA</strong> and any other relevant documents like work orders or contracts are signed, you will be granted full access to your selected division&apos;s channels.</p>
                  <p>This access will enable you to interact with other <strong>staff-level</strong> individuals in your team, fostering connections and collaboration. Additionally, you&apos;ll gain access to essential tools tailored to your division, including platforms like <strong>Trello</strong> for task management and other tools relevant to the nature of your role. This comprehensive onboarding process ensures you have the necessary resources and connections to thrive within your specific division at <strong>Vierra</strong>.</p>
                  <p>As a <strong>staff-level</strong> team member at <strong>Vierra</strong>, adherence to the established work expectations, including leave of absence policies and tasking procedures, is essential. Throughout your tenure, quick promotions are readily available, and comprehensive support is always accessible.</p>
                  <p>When seeking assistance, the initial step is to reach out to your fellow team members within your division and your designated divisional <strong>supervisor</strong>. These individuals are your primary resources for addressing inquiries and challenges. If your questions cannot be resolved at this level, <strong>executives</strong> within the company are available to provide further assistance. <strong>Vierra</strong> is committed to fostering a supportive environment, ensuring that you have the resources and guidance needed for your professional growth and success.</p>
                </Section>

                <Section id="work-expectations" index={6} title="Work Expectations">
                  <p>While <strong>Vierra</strong> operates as a small startup company with a limited set of work expectations, it is imperative that these expectations are strictly adhered to at all times. Although they may be open and broad, there is zero tolerance for violations. Any breach of these work expectations by a <strong>staff-level</strong> team member may lead to termination from the company. <strong>Vierra</strong> places a premium on the importance of upholding its foundational principles, and the commitment to these expectations is fundamental to maintaining a cohesive and effective work environment.</p>
                  <ol>
                    <li><strong>Work Hours</strong>: <strong>Vierra</strong> embraces a highly flexible and generous approach to <strong>work hours</strong>. As a <strong>remote</strong> company, <strong>staff-level</strong> team members have the flexibility to work from any time zone and at any time of the day. The emphasis is placed on <strong>meeting deadlines</strong>, allowing team members to manage their schedules autonomously. However, it is essential to maintain realistic expectations for response times from both fellow team members and the <strong>management team</strong>, considering the diverse working hours chosen by individuals. This flexibility encourages productivity and accommodates the varied preferences and time zones of the <strong>Vierra</strong> team.</li>
                    <li><strong>Project Deadlines And Tasking</strong>: Project deadlines and task management at <strong>Vierra</strong> are facilitated through the use of <strong>Trello</strong>, employing an <strong>Agile Workflow</strong> and <strong>Sprints</strong> model. Specific details about how this model operates can be found in the <strong>Agile Workflow</strong> section of this document. Team members must strive to complete assigned tasks, which are allocated with generous timeframes based on the task&apos;s complexity, within the designated deadline. In situations where additional time is required, <strong>Vierra</strong> accommodates such requests for extensions provided they are communicated at least <strong>2 days in advance</strong>. In case of emergencies, team members are expected to file a <strong>Leave of Absence</strong> (<em>LOA</em>), and any responsibilities tied to specific deadlines will be either negotiated or lifted entirely, demonstrating <strong>Vierra</strong>&apos;s commitment to flexibility and the understanding of unforeseen circumstances.</li>
                    <li><strong>Leave Of Absence</strong> (<em>LOA</em>): The <strong>Leave of Absence</strong> system at <strong>Vierra</strong> is designed to accommodate team members who need to take time off from the project due to various unavoidable circumstances such as family issues, emergencies, exams, vacations, or other obligations. To initiate a <strong>Leave of Absence</strong>, team members simply need to communicate the details and duration of their leave to their <strong>supervisor</strong>, who will then file it with the <strong>executive</strong> team. As a best practice, team members are encouraged to provide notice of their <strong>Leave of Absence</strong> within <strong>5 days</strong> of the anticipated leave period. However, exceptions are made for emergencies. This early notification allows <strong>executives</strong> to restructure tasks accordingly—whether they are pushed back and delayed or assigned to a different team member for completion—ensuring a smooth workflow despite any temporary adjustments in team composition.</li>
                    <li><strong>Work Habits</strong>: Work habits play a crucial role in <strong>Vierra</strong>&apos;s work environment, and as you integrate into our company culture, we expect the development of certain habits. These include establishing a general availability duration that aligns with the team&apos;s needs. Communication is paramount, and we emphasize a respectful and integral manner when interacting with both <strong>staff-level</strong> and managerial team members. Effective utilization of company systems, such as <strong>Trello</strong> for task management and <strong>Leave of Absence</strong> forms, is a fundamental work habit. We encourage a respectful approach to using these tools to maintain an organized and efficient workflow. For those involved in customer relations, a consistent and respectful demeanor towards clients is essential, reflecting <strong>Vierra</strong>&apos;s commitment to professionalism in all aspects of our work. Developing and maintaining these positive work habits contributes to a harmonious and productive work environment.</li>
                    <li><strong>Pay</strong>: It is important to note that <strong>Vierra</strong>&apos;s pay system operates by the percentage system, and this system is rigorously enforced across all levels. Team members should be aware that compensation expectations are strictly tied to the percentage system, and any adjustments or considerations are made within the framework of this system. It is advised not to anticipate deviations from the established percentage system in matters related to compensation. <strong>Vierra</strong> maintains a consistent and fair approach in aligning pay with the percentage earned through performance and contributions within the organization.</li>
                  </ol>
                </Section>

                <Section id="staffing-benefits" index={7} title="Staffing Benefits">
                  <p>Working with <strong>Vierra</strong> brings about numerous staffing benefits within the unique context of a small company. <strong>Vierra</strong> encourages team members to leverage these benefits not only to enhance their skill sets but also to contribute to the advancement of their overall professional careers. The dynamic and collaborative environment at <strong>Vierra</strong> provides opportunities for growth, learning, and skill development that extend beyond the immediate scope of one&apos;s role. Team members are encouraged to actively explore and take advantage of these staffing benefits to foster personal and professional development.</p>
                  <ul>
                    <li><strong>The Percentage System</strong>: At <strong>Vierra</strong>, we have a strong belief in the future potential and success of our company. To effectively track and recognize the contributions of our <strong>staff-level</strong> team, we have implemented a <strong>percentage system</strong> within our tasking framework. Each client task will lead to a percentage (<em>based on your role</em>) of the commission if you’ve completed part of the client’s order. The more complex/difficult the task, likely larger the commission leading to higher payouts. Work done for the company also leads to payouts with time completed for the task and lead generation. Tasks completed for the company that generate clients will automatically lead you to receive more commissions from <strong>Vierra</strong>. This system not only serves as a mechanism for tracking completed work but also provides a tangible and rewarding way to recognize and compensate for the efforts of our <strong>staff-level</strong> team.</li>
                    <li><strong>Resume Position</strong>: At <strong>Vierra</strong>, we view our relationship with you as more than just an employment arrangement focused on completing tasks. Instead, we see it as an investment in your potential. Our commitment extends beyond the work you do for us – we dedicate our resources, time, and training to ensure you have the best opportunities as you advance in your career. Being part of <strong>Vierra</strong> means we are actively working to optimize avenues that will propel your career forward. By collaborating with us, you gain the potential to add a growing and notable project to your resume. This project not only showcases your skills and contributions but also enhances your marketability in the professional landscape. We aim to provide an environment that not only supports your current role but also contributes significantly to your long-term career success and growth.</li>
                    <li><strong>Working With A Small Company</strong>: Collaborating with a small company like <strong>Vierra</strong> offers a unique and enriching experience, allowing you to engage with various facets of the business within a more intimate environment. In a smaller setting, you have the opportunity to work closely with different teams, gaining insights into diverse aspects of business operations. This exposure extends beyond your primary role, enabling you to explore areas of interest that you might not have discovered in a larger corporate setting. Working with a small company provides invaluable experience in understanding how to run a business. You&apos;re not just a small cog in a big machine; instead, you get to be involved at multiple levels, contributing to the core of company operations. This hands-on involvement allows you to witness and actively participate in industry-changing developments, an experience that might be harder to come by in larger corporations like <strong>FAANG</strong> companies. The dynamic and collaborative nature of small companies offers a unique and impactful learning environment for those seeking diverse and immersive professional experiences.</li>
                    <li><strong>Working With Large Clients</strong>: <strong>Vierra</strong>&apos;s business model involves collaborating with not everyday consumers but with small and large business owners, often dealing with high-ticket commissions. Being part of <strong>Vierra</strong> provides an invaluable opportunity for individuals to learn how to effectively engage with such clients and cultivate their professional network. Working with small and large business owners, along with high-ticket commissions, exposes team members to the intricacies of handling diverse and significant clients. This experience is instrumental in developing skills in client management, negotiation, and relationship building. As a result, team members at <strong>Vierra</strong> gain hands-on knowledge about the nuances of working with clients of varying scales and complexities. Moreover, the collaborative and network-centric environment at <strong>Vierra</strong> fosters personal and professional growth. By spending time with <strong>Vierra</strong>, team members can actively expand their professional network, creating opportunities for personal and career development. This aspect aligns with <strong>Vierra</strong>&apos;s belief in the vital importance of learning how to work with large clients and building a robust professional network for long-term success.</li>
                    <li><strong>Subscription Perks</strong>: <strong>Vierra</strong> is committed to utilizing top-of-the-line tools to drive the advancement of our company. Depending on the division in which you work, you will have access to premium versions of industry-leading products. For example, the design team benefits from premium versions of <strong>Figma</strong> and <strong>Adobe Creative Cloud</strong>, enabling them to create and innovate with cutting-edge design tools. This commitment to providing access to premium tools underscores <strong>Vierra</strong>&apos;s dedication to fostering a high-performance and efficient work environment for all team members, empowering them to contribute effectively to the company&apos;s progression.</li>
                  </ul>
                </Section>

                <Section id="team-divisions" index={8} title="Team Divisions">
                  <p>At <strong>Vierra</strong>, we believe in optimizing our teams for maximum efficiency and collaboration. To achieve this, we have structured the company into different departments, allowing like-minded individuals to maintain constant communication. The team size and specifications may vary based on your assigned position. Below, you will find information about each specific role within the company, along with its respective description and processes. This structured approach ensures that each team operates cohesively, contributing to the overall success and productivity of <strong>Vierra</strong>.</p>
                </Section>

                <Section id="design-team" index={9} title="Design Team">
                  <p>The Design team at <strong>Vierra</strong> plays a crucial role in exercising creative control over the company&apos;s visual identity. Tasked with interpreting consumer research, the design team is responsible for creating layouts for our websites and products. Additionally, they are instrumental in producing any outreach materials and video posts required by the outreach team. This collaborative effort ensures a cohesive and visually appealing representation of <strong>Vierra</strong> across various platforms, contributing to a strong and engaging brand presence.</p>
                  <ul>
                    <li><strong>Design Team Expectations</strong>: Designers at <strong>Vierra</strong> are expected to leverage their creative skills to exercise original and research-based control over their work. The emphasis is on producing optimized, high-quality, and timely deliverables. This expectation extends to all aspects of design, including icons and assets, which must be either original creations or generated using AI technology. This commitment to creativity, innovation, and quality ensures that <strong>Vierra</strong>&apos;s design output is not only visually appealing but also aligns with the latest research and industry standards.</li>
                    <li>
                      <strong>Software And Product Creation Process</strong>: The design process for product and software creation at <strong>Vierra</strong> adheres to the following steps:
                      <ul>
                        <li><strong>Tasking</strong>: <strong>Vierra</strong>&apos;s design team operates with a structured task management system using <strong>Trello</strong>. All tasks for the design team are assigned and tracked through <strong>Trello</strong>. Design team members have access to the <strong>Trello</strong> task board, where they can view and manage their assigned tasks. It is expected that each design team member maintains an active presence on the <strong>Trello</strong> task board and consistently works on one concurrent task at a time. This approach ensures efficient task allocation, effective collaboration, and the seamless progression of design projects within the team.</li>
                        <li><strong>Figma</strong>: For <strong>Vierra</strong>&apos;s design team, all design aspects, both in progression and completion, are conducted using <strong>Figma</strong>. The entire process, from initial development to finalization, occurs within the dedicated company <strong>Figma</strong> team and corresponding page documents. Design team members will be granted edit access to their specific design projects. Team members must adhere to the principle of editing only the pages to which they have been assigned. This practice ensures a streamlined and organized workflow, minimizing the risk of conflicts and ensuring that each team member can focus on their designated design tasks without interference.</li>
                        <li><strong>Design Review</strong>: Upon completion of a design in <strong>Figma</strong>, the design review process must be initiated. For detailed information about this process, team members are directed to refer to the <strong>design-review Discord channel&apos;s pinned messages</strong>. This channel serves as a centralized chat for discussions and guidelines related to the design review process. After feedback is received, design team members are expected to carefully assess the comments and suggestions, making the necessary adjustments to the designs. The revised designs should then be returned to the design review channel for further evaluation. This iterative process continues until no more feedback is received, ensuring that each design undergoes thorough scrutiny and refinement before finalization.</li>
                        <li>
                          <strong>Responsive Design</strong>: Following the completion of the design review process, the next step is to create responsive designs, particularly if the designs pertain to websites. Responsive design ensures optimal viewing and interaction experiences across various devices and screen sizes. Design team members are tasked with creating responsive designs for each relevant dimension. The specific dimensions may include…
                          <ul>
                            <li>Phones.</li>
                            <li>Large phones.</li>
                            <li>Tablets.</li>
                            <li>Laptops.</li>
                            <li>Desktops.</li>
                            <li>Televisions.</li>
                          </ul>
                        </li>
                        <li><strong>Animations</strong>: When completing designs, especially for website designs, it is important to keep a detailed record of animations. This includes noting every intended animation and micro-animation that will be integrated into the design. To facilitate this, it is recommended to keep comprehensive notes, preferably on the <strong>Figma</strong> board itself, outlining the specifics of each planned animation. Additionally, if desired, designers may use animation software or systems to animate the UI design. This animated representation can serve as a valuable resource for developers, providing clear guidance on how the animations are intended to function within the user interface. By documenting and communicating these animations effectively, the design-to-development transition is streamlined, ensuring a smooth and accurate implementation of the intended user interactions and visual elements.</li>
                        <li><strong>Submission</strong>: Upon the successful completion and approval of the entire process, encompassing responsive designs and animations, the designated task in <strong>Trello</strong> will be marked as complete.</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Roles</strong>: The design team at <strong>Vierra</strong> is organized into different roles based on a designer&apos;s specialty in various asset and media creation. While there is flexibility for interlocking between different roles, each team member will be assigned a specific role based on where they are anticipated to contribute the most work. This structured approach ensures that team members can leverage their strengths and expertise in areas where they can make the most significant impact.
                      <ul>
                        <li><strong>Graphic Designer/Illustrator</strong>: The Graphic Designer/Illustrator role at <strong>Vierra</strong> is responsible for designing graphics, icons, and banners for the company. This role primarily involves creating smaller assets that are integral components of the overall designs for the website, software, or materials used by the outreach team. The focus is on producing visually appealing and cohesive elements that contribute to the overall brand identity and user experience across various platforms.</li>
                        <li><strong>UI/UX Designer</strong>: The UI/UX designer role at <strong>Vierra</strong> is pivotal, encompassing the creation of visually compelling and user-friendly designs for the website, software applications, mobile interfaces, and various system layouts. Responsible for maintaining brand consistency, the designer collaborates with cross-functional teams to ensure alignment between design and implementation. Through user research, usability testing, and continuous iteration, the designer focuses on delivering a positive and seamless user experience. Additionally, the role involves staying updated on design trends, applying innovative techniques, and creatively solving design challenges to contribute to the success of <strong>Vierra</strong>&apos;s digital products.</li>
                        <li><strong>Video Editor</strong>: The Video Editor role at <strong>Vierra</strong> stands apart as it involves both long and short-form content editing, along with animation design using <strong>Adobe After Effects</strong>. This role is primarily dedicated to crafting outreach videos and editing clips for the outreach team, but it extends its influence to various purposes, including website enhancement, course content creation, and other facets of multimedia production. The Video Editor is pivotal in delivering polished and engaging visual content that aligns with <strong>Vierra</strong>&apos;s objectives across diverse platforms and contexts.</li>
                      </ul>
                    </li>
                  </ul>
                </Section>

                <Section id="development-team" index={10} title="Development Team">
                  <p>The development team at <strong>Vierra</strong> is tasked with the crucial goal of transforming the designs crafted by the design team into tangible, functional products. This collaborative team effort involves both frontend and backend developers working together to bring designs to life across the mobile, software, and website landscape. Their responsibilities include receiving design specifications from the design team and translating them into fully operational products, ensuring a seamless integration of visual elements and backend functionality. The development team plays a pivotal role in turning conceptual ideas into practical, user-friendly solutions for clients across various digital platforms.</p>
                  <ul>
                    <li><strong>Development Team Expectations</strong>: The development team at <strong>Vierra</strong> is required to adhere to a comprehensive development process for all projects, with a strong reliance on the coordination and oversight of the development manager/executive. This manager is responsible for managing the entire development process, ensuring that the code progresses to a production branch for deployment. The team strictly follows version control practices using <strong>GitHub</strong>, emphasizing the importance of proper collaboration through features like branches and conflict resolution. Each team member is expected to work exclusively on their assigned tasks, and sharing or saving code for external purposes is strictly prohibited to maintain the integrity and security of <strong>Vierra</strong>&apos;s proprietary codebase. This ensures a disciplined and secure approach to development, fostering efficient collaboration within the team.</li>
                    <li>
                      <strong>Development Process</strong>: The development process at <strong>Vierra</strong> adheres to the following steps:
                      <ul>
                        <li><strong>Tasks</strong>: <strong>Vierra</strong>&apos;s development team operates with a structured task management system using <strong>Trello</strong>. All tasks for the development team are assigned and tracked through <strong>Trello</strong>. Development team members have access to the <strong>Trello</strong> task board, where they can view and manage their assigned tasks. It is expected that each development team member maintains an active presence on the <strong>Trello</strong> task board and consistently works on one concurrent task at a time. This approach ensures efficient task allocation, effective collaboration, and the seamless progression of development projects within the team.</li>
                        <li><strong>Where To Develop</strong>: The development team at <strong>Vierra</strong> strictly adheres to organized version control practices using <strong>GitHub</strong>. All code is expected to be created and maintained within their respective repositories, ensuring proper segregation based on the type of development (<em>e.g., web development, AI</em>). To initiate a project, developers clone the main branch and create a new branch with a descriptive name indicating its purpose and the developer&apos;s name. For instance, when tasked with adding a system or page to the website or software, a developer creates a branch with a clear purpose. Changes are made exclusively on this branch, and developers refrain from making alterations to any other branch of code, maintaining a systematic and collaborative approach to development.</li>
                        <li><strong>Pushing Changes</strong>: In the development workflow at <strong>Vierra</strong>, it is imperative to follow a disciplined approach when pushing changes. Developers are instructed to commit changes exclusively to their created branches and are strictly prohibited from committing directly to the production or master branch. This practice ensures a controlled and organized development process, preventing unintentional errors or conflicts in the main codebase. By adhering to this rule, the team maintains a clear separation between ongoing development work and the stable production code, contributing to a more reliable and manageable version control system.</li>
                        <li><strong>Bug Review</strong>: Upon completing the development phase and pushing all changes to the respective branches, the development manager at <strong>Vierra</strong> plays a crucial role in the code review process. The manager carefully examines the code for optimization and conducts a thorough bug review. After ensuring that the code meets the required standards and there are no issues, the development manager proceeds to merge the changes from the developer&apos;s branch into the production branch. This meticulous process ensures that only thoroughly reviewed and optimized code is integrated into the main codebase, contributing to the reliability and stability of the production environment during updates.</li>
                        <li><strong>Submission</strong>: Upon the successful completion and approval of the entire process, encompassing bug review, the designated task in <strong>Trello</strong> will be marked as complete.</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Roles</strong>:
                      <ul>
                        <li>
                          <strong>Frontend Developer</strong>: The role of the frontend developer at <strong>Vierra</strong> is pivotal in overseeing the development of all frontend systems within the company. This encompasses responsibilities such as crafting the <strong>HTML</strong> and <strong>CSS</strong> components for the website, panels, mobile applications, and other systems falling under the domain of frontend development. The frontend developer plays a crucial role in ensuring a cohesive and visually appealing user interface across various platforms, contributing to the overall user experience and the success of Vierra&apos;s digital products.
                          <ul>
                            <li><strong>Technology Stack</strong>: HTML, CSS, JavaScript, TypeScript, and NextJS.</li>
                          </ul>
                        </li>
                        <li>
                          <strong>Backend Developer</strong>: The role of the backend developer at <strong>Vierra</strong> holds key responsibility for the development of all backend systems within the company. This encompasses tasks related to database storage, backend systems utilizing technologies such as <strong>PostgreSQL</strong> and <strong>Prisma</strong> columns, and ensuring the cybersecurity of <strong>Vierra</strong>&apos;s panels and other projects. The backend developer plays a critical role in building the foundational elements that power <strong>Vierra</strong>&apos;s digital infrastructure, focusing on data storage, system functionality, and cybersecurity measures to ensure the robustness and security of the company&apos;s technological ecosystem.
                          <ul>
                            <li><strong>Technology Stack</strong>: PostgreSQL, Prisma, NextJS, Ubuntu, and TypeScript.</li>
                          </ul>
                        </li>
                        <li><strong>Full Stack Developer</strong>: At <strong>Vierra</strong>, while we don&apos;t explicitly assign roles for full-stack developers, individuals have the opportunity to access both the frontend and backend teams by demonstrating proficiency across the required technology stacks. Despite having exposure to both areas, individuals are still required to choose a primary role, either frontend or backend. This approach allows our team members to specialize in their chosen domain while fostering a collaborative environment where skills and knowledge can be shared across the entire development spectrum.</li>
                      </ul>
                    </li>
                  </ul>
                </Section>

                <Section id="outreach-team" index={11} title="Outreach Team">
                  <p>The outreach team at <strong>Vierra</strong> is entrusted with the mission of amplifying <strong>Vierra</strong>&apos;s message to the public. This multifaceted role encompasses both sales, with a focus on securing high-ticket commissions, and marketing for broader social media growth. The outreach team takes ownership of all outreach initiatives, ensuring that the company&apos;s projects and resources reach a wide audience, ultimately connecting with individuals who can benefit from our services. Their efforts are instrumental in expanding <strong>Vierra</strong>&apos;s visibility and impact across diverse channels and platforms.</p>
                  <ul>
                    <li><strong>Outreach Team Expectations</strong>: Members of the outreach team at <strong>Vierra</strong> are held to a high standard of maintaining a positive and professional public image. Each team member is expected to uphold a near-perfect track record on the internet, free from any controversial or negative content. As the frontline representatives of <strong>Vierra</strong>, the outreach team plays a crucial role in shaping the company&apos;s image. Their responsibilities extend beyond client communication and updating management to actively curate and progress updates through posts on various social media accounts and email campaigns. This commitment to professionalism and compliance ensures that the outreach team serves as exemplary ambassadors for <strong>Vierra</strong>, contributing to a positive and reputable public perception.</li>
                    <li>
                      <strong>Helpful Steps</strong>: The following list contains helpful and useful tips for any sort of completion of outreach:
                      <ul>
                        <li><strong>Asking For Assets</strong>: In the dynamic collaboration between the outreach and design teams at <strong>Vierra</strong>, members of the outreach team are encouraged to respectfully request assets or banners for their outreach processes while allowing the design team adequate time to meet realistic deadlines. Planning and communicating requirements, including formats, sizes, and reference materials, ensures that the design team can craft high-quality materials aligned with the outreach goals. Prioritizing requests based on urgency, establishing realistic timelines, and maintaining open communication contribute to a streamlined and effective collaboration.</li>
                        <li><strong>Accessing And Posting</strong>: In <strong>Vierra</strong>, permissions for various social media postings are assigned based on both the specific tasks and the individual&apos;s established reputation and trust within the company. Access to post content is granted on a task-by-task and person-by-person basis, emphasizing the importance of building a solid reputation. Within the marketing department, individuals typically involved in content creation are responsible for crafting and optimizing posts. However, the actual posting may be handled by a content creation manager, emphasizing the collaborative nature of the process and the need for trust and reliability in managing outreach tasks across different social media platforms.</li>
                        <li><strong>Training</strong>: In both the sales and marketing departments at <strong>Vierra</strong>, extensive training is provided to sales representatives, equipping them with comprehensive insights into the company&apos;s approach to outreach and client communications. Training programs encompass a wealth of resources, guides, and scripts tailored to optimize the outreach process and streamline communication with clients. This structured training not only ensures a consistent and effective approach across teams but also empowers sales representatives with the knowledge and tools needed to navigate and excel in client interactions efficiently.</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Roles</strong>:
                      <ul>
                        <li><strong>Sales Representative</strong>: Sales representatives at <strong>Vierra</strong> play a crucial role in client outreach by finding leads and creating effective funnels for client generation. Some select sales representatives may take on the responsibility of closing clients for <strong>Vierra</strong>&apos;s services, and successful closures result in a 15% commission on the total value of the closed client, potentially amounting to $200 or more per client. Sales representatives undergo thorough training to efficiently handle client outreach and marketing, ensuring that the potential for closing clients is maximized and that opportunities are not lost. This system incentivizes sales representatives to contribute actively to the growth and success of <strong>Vierra</strong> by effectively bringing in and closing clients for the company&apos;s services.</li>
                        <li><strong>Marketer</strong>: Marketers at <strong>Vierra</strong> hold a pivotal role in mass outreach, focusing on handling social media accounts and video platforms to enhance the company&apos;s visibility. They leverage a series of trained techniques aimed at increasing attention and notability for the <strong>Vierra</strong> platform. With a strategic approach to social media and video content, marketers contribute significantly to raising awareness, engaging audiences, and promoting the company&apos;s brand. Their efforts are instrumental in building a strong online presence and attracting attention to <strong>Vierra</strong>&apos;s offerings in a competitive landscape.</li>
                      </ul>
                    </li>
                  </ul>
                </Section>

                <Section id="agile-workflow" index={12} title="Agile Workflow Systems & Sprints">
                  <p><strong>Vierra</strong> employs an Agile workflow and utilizes the sprint system for efficient task management. The task delegation process is facilitated through the <strong>Trello</strong> platform, where specific sprints are created. These sprints operate on a biweekly calendar, optimizing productivity and fostering a shared company goal for the week. At the beginning of each biweekly cycle, team members are assigned a set number of tasks to complete, and by the end of the two weeks, there is an expectation for the successful completion of these tasks. This structured approach enhances collaboration, accountability, and overall efficiency within the team as they work collectively toward achieving company objectives.</p>
                  <p>At <strong>Vierra</strong>, the Agile Workflow system is a cornerstone for optimizing work efficiency, fostering team collaboration, and enabling systematic delegation for review and analysis. This methodology is applied at both the team-by-team level and within each team, ensuring a cohesive and efficient approach to project management. The general process at the team-by-team level involves iterative cycles, emphasizing:</p>
                  <ol>
                    <li>In <strong>Vierra</strong>&apos;s Agile Workflow, the process begins with tasks being initially assigned to the design team. This team is responsible for transforming conceptual features and ideas originating from the executive department into tangible and visually appealing User Interfaces (<em>UIs</em>). By entrusting the design team with this crucial initial step, <strong>Vierra</strong> ensures that the foundation for new features and innovations is crafted with a focus on aesthetics, usability, and alignment with the company&apos;s overall design principles. This collaborative approach sets the stage for the subsequent stages of development within the Agile framework.</li>
                    <li>Following the completion of tasks by the design team, the next phase involves handing off the designs to the development team. This transition marks the initiation of the implementation process, where the development team takes the visually crafted designs and transforms them into fully functional systems. By seamlessly passing the baton from design to development, <strong>Vierra</strong> ensures a cohesive and efficient workflow within the Agile framework, promoting collaboration and alignment between design aesthetics and functional implementation. This handoff is a pivotal step in bringing conceptual ideas to life and contributing to the overall success of <strong>Vierra</strong>&apos;s projects.</li>
                    <li>After the developmental process is complete, a comprehensive review of the newly implemented content is conducted collaboratively by both the design and development teams at <strong>Vierra</strong>. This joint assessment ensures that the integrated features align with the initial design concepts and meet functional requirements. If the review indicates readiness, the content is then moved to the production environment. At this point, the sales and marketing teams take over, leveraging the finalized content for outreach and promotional activities. This streamlined process within <strong>Vierra</strong>&apos;s Agile Workflow emphasizes collaboration and a seamless transition from development to production, ultimately contributing to the efficient delivery of high-quality content to the intended audience.</li>
                  </ol>
                  <p>At the team level, the specific details of the process are elaborated in the team divisions section of the handbook, emphasizing adherence to an Agile Workflow environment. This approach is designed to facilitate team collaboration, ensuring that issues, bugs, or designs that do not meet the required standards are identified and addressed before progressing into production or developmental phases. By implementing Agile principles, <strong>Vierra</strong> establishes a structured framework that enhances communication, transparency, and the ability to catch and rectify potential issues early in the development process, promoting the delivery of high-quality and reliable outcomes.</p>
                </Section>

                <Section id="striking-system" index={13} title="The Striking System and Human Resources">
                  <p>At <strong>Vierra</strong>, a striking system is implemented for addressing minor offenses, providing team members with opportunities for redemption in cases of behavioral misconduct. This system is applied on a case-by-case basis, allowing for a fair and considered approach to handling less severe issues. However, it is crucial to note that for serious offenses, <strong>Vierra</strong> maintains a zero-tolerance policy, and such incidents may result in the automatic termination of a <strong>staff-level</strong> member. This tiered approach to addressing misconduct reflects <strong>Vierra</strong>&apos;s commitment to maintaining a positive and professional work environment while affording individuals the chance for improvement in less severe situations.</p>
                  <p>In <strong>Vierra</strong>&apos;s striking system, individuals are given three chances for minor offenses before more serious consequences are enforced. Here&apos;s a breakdown of how such a system typically works:</p>
                  <ol>
                    <li><strong>First Strike</strong>: When a team member commits a minor offense, they receive a first strike. This serves as a warning and an opportunity for the individual to recognize and rectify their behavior. It&apos;s a chance for both the employee and the company to address the issue and promote awareness.</li>
                    <li><strong>Second Strike</strong>: If a team member repeats the same or a similar minor offense after the first strike, they receive a second strike. This indicates a pattern of behavior that needs attention and correction. The individual may be provided with additional guidance or counseling to address the underlying issues.</li>
                    <li><strong>Third Strike</strong>: Upon receiving a third strike for a minor offense, the consequences become more serious. If this event occurs, the <strong>staff-level</strong> team member will be terminated.</li>
                  </ol>
                  <p>It&apos;s important to note that the striking system is typically designed to handle minor and correctable issues, giving individuals an opportunity to learn from their mistakes and improve their behavior. However, for more serious offenses or a repeated pattern of misconduct, <strong>Vierra</strong> may implement different disciplinary actions, including termination, even before reaching the three-strike threshold. The goal is to maintain a balance between providing chances for improvement and ensuring a healthy and productive work environment. <strong>Staff-level</strong> member strikes do not expire or disappear after a certain amount of time.</p>
                  <p>If a <strong>staff-level</strong> member of <strong>Vierra</strong> has been terminated, the policies and procedures outlined in the terminated section of this staff handbook will be applied. This section typically details the steps and guidelines that follow the termination of a team member. Ensuring clear communication and adherence to established procedures during the termination process helps manage the transition smoothly and by company policies.</p>
                </Section>

                <Section id="harassment-policy" index={14} title="Harassment Policy">
                  <p><strong>Vierra</strong> is committed to providing a safe, respectful, and inclusive workplace for all staff members. This policy outlines the company&apos;s stance against <strong>sexual harassment</strong> and provides a framework for preventing, reporting, and addressing such behavior. Any forms of sexual harassment will result in termination.</p>
                  <p>Ways to avoid sexual harassment within the company and in your personal life include:</p>
                  <ul>
                    <li>Using common sense.</li>
                    <li>Follow the rules of the social media sites you use.</li>
                    <li>Speak respectfully about <strong>Vierra</strong> and our current and potential staff, clients, partners, and competitors.</li>
                    <li>Write knowledgeably, accurately, and with appropriate professionalism. Despite disclaimers, your web interactions can result in members of the public forming biases about the company and its staff, partners, and business interests.</li>
                    <li>Refrain from publishing anything that could reflect negatively on <strong>Vierra’s</strong> reputation or otherwise embarrass the organization, including posts about sexual humor, and other inappropriate conduct. Do not use personal insults, obscenity, or engage in any conduct that would not otherwise be acceptable in <strong>Vierra’s</strong> workplace.</li>
                    <li>Honor the privacy rights of our current staff, members, and partners by seeking their permission before writing about or displaying internal company information that could be considered a breach of their privacy and confidentiality.</li>
                  </ul>
                  <p>All staff are responsible for helping keep our work environment free of harassment. If you become aware of an incident of harassment, whether by witnessing the incident or being told of it, you must report it to <strong>management</strong>. When <strong>Vierra</strong> becomes aware of harassment, it is obligated by law to take prompt and appropriate action, regardless of if the victim wants to do so.</p>
                  <p>Any staff member of <strong>Vierra</strong>, who believes that he or she has suffered harassment in violation of the <strong>Harassment Policy</strong>, should take the following actions:</p>
                  <ol>
                    <li>If you are able to do so without conflict or danger, tell the harasser as clearly as possible that the behavior is unwelcome.</li>
                    <li>If the behavior continues, advise your direct supervisor of your complaint. Clearly identify the behavior surrounding the complaint.</li>
                  </ol>
                </Section>

                <Section id="discrimination-dei" index={15} title="Discrimination & DEI Policy">
                  <p>This policy is for all staff members, so that all are aware of their rights and responsibilities regarding <strong>discrimination</strong> and <strong>DEI</strong> (<em>diversity, equity, and inclusion</em>), providing clear procedures for reporting, addressing complaints, and prioritizes the company&apos;s commitment to maintaining a diverse and inclusive work environment. <strong>Vierra</strong> is committed to creating a diverse and inclusive workplace where everyone is treated with respect and dignity. <strong>Vierra</strong> holds the standard against discrimination and provides guidelines for preventing, reporting, and addressing such behavior.</p>
                  <p><strong>Vierra</strong> will provide regular training to all team members on preventing, identifying, and reporting discrimination. Managers and supervisors will receive additional training on handling complaints and conducting investigations. Discrimination refers to any unfair treatment, harassment, or bias against an individual or group based on their race, color, religion, sex, nationality, age, disability, genetic information, marital status, sexual orientation, gender identity or expression, or any other characteristic protected by law. Any violation of these rights will result in disciplinary action or termination.</p>
                  <p>Team members who believe they have been subjected to discrimination should report the incident to a supervisor or management officer, or the <strong>Human Resources Department</strong> <strong>(HR)</strong>. Reports can be made in person, by phone, or in writing. All complaints will be treated seriously and investigated promptly, thoroughly, and impartially. Confidentiality will be an option to those who wish so. <strong>Vierra</strong> will maintain confidentiality to the extent possible, with the need to conduct a thorough investigation and comply with legal requirements.</p>
                  <p><strong>Hostile Environments:</strong> <strong>Vierra</strong> strictly prohibits retaliation against any individual who reports hostile work environment conduct or participates in an investigation. Any act of retaliation should be reported immediately and will be subject to disciplinary action and/or termination.</p>
                </Section>

                <Section id="termination-policies" index={16} title="Termination Policies">
                  <p><strong>Vierra</strong> maintains an exceptionally low tolerance for violations of workplace policies and company values. While we pride ourselves on being a lenient company, we take any breaches of our policies seriously. Termination of employment and service with the company is a possibility at any point in time, and our approach to violations is assessed on a case-by-case basis.</p>
                  <p>For minor offenses, we often employ a warning system and adhere to a <strong>strike system</strong>. This allows for corrective actions to be taken for smaller infractions, reinforcing our commitment to maintaining a respectful and compliant work environment. <strong>Vierra</strong>&apos;s stringent stance on upholding policies and values underscores our dedication to fostering a workplace that prioritizes integrity, professionalism, and adherence to our shared principles.</p>
                  <p>In cases where a violation is deemed severe or the <strong>strike system</strong> indicates that continued employment is not viable, <strong>Vierra</strong> reserves the right to terminate your employment. In such instances, access to all company resources and support will be restricted. This includes any further assistance or support from team members and the withholding of employment recommendations for the future.</p>
                  <p>Adherence to the <strong>Non-Disclosure Agreement</strong> (<em>NDA</em>) is a continuous obligation, extending even beyond termination, as explicitly stated within the terms of the <strong>NDA</strong>. <strong>Vierra</strong> emphasizes the importance of maintaining confidentiality and protecting sensitive information, and this commitment is expected to persist regardless of the employment status of individuals associated with the company.</p>
                  <p>Former team members must uphold the terms of the <strong>NDA</strong>, ensuring that any proprietary or confidential information acquired during their tenure at <strong>Vierra</strong> remains safeguarded. This commitment to confidentiality is integral to maintaining the trust and integrity of <strong>Vierra</strong>&apos;s business operations and relationships.</p>
                </Section>

                <Section id="additional-resources" index={17} title="Additional Resources">
                  <p>At <strong>Vierra</strong>, our commitment is to equip you with every resource necessary for success within our company. The following list outlines resources that may prove beneficial during your time at <strong>Vierra</strong>:</p>
                  <p><strong>General</strong>:</p>
                  <ul>
                    <li>Staffing Handbook: <a href="https://docs.google.com/document/d/1zdH-0dTJYSz8fBH7lJ1zT3VW-h6qRD-vdcyTxIgV2WI/edit?usp=sharing" target="_blank" rel="noopener noreferrer">Vierra Staff Handbook</a></li>
                    <li>Staff Discord: Get an invite from a member of the management team.</li>
                  </ul>
                  <p><strong>Divisional</strong>:</p>
                  <ul>
                    <li>Figma: <a href="https://www.figma.com" target="_blank" rel="noopener noreferrer">https://www.figma.com</a></li>
                    <li>Github: <a href="https://github.com/Vierra-Digital" target="_blank" rel="noopener noreferrer">https://github.com/Vierra-Digital</a></li>
                  </ul>
                  <p><strong>Clients</strong>:</p>
                  <ul>
                    <li>Vierra Website: <a href="https://vierradev.com" target="_blank" rel="noopener noreferrer">https://vierradev.com</a></li>
                    <li>Client Retainer Agreement: <a href="https://docs.google.com/document/d/1LQloUM6qE1BXzIZp4WPXsWBp4ZHflWZarP3ok4dVI-8/edit" target="_blank" rel="noopener noreferrer">Client Retainer</a></li>
                  </ul>
                  <p><strong>Emails</strong>:</p>
                  <ul>
                    <li>Alex: <a href="mailto:alex@vierradev.com">alex@vierradev.com</a></li>
                  </ul>
                </Section>

                <Section id="acknowledgement" index={18} title="Acknowledgement">
                  <p>I, <span className="mx-1 inline-block w-32 border-b border-[#1A1033]/30"></span> hereby acknowledge that I have received, read, comprehended, and consent to abide by the regulations delineated in the <em>Vierra Staffing Handbook</em> for <em>Vierra Digital LLC</em> and its subsidiary projects, dated <span className="mx-1 inline-block w-24 border-b border-[#1A1033]/30"></span>. I affirm my understanding of all the information presented therein.</p>
                  <p>I confirm that I have been afforded the opportunity to pose any queries I may have, and I have received satisfactory responses to all of my questions.</p>
                  <p>I acknowledge that the company retains the utmost discretion permissible by law to interpret, enforce, alter, amend, or revoke the rules, regulations, procedures, and benefits outlined in the <em>Vierra Staffing Handbook</em> at any given time, with or without prior notification. No statement or representation made by a supervisor, manager, or any other employee, whether verbal or written, can augment or amend the provisions outlined in this handbook. Changes can only be implemented if approved in writing by the management department of the company.</p>
                  <p>I comprehend that any delay or failure by the company to enforce any rule, regulation, or procedure delineated in the handbook does not waive the company&apos;s rights or affect its ability to enforce such provisions in the future. I acknowledge that the <em>Vierra Staffing Handbook</em> does not establish or imply an employment contract.</p>
                  <p>I acknowledge that my employment status is &quot;at-will&quot;, signifying that <em>Vierra Digital LLC and its subsidiaries</em> reserve the right to terminate my employment for any reason, or for no reason, at any given time.</p>
                  <p>I have reviewed the policy on discrimination/harassment and recognize that I am obligated to promptly report to <em>Vierra Digital LLC and its subsidiaries</em> any instances of discrimination/harassment that I observe or in which I am involved. I also affirm my commitment to uphold the company&apos;s values and provisions regarding a respectful and inclusive work environment.</p>
                  <p>This handbook is not designed to dissuade or preclude employees from participating in legally protected activities as outlined in the <strong>National Labor Relations Act (NLRA)</strong>. This handbook supersedes any prior handbooks or policy statements, whether communicated in writing or orally, issued by <em>Vierra Digital LLC and its subsidiaries</em>. Should I have any inquiries regarding the content or interpretation of this handbook, I will reach out to a managing officer for clarification.</p>
                  <p>I hereby affirm my commitment to adhere to and uphold all the rules, policies, and procedures delineated in the <em>Vierra Staffing Handbook</em>.</p>
                  <p>Employee Signed: <span className="ml-2 inline-block w-48 border-b border-[#1A1033]/30"></span></p>
                  <p>Employee Printed: <span className="ml-2 inline-block w-48 border-b border-[#1A1033]/30"></span></p>
                  <p>Date: <span className="ml-2 inline-block w-32 border-b border-[#1A1033]/30"></span></p>
                  <p className="text-xs text-[#6B6480]">THIS FORM MUST BE COMPLETED AND SIGNED AT THE TIME OF THE ISSUANCE/ACCESSIBILITY OF THE EMPLOYEE HANDBOOK. A COPY OF THIS ACKNOWLEDGMENT IS TO BE PLACED IN EACH EMPLOYEE&apos;S PERSONNEL FILE.</p>
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

export default WorkPolicyPage;
