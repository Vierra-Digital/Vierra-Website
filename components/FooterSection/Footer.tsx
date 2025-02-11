import Image from "next/image";
import { FaFacebookF, FaInstagram, FaLinkedinIn } from "react-icons/fa";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

const Footer = () => {
  return (
    <footer
      className={`${inter.className} bg-[#18042A] text-white pt-32 max-sm:pt-44 pb-8 px-5 md:px-20`}
    >
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center md:items-start gap-10 px-5 md:px-20">
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
            <h3 className="text-lg font-medium mb-4 md:mb-6">Company</h3>
            <ul className="space-y-3 md:space-y-4 text-white/80">
              <li>
                <a href="#" className="hover:text-white transition-colors">
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

          {/* Product Links */}
          <div>
            <h3 className="text-lg font-medium mb-4 md:mb-6">Product</h3>
            <ul className="space-y-3 md:space-y-4 text-white/80">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Overview
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="flex flex-col gap-4 w-full md:w-auto text-center md:text-left">
          {[
            { icon: <FaFacebookF size={20} />, text: "Follow us on Facebook" },
            { icon: <FaInstagram size={20} />, text: "Follow us on Instagram" },
            { icon: <FaLinkedinIn size={20} />, text: "Follow us on LinkedIn" },
          ].map((item, index) => (
            <a
              key={index}
              href="#"
              className="flex items-center justify-center md:justify-start gap-4 bg-[#1F0F2D] pl-4 pr-6 py-3 rounded-full hover:bg-[#2A1539] transition-colors"
            >
              <div className="bg-[#701CC0] p-2.5 rounded-full">{item.icon}</div>
              <span className="text-sm font-medium">{item.text}</span>
            </a>
          ))}
        </div>
      </div>
      {/* Copyright Text */}
      <div className="flex justify-center md:justify-end mt-14 px-5 md:px-20">
        <p className="text-[#FFFFFFCC] text-sm">© 2025 Vierra.</p>
      </div>
    </footer>
  );
};

export default Footer;
