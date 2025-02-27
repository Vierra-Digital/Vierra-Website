import React from "react";
import { Bricolage_Grotesque, Inter, Figtree } from "next/font/google";
import { ArrowUpRight } from "lucide-react";
import CheckItem from "./CheckItem";
import Footer from "./Footer";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });
const figtree = Figtree({ subsets: ["latin"] });

const checks = ["Problem & Definition", "LTV Evaluation", "Obtain Leads"];

export function FooterSection() {
  return (
    <>
      {/* <div className="mx-auto max-sm:my-6 max-w-[1300px] pt-32 px-5 max-sm:py-10 md:pb-32"> */}
      <div className="mx-auto max-sm:my-6 max-w-full pt-32 md:px-32 max-sm:py-10 md:pb-32">
        <div className="flex gap-5 max-md:flex-col bg-[#7A13D0] rounded-[60px] relative z-10">
          {/* Left Content */}
          <div className="flex flex-col w-[69%] max-md:w-full px-20 max-md:px-8 max-sm:px-5">
            <div className="flex flex-col items-start mt-20 max-md:mt-10 max-sm:text-center">
              <div
                className={`${bricolage.className} text-5xl font-semibold tracking-wide text-white leading-[68px] max-md:text-4xl max-md:leading-[54px] max-sm:text-3xl max-sm:leading-10`}
              >
                Want To Explode Profits? See How Vierra Can Help.
              </div>

              <div
                className={`${bricolage.className} mt-14 text-3xl font-light tracking-wide leading-none text-white opacity-80 max-md:text-2xl max-sm:text-xl`}
              >
                Obtain a free demo call. Discover how you can elevate your
                business in 15 minutes.
              </div>

              {/* Buttons */}
              <div
                className={`flex gap-5 mt-28 max-md:mt-10 max-sm:flex-col max-sm:mx-auto ${inter.className}`}
              >
                <button className="flex items-center justify-center gap-2 px-8 py-4 text-sm font-bold tracking-wide text-[#7A13D0] bg-white border-2 border-white rounded-[70px] transform transition-transform duration-300 hover:scale-105 max-sm:w-full">
                  Free Audit Call
                  <ArrowUpRight className="w-5 h-5" />
                </button>
                <button className="flex items-center justify-center gap-2 px-8 py-4 text-sm font-bold tracking-wide text-white border-2 border-white rounded-[70px] transform transition-transform duration-300 hover:scale-105 max-sm:w-full">
                  Can&apos;t Decide Yet?
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
                &lt; 15
              </div>
              <div
                className={`${inter.className} mt-2 text-lg font-light tracking-normal leading-7 text-white text-opacity-80`}
              >
                Free expert-level business advice in less than 15 min.
              </div>
              <div className="mt-10">
                <div
                  className={`${bricolage.className} text-5xl font-medium tracking-tighter leading-tight text-white`}
                >
                  +38
                </div>
                <div
                  className={`${inter.className} mt-2 text-lg font-light tracking-normal leading-7 text-white text-opacity-80`}
                >
                  Get on our waitlist.
                </div>
              </div>
              <div className={`${figtree.className} mt-14`}>
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
    </>
  );
}
