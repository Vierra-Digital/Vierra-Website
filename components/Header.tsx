"use client";
import { useEffect, useState } from "react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "unset";
  }, [isMobileMenuOpen]);

  return (
    <>
      <header className="relative z-50 flex items-center justify-between px-2 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 md:gap-12">
          <Link href="/" className="flex items-center">
            <Image src="/assets/vierra-logo.png" alt="Vierra Logo" width={120} height={40} className="w-auto h-8" />
          </Link>
          <nav className={`hidden md:flex items-center gap-8 text-[16px] ${bricolage.className}`}>
            <Link href="/#about" className="hover:text-[#8F42FF] transition-colors relative group">
              About us
              <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-[#8F42FF] transition-all duration-300 group-hover:w-full" />
            </Link>
            <Link href="/#services" className="hover:text-[#8F42FF] transition-colors relative group">
              Services
              <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-[#8F42FF] transition-all duration-300 group-hover:w-full" />
            </Link>
            <Link href="/#solutions" className="hover:text-[#8F42FF] transition-colors relative group">
              Solutions
              <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-[#8F42FF] transition-all duration-300 group-hover:w-full" />
            </Link>
            <Link href="/#cases" className="hover:text-[#8F42FF] transition-colors relative group">
              Case Studies
              <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-[#8F42FF] transition-all duration-300 group-hover:w-full" />
            </Link>
            <Link href="/blog" className="hover:text-[#8F42FF] transition-colors relative group">
              Blog
              <span className="absolute left-0 bottom-0 w-0 h-[1px] bg-[#8F42FF] transition-all duration-300 group-hover:w-full" />
            </Link>
          </nav>
        </div>
        <Button
          variant="secondary"
          className={`hidden md:flex items-center gap-2 border-2 border-[#701CC0] bg-transparent hover:bg-[#8F42FF] text-white rounded-full px-8 py-7 shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-all duration-300 hover:scale-105 ${inter.className}`}
          onClick={() => setIsModalOpen(true)}
        >
          Free Audit Call <ArrowUpRight className="w-4 h-4" />
        </Button>
        <div className="md:hidden">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
          </button>
          {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-[#18042A] z-[100]">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between py-4 border-b border-white/10">
                  <Link href="/" className="flex items-center">
                    <Image src="/assets/vierra-logo.png" alt="Vierra Logo" width={120} height={40} className="w-auto h-8" />
                  </Link>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)} 
                    className="p-2 text-white"
                    aria-label="Close menu"
                  >
                    <X size={24} />
                  </button>
                </div>
                <nav className={`flex flex-col p-4 ${bricolage.className}`}>
                  <Link href="/#about" className="py-3 text-xl text-white hover:text-[#8F42FF] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>About us</Link>
                  <Link href="/#services" className="py-3 text-xl text-white hover:text-[#8F42FF] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Services</Link>
                  <Link href="/#solutions" className="py-3 text-xl text-white hover:text-[#8F42FF] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Solutions</Link>
                  <Link href="/#cases" className="py-3 text-xl text-white hover:text-[#8F42FF] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Cases</Link>
                  <Link href="/blog" className="py-3 text-xl text-white hover:text-[#8F42FF] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Blog</Link>
                </nav>
                <div className="mt-auto p-4 border-t border-white/10">
                  <Button
                    variant="secondary"
                    className={`w-full flex items-center justify-center gap-2 border-2 border-[#701CC0] bg-transparent hover:bg-[#8F42FF] text-white rounded-full px-8 py-7 shadow-[0px_4px_15.9px_0px_#701CC061] ${inter.className}`}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsModalOpen(true);
                    }}
                  >
                    Free Audit Call <ArrowUpRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>
      {isModalOpen && <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />}
    </>
  );
}
