import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Image from "next/image";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

export function CaseStudies() {
  return (
    <div className="mt-16 md:mt-32 md:px-20" id="cases">
      <div className="mb-8 md:mb-24">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-3 items-start lg:items-center max-w-[1200px] mx-auto px-2">
          <h2
            className={`${bricolage.className} text-4xl md:text-6xl lg:text-[96px] leading-tight font-semibold text-white lg:pr-24`}
          >
            Why It Works
          </h2>

          <div className="w-full lg:w-[583px]">
            <p
              className={`${inter.className} text-white mt-4 lg:mt-6 mb-6 lg:mb-8 text-base font-extralight`}
            >
              There&apos;s a pristine methodology to our process, what we do
              works because we&apos;ve tested our strategies on thousands of
              practices and refined a one-service and results-based approach.
              Learn more about drawing in more patients from a team that&apos;s
              helped scale over $5 million in profits. Obtain free business
              strategies from the most current professionals in the field.
            </p>

            <div className="flex gap-4 flex-wrap">
              <Button
                variant="ghost"
                className={`${inter.className} bg-[#701CC0] text-white md:px-8 py-4 md:py-6 rounded-full hover:bg-purple-700 transition-all transform duration-300 hover:scale-105 group w-full sm:w-auto shadow-[0px_4px_15.9px_0px_#701CC0CC]`}
              >
                <span>Free Case Study</span>
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>

              <Button
                className={`${inter.className} border-2 border-[#7A13D0] bg-transparent text-white md:px-8 py-4 md:py-6 rounded-full hover:bg-transparent transform transition-transform duration-300 hover:scale-105 will-change-transform w-full sm:w-auto shadow-[0px_4px_15.9px_0px_#701CC061]`}
              >
                <span>Exclusive Study</span>
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Section */}
      <div className="container mx-auto mb-10 px-4 md:px-16">
        <div className="max-w-full mx-auto flex justify-center items-center">
          <Image
            src="/assets/cs.jpeg"
            alt="Case Study Team"
            width={1136}
            height={670}
            quality={100}
            className="object-cover shrink-0 w-full rounded-[95px] max-sm:rounded-3xl h-[670px] lg:shadow-[20px_15px_100px_0px_#7A13D080]"
          />
        </div>
      </div>
    </div>
  );
}

export default CaseStudies;
