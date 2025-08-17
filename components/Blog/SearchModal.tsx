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

export function SearchModal({ isOpen, onClose }: ModalProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Add your search logic here
    console.log("Searching for:", searchQuery);
    // You can add API call or filter logic here
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Auto-focus search input when modal opens
  useState(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  });

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
              Search Blog Posts
            </h2>
            <p className={`text-gray-600 ${inter.className}`}>
              Find articles, insights, and more from Vierra
            </p>
          </div>
          <div id="search bar" className="w-full">
            <form onSubmit={handleSearch} className="relative">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search articles, topics, authors..."
                  className={`w-full h-14 pl-6 pr-14 rounded-full border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors text-gray-700 ${inter.className}`}
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 transition-colors"
                >
                  <Search size={20} />
                </button>
              </div>
            </form>
            {searchQuery && (
              <div id="search-results" className="w-full mt-6">
                <div className="border-t pt-4">
                  <p className={`text-gray-500 text-center ${inter.className}`}>
                    Search results for "{searchQuery}" would appear here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}