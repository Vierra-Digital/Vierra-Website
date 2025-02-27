import { TrendingUp, ArrowRight } from "lucide-react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

export function StatsGrid() {
  // content sets for card-4
  const card4Content = [
    {
      number: "13M+",
      text: "leads generated. We drive leads to your practice.",
    },
    {
      number: "$687K",
      text: "ad spent. We maximize every dollar of your marketing budget.",
    },
    {
      number: "28+",
      text: "clients helped. We prioritize your business like our own.",
    },
  ];

  // State to track the current content index
  const [contentIndex, setContentIndex] = useState(0);

  // Automatic rotation every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setContentIndex((prevIndex) => (prevIndex + 1) % card4Content.length);
    }, 5000);

    return () => clearInterval(interval); // Cleanup on unmount
  }, [contentIndex, card4Content.length]);

  // Function to handle button click and cycle through content
  const handleContentSwap = () => {
    setContentIndex((prevIndex) => (prevIndex + 1) % card4Content.length);
  };

  // Get current content
  const currentContent = card4Content[contentIndex];

  return (
    <div className="flex flex-col mx-auto my-0 items-center max-w-[1200px] z-10 relative">
      <div className="absolute w-[893px] h-[510px] rounded-[60px] top-[50px] left-1/4 bg-[#4F14881A] max-md:hidden -z-10" />
      <div className="flex gap-20 mb-14 items-end max-md:flex-col max-md:items-center max-md:gap-4  max-md:mb-4">
        {/* Card-1 */}
        <div className="flex flex-col w-[350px] h-[231px] bg-[#701CC0] rounded-[60px] max-md:w-[300px] max-md:h-[250px] max-md:px-5 max-md:py-10 max-sm:w-[260px] max-sm:h-[200px] max-sm:px-8 max-sm:py-8 max-sm:rounded-[30px] relative hover:scale-105 transition-transform duration-300 ease-in-out">
          <div className="flex flex-col mx-8 my-8 w-[204px] h-[124px] max-md:mx-0 max-md:my-0 max-md:h-auto max-md:w-full">
            <div
              className={`text-7xl font-extrabold leading-none text-white max-md:text-4xl ${bricolage.className}`}
            >
              258%
            </div>
            <div
              className={`mt-4 font-light leading-6 text-[#ECF2FDCC] max-sm:text-sm max-sm:leading-5 ${inter.className}`}
            >
              investment conversion. The average ROI for each practice helped.
            </div>
          </div>

          {/* Floating Trending Up Icon */}
          <div className="absolute top-1/2 right-[-30px] transform -translate-y-1/2 w-[60px] h-[60px] md:w-[108px] md:h-[108px] bg-[#010205] shadow-[0px_30.08px_50.58px_-6.84px_#701CC0] rounded-full flex items-center justify-center">
            <TrendingUp className="w-6 h-6 md:w-12 md:h-12 text-white" />
          </div>
        </div>

        {/* Card-2 */}
        <div className="flex flex-col w-[409px] h-[338px] bg-[#010205] rounded-[60px] max-md:w-[300px] max-md:h-[250px] max-md:px-5 max-md:py-10 max-sm:w-[260px] max-sm:h-[200px] max-sm:px-8 max-sm:py-8 max-sm:rounded-[30px] hover:scale-105 transition-transform duration-300 ease-in-out">
          <div className="flex flex-col mx-12 my-12 w-[310px] h-[219px] max-md:mx-0 max-md:my-0 max-md:h-auto max-md:w-full">
            <div
              className={`text-7xl font-extrabold leading-none text-white max-md:text-4xl ${bricolage.className}`}
            >
              <span className="font-extrabold text-[#701CC0]">$</span>
              5.9M
            </div>
            <div
              className={`mt-8 font-light leading-6 text-[#9BAFC3] max-sm:text-sm max-sm:leading-5 ${inter.className}`}
            >
              profits raised. The total amount of profit generated for our
              partners.
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-16 items-center max-md:flex-col max-md:gap-4">
        {/* Card-3 Business Growth */}
        <div className="px-10 py-10 w-[687px] h-[283px] bg-[#010205] rounded-[60px] max-md:w-[300px] max-md:h-[250px] max-md:px-5 max-md:py-10 max-sm:w-[260px] max-sm:h-[200px] max-sm:px-8 max-sm:py-8 max-sm:rounded-[30px] overflow-hidden relative z-10 hover:scale-105 transition-transform duration-300 ease-in-out">
          {/* Ellipse Purple gradient effects */}
          <div className="absolute top-[2px] left-[50] w-[285px] h-[285px] opacity-80 blur-[50px] rotate-[60deg] rounded-full bg-gradient-to-t from-[#18042A] to-[#701CC0] -z-10 max-md:hidden" />
          <div
            className={`text-5xl tracking-tight leading-none text-white max-md:text-2xl ${bricolage.className}`}
          >
            <span>Scale Your Enterprise</span>
          </div>

          {/* Graph SVG Container */}
          <div className="relative w-full h-full">
            {/* First Graph Line (Purple) */}
            <svg
              className="absolute top-[3px] left-[150px] w-[494px] h-[192px] max-md:w-[217px] max-md:h-[84px] max-md:top-[86px] max-md:left-[63px] max-sm:w-[160px] max-sm:h-[100px] max-sm:top-[52px] max-sm:left-[68px]"
              viewBox="0 0 494 192"
              fill="none"
            >
              <path
                d="M2 197.753C2 197.753 87.0628 51.3311 106.103 43.5771C125.143 35.8231 154.297 147.99 185.417 145.749C216.538 143.508 241.305 102.858 262.253 95.0195C283.201 87.181 305.148 155.589 340.328 171.701C375.509 187.813 405.98 27.1956 422.206 13.6668C444.378 -25.043 494 43.5771 494 43.5771"
                stroke="#701CC0"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>

            {/* Second Graph Line (White) */}
            <svg
              className="absolute top-[59px] left-[218px] w-[427px] h-[136px] max-md:w-[200px] max-md:h-[80px] max-md:top-[96px] max-md:left-[77px] max-sm:w-[160px] max-sm:h-[100px] max-sm:top-[59px] max-sm:left-[68px]"
              viewBox="0 0 427 136"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 138.739C2 138.739 18.2855 129.95 71.3182 86.8338C124.351 43.7175 126.821 2.09479 144.045 2.09479C161.27 2.09479 188.851 72.6125 214.5 72.6125C240.149 72.6125 244.843 28.2965 286.091 34.3125C327.339 40.3286 335.345 81.7308 355.409 93.1642C375.474 104.598 427 48.5492 427 48.5492"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card-4 */}
        <div className="flex flex-col w-[328px] h-[319px] bg-[#701CC0] rounded-[60px] max-md:w-[300px] max-md:h-[300px] max-md:px-5 max-md:py-10 max-sm:w-[260px] max-sm:h-[250px] max-sm:px-8 max-sm:py-8 max-sm:rounded-[30px] hover:scale-105 transition-transform duration-300 ease-in-out">
          <div className="flex flex-col mx-12 my-8 w-[250px] max-md:mx-4 max-md:my-4 max-md:h-auto max-md:w-full max-sm:mx-2">
            <div
              className={`text-7xl font-extrabold leading-none text-white max-md:text-4xl max-sm:text-3xl ${bricolage.className}`}
            >
              {currentContent.number}
            </div>
            <div className="flex items-center justify-between mt-8 max-md:mt-6 max-sm:mt-4">
              <div
                className={`text-base font-light leading-6 max-w-[200px] max-md:max-w-[160px] max-sm:max-w-[140px] text-[#ECF2FDCC] max-sm:text-sm max-sm:leading-5 ${inter.className}`}
              >
                {currentContent.text}
              </div>
              <button
                className="flex items-center justify-center min-w-[56px] w-14 h-14 max-md:w-12 max-md:h-12 max-sm:w-10 max-sm:h-10 rounded-full bg-[#4F1488] hover:bg-[#18042A] ml-4 max-sm:ml-2 transform transition-all duration-300 hover:scale-105"
                onClick={handleContentSwap}
              >
                <ArrowRight className="w-6 h-6 max-md:w-5 max-md:h-5 max-sm:w-4 max-sm:h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mx-12 mt-auto mb-8 max-md:mx-6 max-sm:mx-4 max-md:mb-6 max-sm:mb-4">
            <div className="h-1 w-full bg-[rgba(255,255,255,0.2)]">
              <motion.div
                className="h-1 bg-white"
                key={contentIndex}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 5, ease: "linear" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
