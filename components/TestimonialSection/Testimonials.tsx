"use client";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { useState } from "react";
import { motion } from "framer-motion";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

const testimonials = [
  {
    name: "Nowfal Ebrahim",
    role: "Invisalign",
    text: "Vierra has helped Invisalign by providing doctor referrals and increasing our presence in offices and our total revenue. Every month, we increase our contracts with Vierra and see higher profits.",
    image: "/assets/Testimonials/nowfal.jpg",
    companyLogo: "/assets/Testimonials/invisalign.png",
  },
  {
    name: "Deanna Mazzeo",
    role: "Somerville Dental Associates",
    text: "Our office had no online presence. Alex on Vierra has helped grow our Yelp and the number of new monthly patients we get, filling the annoying gaps in our schedule.",
    image: "/assets/Testimonials/nowfal.jpg",
    companyLogo: "/assets/Testimonials/somerville.png",
  },
  {
    name: "Zev Young",
    role: "Novartis",
    text: "Vierra's strategic marketing and business-oriented lead generation have enhanced our brand presence, optimized our outreach, and driven measurable growth.",
    image: "/assets/Testimonials/nowfal.jpg",
    companyLogo: "/assets/Testimonials/novartis.png",
  },
  {
    name: "Hannah Lowney",
    role: "Salon Renee",
    text: "Within just 3 months of Vierra handling my marketing, I saw more than triple the number of clients I used to get.",
    image: "/assets/Testimonials/nowfal.jpg",
    companyLogo: "/assets/Testimonials/renee.png",
  },
  {
    name: "Long Doan",
    role: "eCyberForce",
    text: "I struggled to get even a percentage of the leads my competitors were getting. After signing with Vierra, my leads have gone from roughly 20 to over 3000 in just a month.",
    image: "/assets/Testimonials/nowfal.jpg",
    companyLogo: "/assets/Testimonials/ecyberforce.png",
  },
  {
    name: "Dennis Zax",
    role: "ezML",
    text: "Vierra's marketing approach is simple, structured, and intentional. They have made a huge impact on my life and my small business, not to be so small in a few months from the growth I've been seeing!",
    image: "/assets/Testimonials/nowfal.jpg",
    companyLogo: "/assets/Testimonials/ezml.png",
  },
];

export function TestimonialsSection() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <section className="w-full min-h-screen bg-[#010205] text-white px-4 md:mt-40 relative overflow-hidden">
      <div className="hidden md:block absolute right-0 -top-0 w-[450px] h-[470px] bg-[#18042A] rounded-tl-[60px] rounded-bl-[60px] z-0" />

      <div className="relative max-w-[800px] mx-auto mt-20 md:mt-40 rounded-[30px] md:rounded-[60px] p-6 md:p-12 border-2 border-[#42345099] z-10 max-lg:mt-40">
        <div className="absolute -top-16 right-4 md:-right-[155px] md:-top-20 bg-[#701CC0] rounded-[30px] md:rounded-[60px] flex items-center justify-center w-[200px] md:w-[305px] h-[100px] md:h-[160px]">
          <Image
            src={testimonials[currentTestimonial].companyLogo}
            alt={testimonials[currentTestimonial].name}
            width={120}
            height={40}
            className="md:w-[180px] md:h-[60px] object-contain filter invert brightness-0" // Applied invert and brightness filter to make logo white
          />
        </div>

        <div className="hidden md:block absolute -top-40 right-0 w-[250px] h-[470px] opacity-25 blur-[10px] rotate-[83deg] rounded-full bg-gradient-to-t from-transparent to-[#701CC0] -z-10" />

        <div className="absolute bottom-4 right-4 md:-right-28 md:top-36">
          <div
            className="border-2 border-[#7A13D0] rounded-full p-2 md:p-4 cursor-pointer hover:bg-[#6610B2] transition-colors"
            onClick={nextTestimonial}
          >
            <ArrowRight size={24} />
          </div>
        </div>

        {/* Animated Testimonial */}
        <div className="my-4 md:my-6 mx-4 md:mx-20">
          <motion.div
            key={currentTestimonial} // Key is used to trigger the animation on testimonial change
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <div className="flex items-center gap-4 md:gap-6 mb-6 md:mb-8">
              <Image
                src={testimonials[currentTestimonial].image}
                alt={testimonials[currentTestimonial].name}
                width={100}
                height={100}
                quality={100}
                className="w-[60px] h-[60px] md:w-[80px] md:h-[80px] object-cover rounded-full"
              />
              <div>
                <h3
                  className={`${bricolage.className} text-xl md:text-2xl font-semibold`}
                >
                  {testimonials[currentTestimonial].name}
                </h3>
                <p
                  className={`${inter.className} text-sm md:text-base text-white/80`}
                >
                  {testimonials[currentTestimonial].role}
                </p>
              </div>
            </div>

            <p
              className={`${bricolage.className} md:text-3xl text-xl font-light md:leading-relaxed leading-relaxed`}
            >
              &ldquo;{testimonials[currentTestimonial].text}&rdquo;
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
