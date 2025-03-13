import { Bricolage_Grotesque, Figtree } from "next/font/google";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

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
  // Start with -1 so no steps are initially visible
  const [activeStep, setActiveStep] = useState(-1);

  // Set up scroll tracking (desktop only)
  useEffect(() => {
    // Only run on larger screens
    if (window.innerWidth < 1024) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const timelineSection = document.getElementById("timeline-section");

      if (!timelineSection) return;

      const sectionTop = timelineSection.offsetTop;
      const sectionHeight = timelineSection.offsetHeight;

      // Calculate which step should be active based on scroll position
      if (
        scrollPosition >= sectionTop &&
        scrollPosition < sectionTop + sectionHeight
      ) {
        // Calculate progress through the section (0 to 1)
        const progress =
          (scrollPosition - sectionTop) / (sectionHeight - window.innerHeight);
        // Map progress to step index (-1 to 3)
        // We start from -1 so even the first step needs scrolling to appear
        const stepIndex = Math.min(3, Math.floor(progress * 5) - 1);
        setActiveStep(Math.max(-1, stepIndex)); // Don't go below -1
      }
    };

    window.addEventListener("scroll", handleScroll);

    // Trigger initial check
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Desktop version with sticky scroll behavior */}
      <div
        id="timeline-section"
        className="hidden lg:block relative h-[200vh]" // Tall container for desktop only
      >
        <div className="bg-[#010205] text-white py-16 mx-10 px-20 rounded-[80px] sticky top-0 h-[100vh] flex flex-col justify-center">
          <h2
            className={`${bricolage.className} text-5xl font-normal text-start mb-16`}
          >
            How Does It Work?
          </h2>

          {/* Desktop Layout */}
          <div className="h-[50vh] flex relative w-full justify-between items-center">
            {/* Horizontal Line */}
            <div className="absolute top-1/2 left-0 right-0 h-4 bg-[#3E1F58] z-0" />

            {/* Steps */}
            {steps.map((step, index) => (
              <div key={index} className="relative w-1/4 text-center">
                {/* Text */}
                <div
                  className={`absolute min-w-[25vw] w-full ${
                    index % 2 === 0 ? "-top-36" : "top-24"
                  } flex flex-row items-center gap-4 px-2 ${figtree.className}`}
                >
                  <motion.span
                    className="text-6xl font-bold text-white"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{
                      opacity: activeStep >= index ? 1 : 0,
                      scale: activeStep >= index ? 1 : 0.5,
                    }}
                    transition={{
                      duration: 0.8,
                      type: "spring",
                      stiffness: 100,
                    }}
                  >
                    {step.number}
                  </motion.span>
                  <motion.p
                    className="text-gray-200 text-lg max-w-[280px] leading-tight"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: activeStep >= index ? 1 : 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.2,
                    }}
                  >
                    {step.text}
                  </motion.p>
                </div>

                {/* Circle Indicator */}
                <motion.div
                  className="relative z-10 w-12 h-12 bg-[#7A13D0] left-[9.7rem] rounded-full flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: activeStep >= index ? 1 : 0,
                    scale: activeStep >= index ? 1 : 0,
                  }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="w-8 h-8 bg-[#010205] rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-[#FFFFFF] rounded-full" />
                  </div>
                </motion.div>

                {/* Vertical Line */}
                {index % 2 === 1 && (
                  <motion.div
                    className="absolute top-[2.8rem] left-[11rem] -translate-x-1/4 w-2 bg-[#7A13D0]"
                    initial={{ height: 0 }}
                    animate={{ height: activeStep >= index ? "2.5rem" : 0 }}
                    transition={{ duration: 0.5 }}
                  />
                )}
                {index % 2 === 0 && (
                  <motion.div
                    className="absolute bottom-[2.8rem] left-[11rem] -translate-x-1/4 w-2 bg-[#7A13D0]"
                    initial={{ height: 0 }}
                    animate={{ height: activeStep >= index ? "2.5rem" : 0 }}
                    transition={{ duration: 0.5 }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile version - completely separate implementation */}
      <div className="lg:hidden bg-[#010205] text-white py-16 mx-2 md:mx-10 px-4 md:px-20 rounded-[40px] md:rounded-[80px]">
        <h2
          className={`${bricolage.className} text-4xl font-normal text-start mb-16`}
        >
          How Does It Work?
        </h2>

        <div className="flex flex-col items-center relative w-full">
          {/* Vertical Line */}
          <div className="absolute left-1/2 -translate-x-1/2 w-2 h-full bg-[#3E1F58] z-0" />

          {/* Steps (Stacked) */}
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="relative flex flex-col items-center w-full mb-12 last:mb-0"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              viewport={{ once: true }}
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
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
};

export default Timeline;
