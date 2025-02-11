import React from "react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { ArrowUpRight } from "lucide-react";
import CheckItem from "./CheckItem";
import Footer from "./Footer";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

const checks = ["Free call USP", "Free call, second USP", "3rd Free call USP"];

export function FooterSection() {
  return (
    <>
      <div className="relative">
        <div className="mx-auto max-sm:my-6 max-w-[1300px] px-5 max-sm:py-10 md:pb-32">
          <div className="flex gap-5 max-md:flex-col bg-[#7A13D0] rounded-[60px] relative z-10">
            {/* Left Content */}
            <div className="flex flex-col w-[69%] max-md:w-full px-20 max-md:px-8 max-sm:px-5">
              <div className="flex flex-col items-start mt-20 max-md:mt-10 max-sm:text-center">
                <div
                  className={`${bricolage.className} text-5xl font-semibold tracking-wide text-white leading-[68px] max-md:text-4xl max-md:leading-[54px] max-sm:text-3xl max-sm:leading-10`}
                >
                  We invite you to try our innovative solutions tools.
                </div>

                <div
                  className={`${bricolage.className} mt-14 text-3xl font-light tracking-wide leading-none text-white opacity-80 max-md:text-2xl max-sm:text-xl`}
                >
                  Schedule an appointment with us and find out.
                </div>

                {/* Buttons */}
                <div
                  className={`flex gap-5 mt-28 max-md:mt-10 max-sm:flex-col max-sm:mx-auto ${inter.className}`}
                >
                  <button className="flex items-center justify-center gap-2 px-8 py-4 text-sm font-light tracking-wide text-[#7A13D0] bg-white border-2 border-white rounded-[70px] max-sm:w-full">
                    Book a meeting
                    <ArrowUpRight className="w-5 h-5" />
                  </button>
                  <button className="flex items-center justify-center gap-2 px-8 py-4 text-sm font-light tracking-wide text-white border-2 border-white rounded-[70px] max-sm:w-full">
                    Get in touch
                    <ArrowUpRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex flex-col w-[31%] max-md:w-full">
              <div className="px-16 py-20 h-full md:rounded-r-[60px] max-sm:rounded-b-[60px] bg-[#510B9463] max-md:px-8 max-md:py-10 max-md:mt-10">
                <div
                  className={`${bricolage.className} text-5xl font-bold tracking-tighter leading-tight text-white`}
                >
                  +10
                </div>
                <div
                  className={`${inter.className} mt-2 text-lg font-light tracking-normal leading-7 text-white text-opacity-80`}
                >
                  Creative business insights and analysis for free.
                </div>
                <div className="mt-10">
                  <div
                    className={`${bricolage.className} text-5xl font-medium tracking-tighter leading-tight text-white`}
                  >
                    +45
                  </div>
                  <div
                    className={`${inter.className} mt-2 text-lg font-light tracking-normal leading-7 text-white text-opacity-80`}
                  >
                    Satisfied clients served.
                  </div>
                </div>
                <div className={`${inter.className} mt-14`}>
                  {checks.map((text, index) => (
                    <CheckItem key={index} text={text} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative -mt-52">
          <Footer />
        </div>
      </div>
    </>
  );
}
