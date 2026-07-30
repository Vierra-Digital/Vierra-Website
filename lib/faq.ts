/**
 * Frequently asked questions — single source of truth.
 *
 * Consumed by the visible /faq page, its FAQPage JSON-LD schema, and the
 * Markdown mirror (/faq.md + llms.txt). Answers are self-contained and
 * substantive (~100–140 words) so they read as strong, quotable AI-answer/LLM
 * citations. Kept grounded in real, on-site claims — no invented metrics.
 *
 * NOTE ON LENGTH: this favors AI-answer-engine citation (which rewards complete,
 * self-contained passages) over Google featured snippets (which prefer ~40–58
 * words). FAQ rich results were retired by Google in May 2026, so the snippet
 * tradeoff is minor; the schema now serves AI citation + on-page UX.
 *
 * TONE: written to sound like a person explaining the business, not a brochure.
 * Kept free of em-dashes on purpose.
 */
export interface FaqItem {
  question: string;
  answer: string;
}

// Last substantive review of these answers — surfaced as the FAQPage dateModified
// freshness signal. Bump when the Q&A set is meaningfully updated.
export const FAQ_LAST_UPDATED = "2026-07-15";

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What does Vierra do?',
    answer:
      "Vierra Digital is a B2B lead generation and digital marketing agency. In plain terms, we fill your sales calendar with qualified leads: prospects who match your ideal customer profile and are actually ready to buy. Most agencies ask you to bet a big budget on ads and hope something sticks. We do it the other way around. We build the outreach, advertising, and follow-up systems first, then tie our fee to the meetings and pipeline they produce. You get warm outreach through our network, targeted advertising, automated client-acquisition systems, and continuous, analytics-driven optimization all working together. The idea is simple: growth should feel like a reliable system, not a string of one-off campaigns that stop working the moment you stop paying.",
  },
  {
    question: "How does Vierra's lead generation work?",
    answer:
      "We bring four things together into one system. First, warm outreach through our existing network and connections. Second, results-based targeted ad campaigns built to maximize your return on ad spend. Third, automated client- and partner-acquisition systems that handle follow-up at scale. And fourth, Google Analytics-driven optimization that turns performance data into steadily better conversion rates. Instead of launching one campaign and hoping it works, we keep measuring which channels and messages actually produce qualified leads, then move budget toward what's proven. What you end up with is a predictable pipeline of prospects who fit your ideal customer profile and have shown real buying intent, with booked meetings landing on your calendar week after week instead of a burst of activity that fizzles out the moment spending stops.",
  },
  {
    question: 'What makes Vierra "risk-averse"?',
    answer:
      "Our whole model is built around measurable ROI and case-study-proven playbooks, not experiments run on your dime. We point your budget only at activities we can show will generate leads that pay back the investment, so wasted, speculative marketing spend goes away and your return on ad spend stays high. The biggest piece is this: our fee is tied to results, meaning booked meetings and qualified pipeline, instead of a fixed retainer you owe whether or not anything works. That moves the financial risk that normally sits entirely on you over to us. We only win when you win. You are never funding our learning curve or paying for channels before they have proven they can turn into high-paying clients.",
  },
  {
    question: 'What kinds of businesses does Vierra work with?',
    answer:
      "We work with B2B businesses and high-ticket service providers who want a reliable, scalable source of qualified leads without gambling a big budget on unproven advertising. That covers a lot of ground, from local service businesses like dental and healthcare practices to product and service companies that have outgrown word-of-mouth referrals and need a repeatable way to fill their pipeline. The common thread is deal size and intent. Our model fits best when each new client is worth enough that a steady flow of qualified, sales-ready leads genuinely moves the business. If you are scaling past referrals and you want growth to run like a system instead of a guessing game, you are exactly the kind of company we are built for.",
  },
  {
    question: 'What services does Vierra offer?',
    answer:
      "Vierra offers one integrated lead-generation system rather than a menu of separate tactics. That includes warm outreach through our connections and network, automated client- and partner-acquisition systems that manage follow-up at scale, results-based targeted ad campaigns engineered to maximize return on ad spend, and Google Analytics-driven optimization that turns your performance data into more leads and higher conversion rates over time. Each piece feeds the next. Outreach and ads bring in prospects, the automation nurtures and books them, and the analytics layer keeps tightening your targeting and messaging. Because everything is measured against booked meetings and qualified pipeline, the work stays tuned to the outcomes that actually affect your revenue, not vanity metrics like impressions or clicks that never reach your sales calendar.",
  },
  {
    question: 'How quickly can we get started?',
    answer:
      "Onboarding is deliberately fast and simple. We start right away and aim to launch your lead generation within days, not the multi-month ramp-up you get at most traditional agencies. A big reason we can move that quickly is that we cut the corporate formalities and drawn-out approval cycles that slow most engagements down. After a short kickoff to nail down your ideal customer profile, offer, and targeting, we set up the outreach lists, ad accounts, and follow-up automation and start driving activity. Exact timelines depend on your industry and how fast accounts and assets can be provisioned, but the goal never changes: get real, qualified leads flowing quickly, so you see momentum in weeks instead of quarters.",
  },
  {
    question: 'Where is Vierra located?',
    answer:
      "Vierra Digital is a B2B lead generation and digital marketing agency headquartered at 3 Ashland Street in Medford, Massachusetts, with a second office in New York, New York. We are rooted in the Boston and NYC areas, but most of our work, including outreach, ad management, follow-up automation, and analytics, happens remotely. That means we serve clients across the United States no matter where their team sits. Being lean and remote-friendly is part of how we move fast and keep overhead low, which is exactly what supports our results-based pricing.",
  },
  {
    question: 'How do I get a free audit or quote?',
    answer:
      "Book a free audit call through our website. It is the fastest way to find out whether we are a fit. On the call we review your current systems, outreach, and advertising, pinpoint where qualified leads are leaking out of your funnel, and look at ways to strengthen your value ladder and outbound efforts. From there we show you exactly how Vierra would drive more qualified leads and fill your sales calendar, and we outline a plan built around your specific numbers: your industry, deal size, and lead-volume goals. There is no obligation. The whole point of the audit is to give you a clear, concrete picture of the opportunity before you commit to anything.",
  },
  {
    question: 'How does pay-after lead generation work?',
    answer:
      "Pay-after lead generation means your fee is tied to results, like booked meetings and qualified pipeline, rather than a fixed retainer you hand over upfront before anything has been produced. Vierra builds and runs the outreach, ad campaigns, and follow-up systems first, at our own risk, and then ties compensation to the leads and meetings those systems actually generate. In practice, your budget is not spent before you see a return, and you are not underwriting months of setup and experimentation with no guarantee of results. It lines our incentives up directly with yours: we are motivated to produce qualified, sales-ready leads because that is what we get paid for, not to keep a retainer quietly renewing regardless of how it performs.",
  },
  {
    question: 'How much does Vierra cost?',
    answer:
      "Vierra prices around the results you need rather than a flat monthly retainer, so there is no single sticker price. Cost depends on your industry, average deal size, and lead-volume goals. Because our fee is tied to booked meetings and qualified pipeline, pricing is set up so what you pay tracks the value you actually receive, not a fixed amount charged whether or not the campaigns perform. The best way to get real numbers is to book a free audit call. We will review your situation and walk you through a plan and pricing built around your specific goals before you commit to anything, so you can weigh the expected return against the cost with full visibility, right up front.",
  },
  {
    question: 'How is risk-averse lead generation different from a retainer agency?',
    answer:
      "A traditional retainer agency gets paid the same fee every month whether your pipeline grows or stalls, which means the financial risk sits entirely with you. You fund the work, the experiments, and the learning curve no matter the outcome. Vierra flips that around. We tie our fee to booked meetings and qualified leads, so we only get paid meaningfully when the system actually delivers. The difference really shows up in incentives: a retainer agency's main goal is renewing the contract, while ours is generating the pipeline we are paid for. It also changes how a weak spot gets handled. Instead of you paying full price for a channel that is not working, the cost of that channel falls mostly on us, and we are motivated to fix or replace it fast.",
  },
  {
    question: 'Who is Vierra for?',
    answer:
      "Vierra is built for B2B businesses and high-ticket service providers who want a predictable pipeline of qualified leads without gambling a big budget on unproven ad spend. That includes local service businesses, dental and healthcare practices, and product or service companies scaling past word-of-mouth referrals into a repeatable growth system. The model fits best when each new client is valuable enough that a steady flow of sales-ready, ICP-matched leads makes a real difference to revenue, and when you would rather pay against results than shoulder the full risk of an upfront retainer. If you are tired of marketing that feels like a gamble and you want growth you can actually forecast, that is who we serve.",
  },
  {
    question: 'How fast do results come?',
    answer:
      "Onboarding starts immediately, and most clients see their first qualified leads and booked meetings within the first few weeks of launch. We are set up to skip the slow, multi-month ramp-up common at traditional agencies by cutting unnecessary corporate formalities and getting outreach and campaigns live quickly. Exact timelines vary with your industry and how fast outreach lists, ad accounts, and follow-up automation can be set up, since some markets simply move faster than others. Either way, the intent is always early, traceable momentum instead of a long wait for one big reveal. And because our fee is tied to results, we are just as motivated as you are to reach that first qualified pipeline quickly.",
  },
  {
    question: 'What happens if a campaign underperforms?',
    answer:
      "Because Vierra ties its fee to booked meetings and qualified pipeline rather than a flat retainer, an underperforming channel costs you far less than it would under a pay-upfront model. You are not locked into funding something that is not working. When a channel stops producing traceable results, we do not keep spending on it out of habit. We shift budget toward the activities and messages proven to convert and stop funding what is not. This is where the analytics layer earns its keep: we are constantly measuring which sources generate qualified leads, so decisions to move spend are based on data instead of guesswork. The result is a system that self-corrects toward what works, with the downside of any single weak channel absorbed mostly on our side rather than yours.",
  },
  {
    question: 'Does Vierra require a long-term contract?',
    answer:
      "Vierra is deliberately built to reduce corporate formalities, not to lock clients into long commitments. Because our fees are tied to results, meaning booked meetings and qualified pipeline, rather than a retainer you pay regardless of performance, there is far less reason to bind you to a lengthy contract in the first place. Our incentive is to keep producing leads worth paying for, not to trap you in an agreement that is not working. That keeps the relationship performance-driven on both sides. If you want the specific terms for your situation, a free audit call is the place to get them. We will lay out exactly how the engagement works before you commit to anything.",
  },
  {
    question: 'What is a qualified lead, exactly?',
    answer:
      "A qualified lead is a prospect who matches your ideal customer profile and has shown genuine buying intent, not just a name and email scraped from a form or bought off a list. In practice that means the right kind of business or decision-maker, in a position to buy, who has engaged in a way that signals real interest. The important part: Vierra defines what counts as qualified together with each client before a campaign starts, so the criteria are explicit and agreed on rather than left fuzzy. That upfront definition removes any guessing about what you are paying for and keeps everyone aligned. When we report qualified leads and booked meetings, they meet a standard you helped set, not a loose one picked to make the numbers look good.",
  },
  {
    question: 'Does Vierra work with businesses outside Medford or New York?',
    answer:
      "Yes. Vierra Digital is headquartered in Medford, MA with an office in New York, NY, but the large majority of our work, including outreach, ad management, follow-up automation, and analytics, is done remotely. So we serve clients across the United States regardless of where their team is located, and you do not need to be in the Boston or New York area to work with us. Our lean, remote-friendly setup is actually part of how we keep overhead low and move quickly, which is what supports the results-based pricing model. If you are a B2B or high-ticket service business anywhere in the US looking for a predictable source of qualified leads, location is not a barrier.",
  },
  {
    question: 'How is Vierra different from buying leads from a list broker?',
    answer:
      "A list broker sells you raw contact data, names and emails with no context, no qualification, and no follow-up, and then it is entirely on you to turn that list into actual business. Vierra does the opposite. We build the complete system around reaching the right prospects, including warm outreach through our network, results-based targeted ad campaigns, and analytics-driven follow-up that nurtures leads and books meetings. And rather than charging by the size of a list, we tie our fee to the meetings and qualified pipeline that system produces. So instead of paying for a pile of contacts and hoping some convert, you are paying against real outcomes: sales-ready, ICP-matched leads landing on your calendar. It is a fundamentally different and lower-risk proposition than buying data and figuring out the rest yourself.",
  },
];
