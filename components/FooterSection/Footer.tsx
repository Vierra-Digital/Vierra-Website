import Image from "next/image";
import Link from "next/link";
import { FaEnvelope, FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { figtree, inter } from "@/lib/fonts";
import { SectionScrollLink } from "@/components/ui/SectionScrollLink";


const Footer = ({ bare = false }: { bare?: boolean }) => {
  const socialLinks = [
    { icon: <FaEnvelope size={20} />, text: "Send Us An Email", link: "mailto:alex@vierradev.com" },
    { icon: <FaLinkedinIn size={20} />, text: "Connect On LinkedIn", link: "https://www.linkedin.com/company/vierra/" },
    { icon: <FaFacebookF size={20} />, text: "Friend Us On Facebook", link: "https://www.facebook.com/vierradigital" },
  ];

  const platforms: { label: string; link: string | null }[] = [
    { label: "LinkedIn", link: "https://www.linkedin.com/company/vierra/" },
    { label: "Instagram", link: null },
    { label: "Facebook", link: "https://www.facebook.com/vierradigital" },
    { label: "GitHub", link: "https://github.com/Vierra-Digital" },
  ];

  return (
    <footer className={`relative ${bare ? "" : "overflow-hidden bg-[#18042A] "}text-white pt-32 max-sm:pt-44 pb-8 px-5 md:px-20`}>
      {/* Concentric circle accent (Figma footer element). Omitted when `bare` — the
          parent section renders rings that span the CTA box and footer together. */}
      {!bare && (
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
          {[925, 1185, 1434].map((size, i) => (
            <div
              key={i}
              className="absolute left-[50%] top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.58px] border-[#701CC04D]"
              style={{ width: size, height: size }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 max-w-[1400px] mx-auto flex flex-col xl:flex-row justify-between items-center xl:items-start gap-10 px-5 md:px-20">
        <div className="mb-6 xl:mb-0 flex justify-center xl:justify-start w-full xl:w-auto">
          <Link href="/" aria-label="Go to homepage" className="inline-flex">
            <Image src="/assets/vierra-logo-panel.png" alt="Vierra" width={152} height={56} className="h-10 w-auto" />
          </Link>
        </div>
        <div className="flex flex-col xl:flex-row gap-10 xl:gap-16 text-center xl:text-left w-full xl:w-auto">
          <div>
            <h3 className={`text-lg font-medium mb-4 md:mb-6 ${figtree.className}`}>Company</h3>
            <ul className={`space-y-3 md:space-y-4 text-white/80 ${inter.className}`}>
              <li>
                <SectionScrollLink sectionId="services" className="hover:text-white transition-colors">GTM Engine</SectionScrollLink>
              </li>
              <li>
                <Link href="/careers" className="inline-flex items-center justify-center xl:justify-start gap-2 text-white/80 transition-colors hover:text-white">
                  Careers <span className="bg-[#701CC0]/60 text-xs px-2 py-0.5 rounded-[12px] text-white/80">HIRING</span>
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className={`text-lg font-medium mb-4 md:mb-6 ${figtree.className}`}>Legal</h3>
            <ul className={`space-y-3 md:space-y-4 text-white/80 ${inter.className}`}>
              <li>
                <Link href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/work-policy" className="hover:text-white transition-colors">Work Policy</Link>
              </li>
              <li>
                <Link href="/branding" className="hover:text-white transition-colors">Brand Kit</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className={`text-lg font-medium mb-4 md:mb-6 ${figtree.className}`}>Connect</h3>
            <ul className={`space-y-3 md:space-y-4 text-white/80 ${inter.className}`}>
              {platforms.map((p) => (
                <li key={p.label}>
                  {p.link ? (
                    <a href={p.link} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      {p.label}
                    </a>
                  ) : (
                    <span className="cursor-default text-white/50">{p.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-4 w-full xl:w-auto text-center xl:text-left">
          {socialLinks.map((item, i) => (
            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-start gap-4 bg-[#1F0F2D] pl-4 pr-6 py-3 rounded-full hover:bg-[#2A1539] transition-colors">
              <div className="bg-[#701CC0] p-2.5 rounded-full">{item.icon}</div>
              <span className={`text-sm font-medium ${figtree.className}`}>{item.text}</span>
            </a>
          ))}
        </div>
      </div>
      <div className="relative z-10 flex flex-col xl:flex-row justify-center xl:justify-end items-center gap-4 mt-14 px-5 md:px-20">
        <Link href="/privacy-policy" className={`text-[#FFFFFFCC] text-sm hover:text-white transition-colors ${inter.className}`}>Privacy Policy</Link>
        <p className={`text-[#FFFFFFCC] text-sm ${inter.className}`}>© 2026 Vierra Digital LLC, All rights reserved</p>
      </div>
    </footer>
  );
};

export default Footer;
