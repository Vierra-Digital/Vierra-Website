"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";
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

export function AllPostsModal({ isOpen, onClose }: ModalProps) {
  const [allPosts, setAllPosts] = useState<BlogPostType[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [totalPosts, setTotalPosts] = useState(0);
  const limit = 6;

  useEffect(() => {
    if (isOpen) {
      fetchAllPosts(currentPage);
    }
  }, [isOpen, currentPage]);

  const fetchAllPosts = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/blog/posts?page=${page}&limit=${limit}`);
      const data = await response.json();
      setAllPosts(data.posts);
      setTotalPosts(data.total);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
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
      <div ref={modalRef} className="bg-white backdrop-blur-md rounded-lg h-full lg:h-[70%] p-6 w-full max-w-4xl shadow-lg relative">
        <button
          className="absolute top-4 right-4 text-black hover:text-[#FF0000] transition-colors"
          onClick={onClose}
        >
          <X size={24} />
        </button>
        <div id="content-container" className="flex flex-col w-full h-full items-center justify-between text-[#18042A]">
          <div id="search-window-heading" className="flex-col items-center justify-center py-2 md:py-5">
            <h2 className={`text-2xl lg:text-3xl font-bold md:mb-3 leading-tight ${bricolage.className}`}>
              All Blog Posts
            </h2>
            <p className={`text-gray-600 ${inter.className}`}>
              Find articles, insights, and more from Vierra
            </p>
          </div>
          <div id="posts-in-view" className="h-full w-full">
            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4 w-full">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4 w-full">
                {allPosts.map((blog) => (
                  <Link key={blog.slug} href={`/blog/${blog.slug}`} passHref>
                    <div id="editor-blog-container" className="flex flex-row w-full h-24 p-5 gap-3 border-[1px] border-[#646A69] rounded-lg bg-[#F3F3F3] overflow-hidden transition-all duration-300 hover:shadow-lg">
                      <div id="editor-blog-image-container" className="w-20 h-full flex-shrink-0 relative">
                        <Image src={(blog.image_url && (blog.image_url.startsWith('http://') || blog.image_url.startsWith('https://'))) ? "/assets/meta-banner.png" : (blog.image_url || "/assets/meta-banner.png")} alt={blog.title} fill className="object-cover" />
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
              disabled={currentPage === totalPages}
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