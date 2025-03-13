import Image from "next/image";
import { FaEnvelope, FaFacebookF, FaLinkedinIn, FaTimes, FaExternalLinkAlt } from "react-icons/fa";
import { Figtree, Inter } from "next/font/google";
import { useState, useEffect } from "react";

const figtree = Figtree({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

const Footer = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDocUrl, setCurrentDocUrl] = useState("");
  const [currentDocTitle, setCurrentDocTitle] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Set initial value
    checkIsMobile();
    
    // Add event listener
    window.addEventListener('resize', checkIsMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const openDocInModal = (url: string, title: string) => {
    // If on mobile, open directly in new tab for better viewing
    if (isMobile) {
      // Use the direct preview URL
      const previewUrl = url.replace(/\/edit\?tab=t\.0$/, "/preview");
      window.open(previewUrl, '_blank');
      return;
    }
    
    // On desktop, use the modal approach
    const embedUrl = url.replace(/\/edit\?tab=t\.0$/, "/preview");
    setCurrentDocUrl(embedUrl);
    setCurrentDocTitle(title);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentDocUrl("");
  };

  // Open document in new tab (fallback option for desktop too)
  const openDocInNewTab = () => {
    if (currentDocUrl) {
      window.open(currentDocUrl, '_blank');
    }
  };

  const documents = [
    {
      title: "Terms of Service",
      url: "https://docs.google.com/document/d/1A3rfabN_-r240YgMVmXpG2eR7FwehhPSwYJlpEcUkd4/edit?tab=t.0",
    },
    {
      title: "Privacy Policy",
      url: "https://docs.google.com/document/d/1eS-9f8RAMGF8AE--GqbBeIuDs1W8_IXn3jRRWXT-7VE/edit?tab=t.0",
    },
    {
      title: "Work Policy",
      url: "https://docs.google.com/document/d/1zdH-0dTJYSz8fBH7lJ1zT3VW-h6qRD-vdcyTxIgV2WI/edit?tab=t.0",
    },
  ];

  return (
    <footer className="bg-[#18042A] text-white pt-32 max-sm:pt-44 pb-8 px-5 md:px-20 md:relative md:overflow-hidden">
      {/* Centered circles */}
      <div className="hidden md:block md:absolute inset-0">
        <div className="absolute w-[925px] h-[925px] rounded-full left-1/2 top-1/2 -translate-x-1/3 -translate-y-1/2 bg-gradient-to-b from-[#701CC000] to-[#701CC000] border-[1.58px] border-[#701CC099] " />
        <div className="absolute w-[1185px] h-[1185px] rounded-full left-1/2 top-1/2 -translate-x-1/3 -translate-y-1/2 bg-gradient-to-b from-[#701CC000] to-[#701CC000] border-[1.58px] border-[#701CC099] " />
        <div className="absolute w-[1434px] h-[1434px] rounded-full left-1/2 top-1/2 -translate-x-1/3 -translate-y-1/2 bg-gradient-to-b from-[#701CC000] to-[#701CC000] border-[1.58px] border-[#701CC099] " />
      </div>

      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center md:items-start gap-10 px-5 md:px-20 relative">
        {/* Logo */}
        <div className="mb-6 md:mb-0 flex justify-center md:justify-start w-full md:w-auto">
          <Image
            src="/assets/vierra-logo.png"
            alt="Vierra"
            width={150}
            height={40}
          />
        </div>

        {/* Links Sections */}
        <div className="flex flex-col md:flex-row gap-10 md:gap-16 text-center md:text-left w-full md:w-auto">
          {/* Company Links */}
          <div>
            <h3
              className={`text-lg font-medium mb-4 md:mb-6 ${figtree.className}`}
            >
              Company
            </h3>
            <ul
              className={`space-y-3 md:space-y-4 text-white/80 ${inter.className}`}
            >
              <li>
                <a href="#about" className="hover:text-white transition-colors">
                  About
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-white transition-colors flex items-center justify-center md:justify-start gap-2"
                >
                  Careers
                  <span className="bg-[#701CC0] text-xs px-2 py-0.5 rounded-[12px] text-white">
                    HIRING
                  </span>
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Referral Program
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3
              className={`text-lg font-medium mb-4 md:mb-6 ${figtree.className}`}
            >
              Legal
            </h3>
            <ul
              className={`space-y-3 md:space-y-4 text-white/80 ${inter.className}`}
            >
              {documents.map((doc, index) => (
                <li key={index}>
                  <button
                    onClick={() => openDocInModal(doc.url, doc.title)}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {doc.title}
                  </button>
                </li>
              ))}
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Inquiries
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="flex flex-col gap-4 w-full md:w-auto text-center md:text-left">
          {[
            {
              icon: <FaEnvelope size={20} />,
              text: "Send Us An Email",
              link: "#",
            },
            {
              icon: <FaLinkedinIn size={20} />,
              text: "Connect On LinkedIn",
              link: "https://www.linkedin.com/company/vierra/?viewAsMember=true",
            },
            {
              icon: <FaFacebookF size={20} />,
              text: "Friend Us On Facebook",
              link: "https://www.facebook.com/profile.php?viewas=100000686899395&id=61572460110348",
            },
          ].map((item, index) => (
            <a
              key={index}
              href={item.link}
              target="_blank"
              className="flex items-center justify-start gap-4 bg-[#1F0F2D] pl-4 pr-6 py-3 rounded-full hover:bg-[#2A1539] transition-colors"
            >
              <div className="bg-[#701CC0] p-2.5 rounded-full">{item.icon}</div>
              <span className={`text-sm font-medium ${figtree.className}`}>
                {item.text}
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Copyright Text */}
      <div className="flex justify-center md:justify-end mt-14 px-5 md:px-20">
        <p className={`text-[#FFFFFFCC] text-sm ${inter.className}`}>
          © 2025 Vierra Digital Inc, All rights reserved
        </p>
      </div>

      {/* Document Modal - Only shown on desktop */}
      {isModalOpen && !isMobile && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="relative bg-[#18042A] border border-[#701CC099] rounded-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-[0_0_30px_rgba(112,28,192,0.3)]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#701CC099]">
              <h2
                className={`text-white font-medium text-xl ${figtree.className}`}
              >
                {currentDocTitle}
              </h2>
              <div className="flex items-center gap-3">
                {/* Open in new tab button */}
                <button
                  onClick={openDocInNewTab}
                  className="text-white/80 hover:text-white bg-[#2A1539] hover:bg-[#3A1F4D] p-2 rounded-full transition-colors flex items-center gap-2"
                  aria-label="Open in new tab"
                  title="Open in new tab"
                >
                  <FaExternalLinkAlt size={16} />
                </button>
                
                <button
                  onClick={closeModal}
                  className="text-white/80 hover:text-white bg-[#2A1539] hover:bg-[#3A1F4D] p-2 rounded-full transition-colors"
                  aria-label="Close"
                >
                  <FaTimes size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 w-full h-full bg-white/5 p-1">
              <iframe
                src={currentDocUrl}
                className="w-full h-full rounded-md"
                title={currentDocTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;