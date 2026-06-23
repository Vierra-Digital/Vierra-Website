export type EmploymentType = 'Full-Time' | 'Part-Time' | 'Internship';

export interface JobRole {
  /** URL slug used for /careers/[slug] */
  slug: string;
  title: string;
  employmentType: EmploymentType;
  /** Short label shown on the listing card, e.g. "Full-Time" */
  typeLabel: string;
  /** Experience requirement, e.g. "3+ Years Of Experience" */
  experience: string;
  /** Compensation summary, e.g. "$175k / Year" */
  compensation: string;
  location: string;
  /** Team / department label shown as a small tag */
  department: string;
  /** One-line summary for the listing card */
  summary: string;
  /** Longer "About the role" paragraphs */
  about: string[];
  responsibilities: string[];
  qualifications: string[];
  /** What the role offers — perks and benefits */
  benefits: string[];
  niceToHave?: string[];
}

const CAREERS_LOCATION = 'In-Person NYC';

export const JOB_ROLES: JobRole[] = [
  {
    slug: 'junior-software-engineer',
    title: 'Junior Software Engineer',
    employmentType: 'Full-Time',
    typeLabel: 'Full-Time',
    experience: '3+ Years Of Experience',
    compensation: '$175k / Year',
    location: CAREERS_LOCATION,
    department: 'Engineering',
    summary:
      'Build and ship the products that power Vierra’s growth platform alongside an experienced, senior engineering team.',
    about: [
      'As a Junior Software Engineer at Vierra, you’ll build and ship the products that power our growth platform, working alongside an experienced, senior engineering team. You’ll touch everything from the client-facing dashboards our partners log into every day to the internal tooling that keeps our campaigns running.',
      'We move fast and we care a lot about writing clean, maintainable code. You’ll ship to production regularly, get real mentorship from the engineers around you, and watch your work make a direct difference for the businesses we serve.',
      'Vierra is a small, tight-knit company, which means you get to see how the whole business works rather than just one narrow slice of it. If you want to grow quickly, take on real ownership, and do the best work of your career, this is the place to do it.',
    ],
    responsibilities: [
      'Develop, test, and ship features across our web applications using TypeScript, React, and Next.js.',
      'Collaborate with design and product to translate requirements into well-scoped, maintainable code.',
      'Write automated tests and participate in code reviews to keep our codebase healthy.',
      'Debug, monitor, and improve the performance and reliability of production systems.',
      'Contribute to technical discussions and help shape engineering best practices.',
    ],
    qualifications: [
      '3+ years of professional software engineering experience.',
      'Strong proficiency with JavaScript and TypeScript and a modern front-end framework (NextJS preferred).',
      'Knowledge in AWS, CI/CD pipelines, Prisma ORM, database architecture, LLMs, and AI Agents.',
      'Familiarity with building and consuming REST APIs and working with relational databases including PostgreSQL.',
      'Expert understanding of version control with Git and collaborative development workflows.',
      'A bias toward shipping, clear written communication, and a growth mindset.',
    ],
    benefits: [
      'A competitive $175k salary with a flexible, hybrid NYC schedule built around deadlines.',
      'Premium developer tooling and a modern stack (TypeScript, Next.js, PostgreSQL).',
      'Direct mentorship from senior engineers and a fast, merit-based path to more ownership.',
      'Included paid vacation and sick leave, 401k, and medical insurance benefits.',
      'Sponsored learning and offering to pay for any books or self-development programs of your choosing.',
      'A close-knit team where you see and shape the whole business.',
    ],
  },
  {
    slug: 'software-engineer-intern',
    title: 'Software Engineer Intern',
    employmentType: 'Internship',
    typeLabel: 'Internship · 6 Months → Full-Time',
    experience: '1+ Years Of Experience Required',
    compensation: '$4k / Month',
    location: CAREERS_LOCATION,
    department: 'Engineering',
    summary:
      'A 6-month, paid internship designed to teach about software systems and convert into a full-time software engineering role.',
    about: [
      'Our Software Engineer Internship is a six-month, paid program built to teach you how real software systems are designed, built, and shipped, and to set you up to convert into a full-time engineering role. From your first week you’ll work on features that reach real users.',
      'You’ll be paired with a senior engineer who guides your training, reviews your code, and helps you grow the craft of building production software. During your first month or two you’ll go through a focused training program, and from there you’ll take on real tasks that contribute directly to Vierra’s progress.',
      'Strong interns are offered a full-time position at the end of the program. Along the way you’ll also get a window into how an entire company operates, far beyond just engineering.',
    ],
    responsibilities: [
      'Pair with senior engineers to build and ship features across our product stack.',
      'Learn our codebase, tooling, and development workflows through hands-on work.',
      'Write and review code, fix bugs, and contribute to a production application.',
      'Participate in standups, sprint planning, and team retrospectives.',
      'Take on increasing ownership and scope as the internship progresses.',
      'Contribute to technical discussions and help shape engineering best practices.',
    ],
    qualifications: [
      'At least 1 year of hands-on experience building software, through school, internships, or personal projects.',
      'Working knowledge of JavaScript or TypeScript and at least one modern framework.',
      'A genuine eagerness to learn, take feedback, and grow quickly.',
      'Strong problem-solving skills and attention to detail.',
      'Proficient understanding of version control with Git and collaborative development workflows.',
      'Availability to commit to the full six-month program.',
    ],
    benefits: [
      'A paid internship at $4k per month with a clear, structured path to a full-time engineering offer.',
      'One-on-one mentorship from a senior engineer who guides your training and growth.',
      'Exposure to how an entire company operates, well beyond just engineering.',
      'Sponsored learning and offering to pay for any books or self-development programs of your choosing.',
      'Premium tools and a flexible, hybrid NYC schedule that respects your time.',
    ],
  },
  {
    slug: 'project-manager',
    title: 'Project Manager',
    employmentType: 'Full-Time',
    typeLabel: 'Full-Time',
    experience: '3+ Years Of Experience',
    compensation: '$200k / Year',
    location: CAREERS_LOCATION,
    department: 'Operations',
    summary:
      'Lead delivery across client systems and GTM workflows, keeping teams aligned, timelines moving quickly, and outcomes exceptional.',
    about: [
      'As a Project Manager at Vierra, you’ll lead delivery across our client systems and go-to-market workflows. You’re the person who keeps teams aligned, timelines moving quickly, and outcomes exceptional. You’ll sit at the center of our designers, engineers, marketers, and salespeople and make sure every engagement runs smoothly.',
      'You’ll own the full delivery lifecycle, from scoping and planning through execution and reporting. We run on an agile workflow with sprints, and you’ll bring the structure that keeps fast-moving work on track. A big part of the job is spotting blockers early and clearing them before they ever become problems.',
      'This is a high-ownership role for someone who loves organization and results. You’ll keep clients confident and informed, partner closely with leadership, and have real influence over how we deliver as the company grows.',
    ],
    responsibilities: [
      'Own the end-to-end delivery of multiple concurrent client engagements.',
      'Define project scope, timelines, and deliverables, and keep them on track.',
      'Coordinate across design, engineering, and outreach teams to remove blockers.',
      'Run sprint planning, standups, and retrospectives using agile workflows.',
      'Communicate progress, risks, and outcomes clearly to clients and leadership.',
    ],
    qualifications: [
      '3+ years of project or program management experience, ideally in an agency or services environment.',
      'A track record of delivering complex projects on time and within scope.',
      'Excellent organizational, communication, and stakeholder-management skills.',
      'Comfort with agile methodologies and modern project-management tooling.',
      'A calm, proactive approach to ambiguity, risk management, and competing priorities.',
      'PMP, CSM, or an equivalent certification.',
    ],
    benefits: [
      'A competitive $200k salary with a flexible, hybrid NYC schedule.',
      'Premium project and collaboration tooling to run delivery the way you see fit.',
      'A seat close to leadership, with real influence over how we ship and scale.',
      'Included paid vacation and sick leave, 401k, and medical insurance benefits.',
      'Sponsored learning and offering to pay for any books or self-development programs of your choosing.',
      'Direct work with notable clients that strengthens your track record and network.',
    ],
  },
  {
    slug: 'chief-marketing-officer',
    title: 'Chief Marketing Officer',
    employmentType: 'Full-Time',
    typeLabel: 'Full-Time · Executive',
    experience: '3+ Years Of Experience',
    compensation: '$250k / Year',
    location: CAREERS_LOCATION,
    department: 'Marketing',
    summary:
      'Plan and lead marketing and sales strategies that scales Vierra’s market exposure. Lead outbound efforts.',
    about: [
      'As Chief Marketing Officer at Vierra, you’ll plan and lead the marketing and sales strategies that scale our market exposure, and you’ll own our outbound efforts. You’ll set the vision for our own brand and act as the strategic north star for the client work we deliver.',
      'This is a senior leadership role with a real seat at the table. You’ll partner directly with the founders and department heads to shape the company’s direction, build and lead the marketing function, and own the metrics that matter. You’ll be hands-on across brand, demand generation, content, and performance marketing.',
      'Vierra works with small and large business owners on high-ticket engagements, so you’ll be building a function that drives measurable growth for real, sizable clients.',
    ],
    responsibilities: [
      'Define and execute the company-wide marketing strategy across all channels.',
      'Lead brand, demand generation, content, and performance marketing initiatives.',
      'Build, mentor, and scale a high-performing marketing team.',
      'Own marketing KPIs and report on growth, pipeline, and ROI to leadership.',
      'Partner with sales and delivery to align go-to-market and client outcomes.',
    ],
    qualifications: [
      '3+ years of senior marketing leadership experience with a record of measurable growth.',
      'Deep expertise across digital marketing, SEO, brand strategy, and performance channels.',
      'Proven ability to build and lead teams and set strategy from the ground up.',
      'Strong analytical skills and fluency with marketing data and attribution.',
      'Ability to produce a comprehensive marketing growth plan and strategy document.',
      'Executive presence and exceptional communication skills.',
    ],
    benefits: [
      'A competitive $250k executive salary with a flexible, hybrid NYC schedule and autonomy to own marketing end-to-end.',
      'Partner directly with the founders on company direction.',
      'The budget and premium tools to build and lead the marketing function from the ground up.',
      'Included paid vacation and sick leave, 401k, and medical insurance benefits.',
      'Sponsored learning and offering to pay for any books or self-development programs of your choosing.',
      'Hands-on work with large, high-ticket clients that expands your network and reputation.',
    ],
  },
  {
    slug: 'account-executive',
    title: 'Account Executive',
    employmentType: 'Full-Time',
    typeLabel: 'Full-Time',
    experience: '1+ Years Of Experience',
    compensation: '$80k / Year + Uncapped Commission',
    location: CAREERS_LOCATION,
    department: 'Sales',
    summary:
      'Works in the full sales cycle and grows Vierra’s brand universe with uncapped earning potential.',
    about: [
      'As an Account Executive at Vierra, you’ll work the full sales cycle and grow our brand universe, with uncapped earning potential. You’ll take opportunities from the first conversation all the way to a closed deal, learning what each prospect wants and showing them exactly how Vierra can drive their growth.',
      'You’ll work both warm and self-sourced opportunities, deliver tailored pitches and proposals, and own your pipeline. Our percentage-based commission system means the more you close, and the more complex the work, the more you earn. There is no ceiling on what a strong closer can make here.',
      'You’ll also get direct exposure to small and large business owners and high-ticket deals, which is some of the best experience there is for building your skills and your network. If you’re hungry, consultative, and motivated by results, you’ll thrive.',
    ],
    responsibilities: [
      'Own the full sales cycle from prospecting and discovery through to close.',
      'Build relationships with prospects and understand their growth challenges.',
      'Deliver compelling pitches and proposals tailored to each prospect.',
      'Hit and exceed monthly and quarterly revenue targets.',
      'Maintain an accurate pipeline and forecast in the CRM.',
    ],
    qualifications: [
      '1+ years of sales experience, ideally in B2B, agency, or services sales.',
      'A consultative selling style and strong relationship-building skills.',
      'Excellent verbal and written communication.',
      'Self-motivated, resilient, and driven by hitting targets.',
      'Comfort working in a fast-paced, high-accountability environment.',
      'Some sort of technical background in marketing, AI tools, and software usage.',
    ],
    benefits: [
      'An $80k base salary with a flexible, hybrid NYC schedule plus uncapped commission through our percentage system.',
      'Warm and self-sourced opportunities, so you spend your time selling rather than prospecting.',
      'Direct exposure to small and large business owners and high-ticket deals.',
      'Included paid vacation and sick leave, 401k, and medical insurance benefits.',
      'Sponsored learning and offering to pay for any books or self-development programs of your choosing.',
      'Mentorship, clear targets, and fast promotion for top performers.',
    ],
  },
  {
    slug: 'senior-account-executive',
    title: 'Senior Account Executive',
    employmentType: 'Full-Time',
    typeLabel: 'Full-Time',
    experience: '5+ Years Of Experience',
    compensation: '$150k / Year + Uncapped Commission',
    location: CAREERS_LOCATION,
    department: 'Sales',
    summary:
      'Close high-value deals, mentor the sales team, and support Vierra’s GTM strategy with uncapped earning potential.',
    about: [
      'As a Senior Account Executive at Vierra, you’ll close our highest-value deals, mentor the sales team, and help support our go-to-market strategy, all with uncapped earning potential. You’ll own our largest and most strategic opportunities and bring a proven playbook to the table.',
      'Beyond closing, you’ll serve as a model and mentor for the broader sales team, sharpening our messaging, processes, and playbooks. You’ll partner closely with leadership on forecasting and go-to-market, and your input will shape how Vierra sells.',
      'With a strong base and uncapped commission through our percentage system, this role rewards top performers generously. You’ll work directly with small and large business owners on high-ticket engagements and keep building a network that compounds over your career.',
    ],
    responsibilities: [
      'Own and close high-value, strategic deals end-to-end.',
      'Develop and refine sales playbooks, messaging, and processes.',
      'Mentor and coach junior account executives.',
      'Partner with leadership to shape go-to-market strategy and forecasting.',
      'Consistently exceed ambitious revenue targets.',
    ],
    qualifications: [
      '5+ years of B2B or services sales experience with a track record of closing large deals.',
      'Demonstrated success consistently exceeding quota.',
      'Strong negotiation, presentation, and relationship-management skills.',
      'Experience mentoring or leading other salespeople.',
      'A strategic mindset with the ability to operate independently.',
      'A network of relevant industry relationships.',
      'A technical background in marketing, AI tools, and software usage.',
    ],
    benefits: [
      'A $150k base salary with a flexible, hybrid NYC schedule plus uncapped commission on our largest, highest-ticket deals.',
      'Ownership of strategic accounts and real input into our go-to-market motion.',
      'Included paid vacation and sick leave, 401k, and medical insurance benefits.',
      'Sponsored learning and offering to pay for any books or self-development programs of your choosing.',
      'A strong professional network built through high-value client relationships.',
    ],
  },
  {
    slug: 'engagement-specialist',
    title: 'Engagement Specialist',
    employmentType: 'Full-Time',
    typeLabel: 'Full-Time',
    experience: 'No Experience Required',
    compensation: '$75k / Year',
    location: CAREERS_LOCATION,
    department: 'Marketing',
    summary:
      'Manage and handle client support, lead replies, follow-ups, and outbound communications.',
    about: [
      'As an Engagement Specialist at Vierra, you’ll manage and handle client support, lead replies, follow-ups, and outbound communications. You’re the friendly, organized point of contact who keeps conversations moving and makes every client feel looked after. No prior experience is required, because we’ll train you on everything you need.',
      'Day to day, you’ll keep clients engaged and informed, coordinate follow-ups across our internal teams, and make sure nothing slips through the cracks. You’ll gather feedback, surface client needs to the right people, and help keep relationships warm and responsive.',
      'This is a people-first role for someone who is warm, proactive, and great with details. If you enjoy helping others and staying on top of things, you’ll do well here and grow quickly into bigger responsibilities.',
    ],
    responsibilities: [
      'Serve as a day-to-day point of contact for clients, keeping them engaged and informed.',
      'Handle lead replies, follow-ups, and outbound communications.',
      'Coordinate scheduling and updates across clients and internal teams.',
      'Track client touchpoints and make sure nothing falls through the cracks.',
      'Gather feedback and surface client needs to the right people internally.',
    ],
    qualifications: [
      'Excellent written and verbal communication skills.',
      'Strong organization and follow-through with great attention to detail.',
      'A warm, proactive, people-first attitude.',
      'Eagerness to learn, take feedback, and grow within the company.',
      'Experience in customer service, hospitality, or other client-facing roles.',
      'Familiarity with CRMs or project-management tools.',
    ],
    benefits: [
      'A $75k salary with a flexible, hybrid NYC schedule and full training.',
      'Hands-on mentorship and a fast, merit-based path to bigger responsibilities.',
      'Premium tools and systems that make staying on top of clients easy.',
      'Included paid vacation and sick leave, 401k, and medical insurance benefits.',
      'Sponsored learning and offering to pay for any books or self-development programs of your choosing.',
      'Exposure to every part of the business and to our clients’ day-to-day needs.',
    ],
  },
  {
    slug: 'ui-ux-designer',
    title: 'UI/UX Designer',
    employmentType: 'Part-Time',
    typeLabel: 'Part-Time',
    experience: '4+ Years Of Experience',
    compensation: '$50 / Hour',
    location: CAREERS_LOCATION,
    department: 'Design',
    summary:
      'Craft clean, modern, and conversion-focused interfaces with research-backed design copy.',
    about: [
      'As a part-time UI/UX Designer at Vierra, you’ll craft clean, modern, and conversion-focused interfaces backed by research and thoughtful design copy. You’ll shape the look and feel of the products and campaigns we ship, turning ideas and requirements into polished, intuitive designs.',
      'You’ll create wireframes, prototypes, and high-fidelity mockups, and you’ll work closely with engineering to make sure your designs ship faithfully. You’ll balance aesthetics with usability and performance, and you’ll use real user feedback and data to keep improving.',
      'You’ll also help maintain and evolve our design systems and keep our brand consistent. This is a flexible, part-time role for an experienced designer who does sharp, modern work and cares about the details.',
    ],
    responsibilities: [
      'Design clean, modern, responsive interfaces for web products and landing pages.',
      'Create wireframes, prototypes, and high-fidelity mockups.',
      'Partner with engineers to ensure designs are implemented faithfully.',
      'Maintain and evolve design systems and brand consistency.',
      'Use user feedback and data to iterate on and improve designs.',
    ],
    qualifications: [
      '4+ years of professional UI/UX design experience.',
      'A strong portfolio demonstrating modern, conversion-focused work.',
      'Proficiency with design tools such as Figma, Adobe Photoshop, Sketch, Cinema4D, and other software.',
      'A solid grasp of responsive design, accessibility, graphic design, HCI, design principles, and usability principles.',
      'Ability to work independently and deliver on a part-time schedule.',
      'Familiarity with front-end basics (HTML/CSS) and design-to-code handoff.',
    ],
    benefits: [
      'A flexible part-time role at $50 per hour with a flexible, hybrid NYC schedule.',
      'Access to premium design tools, including Figma and Adobe Creative Cloud.',
      'Included paid vacation and sick leave, 401k, and medical insurance benefits.',
      'Sponsored learning and offering to pay for any books or self-development programs of your choosing.',
      'Creative ownership over the look and feel of real, shipping products.',
    ],
  },
];

export function getJobRole(slug: string): JobRole | undefined {
  return JOB_ROLES.find((role) => role.slug === slug);
}
