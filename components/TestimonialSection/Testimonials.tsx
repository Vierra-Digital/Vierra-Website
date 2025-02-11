"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { SectionTitle } from "../SectionTitle";
import { useState } from "react";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

const testimonials = [
  {
    name: "Brian Chesky",
    role: "CEO Airbnb",
    image: "/assets/Testimonials/brian-chesky.png",
    rating: 5,
    text: "With Vierra's tools we optimize all our marketing and communication tasks. The user-friendly interface offers a wide range of collaboration options.",
    companyLogo: "/assets/Testimonials/airbnb-logo.svg",
  },
  {
    name: "Elon Musk",
    role: "CEO Tesla & SpaceX",
    image: "/assets/Testimonials/elon-musk.jpg",
    rating: 4,
    text: "Vierra Digital's automation tools have significantly improved our ad performance and conversion rates across multiple platforms.",
    companyLogo: "/assets/Testimonials/tesla-logo.svg",
  },
];

export function TestimonialsSection() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <section className="w-full min-h-screen bg-[#010205] text-white px-4 relative overflow-hidden">
      <SectionTitle title="Testimonials" />

      <div className="hidden md:block absolute right-0 -top-0 w-[450px] h-[470px] bg-[#18042A] rounded-tl-[60px] rounded-bl-[60px] z-0" />

      <div className="relative max-w-[800px] mx-auto mt-20 md:mt-40 rounded-[30px] md:rounded-[60px] p-6 md:p-12 border-2 border-[#42345099] z-10 max-lg:mt-40">
        <div className="absolute -top-16 right-4 md:-right-[155px] md:-top-20 bg-[#701CC0] rounded-[30px] md:rounded-[60px] flex items-center justify-center w-[200px] md:w-[305px] h-[100px] md:h-[160px]">
          <Image
            src={testimonials[currentTestimonial].companyLogo}
            alt={testimonials[currentTestimonial].name}
            width={120}
            height={40}
            className="md:w-[180px] md:h-[60px]"
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

        <div className="my-4 md:my-6 mx-4 md:mx-20">
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

          <div className="flex gap-1 md:gap-2 mb-4 md:mb-6">
            {[...Array(testimonials[currentTestimonial].rating)].map(
              (_, index) => (
                <svg
                  key={index}
                  className="w-4 h-4 md:w-6 md:h-6 text-[#9AE856]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )
            )}
          </div>

          <p
            className={`${bricolage.className} md:text-3xl text-xl font-light md:leading-relaxed leading-relaxed`}
          >
            &ldquo;{testimonials[currentTestimonial].text}&rdquo;
          </p>
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
