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
 */
export interface FaqItem {
  question: string;
  answer: string;
}

// Last substantive review of these answers — surfaced as the FAQPage dateModified
// freshness signal. Bump when the Q&A set is meaningfully updated.
export const FAQ_LAST_UPDATED = "2026-07-14";

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What does Vierra do?',
    answer:
      "Vierra Digital is a B2B lead generation and digital marketing agency. We design and run results-based, case-study-proven systems that fill your sales calendar with qualified leads — prospects who match your ideal customer profile and are ready to buy. Instead of asking you to gamble a large budget on speculative ad spend and hope it works, we build the outreach, advertising, and follow-up infrastructure first, then tie our fee to the meetings and pipeline it actually produces. That combination of warm outreach through our network, targeted advertising, automated client-acquisition systems, and continuous analytics-driven optimization gives you a predictable, scalable source of new business — so growth becomes a system you can rely on rather than a series of one-off campaigns that stop working the moment you stop paying.",
  },
  {
    question: "How does Vierra's lead generation work?",
    answer:
      "We combine four things into one system: warm outreach through our existing network and connections, results-based targeted ad campaigns built to maximize return on ad spend, automated client- and partner-acquisition systems that handle follow-up at scale, and Google Analytics-driven optimization that turns performance data into steadily improving conversion rates. Rather than launching a single campaign and hoping it sticks, we continuously measure which channels and messages produce qualified leads and reallocate budget toward what's proven to work. The outcome is a predictable pipeline of prospects who match your ideal customer profile and have shown genuine buying intent — booked meetings landing on your calendar week after week, instead of a burst of activity that dries up the moment spending stops.",
  },
  {
    question: 'What makes Vierra "risk-averse"?',
    answer:
      "Our entire model is built around measurable ROI and case-study-proven playbooks rather than experimentation on your dime. We focus your budget only on the activities we can demonstrate will generate leads that pay back the investment, so speculative, wasted marketing spend is eliminated and return on ad spend is maximized. Most importantly, our fee is tied to results — booked meetings and qualified pipeline — instead of a fixed retainer you pay whether or not anything works. That shifts the financial risk that normally sits entirely with the client onto us: we only win when you win. You aren't underwriting our learning curve or funding channels before they've proven they can convert into high-paying clients.",
  },
  {
    question: 'What kinds of businesses does Vierra work with?',
    answer:
      "We work with B2B businesses and high-ticket service providers who want a reliable, scalable source of qualified leads without gambling a large budget on unproven advertising. That spans a wide range of industries — from local service businesses like dental and healthcare practices, to product and service companies that have outgrown word-of-mouth referrals and need a repeatable way to fill their pipeline. The common thread is deal size and intent: our model fits best where each new client is worth enough that a predictable flow of qualified, sales-ready leads meaningfully moves the business. If you're scaling past referrals and want growth to be a system rather than a guessing game, you're the kind of company we're built to serve.",
  },
  {
    question: 'What services does Vierra offer?',
    answer:
      "Vierra offers an integrated lead-generation system rather than à la carte tactics. That includes warm outreach through our connections and network, automated client- and partner-acquisition systems that manage follow-up at scale, results-based targeted ad campaigns engineered to maximize return on ad spend, and Google Analytics-driven optimization that turns your performance data into more leads and higher conversion rates over time. Each piece feeds the others: outreach and ads generate prospects, the automation nurtures and books them, and the analytics layer continuously tightens targeting and messaging. Because everything is measured against booked meetings and qualified pipeline, the services are tuned around the outcomes that matter to your revenue — not vanity metrics like impressions or clicks that never reach your sales calendar.",
  },
  {
    question: 'How quickly can we get started?',
    answer:
      "Onboarding is deliberately fast and simple. We start immediately and work to launch your lead generation within days rather than the multi-month ramp-up common at traditional agencies, largely by cutting the corporate formalities and drawn-out approval cycles that slow most engagements down. After a short kickoff to define your ideal customer profile, offer, and targeting, we set up the outreach lists, ad accounts, and follow-up automation and begin driving activity. Exact timelines depend on your industry and how quickly accounts and assets can be provisioned, but the goal is always to get real, qualified leads flowing quickly — so you see momentum in weeks, not quarters.",
  },
  {
    question: 'Where is Vierra located?',
    answer:
      "Vierra Digital is a B2B lead generation and digital marketing agency headquartered at 3 Ashland Street, Medford, Massachusetts, with a second office in New York, New York. While we're rooted in the Boston and NYC areas, the majority of our work — outreach, ad management, follow-up automation, and analytics — happens remotely, so we serve clients across the United States regardless of where their team is based. Being lean and remote-friendly is part of how we move quickly and keep overhead low, which in turn supports our results-based pricing.",
  },
  {
    question: 'How do I get a free audit or quote?',
    answer:
      "Book a free audit call through our website — it's the fastest way to see whether we're a fit. On the call we review your current systems, outreach, and advertising, identify where qualified leads are leaking out of your funnel, and look at ways to strengthen your value ladder and outbound efforts. From there we show you exactly how Vierra would drive more qualified leads and fill your sales calendar, and outline a plan built around your specific numbers — your industry, deal size, and lead-volume goals — before you commit to anything. There's no obligation; the point of the audit is to give you a clear, concrete picture of the opportunity first.",
  },
  {
    question: 'How does pay-after lead generation work?',
    answer:
      "Pay-after lead generation means your fee is tied to results — like booked meetings and qualified pipeline — rather than a fixed retainer paid upfront before anything has been produced. Vierra builds and runs the outreach, ad campaigns, and follow-up systems first, at our own risk, then ties compensation to the leads and meetings those systems actually generate. Practically, that means your budget isn't spent before you see a return, and you're not underwriting months of setup and experimentation with no guarantee of results. It aligns our incentives directly with yours: we're motivated to produce qualified, sales-ready leads because that's what we're paid for — not to simply keep a retainer renewing regardless of performance.",
  },
  {
    question: 'How much does Vierra cost?',
    answer:
      "Vierra prices around the results you need rather than a flat monthly retainer, so there's no single sticker price — cost depends on your industry, average deal size, and lead-volume goals. Because our fee is tied to booked meetings and qualified pipeline, pricing is structured so that what you pay tracks the value you receive rather than a fixed amount charged whether or not the campaigns perform. The best way to get real numbers is to book a free audit call: we'll review your situation and walk you through a plan and pricing built around your specific goals before you commit to anything. That way you can weigh the expected return against the cost with full visibility, up front.",
  },
  {
    question: 'How is risk-averse lead generation different from a retainer agency?',
    answer:
      "A traditional retainer agency is paid the same fee every month whether your pipeline grows or stalls, which means the financial risk sits entirely with you — you fund the work, the experiments, and the learning curve regardless of outcome. Vierra flips that. We tie our fee to booked meetings and qualified leads, so we're only paid meaningfully when the system actually produces results. The difference shows up in incentives: a retainer agency's main goal is to renew the contract, while ours is to generate the pipeline we're compensated for. It also changes how underperformance is handled — instead of you continuing to pay full price for a channel that isn't working, the cost of a weak channel falls largely on us, and we're motivated to fix or replace it quickly.",
  },
  {
    question: 'Who is Vierra for?',
    answer:
      "Vierra is built for B2B businesses and high-ticket service providers who want a predictable pipeline of qualified leads without gambling a large budget on unproven ad spend. That includes local service businesses, dental and healthcare practices, and product or service companies scaling past word-of-mouth referrals into a repeatable growth system. The model fits best when each new client is valuable enough that a steady flow of sales-ready, ICP-matched leads makes a real difference to revenue — and when the owner would rather pay against results than take on the full risk of an upfront retainer. If you're tired of marketing that feels like a gamble and want growth you can forecast, that's exactly who we serve.",
  },
  {
    question: 'How fast do results come?',
    answer:
      "Onboarding starts immediately, and most clients see their first qualified leads and booked meetings within the first few weeks of launch. We're structured to skip the slow, multi-month ramp-up common at traditional agencies by cutting unnecessary corporate formalities and getting outreach and campaigns live quickly. Exact timelines vary with your industry and how fast outreach lists, ad accounts, and follow-up automation can be set up — some markets move faster than others — but the intent is always early, traceable momentum rather than a long wait for a big reveal. And because our fee is tied to results, we're motivated to reach that first qualified pipeline as quickly as you are.",
  },
  {
    question: 'What happens if a campaign underperforms?',
    answer:
      "Because Vierra ties its fee to booked meetings and qualified pipeline rather than a flat retainer, an underperforming channel costs you far less than it would under a pay-upfront model — you're not locked into funding something that isn't working. When a channel isn't producing traceable results, we don't keep spending on it out of inertia; we reallocate budget toward the activities and messages proven to convert and stop funding what isn't. This is where the analytics layer matters: we continuously measure which sources generate qualified leads, so decisions to shift spend are based on data rather than guesswork. The result is a system that self-corrects toward what works, with the downside of any single weak channel largely absorbed on our side rather than yours.",
  },
  {
    question: 'Does Vierra require a long-term contract?',
    answer:
      "Vierra is deliberately built to reduce corporate formalities, not to lock clients into long commitments. Because our fees are tied to results — booked meetings and qualified pipeline — rather than a retainer you pay regardless of performance, there's far less reason to bind you to a lengthy contract in the first place: our incentive is to keep producing leads worth paying for, not to trap you in an agreement that isn't working. That structure keeps the relationship performance-driven on both sides. If you want the specific terms for your situation, a free audit call is the place to get them — we'll lay out how the engagement works before you commit to anything.",
  },
  {
    question: 'What is a qualified lead, exactly?',
    answer:
      "A qualified lead is a prospect who matches your ideal customer profile and has shown genuine buying intent — not just a name and email captured from a form or bought from a list. In practice that means the right kind of business or decision-maker, in a position to buy, who has engaged in a way that signals real interest. Crucially, Vierra defines what counts as qualified together with each client before a campaign starts, so the criteria are explicit and agreed upon rather than left vague. That upfront definition removes ambiguity about what you're paying for and keeps everyone aligned: when we report qualified leads and booked meetings, they meet a standard you helped set, not a loose one chosen to flatter the numbers.",
  },
  {
    question: 'Does Vierra work with businesses outside Medford or New York?',
    answer:
      "Yes. Vierra Digital is headquartered in Medford, MA with an office in New York, NY, but the large majority of our work — outreach, ad management, follow-up automation, and analytics — is done remotely. That means we serve clients across the United States regardless of where their team is located; you don't need to be in the Boston or New York area to work with us. Our lean, remote-friendly setup is actually part of how we keep overhead low and move quickly, which supports the results-based pricing model. If you're a B2B or high-ticket service business anywhere in the US looking for a predictable source of qualified leads, location isn't a barrier.",
  },
  {
    question: 'How is Vierra different from buying leads from a list broker?',
    answer:
      "A list broker sells you raw contact data — names and emails with no context, no qualification, and no follow-up — and it's entirely on you to turn that list into actual business. Vierra does the opposite: we build the complete system around reaching the right prospects, including warm outreach through our network, results-based targeted ad campaigns, and analytics-driven follow-up that nurtures and books meetings. And rather than charging by the size of a list, we tie our fee to the meetings and qualified pipeline that system produces. So instead of paying for volume of contacts and hoping some convert, you're paying against real outcomes — sales-ready, ICP-matched leads landing on your calendar — a fundamentally different and lower-risk proposition than buying data and figuring out the rest yourself.",
  },
];
