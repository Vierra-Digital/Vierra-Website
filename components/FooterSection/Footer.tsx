import Image from "next/image";
import { FaEnvelope, FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { Figtree, Inter } from "next/font/google";

const figtree = Figtree({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

const Footer = () => {

  const socialLinks = [
    { icon: <FaEnvelope size={20} />, text: "Send Us An Email", link: "mailto:business@alexshick.com" },
    { icon: <FaLinkedinIn size={20} />, text: "Connect On LinkedIn", link: "https://www.linkedin.com/company/vierra/?viewAsMember=true" },
    { icon: <FaFacebookF size={20} />, text: "Friend Us On Facebook", link: "https://www.facebook.com/profile.php?viewas=100000686899395&id=61572460110348" },
  ];

  return (
    <footer className="bg-[#18042A] text-white pt-32 max-sm:pt-44 pb-8 px-5 md:px-20 md:relative md:overflow-hidden">
      <div className="hidden md:block md:absolute inset-0">
        {[925, 1185, 1434].map((size, i) => (
          <div key={i} className={`absolute w-[${size}px] h-[${size}px] rounded-full left-1/2 top-1/2 -translate-x-1/3 -translate-y-1/2 bg-gradient-to-b from-[#701CC000] to-[#701CC000] border-[1.58px] border-[#701CC099]`} />
        ))}
      </div>
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center md:items-start gap-10 px-5 md:px-20 relative">
        <div className="mb-6 md:mb-0 flex justify-center md:justify-start w-full md:w-auto">
          <Image src="/assets/vierra-logo.png" alt="Vierra" width={150} height={40} />
        </div>
        <div className="flex flex-col md:flex-row gap-10 md:gap-16 text-center md:text-left w-full md:w-auto">
          <div>
            <h3 className={`text-lg font-medium mb-4 md:mb-6 ${figtree.className}`}>Company</h3>
            <ul className={`space-y-3 md:space-y-4 text-white/80 ${inter.className}`}>
              <li>
                <a 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-white transition-colors"
                >
                  About
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors flex items-center justify-center md:justify-start gap-2">
                  Careers <span className="bg-[#701CC0] text-xs px-2 py-0.5 rounded-[12px] text-white">HIRING</span>
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className={`text-lg font-medium mb-4 md:mb-6 ${figtree.className}`}>Legal</h3>
            <ul className={`space-y-3 md:space-y-4 text-white/80 ${inter.className}`}>
              <li>
                <a href="https://vierradev.com/terms-of-service" className="hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">Terms of Service</a>
              </li>
              <li>
                <a href="https://vierradev.com/privacy-policy" className="hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
              </li>
              <li>
                <a href="https://vierradev.com/work-policy" className="hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">Work Policy</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-4 w-full md:w-auto text-center md:text-left">
          {socialLinks.map((item, i) => (
            <a key={i} href={item.link} target="_blank" className="flex items-center justify-start gap-4 bg-[#1F0F2D] pl-4 pr-6 py-3 rounded-full hover:bg-[#2A1539] transition-colors">
              <div className="bg-[#701CC0] p-2.5 rounded-full">{item.icon}</div>
              <span className={`text-sm font-medium ${figtree.className}`}>{item.text}</span>
            </a>
          ))}
        </div>
      </div>
      <div className="flex flex-col md:flex-row justify-center md:justify-end items-center gap-4 mt-14 px-5 md:px-20">
        <a href="https://vierradev.com/privacy-policy" className={`text-[#FFFFFFCC] text-sm hover:text-white transition-colors ${inter.className}`}>Privacy Policy</a>
        <p className={`text-[#FFFFFFCC] text-sm ${inter.className}`}>© 2026 Vierra Digital Inc, All rights reserved</p>
      </div>
    </footer>
  );
};

export default Footer;
