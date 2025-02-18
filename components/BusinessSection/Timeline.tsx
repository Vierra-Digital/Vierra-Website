import { Bricolage_Grotesque, Figtree } from "next/font/google";
import React from "react";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const figtree = Figtree({ subsets: ["latin"] });

const steps = [
  {
    number: 1,
    text: "Free evaluation call. We'll provide feedback on what to improve and see if you're a good fit to work with us.",
  },
  {
    number: 2,
    text: "We'll onboard you. A full-scale breakdown of improvements, campaigns, and plans will be brought to your attention.",
  },
  {
    number: 3,
    text: "Leads will be generated. Campaigns will run, and you'll see an influx of patients signing up for your practice.",
  },
  {
    number: 4,
    text: "Rinse and repeat. Our team will improve organic outreach and raise revenue, doubling your MRR.",
  },
];

const Timeline = () => {
  return (
    <div className="bg-[#010205] text-white py-16 mx-2 sm:mx-10 px-4 sm:px-20 rounded-[40px] sm:rounded-[80px]">
      <h2
        className={`${bricolage.className} text-4xl sm:text-5xl font-normal text-start mb-16 sm:mb-24`}
      >
        How Does It Work?
      </h2>

      {/* Desktop Layout */}
      <div className="h-[50vh] hidden sm:flex relative w-full justify-between items-center">
        {/* Horizontal Line */}
        <div className="absolute top-1/2 left-0 right-0 h-4 bg-[#3E1F58] z-0" />

        {/* Steps */}
        {steps.map((step, index) => (
          <div key={index} className="relative w-1/4 text-center">
            {/* Text */}
            <div
              className={`absolute w-full ${
                index % 2 === 0 ? "-top-36" : "top-24"
              } flex flex-row items-center gap-4 px-2 ${figtree.className}`}
            >
              <span className="text-6xl font-bold text-white">
                {step.number}
              </span>
              <p className="text-gray-200 text-lg max-w-[280px] leading-tight">
                {step.text}
              </p>
            </div>

            {/* Circle Indicator */}
            <div className="relative z-10 w-12 h-12 bg-[#7A13D0] left-1/2 -translate-x-1/2 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 bg-[#010205] rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-[#FFFFFF] rounded-full" />
              </div>
            </div>

            {/* Vertical Line */}
            {index % 2 === 1 && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 h-14 w-2 bg-[#7A13D0]" />
            )}
            {index % 2 === 0 && (
              <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 h-14 w-2 bg-[#7A13D0]" />
            )}
          </div>
        ))}
      </div>

      {/* Mobile Layout */}
      <div className="flex sm:hidden flex-col items-center relative w-full">
        {/* Vertical Line */}
        <div className="absolute left-1/2 -translate-x-1/2 w-2 h-full bg-[#3E1F58] z-0" />

        {/* Steps (Stacked) */}
        {steps.map((step, index) => (
          <div
            key={index}
            className="relative flex flex-col items-center w-full mb-12 last:mb-0"
          >
            {/* Circle Indicator */}
            <div className="relative z-10 w-12 h-12 bg-[#7A13D0] rounded-full flex items-center justify-center">
              <div className="w-8 h-8 bg-[#010205] rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-[#FFFFFF] rounded-full" />
              </div>
            </div>

            {/* Text with Gradient Background */}
            <div className="text-center mt-6 px-6 relative z-10">
              <span className="text-5xl font-bold text-white">
                {step.number}
              </span>
              <p className="text-gray-200 text-base leading-tight mt-2 bg-gradient-to-b from-[#010205] to-[#3E1F58] p-4 rounded-lg">
                {step.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;
