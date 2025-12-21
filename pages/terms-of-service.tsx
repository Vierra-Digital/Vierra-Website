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

const TermsOfServicePage: React.FC = () => {
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
        <title>Vierra | Terms of Service</title>
        <meta name="description" content="Vierra Digital Terms of Service. Read our terms and conditions for using our digital marketing and lead generation services." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://vierradev.com/terms-of-service" />
        <meta property="og:title" content="Vierra | Terms of Service" />
        <meta property="og:description" content="Vierra Digital Terms of Service. Read our terms and conditions for using our services." />
        <meta property="og:url" content="https://vierradev.com/terms-of-service" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Vierra | Terms of Service" />
        <meta name="twitter:description" content="Vierra Digital Terms of Service. Read our terms and conditions for using our services." />
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
            Terms of Service
          </h1>

          <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg p-6 md:p-10 text-white/90 space-y-4">
            <h2 className="text-2xl font-semibold mb-4 text-white border-b border-white/30 pb-2">AGREEMENT TO OUR LEGAL TERMS</h2>
            <p className="mb-4 leading-relaxed">
              We are <strong>Vierra Digital LLC</strong>, doing business as <strong>Vierra</strong> (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; &quot;our&quot;), a company registered in Massachusetts, United States.
            </p>
            <p className="mb-4 leading-relaxed">
              We operate the website <strong>https://vierradev.com</strong> (the &quot;Site&quot;), as well as any other related products and services that refer or link to these legal terms (the &quot;Legal Terms&quot;) (collectively, the &quot;Services&quot;).
            </p>
            <p className="mb-4 leading-relaxed">
              Increase lead conversions and double your monthly profits. Stop wasting time and money on faulty and ineffective ad campaigns or attempting in-house marketing. Make your ad budget count by scaling your business and filling your calendar. At <strong>Vierra Digital</strong>, we use case-study-proven results-based services to produce millions of dollars in return on ad spending and marketing budgets. We optimize your spending and cut inefficient formalities you pay for by going to a standard marketing agency. We work closely with each of our clients, hand-selecting from a long waitlist of companies looking to stop wasting time with inefficient sales tricks and depleting marketing ad spending.
            </p>
            <p className="mb-4 leading-relaxed">
              You can contact us by phone at (+1)339-333-0929, or email at <a href="mailto:business@vierradev.com" className="underline hover:text-purple-300">business@vierradev.com</a>.
            </p>
            <p className="mb-4 leading-relaxed">
              These Legal Terms constitute a legally binding agreement between you, whether personally or on behalf of an entity (<em>&quot;you&quot;</em>), and Vierra Digital LLC, concerning your access to and use of the Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by all these Legal Terms. IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES YOU MUST DISCONTINUE USE IMMEDIATELY.
            </p>
            <p className="mb-4 leading-relaxed">
              We will provide you with prior notice of any scheduled changes to the Services you are using. The modified Legal Terms will become effective upon posting or notifying you by <a href="mailto:business@vierradev.com" className="underline hover:text-purple-300">business@vierradev.com</a>, as stated in the email message. By continuing to use the Services after the effective date of any changes, you agree to be bound by the modified terms.
            </p>
            <p className="mb-4 leading-relaxed">
              All users who are minors in the jurisdiction in which they reside (<em>generally under the age of 18</em>) must have the permission of, and be directly supervised by, their parent or guardian to use the Services. If you are a minor, you must have your parent or guardian read and agree to these Legal Terms before you use the Services.
            </p>
            <p className="mb-4 leading-relaxed">
              We recommend that you print a copy of these Legal Terms for your records.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">OUR SERVICES</h2>
            <p className="mb-4 leading-relaxed">
              The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country. Accordingly, those persons who choose to access the Services from other locations do so on their initiative and are solely responsible for compliance with local laws, if and to the extent local laws are applicable.
            </p>
            <p className="mb-4 leading-relaxed">
              The Services are not tailored to comply with industry-specific regulations (<em>Health Insurance Portability and Accountability Act (HIPAA), Federal Information Security Management Act (FISMA), etc.</em>), so if your interactions would be subjected to such laws, you may not use the Services. You may not use the Services in a way that would violate the Gramm-Leach-Bliley Act (<em>GLBA</em>).
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">INTELLECTUAL PROPERTY RIGHTS</h2>
            <p className="mb-4 leading-relaxed">
              We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics in the Services (<em>collectively, the &quot;Content&quot;</em>), as well as the trademarks, service marks, and logos contained therein (<em>the &quot;Marks&quot;</em>).
            </p>
            <p className="mb-4 leading-relaxed">
              Our Content and Marks are protected by copyright and trademark laws (<em>and various other intellectual property rights and unfair competition laws</em>) and treaties in the United States and around the world.
            </p>
            <p className="mb-4 leading-relaxed">
              The Content and Marks are provided in or through the Services &quot;AS IS&quot; for your personal, noncommercial use or internal business purposes only.
            </p>
            <p className="mb-4 leading-relaxed">
              Subject to your compliance with these Legal Terms, including the &quot;PROHIBITED ACTIVITIES&quot; section below, we grant you a non-exclusive, non-transferable, revocable license to:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li>Access the Services; and</li>
              <li>Download or print a copy of any portion of the Content to which you have properly gained access,</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              solely for your personal, non-commercial use or internal business purpose. Except as set out in this section or elsewhere in our Legal Terms, no part of the Services and no Content or Marks may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose whatsoever, without our express prior written Permission.
            </p>
            <p className="mb-4 leading-relaxed">
              If you wish to make any use of the Services, Content, or Marks other than as set out in this section or elsewhere in our Legal Terms, please address your request to: <a href="mailto:business@vierradev.com" className="underline hover:text-purple-300">business@vierradev.com</a>. If we ever grant you permission to post, reproduce, or publicly display any part of our Services or Content, you must identify us as the owners or licensors of the Services, Content, or Marks and ensure that any copyright or proprietary notice appears or is visible on posting, reproducing, or displaying our Content.
            </p>
            <p className="mb-4 leading-relaxed">
              We reserve all rights not expressly granted to you in and to the Services, Content, and Marks. Any breach of these Intellectual Property Rights will constitute a material breach of our Legal Terms and your right to use our Services will terminate immediately.
            </p>
            <p className="mb-4 leading-relaxed">
              Please review this section and the &quot;PROHIBITED ACTIVITIES&quot; section carefully before using our Services to understand the (a) rights you give us and (b) obligations you have when you post or upload any content through the Services.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>Submissions:</strong> By directly sending us any question, comment, suggestion, idea, feedback, or other information about the Services (<em>&quot;Submissions&quot;</em>), you agree to assign to us all intellectual property rights in such Submission. You agree that we shall own this Submission and be entitled to its unrestricted use and dissemination for any lawful purpose, commercial or otherwise, without acknowledgment or compensation to you.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong>You are responsible for what you post or upload:</strong> By sending us Submissions through any part of the Services you:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li>confirm that you have read and agree with our &quot;PROHIBITED ACTIVITIES&quot; and will not post, send, publish, upload, or transmit through the Services any Submission that is illegal, harassing, hateful, harmful, defamatory, obscene, bullying, abusive, discriminatory, threatening to any person or group, sexually explicit, false, inaccurate, deceitful, or misleading;</li>
              <li>to the extent permissible by applicable law, waive any moral rights to any such Submission;</li>
              <li>warrant that any such Submission is original to you or that you have the necessary rights and licenses to submit such Submissions and that you have full authority to grant us the above-mentioned rights about your Submissions; and</li>
              <li>warrant and represent that your Submissions do not constitute confidential information.</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              You are solely responsible for your Submissions and you expressly agree to reimburse us for any losses that we may suffer because you breach (a) this section, (b) any third party’s intellectual property rights, or (c) applicable law.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">USER REPRESENTATIONS</h2>
            <p className="mb-4 leading-relaxed">
              By using the Services, you represent and warrant that: (1) you have the legal capacity and you agree to comply with these Legal Terms; (2) you are not a minor in the jurisdiction in which you reside, or if a minor, you have received parental permission to use the Services; (3) you will not access the Services through automated or non-human means, whether through a bot, script or otherwise; (4) you will not use the Services for any illegal or unauthorized purpose; and (5) your use of the Services will not violate any applicable law or regulation.
            </p>
            <p className="mb-4 leading-relaxed">
              If you provide any information that is untrue, inaccurate, not current, or incomplete, we have the right to suspend or terminate your account and refuse any current or future use of the Services (<em>or any portion thereof</em>).
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">SUBSCRIPTIONS</h2>
            <p className="mb-4 leading-relaxed">
              Your subscription will continue and automatically renew unless canceled. You consent to our charging your payment method regularly without requiring your prior approval for each recurring charge until you cancel the applicable order. The length of your billing cycle is monthly.
            </p>
            <p className="mb-4 leading-relaxed">
              You can cancel your subscription at any time by contacting us using the contact information provided below. Your cancellation will take effect at the end of the current paid term. If you have any questions or are unsatisfied with our Services, please email us at <a href="mailto:business@vierradev.com" className="underline hover:text-purple-300">business@vierradev.com</a>.
            </p>
            <p className="mb-4 leading-relaxed">
              We may, from time to time, make changes to the subscription fee and will communicate any price changes to you per applicable law.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">PROHIBITED ACTIVITIES</h2>
            <p className="mb-4 leading-relaxed">
              You may not access or use the Services for any purpose other than that for which we make the Services available. The Services may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.
            </p>
            <p className="mb-4 leading-relaxed">
              As a user of the Services, you agree not to:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li>Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.</li>
              <li>Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.</li>
              <li>Circumvent, disable, or otherwise interfere with security-related features of the Services, including features that prevent or restrict the use or copying of any Content or enforce limitations on the use of the Services and/or the Content contained therein.</li>
              <li>Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.</li>
              <li>Use any information obtained from the Services to harass, abuse, or harm another person.</li>
              <li>Make improper use of our support services or submit false reports of abuse or misconduct.</li>
              <li>Use the Services in a manner inconsistent with any applicable laws or regulations.</li>
              <li>Engage in unauthorized framing of or linking to the Services.</li>
              <li>Upload or transmit (<em>or attempt to upload or to transmit</em>) viruses, Trojan horses, or other material, including excessive use of capital letters and spamming (<em>continuous posting of repetitive text</em>), that interferes with any party’s uninterrupted use and enjoyment of the Services or modifies, impairs, disrupts, alters, or interferes with the use, features, functions, operation, or maintenance of the Services.</li>
              <li>Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.</li>
              <li>Delete the copyright or other proprietary rights notice from any Content.</li>
              <li>Attempt to impersonate another user or person or use the username of another user.</li>
              <li>Upload or transmit (<em>or attempt to upload or transmit</em>) any material that acts as a passive or active information collection or transmission mechanism, including without limitation, clear graphics interchange formats (<em>&quot;gifs&quot;</em>), 1×1 pixels, web bugs, cookies, or other similar devices (<em>sometimes referred to as &quot;spyware&quot; or &quot;passive collection mechanisms&quot; or &quot;PCM&quot;</em>).</li>
              <li>Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.</li>
              <li>Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you.</li>
              <li>Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.</li>
              <li>Copy or adapt the Services&apos; software, including but not limited to Flash, PHP, HTML, JavaScript, or other code.</li>
              <li>Except as permitted by applicable law, decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services.</li>
              <li>Except as may be the result of standard search engine or Internet browser usage, use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, scraper, or offline reader that accesses the Services, or use or launch any unauthorized script or other software.</li>
              <li>Use a buying agent or purchasing agent to make purchases on the Services.</li>
              <li>Make any unauthorized use of the Services, including collecting usernames and/or email addresses of users by electronic or other means to send unsolicited emails, or create user accounts by automated means or under pretenses.</li>
              <li>Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise.</li>
              <li>Sell or otherwise transfer your profile.</li>
            </ul>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">USER-GENERATED CONTRIBUTIONS</h2>
            <p className="mb-4 leading-relaxed">
              The Services does not offer users to submit or post content. We may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the Services, including but not limited to text, writings, video, audio, photographs, graphics, comments, suggestions, or personal information or other material (<em>collectively, &quot;Contributions&quot;</em>). Contributions may be viewable by other users of the Services and through third-party websites. As such, any Contributions you transmit may be treated per the Service&apos;s Privacy Policy. When you create or make available any Contributions, you thereby represent and warrant that:
            </p>
            <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
              <li>The creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party.</li>
              <li>You are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us, the Services, and other users of the Services to use your Contributions in any manner contemplated by the Services and these Legal Terms.</li>
              <li>You have the written consent, release, and/or permission of every identifiable person in your Contributions to use the name or likeness of every such identifiable person to enable inclusion and use of your Contributions in any manner contemplated by the Services and these Legal Terms.</li>
              <li>Your Contributions are not false, inaccurate, or misleading.</li>
              <li>Your Contributions are not unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation.</li>
              <li>Your Contributions are not obscene, lewd, lascivious, filthy, violent, harassing, libelous, slanderous, or otherwise objectionable (<em>as determined by us</em>).</li>
              <li>Your Contributions do not ridicule, mock, disparage, intimidate, or abuse anyone.</li>
              <li>Your Contributions are not used to harass or threaten (<em>in the legal sense of those terms</em>) any other person or to promote violence against a specific person or class of people.</li>
              <li>Your Contributions do not violate any applicable law, regulation, or rule.</li>
              <li>Your Contributions do not violate the privacy or publicity rights of any third party.</li>
              <li>Your Contributions do not violate any applicable law concerning child pornography, or otherwise intended to protect the health or well-being of minors.</li>
              <li>Your Contributions do not include any offensive comments that are connected to race, national origin, gender, sexual preference, or physical handicap.</li>
              <li>Your Contributions do not otherwise violate, or link to material that violates, any provision of these Legal Terms, or any applicable law or regulation.</li>
            </ul>
            <p className="mb-4 leading-relaxed">
              Any use of the Services in violation of the foregoing violates these Legal Terms and may result in, among other things, termination or suspension of your rights to use the Services.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">CONTRIBUTION LICENSE</h2>
            <p className="mb-4 leading-relaxed">
              You and Services agree that we may access, store, process, and use any information and personal data that you provide following the terms of the Privacy Policy and your choices (<em>including settings</em>).
            </p>
            <p className="mb-4 leading-relaxed">
              By submitting suggestions or other feedback regarding the Services, you agree that we can use and share such feedback for any purpose without compensation to you.
            </p>
            <p className="mb-4 leading-relaxed">
              We do not assert any ownership over your Contributions. You retain full ownership of all of your Contributions and any intellectual property rights or other proprietary rights associated with your Contributions. We are not liable for any statements or representations in your Contributions provided by you in any area of the Services. You are solely responsible for your Contributions to the Services and you expressly agree to exonerate us from any responsibility and to refrain from any legal action against us regarding your Contributions.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">THIRD-PARTY WEBSITES AND CONTENT</h2>
            <p className="mb-4 leading-relaxed">
              The Services may contain (<em>or you may be sent via the Site</em>) links to other websites (<em>&quot;Third-Party Websites&quot;</em>) as well as articles, photographs, text, graphics, pictures, designs, music, sound, video, information, applications, software, and other content or items belonging to or originating from third parties (<em>&quot;Third-Party Content&quot;</em>). Such Third-Party Websites and Third-Party Content are not investigated, monitored, or checked for accuracy, appropriateness, or completeness by us, and we are not responsible for any Third-Party Websites accessed through the Services or any Third-Party Content posted on, available through, or installed from the Services, including the content, accuracy, offensiveness, opinions, reliability, privacy practices, or other policies of or contained in the Third-Party Websites or the Third-Party Content. Inclusion of, linking to, or permitting the use or installation of any Third-Party Websites or any Third-Party Content does not imply approval or endorsement thereof by us. If you decide to leave the Services and access the Third-Party Websites or to use or install any Third-Party Content, you do so at your own risk, and you should be aware these Legal Terms no longer govern. You should review the applicable terms and policies, including privacy and data gathering practices, of any website to which you navigate from the Services or relate to any applications you use or install from the Services. Any purchases you make through Third-Party Websites will be through other websites and from other companies, and we take no responsibility whatsoever concerning such purchases which are exclusively between you and the applicable third party. You agree and acknowledge that we do not endorse the products or services offered on Third-Party Websites and you shall hold us blameless from any harm caused by your purchase of such products or services. Additionally, you shall hold us blameless from any losses sustained by you or harm caused to you relating to or resulting in any way from any Third-Party Content or any contact with Third-Party Websites.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">SERVICES MANAGEMENT</h2>
            <p className="mb-4 leading-relaxed">
              We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these Legal Terms; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Legal Terms, including without limitation, reporting such user to law enforcement authorities; (3) in our sole discretion and without limitation, refuse, restrict access to, limit the availability of, or disable (<em>to the extent technologically feasible</em>) any of your Contributions or any portion thereof; (4) in our sole discretion and without limitation, notice, or liability, to remove from the Services or otherwise disable all files and content that are excessive in size or are in any way burdensome to our systems, and (5) otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">PRIVACY POLICY</h2>
            <p className="mb-4 leading-relaxed">
              We care about data privacy and security. Please review our Privacy Policy: <Link href="/privacy-policy" legacyBehavior><a className="underline hover:text-purple-300">https://vierradev.com/privacy-policy</a></Link>. By using the Services, you agree to be bound by our Privacy Policy, which is incorporated into these Legal Terms. Please be advised the Services are hosted in the United States. If you access the Services from any other region of the world with laws or other requirements governing personal data collection, use, or disclosure that differ from applicable laws in the United States, then through your continued use of the Services, you are transferring your data to the United States, and you expressly consent to have your data transferred to and processed in the United States.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">TERM AND TERMINATION</h2>
            <p className="mb-4 leading-relaxed">
              These Legal Terms shall remain in full force and effect while you use the Services. WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR NO REASON, INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR COVENANT CONTAINED IN THESE LEGAL TERMS OR OF ANY APPLICABLE LAW OR REGULATION. WE MAY TERMINATE YOUR USE OR PARTICIPATION IN THE SERVICES OR DELETE ANY CONTENT OR INFORMATION THAT YOU POSTED AT ANY TIME, WITHOUT WARNING, IN OUR SOLE DISCRETION.
            </p>
            <p className="mb-4 leading-relaxed">
              If we terminate or suspend your account for any reason, you are prohibited from registering and creating a new account under your name, a fake or borrowed name, or the name of any third party, even if you may be acting on behalf of the third party. In addition to terminating or suspending your account, we reserve the right to take appropriate legal action, including without limitation pursuing civil, criminal, and injunctive redress.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">MODIFICATIONS AND INTERRUPTIONS</h2>
            <p className="mb-4 leading-relaxed">
              We reserve the right to change, modify, or remove the contents of the Services at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Services. We will not be liable to you or any third party for any modification, price change, suspension, or discontinuance of the Services.
            </p>
            <p className="mb-4 leading-relaxed">
              We cannot guarantee the Services will be available at all times. We may experience hardware, software, or other problems or need to perform maintenance related to the Services, resulting in interruptions, delays, or errors. We reserve the right to change, revise, update, suspend, discontinue, or otherwise modify the Services at any time or for any reason without notice to you. You agree that we have no liability whatsoever for any loss, damage, or inconvenience caused by your inability to access or use the Services during any downtime or discontinuance of the Services. Nothing in these Legal Terms will be construed to obligate us to maintain and support the Services or to supply any corrections, updates, or releases in connection therewith.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">GOVERNING LAW</h2>
            <p className="mb-4 leading-relaxed">
              These Legal Terms and your use of the Services are governed by and construed per the laws of the Commonwealth of Massachusetts applicable to agreements made and to be entirely performed within the Commonwealth of Massachusetts, without regard to its conflict of law principles.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">DISPUTE RESOLUTION</h2>
            <p className="mb-4 leading-relaxed">
              To expedite resolution and control the cost of any dispute, controversy, or claim related to these Legal Terms (<em>each a &quot;Dispute&quot; and collectively, the &quot;Disputes&quot;</em>) brought by either you or us (<em>individually, a &quot;Party&quot; and collectively, the &quot;Parties&quot;</em>), the Parties agree to first attempt to negotiate any Dispute (<em>except those Disputes expressly provided below</em>) informally for at least thirty (<em>30</em>) days before initiating arbitration. Such informal negotiations commence upon written notice from one Party to the other Party.
            </p>
            <p className="mb-4 leading-relaxed">
              If the Parties are unable to resolve a Dispute through informal negotiations, the Dispute (<em>except those Disputes expressly excluded below</em>) will be finally and exclusively resolved by binding arbitration. YOU UNDERSTAND THAT WITHOUT THIS PROVISION, YOU WOULD HAVE THE RIGHT TO SUE IN COURT AND HAVE A JURY TRIAL. The arbitration shall be commenced and conducted under the Commercial Arbitration Rules of the American Arbitration Association (<em>&quot;AAA&quot;</em>) and, where appropriate, the AAA’s Supplementary Procedures for Consumer Related Disputes (<em>&quot;AAA Consumer Rules&quot;</em>), both of which are available at the American Arbitration Association (AAA) website. Your arbitration fees and your share of arbitrator compensation shall be governed by the AAA Consumer Rules and, where appropriate, limited by the AAA Consumer Rules. The arbitration may be conducted in person, through the submission of documents, by phone, or online. The arbitrator will decide in writing but need not provide a statement of reasons unless requested by either Party. The arbitrator must follow applicable law, and any award may be challenged if the arbitrator fails to do so. Except where otherwise required by the applicable AAA rules or applicable law, the arbitration will take place in The United States of America, Massachusetts. Except as otherwise provided herein, the Parties may litigate in court to compel arbitration, stay proceedings pending arbitration, or confirm, modify, vacate, or enter judgment on the award entered by the arbitrator.
            </p>
            <p className="mb-4 leading-relaxed">
              If for any reason, a Dispute proceeds in court rather than arbitration, the Dispute shall be commenced or prosecuted in the state and federal courts located in The United States of America, Massachusetts, and the Parties hereby consent to, and waive all defenses of lack of personal jurisdiction, and forum non conveniens concerning venue and jurisdiction in such state and federal courts. Application of the United Nations Convention on Contracts for the International Sale of Goods and the Uniform Computer Information Transaction Act (<em>UCITA</em>).
            </p>
            <p className="mb-4 leading-relaxed">
              In no event shall any Dispute brought by either Party related in any way to the Services be commenced more than one (<em>1</em>) year after the cause of action arose. If this provision is found to be illegal or unenforceable, then neither Party will elect to arbitrate any Dispute falling within that portion of this provision found to be illegal or unenforceable and such Dispute shall be decided by a court of competent jurisdiction within the courts listed for jurisdiction above, and the Parties agree to submit to the personal jurisdiction of that court.
            </p>
            <p className="mb-4 leading-relaxed">
              The Parties agree that any arbitration shall be limited to the Dispute between the Parties individually. To the full extent permitted by law, (a) no arbitration shall be joined with any other proceeding; (b) there is no right or authority for any Dispute to be arbitrated on a class-action basis or to utilize class-action procedures; and (c) there is no right or authority for any Dispute to be brought in a purported representative capacity on behalf of the general public or any other persons.
            </p>
            <p className="mb-4 leading-relaxed">
              The Parties agree that the following Disputes are not subject to the above provisions concerning informal negotiations binding arbitration: (a) any Disputes seeking to enforce or protect, or concerning the validity of, any of the intellectual property rights of a Party; (b) any Dispute related to, or arising from, allegations of theft, piracy, invasion of privacy, or unauthorized use; and (c) any claim for injunctive relief. If this provision is found to be illegal or unenforceable, then neither Party will elect to arbitrate any Dispute falling within that portion of this provision found to be illegal or unenforceable and such Dispute shall be decided by a court of competent jurisdiction within the courts listed for jurisdiction above, and the Parties agree to submit to the personal jurisdiction of that court.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">CORRECTIONS</h2>
            <p className="mb-4 leading-relaxed">
              There may be information on the Services that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, availability, and various other information. We reserve the right to correct any errors, inaccuracies, or omissions and to change or update the information on the Services at any time, without prior notice.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">DISCLAIMER</h2>
            <p className="mb-4 leading-relaxed">
              THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO WARRANTIES OR REPRESENTATIONS ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES&apos; CONTENT OR THE CONTENT OF ANY WEBSITES OR MOBILE APPLICATIONS LINKED TO THE SERVICES AND WE WILL ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY (1) ERRORS, MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL INJURY OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF THE SERVICES, (3) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL PERSONAL INFORMATION AND/OR FINANCIAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR CESSATION OF TRANSMISSION TO OR FROM THE SERVICES, (5) ANY BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE WHICH MAY BE TRANSMITTED TO OR THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6) ANY ERRORS OR OMISSIONS IN ANY CONTENT AND MATERIALS OR FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED, TRANSMITTED, OR OTHERWISE MADE AVAILABLE VIA THE SERVICES. WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR ANY PRODUCT OR SERVICE ADVERTISED OR OFFERED BY A THIRD PARTY THROUGH THE SERVICES, ANY HYPERLINKED WEBSITE, OR ANY WEBSITE OR MOBILE APPLICATION FEATURED IN ANY BANNER OR OTHER ADVERTISING, AND WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND ANY THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES. AS WITH THE PURCHASE OF A PRODUCT OR SERVICE THROUGH ANY MEDIUM OR IN ANY ENVIRONMENT, YOU SHOULD USE YOUR BEST JUDGMENT AND EXERCISE CAUTION WHERE APPROPRIATE.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">LIMITATIONS OF LIABILITY</h2>
            <p className="mb-4 leading-relaxed">
              IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO THE LESSER OF THE AMOUNT PAID, IF ANY, BY YOU TO US DURING THE SIX (6) MONTH PERIOD BEFORE ANY CAUSE OF ACTION ARISING OR $250.00 USD. CERTAIN US STATE LAWS AND INTERNATIONAL LAWS DO NOT ALLOW LIMITATIONS ON IMPLIED WARRANTIES OR THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY TO YOU, SOME OR ALL OF THE ABOVE DISCLAIMERS OR LIMITATIONS MAY NOT APPLY TO YOU, AND YOU MAY HAVE ADDITIONAL RIGHTS.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">INDEMNIFICATION</h2>
            <p className="mb-4 leading-relaxed">
              You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys’ fees and expenses, made by any third party due to or arising out of: (1) use of the Services; (2) breach of these Legal Terms; (3) any breach of your representations and warranties outlined in these Legal Terms; (4) your violation of the rights of a third party, including but not limited to intellectual property rights; or (5) any overt harmful act toward any other user of the Services with whom you connected via the Services. Notwithstanding the foregoing, we reserve the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, and you agree to cooperate, at your expense, with our defense of such claims. We will use reasonable efforts to notify you of any such claim, action, or proceeding that is subject to this indemnification upon becoming aware of it.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">USER DATA</h2>
            <p className="mb-4 leading-relaxed">
              We will maintain certain data that you transmit to the Services to manage the performance of the Services, as well as data relating to your use of the Services. Although we perform routine backups of data, you are solely responsible for all data that you transmit or that relates to any activity you have undertaken using the Services. You agree that we shall have no liability to you for any loss or corruption of any such data, and you hereby waive any right of action against us arising from any such loss or corruption of such data.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES</h2>
            <p className="mb-4 leading-relaxed">
              Visiting the Services, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically, via email, and on the Services, satisfy any legal requirement that such communication be in writing. YOU HEREBY AGREE TO THE USE OF ELECTRONIC SIGNATURES, CONTRACTS, ORDERS, AND OTHER RECORDS, AND ELECTRONIC DELIVERY OF NOTICES, POLICIES, AND RECORDS OF TRANSACTIONS INITIATED OR COMPLETED BY US OR VIA THE SERVICES. You hereby waive any rights or requirements under any statutes, regulations, rules, ordinances, or other laws in any jurisdiction that require an original signature or delivery or retention of non-electronic records, or to payments or the granting of credits by any means other than electronic means.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">SMS TEXT MESSAGING</h2>
            <p className="mb-4 leading-relaxed">
              If at any time you wish to stop receiving SMS messages from us, simply reply to the text with &quot;STOP.” You may receive an SMS message confirming your opt-out.
            </p>
            <p className="mb-4 leading-relaxed">
              Please be aware that message and data rates may apply to any SMS messages sent or received. The rates are determined by your carrier and the specifics of your mobile plan.
            </p>
            <p className="mb-4 leading-relaxed">
              If you have any questions or need assistance regarding our SMS communications, please email us at <a href="mailto:business@vierradev.com" className="underline hover:text-purple-300">business@vierradev.com</a> or call (+1)339-333-0929.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">CALIFORNIA USERS AND RESIDENTS</h2>
            <p className="mb-4 leading-relaxed">
              If any complaint with us is not satisfactorily resolved, you can contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, California 95834 or by telephone at (800) 952-5210 or (916) 445-1254.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">MISCELLANEOUS</h2>
            <p className="mb-4 leading-relaxed">
              These Legal Terms and any policies or operating rules posted by us on the Services or concerning the Services constitute the entire agreement and understanding between you and us. Our failure to exercise or enforce any right or provision of these Legal Terms shall not operate as a waiver of such right or provision. These Legal Terms operate to the fullest extent permissible by law. We may assign any or all of our rights and obligations to others at any time. We shall not be responsible or liable for any loss, damage, delay, or failure to act caused by any cause beyond our reasonable control. If any provision or part of a provision of these Legal Terms is determined to be unlawful, void, or unenforceable, that provision or part of the provision is deemed severable from these Legal Terms and does not affect the validity and enforceability of any remaining provisions. There is no joint venture, partnership, employment, or agency relationship created between you and us as a result of these Legal Terms or use of the Services. You agree that these Legal Terms will not be construed against us after having drafted them. You hereby waive any defenses you may have based on the electronic form of these Legal Terms and the lack of signing by the parties hereto to execute these Legal Terms.
            </p>

            <h2 className="text-2xl font-semibold mb-4 mt-8 text-white border-b border-white/30 pb-2">CONTACT</h2>
            <p className="mb-4 leading-relaxed">
              To resolve a complaint regarding the Services or to receive further information regarding the use of the Services, please contact us at:
            </p>
            <p className="mb-4 leading-relaxed">
              Vierra Digital LLC<br />
              Cambridge, MA 02138<br />
              United States<br />
              Phone:(+1)339-333-0929<br />
              <a href="mailto:business@vierradev.com" className="underline hover:text-purple-300">business@vierradev.com</a>
            </p>

            <p className="mt-8 text-sm text-white/70">
              Last Updated January 15th, 2025.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default TermsOfServicePage;
