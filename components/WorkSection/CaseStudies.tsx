import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "../SectionTitle";
import { ArrowUpRight } from "lucide-react";
import { ImageComponent } from "./ImageComponent";
import { Bricolage_Grotesque, Inter } from "next/font/google";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

export function CaseStudies() {
  return (
    <>
      <SectionTitle title="Our work" />
      <div className="mt-16 md:mt-32 md:px-20" id="cases">
        {/* Header Section */}
        <div className="relative mb-8 md:mb-16">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-3 items-start lg:items-center max-w-[1200px] max-md:px-2 my-0 mx-auto">
            <h2
              className={`${bricolage.className} text-4xl md:text-6xl lg:text-[96px] leading-tight font-medium text-white lg:pr-24`}
            >
              Case studies<span className="text-[#7A13D0]">.</span>
            </h2>

            <div className="w-full lg:w-[583px] h-auto lg:h-[200px]">
              <p
                className={`${inter.className} text-white/60 mt-4 lg:mt-6 mb-6 lg:mb-8 text-base font-extralight`}
              >
                Our comprehensive tools offers small business owners a
                one-stop-shop solution to manage their accounting, sales,
                marketing, outreach efforts, CRM, financial models, email
                campaigns, QuickBooks integration, record-keeping, and a range
                of other crucial business functions.
              </p>

              <Button
                variant="ghost"
                className={`${bricolage.className} bg-[#701CC0] text-white px-6 md:px-8 py-4 md:py-6 rounded-full 
              hover:bg-purple-700 transition-colors group w-full sm:w-auto`}
              >
                <span>All cases</span>

                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Grid Section */}
        <ImageComponent />
      </div>
    </>
  );
}
