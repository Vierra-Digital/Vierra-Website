"use client";
import { useState, useRef, useEffect } from "react";
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
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      if (isOpen) {
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[200] p-4" onClick={handleOutsideClick}>
      <motion.div 
        ref={modalRef} 
        className="bg-gradient-to-br from-[#18042A] to-[#1F0A33] text-white rounded-2xl w-full max-w-3xl shadow-2xl relative border border-[#701CC0]/20 overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#701CC0] via-[#8F42FF] to-[#701CC0]" />
        
        
        <button
          className="absolute top-5 right-5 text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10 z-10"
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        
        <div className="pt-8 px-6 md:px-8 pb-6 border-b border-white/10">
          <div className="flex justify-center mb-6">
            <Image src="/assets/vierra-logo.png" alt="Vierra Logo" width={150} height={50} className="w-auto h-12" />
          </div>
          
          
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    currentStep === step
                      ? "bg-[#701CC0] text-white shadow-lg shadow-[#701CC0]/50 scale-110"
                      : currentStep > step
                      ? "bg-green-600 text-white"
                      : "bg-white/10 text-gray-400"
                  }`}
                >
                  {currentStep > step ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                {step < 3 && (
                  <div
                    className={`h-0.5 w-12 mx-2 transition-all duration-300 ${
                      currentStep > step ? "bg-green-600" : "bg-white/10"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-4">
            Step {currentStep} of 3
          </p>
        </div>

        <form className={`text-white ${inter.className}`} onSubmit={handleSubmit}>
          <div className="px-6 md:px-8 py-6 max-h-[calc(100vh-300px)] overflow-y-auto">
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              <div>
                <h2 className={`text-2xl font-semibold text-white mb-6 ${bricolage.className}`}>
                  Let&apos;s Get Started
                </h2>
                <p className="text-gray-300 mb-6">Tell us a bit about yourself to begin your free audit.</p>
              </div>
              
              <div>
                <label htmlFor="fullName" className={`block text-sm font-medium text-gray-200 mb-2 ${inter.className}`}>
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-4 py-3 bg-white/5 backdrop-blur-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-all duration-200 ${
                    errors.fullName ? "border-red-500/50" : "border-[#701CC0]/30"
                  }`}
                  placeholder="John Doe"
                />
                {errors.fullName && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1">
                  <span>•</span> {errors.fullName}
                </p>}
              </div>
              
              <div>
                <label htmlFor="email" className={`block text-sm font-medium text-gray-200 mb-2 ${inter.className}`}>
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-4 py-3 bg-white/5 backdrop-blur-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-all duration-200 ${
                    errors.email ? "border-red-500/50" : "border-[#701CC0]/30"
                  }`}
                  placeholder="john@example.com"
                />
                {errors.email && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1">
                  <span>•</span> {errors.email}
                </p>}
              </div>
              
              <div>
                <label htmlFor="phoneNumber" className={`block text-sm font-medium text-gray-200 mb-2 ${inter.className}`}>
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-4 py-3 bg-white/5 backdrop-blur-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-all duration-200 ${
                    errors.phoneNumber ? "border-red-500/50" : "border-[#701CC0]/30"
                  }`}
                  placeholder="+1 (555) 123-4567"
                />
                {errors.phoneNumber && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1">
                  <span>•</span> {errors.phoneNumber}
                </p>}
              </div>
              
              <div className="flex justify-end pt-4">
                <motion.button
                  type="button"
                  className="px-6 py-3 bg-[#701CC0] text-white rounded-lg font-medium shadow-[0px_4px_15.9px_0px_#701CC0B8] hover:bg-[#8F42FF] transform transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleNextStep}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Continue
                </motion.button>
              </div>
            </motion.div>
          )}
          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              <div>
                <h2 className={`text-2xl font-semibold text-white mb-2 ${bricolage.className}`}>
                  Business Information
                </h2>
                <p className="text-gray-300 mb-6">Help us understand your business better.</p>
              </div>
              
              <div>
                <label htmlFor="website" className={`block text-sm font-medium text-gray-200 mb-2 ${inter.className}`}>
                  Website <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  id="website"
                  value={formData.website}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-4 py-3 bg-white/5 backdrop-blur-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-all duration-200 ${
                    errors.website ? "border-red-500/50" : "border-[#701CC0]/30"
                  }`}
                  placeholder="https://yourwebsite.com"
                />
                {errors.website && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1">
                  <span>•</span> {errors.website}
                </p>}
              </div>
              
              <div>
                <label htmlFor="socialMedia" className={`block text-sm font-medium text-gray-200 mb-2 ${inter.className}`}>
                  Social Media <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  id="socialMedia"
                  value={formData.socialMedia}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/30 rounded-lg px-4 py-3 bg-white/5 backdrop-blur-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-all duration-200"
                  placeholder="Instagram, LinkedIn, Facebook handles"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="monthlyRevenue" className={`block text-sm font-medium text-gray-200 mb-2 ${inter.className}`}>
                    Current Monthly Revenue <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="monthlyRevenue"
                      value={formData.monthlyRevenue}
                      onChange={handleChange}
                      className={`w-full border rounded-lg px-4 py-3 pr-10 bg-white/5 backdrop-blur-sm text-white focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-all duration-200 appearance-none ${
                        errors.monthlyRevenue ? "border-red-500/50" : "border-[#701CC0]/30"
                      }`}
                    >
                      <option value="" className="bg-[#1F0A33]">Select revenue range</option>
                      <option value="$10k - $25k" className="bg-[#1F0A33]">$10k - $25k</option>
                      <option value="$25k - $50k" className="bg-[#1F0A33]">$25k - $50k</option>
                      <option value="$50k - $100k" className="bg-[#1F0A33]">$50k - $100k</option>
                      <option value="$100k - $250k" className="bg-[#1F0A33]">$100k - $250k</option>
                      <option value="$250k - $500k" className="bg-[#1F0A33]">$250k - $500k</option>
                      <option value="$500k+" className="bg-[#1F0A33]">$500k+</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {errors.monthlyRevenue && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1">
                    <span>•</span> {errors.monthlyRevenue}
                  </p>}
                </div>
                
                <div>
                  <label htmlFor="desiredRevenue" className={`block text-sm font-medium text-gray-200 mb-2 ${inter.className}`}>
                    Desired Revenue (12 months) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="desiredRevenue"
                    value={formData.desiredRevenue}
                    onChange={handleChange}
                    className={`w-full border rounded-lg px-4 py-3 bg-white/5 backdrop-blur-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-all duration-200 ${
                      errors.desiredRevenue ? "border-red-500/50" : "border-[#701CC0]/30"
                    }`}
                    placeholder="$50,000+"
                  />
                  {errors.desiredRevenue && <p className="text-red-400 text-sm mt-1.5 flex items-center gap-1">
                    <span>•</span> {errors.desiredRevenue}
                  </p>}
                </div>
              </div>
              
              <div className="flex justify-between pt-4">
                <motion.button
                  type="button"
                  className="px-6 py-3 bg-white/10 text-white rounded-lg font-medium border border-white/20 hover:bg-white/20 transform transition-all duration-300 hover:scale-105"
                  onClick={handlePreviousStep}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Previous
                </motion.button>
                <motion.button
                  type="button"
                  className="px-6 py-3 bg-[#701CC0] text-white rounded-lg font-medium shadow-[0px_4px_15.9px_0px_#701CC0B8] hover:bg-[#8F42FF] transform transition-all duration-300 hover:scale-105"
                  onClick={handleNextStep}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Continue
                </motion.button>
              </div>
            </motion.div>
          )}
          {currentStep === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              <div>
                <h2 className={`text-2xl font-semibold text-white mb-2 ${bricolage.className}`}>
                  Tell Us More
                </h2>
                <p className="text-gray-300 mb-6">A few final questions to help us understand your needs.</p>
              </div>
              
              <div>
                <label htmlFor="startTimeline" className={`block text-sm font-medium text-gray-200 mb-2 ${inter.className}`}>
                  How soon can you get started? <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  id="startTimeline"
                  value={formData.startTimeline}
                  onChange={handleChange}
                  className="w-full border border-[#701CC0]/30 rounded-lg px-4 py-3 bg-white/5 backdrop-blur-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-all duration-200"
                  placeholder="e.g., Within 2 weeks, Next month"
                />
              </div>
              
              <div>
                <label htmlFor="agencyExperience" className={`block text-sm font-medium text-gray-200 mb-2 ${inter.className}`}>
                  Agency Experience <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <textarea
                  id="agencyExperience"
                  value={formData.agencyExperience}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-[#701CC0]/30 rounded-lg px-4 py-3 bg-white/5 backdrop-blur-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-all duration-200 resize-none"
                  placeholder="Have you worked with agencies before? Share your experience..."
                />
              </div>
              
              <div>
                <label htmlFor="uniqueTraits" className={`block text-sm font-medium text-gray-200 mb-2 ${inter.className}`}>
                  What sets you apart? <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <textarea
                  id="uniqueTraits"
                  value={formData.uniqueTraits}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-[#701CC0]/30 rounded-lg px-4 py-3 bg-white/5 backdrop-blur-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-all duration-200 resize-none"
                  placeholder="What makes your business unique?"
                />
              </div>
              
              <div>
                <label htmlFor="businessIssues" className={`block text-sm font-medium text-gray-200 mb-2 ${inter.className}`}>
                  Industry Challenges <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <textarea
                  id="businessIssues"
                  value={formData.businessIssues}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-[#701CC0]/30 rounded-lg px-4 py-3 bg-white/5 backdrop-blur-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#701CC0] focus:border-transparent transition-all duration-200 resize-none"
                  placeholder="What are the biggest challenges in your industry?"
                />
              </div>
              
              <div className="flex justify-between pt-4">
                <motion.button
                  type="button"
                  className="px-6 py-3 bg-white/10 text-white rounded-lg font-medium border border-white/20 hover:bg-white/20 transform transition-all duration-300 hover:scale-105"
                  onClick={handlePreviousStep}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Previous
                </motion.button>
                <motion.button
                  type="submit"
                  className="px-6 py-3 bg-[#701CC0] text-white rounded-lg font-medium shadow-[0px_4px_15.9px_0px_#701CC0B8] hover:bg-[#8F42FF] transform transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Submit Application
                </motion.button>
              </div>
            </motion.div>
          )}
          {currentStep === 4 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="text-center py-8"
            >
              <motion.div
                className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <h2 className={`text-3xl font-bold text-white mb-4 ${bricolage.className}`}>
                Application Submitted!
              </h2>
              <p className={`text-gray-300 text-lg mb-8 max-w-md mx-auto ${inter.className}`}>
                Thank you for your interest in Vierra. We&apos;ve received your application and will review it shortly. Our team will get back to you within 24-48 hours.
              </p>
              <motion.button
                className="px-8 py-3 bg-[#701CC0] text-white rounded-lg font-medium shadow-[0px_4px_15.9px_0px_#701CC0B8] hover:bg-[#8F42FF] transform transition-all duration-300 hover:scale-105"
                onClick={onClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Close
              </motion.button>
            </motion.div>
          )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}