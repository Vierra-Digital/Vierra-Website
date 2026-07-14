"use client";
import { useEffect, useState } from "react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";
import { track } from "@/lib/track";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "unset";
  }, [isMobileMenuOpen]);

  const handleSectionClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    sectionId: string,
    closeMobile = false
  ) => {
    event.preventDefault()
    if (closeMobile) {
      setIsMobileMenuOpen(false)
    }
    if (typeof window === "undefined") return
    if (window.location.pathname !== "/") {
      window.location.href = `/#${sectionId}`
      return
    }
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <>
      <header className="relative z-50 flex items-center justify-between px-2 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 md:gap-12">
          <Link href="/" className="flex items-center">
            <Image src="/assets/vierra-logo-panel.png" alt="Vierra Logo" width={152} height={56} className="h-8 w-auto" />
          </Link>
          <nav className={`hidden md:flex items-center gap-8 text-[16px] ${bricolage.className}`}>
            <Link
              href="/#services"
              className="relative group transition-colors duration-300 hover:text-white"
              onClick={(event) => handleSectionClick(event, "services")}
            >
              GTM Engine
              <span className="absolute -bottom-1 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#8F42FF] to-[#D4A5FF] shadow-[0_0_10px_#8F42FF99] transition-all duration-300 ease-out group-hover:w-full" />
            </Link>
            <Link href="/blog" className="relative group transition-colors duration-300 hover:text-white">
              Blog
              <span className="absolute -bottom-1 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#8F42FF] to-[#D4A5FF] shadow-[0_0_10px_#8F42FF99] transition-all duration-300 ease-out group-hover:w-full" />
            </Link>
          </nav>
        </div>
        <Button
          variant="secondary"
          className={`audit-glow hidden md:flex items-center gap-2 border-2 border-[#701CC0] bg-transparent hover:bg-transparent text-white rounded-md px-8 py-7 shadow-[0px_4px_15.9px_0px_#701CC061] transition-all duration-300 hover:border-[#8F42FF] ${inter.className}`}
          onClick={() => { track("cta_click", { location: "header" }); setIsModalOpen(true); }}
        >
          Let&apos;s Talk <ArrowUpRight className="w-4 h-4 arrow-bob" />
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
                    <Image src="/assets/vierra-logo-panel.png" alt="Vierra Logo" width={152} height={56} className="h-8 w-auto" />
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
                  <Link
                    href="/#services"
                    className="py-3 text-xl text-white hover:text-[#8F42FF] transition-colors"
                    onClick={(event) => handleSectionClick(event, "services", true)}
                  >
                    GTM Engine
                  </Link>
                  <Link href="/blog" className="py-3 text-xl text-white hover:text-[#8F42FF] transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Blog</Link>
                </nav>
                <div className="mt-auto p-4 border-t border-white/10">
                  <Button
                    variant="secondary"
                    className={`w-full flex items-center justify-center gap-2 border-2 border-[#701CC0] bg-transparent hover:bg-[#8F42FF] text-white rounded-md px-8 py-7 shadow-[0px_4px_15.9px_0px_#701CC061] ${inter.className}`}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      track("cta_click", { location: "header_mobile" }); setIsModalOpen(true);
                    }}
                  >
                    Let&apos;s Talk <ArrowUpRight className="w-4 h-4 arrow-bob" />
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
