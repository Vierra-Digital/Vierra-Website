import React from 'react';
import { Bricolage_Grotesque } from 'next/font/google';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';

declare global {
  interface Window {
    particlesJS: {
      load: (tagId: string, path: string, callback?: () => void) => void;
    };
    pJSDom?: { pJS: Record<string, unknown> }[];
  }
}

const bricolage = Bricolage_Grotesque({ subsets: ['latin'] });

const PrivacyPolicyPage: React.FC = () => {
  const initParticles = () => {
    if (typeof window !== 'undefined' && window.particlesJS) {
      window.particlesJS.load('particles-container', '/particles-config.json', () => {
        console.log('particles.js loaded - callback');
      });
    }
  };

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
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Vierra | Privacy Policy" />
        <meta name="twitter:description" content="Vierra Digital Privacy Policy. Learn how we collect, use, and protect your personal information." />
      </Head>
      <Script
        src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"
        strategy="afterInteractive"
        onLoad={initParticles}
      />

      <div className={`relative min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] text-white p-4 md:p-8 flex flex-col items-center animate-gradient-move`}>
        <div id="particles-container" className="fixed inset-0 z-0 w-full h-screen"></div>

        <div className="relative z-10 flex flex-col w-full max-w-5xl mx-auto pt-8 pb-16 px-4 md:px-8">
          <div className="mb-8 flex-shrink-0 self-center">
            <Link href="/" legacyBehavior>
              <a aria-label="Go to homepage">
                <Image
                  src="/assets/vierra-logo.png"
                  alt="Vierra Logo"
                  width={150}
                  height={50}
                  className="w-auto h-12 cursor-pointer"
                />
              </a>
            </Link>
          </div>

          <h1 className={`text-3xl md:text-4xl font-bold mb-12 text-center flex-shrink-0 self-center ${bricolage.className}`}>
            Privacy Policy
          </h1>

          <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg p-6 md:p-10 text-white/90 space-y-4">
            <h2 className="text-2xl font-semibold mb-4 text-white border-b border-white/30 pb-2">AGREEMENT TO OUR LEGAL TERMS</h2>
            <p className="mb-4 leading-relaxed">
              This Privacy Notice for <strong>Vierra Digital LLC</strong> (<em>doing business as Vierra</em>) (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), describes how and why we might access, collect, store, use, and/or share (<em>&quot;process&quot;</em>) your personal information when you use our services (<em>&quot;Services&quot;</em>), including when you:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li>Visit our website at <strong>https://vierradev.com</strong>, or any website of ours that links to this Privacy Notice.</li>
              <li>Use <strong>Vierra Digital LLC</strong>. Increase lead conversions and double your monthly profits. Stop wasting time and money on faulty and ineffective ad campaigns or attempting in-house marketing. Make your ad budget count by scaling your business and filling your calendar. At <strong>Vierra Digital</strong>, we use case-study-proven results-based services to produce millions of dollars in return on ad spending and marketing budgets. We optimize your spending and cut inefficient formalities you pay for by going to a standard marketing agency. We work closely with each of our clients, hand-selecting from a long waitlist of companies looking to stop wasting time with inefficient sales tricks and depleting marketing ad spending.</li>
              <li>Engage with us in other related ways, including sales, marketing, or events.</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              Questions or concerns? Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have questions or concerns, please contact us at <a href="mailto:business@vierradev.com" className="underline hover:text-purple-300">business@vierradev.com</a>.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">SUMMARY OF KEY POINTS</h2>
            <p className="mb-4 leading-relaxed">
              This summary provides key points from our Privacy Notice, but you can find more details about any of these topics by clicking the link following each key point.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. Learn more about the personal information you disclose to us.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>Do we process any sensitive personal information?</strong> Some of the information may be considered &quot;special&quot; or &quot;sensitive&quot; in certain jurisdictions, for example, your racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>Do we collect any information from third parties?</strong> We do not collect any information from third parties.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>How do we process your information?</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so. Learn more about how we process your information.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>In what situations and with which parties do we share personal information?</strong> We may share information in specific situations and with specific third parties. Learn more about when and with whom we share your personal information.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>How do we keep your information safe?</strong> We have adequate organizational and technical processes and procedures to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Learn more about how we keep your info safe.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>What are your rights?</strong> Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information. Learn more about your privacy rights.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>How do you exercise your rights?</strong> The easiest way to exercise your rights is by submitting a data subject access request or contacting us. We will consider and act upon any request per applicable data protection laws.
            </p>
            <p className="mb-4 leading-relaxed">
              Want to learn more about what we do with any information we collect? Review the Privacy Notice in full.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">WHAT INFORMATION DO WE COLLECT?</h2>
            <p className="mb-4 leading-relaxed">
              <strong>We collect personal information that you provide to us.</strong>
            </p>
            <p className="mb-4 leading-relaxed">
              We collect personal information that you voluntarily provide us when you express an interest in obtaining information about us or our products and Services when you participate in activities on the Services or otherwise when you contact us.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>Personal Information Provided by You.</strong> The personal information we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li>Names.</li>
              <li>Phone numbers.</li>
              <li>Email addresses.</li>
              <li>Mailing addresses.</li>
              <li>Job titles.</li>
              <li>Contact preferences.</li>
              <li>Contact or authentication data.</li>
              <li>Billing addresses.</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              <strong>Sensitive Information.</strong> We do not process sensitive information. All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.
            </p>
            <p className="mb-4 leading-relaxed">
              Some information such as your Internet Protocol (<em>IP</em>) address and/or browser and device characteristics is collected automatically when you visit our Services. We automatically collect certain information when you visit, use, or navigate the Services. This information does not reveal your specific identity (<em>like your name or contact information</em>) but may include device and usage information, such as your IP address, browser, and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Services, and other technical information. This information is primarily needed to maintain the security and operation of our Services and for our internal analytics and reporting purposes.
            </p>
            <p className="mb-4 leading-relaxed">
              Like many businesses, we also collect information through cookies and similar technologies.
            </p>
            <p className="mb-4 leading-relaxed">
              The information we collect includes:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li><strong>Log and Usage Data.</strong> Log and usage data is service-related, diagnostic, usage, and performance information our servers automatically collect when you access or use our Services and which we record in log files. Depending on how you interact with us, this log data may include your IP address, device information, browser type, and settings and information about your activity in the Services (such as the date/time stamps associated with your usage, pages, and files viewed, searches, and other actions you take such as which features you use), device event information (such as system activity, error reports (sometimes called &quot;crash dumps&quot;), and hardware settings).</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              Our use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">HOW DO WE PROCESS YOUR INFORMATION?</h2>
            <p className="mb-4 leading-relaxed">
              We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent.
            </p>
            <p className="mb-4 leading-relaxed">
              We process your personal information for a variety of reasons, depending on how you interact with our Services, including:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
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

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">WHAT LEGAL BASES DO WE RELY ON TO PROCESS YOUR INFORMATION?</h2>
            <p className="mb-4 leading-relaxed">
              We only process your personal information when we believe it is necessary and we have a valid legal reason (<em>i.e., legal basis</em>) to do so under applicable law, like with your consent, to comply with laws, to provide you with services to enter into or fulfill our contractual obligations, to protect your rights, or to fulfill our legitimate business interests.
            </p>
            <p className="mb-4 leading-relaxed">
              The General Data Protection Regulation (<em>GDPR</em>) and UK GDPR require us to explain the valid legal bases we rely on in order to process your personal information. As such, we may rely on the following legal bases to process your personal information:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li><strong>Consent.</strong> We may process your information if you have given us permission (<em>i.e., consent</em>) to use your personal information for a specific purpose. You can withdraw your consent at any time. Learn more about withdrawing your consent.</li>
              <li><strong>Performance of a Contract.</strong> We may process your personal information when we believe it is necessary to fulfill our contractual obligations to you, including providing our Services or at your request prior to entering into a contract with you.</li>
              <li><strong>Legitimate Interests.</strong> We may process your information when we believe it is reasonably necessary to achieve our legitimate business interests and those interests do not outweigh your interests and fundamental rights and freedoms. For example, we may process your personal information for some of the purposes described in order to:
                <ul className="list-circle list-inside ml-4 mt-1 space-y-1">
                  <li>Send users information about special offers and discounts on our products and services.</li>
                  <li>Analyze how our Services are used so we can improve them to engage and retain users. Diagnose problems and/or prevent fraudulent activities.</li>
                  <li>Understand how our users use our products and services so we can improve user experience.</li>
                </ul>
              </li>
              <li><strong>Legal Obligations.</strong> We may process your information where we believe it is necessary for compliance with our legal obligations, such as to cooperate with a law enforcement body or regulatory agency, exercise or defend our legal rights, or disclose your information as evidence in litigation in which we are involved.</li>
              <li><strong>Vital Interests.</strong> We may process your information where we believe it is necessary to protect your vital interests or the vital interests of a third party, such as situations involving potential threats to the safety of any person.</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              We may process your information if you have given us specific permission (<em>i.e., express consent</em>) to use your personal information for a specific purpose, or in situations where your permission can be inferred (<em>i.e., implied consent</em>). You can withdraw your consent at any time.
            </p>
            <p className="mb-4 leading-relaxed">
              In some exceptional cases, we may be legally permitted under applicable law to process your information without your consent, including, for example:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
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

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</h2>
            <p className="mb-4 leading-relaxed">
              We may share information in specific situations described in this section and/or with the following third parties.
            </p>
            <p className="mb-4 leading-relaxed">
              We may need to share your personal information in the following situations:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li><strong>Business Transfers.</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
            </ul>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?</h2>
            <p className="mb-4 leading-relaxed">
              We may use cookies and other tracking technologies to collect and store your information.
            </p>
            <p className="mb-4 leading-relaxed">
              We may use cookies and similar tracking technologies (<em>like web beacons and pixels</em>) to gather information when you interact with our Services. Some online tracking technologies help us maintain the security of our Services, prevent crashes, fix bugs, save your preferences, and assist with basic site functions.
            </p>
            <p className="mb-4 leading-relaxed">
              We also permit third parties and service providers to use online tracking technologies on our Services for analytics and advertising, including to help manage and display advertisements, to tailor advertisements to your interests, or to send abandoned shopping cart reminders (<em>depending on your communication preferences</em>). The third parties and service providers use their technology to provide advertising about products and services tailored to your interests which may appear either on our Services or on other websites.
            </p>
            <p className="mb-4 leading-relaxed">
              To the extent these online tracking technologies are deemed to be a &quot;sale&quot;/&quot;sharing&quot; (<em>which includes targeted advertising, as defined under the applicable laws</em>) under applicable US state laws, you can opt out of these online tracking technologies by submitting a request as described below under section &quot;DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?&quot;
            </p>
            <p className="mb-4 leading-relaxed">
              Specific information about how we use such technologies and how you can refuse certain cookies is set out in our Cookie Notice.
            </p>
            <p className="mb-4 leading-relaxed">
              We may share your information with Google Analytics to track and analyze the use of the Services. The Google Analytics Advertising Features that we may use include: Google Analytics Demographics and Interests Reporting. To opt out of being tracked by Google Analytics across the Services, visit <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-300">https://tools.google.com/dlpage/gaoptout</a>. You can opt out of Google Analytics Advertising Features through Ads Settings and Ad Settings for mobile apps. Other opt out means include <a href="http://optout.networkadvertising.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-300">http://optout.networkadvertising.org/</a> and <a href="http://www.networkadvertising.org/mobile-choice" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-300">http://www.networkadvertising.org/mobile-choice</a>. For more information on the privacy practices of Google, please visit the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-purple-300">Google Privacy & Terms page</a>.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">DO WE OFFER ARTIFICIAL INTELLIGENCE-BASED PRODUCTS?</h2>
            <p className="mb-4 leading-relaxed">
              We offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies.
            </p>
            <p className="mb-4 leading-relaxed">
              As part of our Services, we offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies (<em>collectively, &quot;AI Products&quot;</em>). These tools are designed to enhance your experience and provide you with innovative solutions. The terms in this Privacy Notice govern your use of the AI Products within our Services.
            </p>
            <p className="mb-4 leading-relaxed">
              We provide the AI Products through third-party service providers (<em>&quot;AI Service Providers&quot;</em>), including Amazon Web Services (<em>AWS</em>) AI. As outlined in this Privacy Notice, your input, output, and personal information will be shared with and processed by these AI Service Providers to enable your use of our AI Products for purposes outlined in &quot;WHAT LEGAL BASES DO WE RELY ON TO PROCESS YOUR PERSONAL INFORMATION?&quot; You must not use the AI Products in any way that violates the terms or policies of any AI Service Provider.
            </p>
            <p className="mb-4 leading-relaxed">
              Our AI Products are designed for the following functions:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
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
            <p className="mb-4 leading-relaxed">
              All personal information processed using our AI Products is handled in line with our Privacy Notice and our agreement with third parties. This ensures high security and safeguards your personal information throughout the process, giving you peace of mind about your data&apos;s safety.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">IS YOUR INFORMATION TRANSFERRED INTERNATIONALLY?</h2>
            <p className="mb-4 leading-relaxed">
              We may transfer, store, and process your information in countries other than your own.
            </p>
            <p className="mb-4 leading-relaxed">
              Our servers are located in the United States. If you are accessing our Services from outside the United States, please be aware that your information may be transferred to, stored by, and processed by us in our facilities and in the facilities of the third parties with whom we may share your personal information (<em>see &quot;WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?&quot; above</em>), in the United States, and other countries.
            </p>
            <p className="mb-4 leading-relaxed">
              If you are a resident in the European Economic Area (<em>EEA</em>), United Kingdom (<em>UK</em>), or Switzerland, then these countries may not necessarily have data protection laws or other similar laws as comprehensive as those in your country. However, we will take all necessary measures to protect your personal information in accordance with this Privacy Notice and applicable law.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>European Commission&apos;s Standard Contractual Clauses:</strong><br />
              We have implemented measures to protect your personal information, including by using the European Commission&apos;s Standard Contractual Clauses for transfers of personal information between our group companies and between us and our third-party providers. These clauses require all recipients to protect all personal information that they process originating from the EEA or UK in accordance with European data protection laws and regulations. Our Standard Contractual Clauses can be provided upon request. We have implemented similar appropriate safeguards with our third-party service providers and partners and further details can be provided upon request.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">HOW LONG DO WE KEEP YOUR INFORMATION?</h2>
            <p className="mb-4 leading-relaxed">
              We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law. We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (<em>such as tax, accounting, or other legal requirements</em>).
            </p>
            <p className="mb-4 leading-relaxed">
              When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (<em>for example, because your personal information has been stored in backup archives</em>), then we will securely store your personal information and isolate it from any further processing until deletion is possible.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">HOW DO WE KEEP YOUR INFORMATION SAFE?</h2>
            <p className="mb-4 leading-relaxed">
              We aim to protect your personal information through a system of organizational and technical security measures.
            </p>
            <p className="mb-4 leading-relaxed">
              We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">WHAT ARE YOUR PRIVACY RIGHTS?</h2>
            <p className="mb-4 leading-relaxed">
              Depending on your state of residence in the US or in some regions, such as the European Economic Area (<em>EEA</em>), United Kingdom (<em>UK</em>), Switzerland, and Canada, you have rights that allow you greater access to and control over your personal information. You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.
            </p>
            <p className="mb-4 leading-relaxed">
              In some regions (<em>like the EEA, UK, Switzerland, and Canada</em>), you have certain rights under applicable data protection laws. These may include the right (i) to request access and obtain a copy of your personal information, (ii) to request rectification or erasure; (iii) to restrict the processing of your personal information; (iv) if applicable, to data portability; and (v) not to be subject to automated decision-making. In certain circumstances, you may also have the right to object to the processing of your personal information. You can make such a request by contacting us by using the contact details provided in the section &quot;HOW CAN YOU CONTACT US ABOUT THIS NOTICE?&quot; below.
            </p>
            <p className="mb-4 leading-relaxed">
              We will consider and act upon any request in accordance with applicable data protection laws.
            </p>
            <p className="mb-4 leading-relaxed">
              If you are located in the EEA or UK and you believe we are unlawfully processing your personal information, you also have the right to complain to your Member State data protection authority or UK data protection authority.
            </p>
            <p className="mb-4 leading-relaxed">
              If you are located in Switzerland, you may contact the Federal Data Protection and Information Commissioner.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>Withdrawing your consent:</strong> If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us by using the contact details provided in the section &quot;HOW CAN YOU CONTACT US ABOUT THIS NOTICE?&quot; below. However, please note that this will not affect the lawfulness of the processing before its withdrawal nor, when applicable law allows, will it affect the processing of your personal information conducted in reliance on lawful processing grounds other than consent.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>Opting out of marketing and promotional communications:</strong> You can unsubscribe from our marketing and promotional communications at any time by clicking on the unsubscribe link in the emails that we send, or by contacting us using the details provided in the section &quot;HOW CAN YOU CONTACT US ABOUT THIS NOTICE?&quot; below. You will then be removed from the marketing lists. However, we may still communicate with you — for example, to send you service-related messages that are necessary for the administration and use of your account, to respond to service requests, or for other non-marketing purposes.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>Cookies and similar technologies:</strong> Most Web browsers are set to accept cookies by default. If you prefer, you can usually choose to set your browser to remove cookies and to reject cookies. If you choose to remove cookies or reject cookies, this could affect certain features or services of our Services.
            </p>
            <p className="mb-4 leading-relaxed">
              If you have questions or comments about your privacy rights, you may email us at <a href="mailto:business@vierradev.com" className="underline hover:text-purple-300">business@vierradev.com</a>.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">CONTROLS FOR DO-NOT-TRACK FEATURES</h2>
            <p className="mb-4 leading-relaxed">
              Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track (<em>&quot;DNT&quot;</em>) feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice.
            </p>
            <p className="mb-4 leading-relaxed">
              California law requires us to let you know how we respond to web browser DNT signals. Because there currently is not an industry or legal standard for recognizing or honoring DNT signals, we do not respond to them at this time.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?</h2>
            <p className="mb-4 leading-relaxed">
              If you are a resident of California, Colorado, Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Tennessee, Texas, Utah, or Virginia, you may have the right to request access to and receive details about the personal information we maintain about you and how we have processed it, correct inaccuracies, get a copy of, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. More information is provided below.
            </p>
            <p className="mb-4 leading-relaxed">
              We have collected the following categories of personal information in the past twelve (<em>12</em>) months:
            </p>
            <div className="grid grid-cols-3 gap-x-0 gap-y-0 text-sm py-0 border border-white/20">
              <div className="font-semibold pb-2 pt-2 px-2 border-r border-b border-white/20">Category</div>
              <div className="font-semibold pb-2 pt-2 px-2 border-r border-b border-white/20">Examples</div>
              <div className="font-semibold pb-2 pt-2 px-2 text-center border-b border-white/20">Collected</div>

              <div className="py-2 px-2 border-r border-b border-white/20">Identifiers</div>
              <div className="py-2 px-2 border-r border-b border-white/20">Contact details, such as real name, alias, postal address, telephone or mobile contact number, unique personal identifier, online identifier, Internet Protocol address, email address, and account name.</div>
              <div className="py-2 px-2 text-center border-b border-white/20">NO</div>

              <div className="py-2 px-2 border-r border-b border-white/20">Personal information as defined in the California Customer Records statute.</div>
              <div className="py-2 px-2 border-r border-b border-white/20">Name, contact information, education, employment, employment history, and financial information.</div>
              <div className="py-2 px-2 text-center border-b border-white/20">NO</div>

              <div className="py-2 px-2 border-r border-b border-white/20">Protected classification characteristics under state or federal law.</div>
              <div className="py-2 px-2 border-r border-b border-white/20">Gender, age, date of birth, race and ethnicity, national origin, marital status, and other demographic data.</div>
              <div className="py-2 px-2 text-center border-b border-white/20">NO</div>

              <div className="py-2 px-2 border-r border-b border-white/20">Commerical Information</div>
              <div className="py-2 px-2 border-r border-b border-white/20">Transaction information, purchase history, financial details, and payment information.</div>
              <div className="py-2 px-2 text-center border-b border-white/20">NO</div>

              <div className="py-2 px-2 border-r border-b border-white/20">Biometric Information</div>
              <div className="py-2 px-2 border-r border-b border-white/20">Fingerprints and voiceprints.</div>
              <div className="py-2 px-2 text-center border-b border-white/20">NO</div>

              <div className="py-2 px-2 border-r border-b border-white/20">Internet or other similar network activity</div>
              <div className="py-2 px-2 border-r border-b border-white/20">Browsing history, search history, online behavior, interest data, and interactions with our and other websites, applications, systems, and advertisements.</div>
              <div className="py-2 px-2 text-center border-b border-white/20">NO</div>

              <div className="py-2 px-2 border-r border-b border-white/20">Geolocation Data</div>
              <div className="py-2 px-2 border-r border-b border-white/20">Device location.</div>
              <div className="py-2 px-2 text-center border-b border-white/20">NO</div>

              <div className="py-2 px-2 border-r border-b border-white/20">Audio, electronic, sensory, or similar information</div>
              <div className="py-2 px-2 border-r border-b border-white/20">Images and audio, video or call recordings created in connection with our business activities.</div>
              <div className="py-2 px-2 text-center border-b border-white/20">NO</div>

              <div className="py-2 px-2 border-r border-b border-white/20">Professional or employment-related information</div>
              <div className="py-2 px-2 border-r border-b border-white/20">Business contact details in order to provide you our Services at a business level or job title, work history, and professional qualifications if you apply for a job with us.</div>
              <div className="py-2 px-2 text-center border-b border-white/20">NO</div>

              <div className="py-2 px-2 border-r border-b border-white/20">Education Information</div>
              <div className="py-2 px-2 border-r border-b border-white/20">Student records and directory information.</div>
              <div className="py-2 px-2 text-center border-b border-white/20">NO</div>

              <div className="py-2 px-2 border-r border-b border-white/20">Inferences drawn from collected personal information</div>
              <div className="py-2 px-2 border-r border-b border-white/20">Inferences drawn from any of the collected personal information listed above to create a profile or summary about, for example, an individual’s preferences and characteristics.</div>
              <div className="py-2 px-2 text-center border-b border-white/20">YES</div>

              <div className="py-2 px-2 border-r border-white/20">Sensitive personal Information</div>
              <div className="py-2 px-2 border-r border-white/20"></div>
              <div className="py-2 px-2 text-center">NO</div>
            </div>
            <p className="mb-4 leading-relaxed">
              We may also collect other personal information outside of these categories through instances where you interact with us in person, online, or by phone or mail in the context of:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li>Receiving help through our customer support channels;</li>
              <li>Participation in customer surveys or contests; and</li>
              <li>Facilitation in the delivery of our Services and to respond to your inquiries.</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              We will use and retain the collected personal information as needed to provide the Services or for:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li>Category H - As long as the user has an account with us.</li>
              <li>Category K - As long as the user has an account with us.</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              Learn more about the sources of personal information we collect in &quot;WHAT INFORMATION DO WE COLLECT?&quot;
            </p>
            <p className="mb-4 leading-relaxed">
              Learn more about how we use your personal information in the section, &quot;HOW DO WE PROCESS YOUR INFORMATION?&quot;
            </p>
            <p className="mb-4 leading-relaxed">
              We may disclose your personal information with our service providers pursuant to a written contract between us and each service provider. Learn more about how we disclose personal information to in the section, &quot;WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?&quot;
            </p>
            <p className="mb-4 leading-relaxed">
              We may use your personal information for our own business purposes, such as for undertaking internal research for technological development and demonstration. This is not considered to be &quot;selling&quot; of your personal information.
            </p>
            <p className="mb-4 leading-relaxed">
              We have not disclosed, sold, or shared any personal information to third parties for a business or commercial purpose in the preceding twelve (<em>12</em>) months. We will not sell or share personal information in the future belonging to website visitors, users, and other consumers.
            </p>
            <p className="mb-4 leading-relaxed">
              You have rights under certain US state data protection laws. However, these rights are not absolute, and in certain cases, we may decline your request as permitted by law. These rights include:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li>Right to know whether or not we are processing your personal data.</li>
              <li>Right to access your personal data.</li>
              <li>Right to correct inaccuracies in your personal data.</li>
              <li>Right to request the deletion of your personal data.</li>
              <li>Right to obtain a copy of the personal data you previously shared with us.</li>
              <li>Right to non-discrimination for exercising your rights.</li>
              <li>Right to opt out of the processing of your personal data if it is used for targeted advertising (<em>or sharing as defined under California’s privacy law</em>), the sale of personal data, or profiling in furtherance of decisions that produce legal or similarly significant effects (<em>&quot;profiling&quot;</em>).</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              Depending upon the state where you live, you may also have the following rights:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li>Right to access the categories of personal data being processed (<em>as permitted by applicable law, including Minnesota’s privacy law</em>).</li>
              <li>Right to obtain a list of the categories of third parties to which we have disclosed personal data (<em>as permitted by applicable law, including California&apos;s and Delaware&apos;s privacy law</em>).</li>
              <li>Right to obtain a list of specific third parties to which we have disclosed personal data (<em>as permitted by applicable law, including Minnesota&apos;s and Oregon&apos;s privacy law</em>).</li>
              <li>Right to review, understand, question, and correct how personal data has been profiled (<em>as permitted by applicable law, including Minnesota’s privacy law</em>).</li>
              <li>Right to limit use and disclosure of sensitive personal data (<em>as permitted by applicable law, including California’s privacy law</em>).</li>
              <li>Right to opt out of the collection of sensitive data and personal data collected through the operation of a voice or facial recognition feature (<em>as permitted by applicable law, including Florida’s privacy law</em>).</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              To exercise these rights, you can contact us by submitting a data subject access request, by emailing us at <a href="mailto:business@vierradev.com" className="underline hover:text-purple-300">business@vierradev.com</a>, or by referring to the contact details at the bottom of this document.
            </p>
            <p className="mb-4 leading-relaxed">
              We will honor your opt-out preferences if you enact the Global Privacy Control (<em>GPC</em>) opt-out signal on your browser.
            </p>
            <p className="mb-4 leading-relaxed">
              Under certain US state data protection laws, you can designate an authorized agent to make a request on your behalf. We may deny a request from an authorized agent that does not submit proof that they have been validly authorized to act on your behalf in accordance with applicable laws.
            </p>
            <p className="mb-4 leading-relaxed">
              Upon receiving your request, we will need to verify your identity to determine you are the same person about whom we have the information in our system. We will only use personal information provided in your request to verify your identity or authority to make the request.
            </p>
            <p className="mb-4 leading-relaxed">
              However, if we cannot verify your identity from the information already maintained by us, we may request that you provide additional information for the purposes of verifying your identity and for security or fraud-prevention purposes.
            </p>
            <p className="mb-4 leading-relaxed">
              If you submit the request through an authorized agent, we may need to collect additional information to verify your identity before processing your request and the agent will need to provide a written and signed permission from you to submit such request on your behalf.
            </p>
            <p className="mb-4 leading-relaxed">
              Under certain US state data protection laws, if we decline to take action regarding your request, you may appeal our decision by emailing us at <a href="mailto:business@vierradev.com" className="underline hover:text-purple-300">business@vierradev.com</a>. We will inform you in writing of any action taken or not taken in response to the appeal, including a written explanation of the reasons for the decisions. If your appeal is denied, you may submit a complaint to your state attorney general.
            </p>
            <p className="mb-4 leading-relaxed">
              California Civil Code Section 1798.83, also known as the &quot;Shine The Light&quot; law, permits our users who are California residents to request and obtain from us, once a year and free of charge, information about categories of personal information (<em>if any</em>) we disclosed to third parties for direct marketing purposes and the names and addresses of all third parties with which we shared personal information in the immediately preceding calendar year. If you are a California resident and would like to make such a request, please submit your request in writing to us by using the contact details provided in the section &quot;HOW CAN YOU CONTACT US ABOUT THIS NOTICE?&quot;
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">DO OTHER REGIONS HAVE SPECIFIC PRIVACY RIGHTS?</h2>
            <p className="mb-4 leading-relaxed">
              You may have additional rights based on the country you reside in.
            </p>
            <p className="mb-4 leading-relaxed">
              We collect and process your personal information under the obligations and conditions set by Australia&apos;s Privacy Act 1988 and New Zealand&apos;s Privacy Act 2020 (<em>Privacy Act</em>). This Privacy Notice satisfies the notice requirements defined in both Privacy Acts, in particular: what personal information we collect from you, from which sources, for which purposes, and other recipients of your personal information.
            </p>
            <p className="mb-4 leading-relaxed">
              If you do not wish to provide the personal information necessary to fulfill their applicable purpose, it may affect our ability to provide our services, in particular:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li>Offer you the products or services that you want.</li>
              <li>Respond to or help with your requests.</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              At any time, you have the right to request access to or correction of your personal information. You can make such a request by contacting us by using the contact details provided in the section &quot;HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?&quot;
            </p>
            <p className="mb-4 leading-relaxed">
              If you believe we are unlawfully processing your personal information, you have the right to submit a complaint about a breach of the Australian Privacy Principles to the Office of the Australian Information Commissioner and a breach of New Zealand&apos;s Privacy Principles to the Office of New Zealand Privacy Commissioner.
            </p>
            <p className="mb-4 leading-relaxed">
              At any time, you have the right to request access to or correction of your personal information. You can make such a request by contacting us by using the contact details provided in the section &quot;HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?&quot;
            </p>
            <p className="mb-4 leading-relaxed">
              If you are unsatisfied with the manner in which we address any complaint with regard to our processing of personal information, you can contact the office of the regulator, the details of which are:
            </p>
            <p className="mb-4 leading-relaxed">
              The Information Regulator (<em>South Africa</em>)<br />
              General enquiries: <a href="mailto:enquiries@inforegulator.org.za" className="underline hover:text-purple-300">enquiries@inforegulator.org.za</a><br />
              Complaints (<em>complete POPIA/PAIA form 5</em>): <a href="mailto:PAIAComplaints@inforegulator.org.za" className="underline hover:text-purple-300">PAIAComplaints@inforegulator.org.za</a> & <a href="mailto:POPIAComplaints@inforegulator.org.za" className="underline hover:text-purple-300">POPIAComplaints@inforegulator.org.za</a>
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">DO WE MAKE UPDATES TO THIS NOTICE?</h2>
            <p className="mb-4 leading-relaxed">
              Yes, we will update this notice as necessary to stay compliant with relevant laws.
            </p>
            <p className="mb-4 leading-relaxed">
              We may update this Privacy Notice from time to time. The updated version will be indicated by an updated &quot;Revised&quot; date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</h2>
            <p className="mb-4 leading-relaxed">
              If you have questions or comments about this notice, you may email us at <a href="mailto:business@vierradev.com" className="underline hover:text-purple-300">business@vierradev.com</a> or contact us by post at:
            </p>
            <p className="mb-4 leading-relaxed">
              Vierra Digital LLC<br />
              Cambridge, MA 02138<br />
              United States
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">HOW CAN WE REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</h2>
            <p className="mb-4 leading-relaxed">
              Based on the applicable laws of your country or state of residence in the US, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. To request to review, update, or delete your personal information, please fill out and submit a data subject access request.
            </p>
            <p className="mt-8 text-sm text-white/70">
              Last Updated January 16th, 2025.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicyPage;
