"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { X, Search } from "lucide-react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { motion } from "framer-motion";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AllPostsModal({ isOpen, onClose }: ModalProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);
  const handleOutsideClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed w-full inset-0 bg-black/50 flex items-center justify-center z-[200]" onClick={handleOutsideClick}>
      <div ref={modalRef} className="bg-white backdrop-blur-md rounded-lg p-6 w-full max-w-2xl shadow-lg relative">
        <button
          className="absolute top-4 right-4 text-black hover:text-[#FF0000] transition-colors"
          onClick={onClose}
        >
          <X size={24} />
        </button>
        <div id="content-container" className="flex flex-col w-full items-center justify-center text-[#18042A]">
          <div id="search-window-heading" className="flex-col items-center justify-center py-5">
            <h2 className={`text-2xl lg:text-3xl font-bold mb-3 leading-tight ${bricolage.className}`}>
              All Blog Posts
            </h2>
            <p className={`text-gray-600 ${inter.className}`}>
              Find articles, insights, and more from Vierra
            </p>
          </div>
          
        </div>

      </div>
    </div>
  );
}