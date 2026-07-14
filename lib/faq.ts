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

// Last substantive review of these answers — surfaced as the FAQPage dateModified
// freshness signal. Bump when the Q&A set is meaningfully updated.
export const FAQ_LAST_UPDATED = "2026-07-13";

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
    question: 'What makes Vierra "risk-averse"?',
    answer:
      'Our model is built around case studies and measurable ROI. We focus your budget only on the activities proven to generate leads that pay back the investment, so you eliminate wasted, speculative marketing spend and maximize return on ad spend. You only pay for the leads who convert to high-paying clients.',
  },
  {
    question: 'What kinds of businesses does Vierra work with?',
    answer:
      'We work with small and large business owners on high-ticket engagements across many industries from local service businesses like dental practices to product and service companies who want a reliable, scalable source of qualified leads.',
  },
  {
    question: 'What services does Vierra offer?',
    answer:
      'Warm outreach through our connections, automated client and partner-acquisition systems, results-based targeted ad campaigns built to maximize return on ad spend, and Google Analytics-driven optimization that turns your data into more leads and conversions.',
  },
  {
    question: 'How quickly can we get started?',
    answer:
      'Onboarding is fast and simple. We start immediately and work to launch your lead generation swiftly, reducing complexity by cutting the corporate formalities that slow most agencies down.',
  },
  {
    question: 'Where is Vierra located?',
    answer:
      'Vierra Digital is a B2B lead generation agency headquartered in Medford, MA, with an office in New York, NY. We serve clients across the United States, working remotely with businesses wherever they operate.',
  },
  {
    question: 'How do I get a free audit or quote?',
    answer:
      'Book a free audit call through our website. We review your current systems and outreach, improve your value ladder and outbound efforts, then show you exactly how Vierra can drive more qualified leads and fill your sales calendar.',
  },
  {
    question: 'How does pay-after lead generation work?',
    answer:
      'Pay-after lead generation means you pay against results, like booked meetings and qualified pipeline, instead of a fixed retainer paid upfront. Vierra builds and runs the outreach, ads, and follow-up systems first, then ties its fee to the leads and meetings those systems actually produce, so your budget is not spent before you see a return.',
  },
  {
    question: 'How much does Vierra cost?',
    answer:
      'Vierra prices around the results you need rather than a flat monthly retainer, so cost depends on your industry, deal size, and lead volume goals. Book a free audit call and we will walk you through a plan built around your numbers before you commit to anything.',
  },
  {
    question: 'How is risk-averse lead generation different from a retainer agency?',
    answer:
      'A retainer agency gets paid the same fee whether your pipeline grows or not, so the financial risk sits entirely with you. Vierra ties its fee to booked meetings and qualified leads instead, which means our incentives are tied to your results, not to renewing a contract.',
  },
  {
    question: 'Who is Vierra for?',
    answer:
      'Vierra works best for B2B businesses and high-ticket service providers who want a predictable pipeline of qualified leads without gambling a large budget on unproven ad spend. That includes local service businesses, dental and healthcare practices, and product or service companies scaling past word-of-mouth referrals.',
  },
  {
    question: 'How fast do results come?',
    answer:
      'Onboarding starts immediately, and most clients see their first qualified leads and booked meetings within the first few weeks of launch. Timelines vary by industry and how quickly outreach lists and ad accounts can be set up, but Vierra is built to skip the slow, multi-month ramp-up common at traditional agencies.',
  },
  {
    question: 'What happens if a campaign underperforms?',
    answer:
      'Because Vierra ties fees to booked meetings and qualified pipeline rather than a flat retainer, an underperforming channel costs you far less than it would under a pay-upfront model. We reallocate spend toward what is proven to convert and stop funding channels that are not producing traceable results.',
  },
  {
    question: 'Does Vierra require a long-term contract?',
    answer:
      'Vierra is built to reduce corporate formalities, not lock clients into long commitments. Because fees are tied to results rather than a retainer you are paying regardless of performance, there is far less reason to feel stuck in a contract that is not working for you.',
  },
  {
    question: 'What is a qualified lead, exactly?',
    answer:
      'A qualified lead is a prospect who matches your ideal customer profile and has shown real buying intent, not just a name captured from a form. Vierra defines what counts as qualified with each client before a campaign starts, so there is no ambiguity about what you are paying for.',
  },
  {
    question: 'Does Vierra work with businesses outside Medford or New York?',
    answer:
      'Yes. Vierra is headquartered in Medford, MA with an office in New York, NY, but the majority of outreach, ad management, and analytics work happens remotely. Vierra serves clients across the United States regardless of where their team is based.',
  },
  {
    question: 'How is Vierra different from buying leads from a list broker?',
    answer:
      'A list broker sells you raw contact data with no context and no follow-up. Vierra builds the full system around those contacts: warm outreach, targeted ad campaigns, and analytics-driven follow-up, then ties its fee to the meetings and pipeline that system produces, not the size of the list.',
  },
];
