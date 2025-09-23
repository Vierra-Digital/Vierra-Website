"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { X, Search } from "lucide-react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { motion } from "framer-motion";
import Link from "next/link";


type BlogPostType = {
  id: number;
  author_id: number;
  title: string;
  content: string;
  image_url?: string | null;
  published_date: string;
  slug: string;
  is_test?: boolean | null;
  visits: number;
  tag?: string;
  author: {
    name: string;
  };
};

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
};

export function SearchModal({ isOpen, onClose }: ModalProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [allPosts, setAllPosts] = useState<BlogPostType[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [totalPosts, setTotalPosts] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 6;

  useEffect(() => {
    if (isOpen) {
      fetchAllPosts(currentPage, searchQuery);
    }
  }, [isOpen, currentPage, searchQuery]);

  const fetchAllPosts = async (page: number, query: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/blog/posts?page=${page}&limit=${limit}&search=${encodeURIComponent(query)}`);
      const data = await response.json();
      setAllPosts(data.posts);
      setTotalPosts(data.total);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
      setAllPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const modalRef = useRef<HTMLDivElement>(null);
  const handleOutsideClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const totalPages = Math.ceil(totalPosts / limit)

  if (!isOpen) return null;

  return (
    <div className="fixed w-full inset-0 bg-black/50 flex items-center justify-center z-[200]" onClick={handleOutsideClick}>
      <div ref={modalRef} className="bg-white backdrop-blur-md rounded-lg h-full lg:h-[80%] p-6 w-full max-w-4xl shadow-lg relative">
        <button
          className="absolute top-4 right-4 text-black hover:text-[#FF0000] transition-colors"
          onClick={onClose}
        >
          <X size={24} />
        </button>
        <div id="content-container" className="flex flex-col w-full h-full items-center justify-between text-[#18042A]">
          <div id="top-part-container" className="w-full flex flex-col items-center mb-4">
            <div id="search-window-heading" className="flex-col items-center justify-center py-5">
              <h2 className={`text-2xl lg:text-3xl font-bold mb-3 leading-tight ${bricolage.className}`}>
                Search Blog Posts
              </h2>
              <p className={`text-sm md:text-lg text-gray-600 ${inter.className}`}>
                Find articles, insights, and more from Vierra
              </p>
            </div>
            <div id="search bar" className="w-full">
              <form className="relative">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search articles, topics, authors..."
                    className={`w-full h-10 md:h-14 pl-6 pr-14 rounded-full border-2 text-sm md:text-lg border-gray-200 focus:border-purple-500 focus:outline-none transition-colors text-gray-700 ${inter.className}`}
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-3 transition-colors"
                  >
                    <Search className="h-4 w-12 md:h-8 md:w-12"/>
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div id="posts-in-view" className="h-full w-full">
            {loading ? (
              <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 w-full">
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-full h-24 rounded-lg bg-gray-200"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 w-full">
                {allPosts.map(blog => (
                  <Link href={`/blog/${blog.slug}`} passHref>
                    <div id="editor-blog-container" className="flex flex-row w-full h-24 p-5 gap-3 border-[1px] border-[#646A69] rounded-lg bg-[#F3F3F3] overflow-hidden transition-all duration-300 hover:shadow-lg">
                      <div id="editor-blog-image-container" className="w-20 h-full flex-shrink-0">
                        <img src={blog.image_url ?? "/assets/vierra-logo.png"} className="object-cover" />
                      </div>
                      <div id="editor-blog-text-container" className="flex flex-col justify-center">
                        <span className={`text-sm md:text-md font-bold leading-tight text-[#18042A] ${bricolage.className}`}>
                          {blog.title}
                        </span>
                        <span className={`text-xs md:text-sm font-bold font-normal leading-tight mt-2 text-[#18042A] ${bricolage.className}`}>
                          {blog.published_date ? formatDate(blog.published_date) : ""}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div id="pagination" className="flex justify-center items-center gap-3 text-[#18042A]">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}