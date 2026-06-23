/**
 * Frequently asked questions — single source of truth.
 *
 * Consumed by the visible /faq page, its FAQPage JSON-LD schema, and the
 * Markdown mirror (/faq.md + llms.txt). Answers are intentionally concise
 * (~40–60 words) and self-contained so they read well as featured snippets
 * and AI-answer citations. Keep them grounded in real, on-site claims.
 */
export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What does Vierra do?',
    answer:
      'Vierra is a B2B digital marketing and lead generation agency. We build case-study-proven, results-based systems that fill your sales calendar with qualified leads, so you can scale your business without gambling on risky, speculative ad spend.',
  },
  {
    question: "How does Vierra's lead generation work?",
    answer:
      'We combine warm outreach through our network, results-based targeted ad campaigns, and automated client-acquisition systems, then use analytics to continuously improve conversions. The result is a predictable pipeline of qualified leads rather than one-off campaigns that stop working the moment you stop paying.',
  },
  {
    question: 'What makes Vierra "risk-averse" and "guaranteed"?',
    answer:
      'Our model is built around case studies and measurable ROI. We focus your budget only on the activities proven to generate leads that pay back the investment, so you eliminate wasted, speculative marketing spend and maximize return on ad spend.',
  },
  {
    question: 'What kinds of businesses does Vierra work with?',
    answer:
      'We work with small and large business owners on high-ticket engagements across many industries — from local service businesses like dental practices to product and service companies — who want a reliable, scalable source of qualified leads.',
  },
  {
    question: 'What services does Vierra offer?',
    answer:
      'Warm outreach through our connections, automated client- and partner-acquisition systems, results-based targeted ad campaigns built to maximize return on ad spend, and Google Analytics-driven optimization that turns your data into more leads and conversions.',
  },
  {
    question: 'How quickly can we get started?',
    answer:
      'Onboarding is fast and simple. We start immediately and work to launch your lead generation swiftly, reducing complexity by cutting the corporate formalities that slow most agencies down.',
  },
  {
    question: 'Where is Vierra located?',
    answer:
      'Vierra Digital is a digital marketing agency based in Cambridge, Massachusetts. We serve clients across the United States, working remotely with businesses wherever they operate.',
  },
  {
    question: 'How do I get a free audit or quote?',
    answer:
      'Book a free audit call through our website. We review your current systems and outreach, then show you exactly how Vierra can drive more qualified leads and fill your sales calendar.',
  },
];
