import Image from "next/image";
import { FaEnvelope, FaFacebookF, FaLinkedinIn, FaTimes, FaExternalLinkAlt } from "react-icons/fa";
import { Figtree, Inter } from "next/font/google";
import { useState, useEffect } from "react";

const figtree = Figtree({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

const Footer = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDoc, setCurrentDoc] = useState({ url: "", title: "" });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => setIsMobile(window.innerWidth < 768);
    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);


  const openDoc = (url: string, title: string): void => {
    if (isMobile) {
      window.open(url.replace(/\/edit\?tab=t\.0$/, "/preview"), "_blank");
      return;
    }
    setCurrentDoc({ url, title });
    setIsModalOpen(true);
  };

  const documents = [
    { title: "Terms of Service", url: "https://docs.google.com/document/d/1A3rfabN_-r240YgMVmXpG2eR7FwehhPSwYJlpEcUkd4/pub?embedded=true" },
    { title: "Privacy Policy", url: "https://docs.google.com/document/d/1eS-9f8RAMGF8AE--GqbBeIuDs1W8_IXn3jRRWXT-7VE/pub?embedded=true" },
    { title: "Work Policy", url: "https://docs.google.com/document/d/1zdH-0dTJYSz8fBH7lJ1zT3VW-h6qRD-vdcyTxIgV2WI/pub?embedded=true" },
  ];

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
              {documents.map((doc, i) => (
                <li key={i}>
                  <button onClick={() => openDoc(doc.url, doc.title)} className="hover:text-white transition-colors cursor-pointer">{doc.title}</button>
                </li>
              ))}
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
      <div className="flex justify-center md:justify-end mt-14 px-5 md:px-20">
        <p className={`text-[#FFFFFFCC] text-sm ${inter.className}`}>© 2025 Vierra Digital Inc, All rights reserved</p>
      </div>
      {isModalOpen && !isMobile && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="relative bg-[#18042A] border border-[#701CC099] rounded-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-[0_0_30px_rgba(112,28,192,0.3)]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#701CC099]">
              <h2 className={`text-white font-medium text-xl ${figtree.className}`}>{currentDoc.title}</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => window.open(currentDoc.url, "_blank")} className="text-white/80 hover:text-white bg-[#2A1539] hover:bg-[#3A1F4D] p-2 rounded-full transition-colors" aria-label="Open in new tab">
                  <FaExternalLinkAlt size={16} />
                </button>
                <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white bg-[#2A1539] hover:bg-[#3A1F4D] p-2 rounded-full transition-colors" aria-label="Close">
                  <FaTimes size={18} />
                </button>
              </div>
            </div>
            <iframe src={currentDoc.url} className="w-full h-full bg-white/5 p-1 rounded-md" title={currentDoc.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
