"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { motion } from "framer-motion";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Modal({ isOpen, onClose }: ModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    website: "",
    socialMedia: "",
    monthlyRevenue: "",
    desiredRevenue: "",
    startTimeline: "",
    agencyExperience: "",
    uniqueTraits: "",
    businessIssues: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const validateStep = (): boolean => {
    const requiredFields: Record<number, string[]> = {
      1: ["fullName", "email", "phoneNumber"],
      2: ["website", "monthlyRevenue", "desiredRevenue"],
    };
    const stepErrors: Record<string, string> = {};
    requiredFields[currentStep]?.forEach((field) => {
      if (!formData[field as keyof typeof formData]) {
        stepErrors[field] = "This field is required.";
      }
    });
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep()) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateStep()) return;

    try {
      const response = await fetch("/api/sendEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        alert("Failed to submit the form. Please try again.");
        return;
      }

      setCurrentStep(4);
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("An error occurred. Please try again.");
    }
  };

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200]" onClick={handleOutsideClick}>
      <div ref={modalRef} className="bg-[#18042A] text-white rounded-2xl p-6 md:p-8 w-[90%] max-w-2xl shadow-xl relative" onClick={(e) => e.stopPropagation()}>
        <button
          className="absolute top-4 right-4 text-gray-300 hover:text-red-400 transition-colors"
          onClick={onClose}
        >
          <X size={24} />
        </button>
        <div className="flex justify-center mb-6">
          <Image src="/assets/vierra-logo.png" alt="Vierra Logo" width={150} height={50} className="w-auto h-12" />
        </div>
        <form className={`space-y-4 text-white ${inter.className}`} onSubmit={handleSubmit}>
          {currentStep === 1 && (
            <>
              <div>
                <label htmlFor="fullName" className={`block text-sm font-medium text-gray-200 mb-1 ${inter.className}`}>
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/40 rounded-lg p-3 bg-[#1F0A33] text-white placeholder-gray-400"
                  placeholder="Enter your full name"
                />
                {errors.fullName && <p className="text-red-500 text-sm">{errors.fullName}</p>}
              </div>
              <div>
                <label htmlFor="email" className={`block text-sm font-medium text-gray-200 mb-1 ${inter.className}`}>
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/40 rounded-lg p-3 bg-[#1F0A33] text-white placeholder-gray-400"
                  placeholder="Enter your email"
                />
                {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="phoneNumber" className={`block text-sm font-medium text-gray-200 mb-1 ${inter.className}`}>
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/40 rounded-lg p-3 bg-[#1F0A33] text-white placeholder-gray-400"
                  placeholder="Enter your phone number"
                />
                {errors.phoneNumber && <p className="text-red-500 text-sm">{errors.phoneNumber}</p>}
              </div>
              <div className="flex justify-end mt-6">
                <motion.button
                  type="button"
                  className="px-4 py-2 bg-[#701CC0] text-white rounded-lg shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105"
                  onClick={handleNextStep}
                >
                  Next
                </motion.button>
              </div>
            </>
          )}
          {currentStep === 2 && (
            <>
              <div>
                <label htmlFor="website" className={`block text-sm font-medium text-gray-200 mb-1 ${inter.className}`}>
                  Website <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  id="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/40 rounded-lg p-3 bg-[#1F0A33] text-white placeholder-gray-400"
                  placeholder="Enter your website"
                />
                {errors.website && <p className="text-red-500 text-sm">{errors.website}</p>}
              </div>
              <div>
                <label htmlFor="socialMedia" className={`block text-sm font-medium text-gray-200 mb-1 ${inter.className}`}>
                  Social Media
                </label>
                <input
                  type="text"
                  id="socialMedia"
                  value={formData.socialMedia}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/40 rounded-lg p-3 bg-[#1F0A33] text-white placeholder-gray-400"
                  placeholder="Enter your social media links"
                />
              </div>
              <div>
                <label htmlFor="monthlyRevenue" className={`block text-sm font-medium text-gray-200 mb-1 ${inter.className}`}>
                  What&apos;s your current monthly revenue? <span className="text-red-500">*</span>
                </label>
                <select
                  id="monthlyRevenue"
                  value={formData.monthlyRevenue}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/40 rounded-lg p-3 bg-[#1F0A33] text-white"
                >
                  <option value="">Select your monthly revenue</option>
                  <option value="$10k - $25k">$10k - $25k per month</option>
                  <option value="$25k - $50k">$25k - $50k per month</option>
                  <option value="$50k - $100k">$50k - $100k per month</option>
                  <option value="$100k - $250k">$100k - $250k per month</option>
                  <option value="$250k - $500k">$250k - $500k per month</option>
                  <option value="$500k+">$500k+ per month</option>
                </select>
                {errors.monthlyRevenue && <p className="text-red-500 text-sm">{errors.monthlyRevenue}</p>}
              </div>
              <div>
                <label htmlFor="desiredRevenue" className={`block text-sm font-medium text-gray-200 mb-1 ${inter.className}`}>
                  What&apos;s your desired monthly revenue in 12 months? <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="desiredRevenue"
                  value={formData.desiredRevenue}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/40 rounded-lg p-3 bg-[#1F0A33] text-white placeholder-gray-400"
                  placeholder="Enter your desired revenue"
                />
                {errors.desiredRevenue && <p className="text-red-500 text-sm">{errors.desiredRevenue}</p>}
              </div>
              <div className="flex justify-between mt-6">
                <motion.button
                  type="button"
                  className="px-4 py-2 bg-transparent text-white rounded-lg border border-white/20 hover:bg-white/10 transform transition-transform duration-300"
                  onClick={handlePreviousStep}
                >
                  Previous
                </motion.button>
                <motion.button
                  type="button"
                  className="px-4 py-2 bg-[#701CC0] text-white rounded-lg shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105"
                  onClick={handleNextStep}
                >
                  Next
                </motion.button>
              </div>
            </>
          )}
          {currentStep === 3 && (
            <>
              <div>
                <label htmlFor="startTimeline" className={`block text-sm font-medium text-gray-200 mb-1 ${inter.className}`}>
                  If you&apos;re accepted, how soon can you get started?
                </label>
                <input
                  type="text"
                  id="startTimeline"
                  value={formData.startTimeline}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/40 rounded-lg p-3 bg-[#1F0A33] text-white placeholder-gray-400"
                  placeholder="Enter your timeline"
                />
              </div>
              <div>
                <label htmlFor="agencyExperience" className={`block text-sm font-medium text-gray-200 mb-1 ${inter.className}`}>
                  Have you ever worked with an agency before? (If yes, what was your experience?)
                </label>
                <textarea
                  id="agencyExperience"
                  value={formData.agencyExperience}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/40 rounded-lg p-3 bg-[#1F0A33] text-white placeholder-gray-400"
                  placeholder="Describe your experience"
                />
              </div>
              <div>
                <label htmlFor="uniqueTraits" className={`block text-sm font-medium text-gray-200 mb-1 ${inter.className}`}>
                  What sets you apart from other applicants wanting to work with us?
                </label>
                <textarea
                  id="uniqueTraits"
                  value={formData.uniqueTraits}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/40 rounded-lg p-3 bg-[#1F0A33] text-white placeholder-gray-400"
                  placeholder="Describe your unique traits"
                />
              </div>
              <div>
                <label htmlFor="businessIssues" className={`block text-sm font-medium text-gray-200 mb-1 ${inter.className}`}>
                  What are the biggest issues in your industry right now?
                </label>
                <textarea
                  id="businessIssues"
                  value={formData.businessIssues}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/40 rounded-lg p-3 bg-[#1F0A33] text-white placeholder-gray-400"
                  placeholder="Describe the issues in your industry"
                />
              </div>
              <div className="flex justify-between mt-6">
                <motion.button
                  type="button"
                  className="px-4 py-2 bg-transparent text-white rounded-lg border border-white/20 hover:bg-white/10 transform transition-transform duration-300"
                  onClick={handlePreviousStep}
                >
                  Previous
                </motion.button>
                <motion.button
                  type="submit"
                  className="px-4 py-2 bg-[#701CC0] text-white rounded-lg shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105"
                >
                  Submit
                </motion.button>
              </div>
            </>
          )}
          {currentStep === 4 && (
            <div className="text-center">
              <motion.div
                className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, type: "spring" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <h2 className={`text-2xl font-bold text-white ${bricolage.className}`}>
                Thank you for submitting the form!
              </h2>
              <p className={`text-white mt-4 ${inter.className}`}>
                We will review your information and get back to you shortly.
              </p>
              <motion.button
                className="mt-6 px-4 py-2 bg-[#701CC0] text-white rounded-lg shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105"
                onClick={onClose}
              >
                Close
              </motion.button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}