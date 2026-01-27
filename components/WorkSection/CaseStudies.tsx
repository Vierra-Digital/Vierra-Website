"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowUpRight, Play } from "lucide-react"
import { Bricolage_Grotesque, Inter } from "next/font/google"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

export function CaseStudies() {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const videoId = "ZK-rNEhJIDs"
  const videoSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1`
  const videoPoster = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

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
              businesses and refined a one-service and results-based approach.
              Learn more about drawing in more leads from a team that helped
              scale over $5 million in profits. Obtain free business strategies
              from the most current professionals in the field.
            </p>
            <div className="flex gap-4 flex-wrap">
              <Link href="/blog" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  className={`${inter.className} bg-[#701CC0] text-white md:px-8 py-4 md:py-6 rounded-full hover:bg-purple-700 transition-all transform duration-300 hover:scale-105 group w-full sm:w-auto shadow-[0px_4px_15.9px_0px_#701CC0CC]`}
                >
                  <span>Free Case Study</span>
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/blog" className="w-full sm:w-auto">
                <Button
                  className={`${inter.className} border-2 border-[#7A13D0] bg-transparent text-white md:px-8 py-4 md:py-6 rounded-full hover:bg-transparent transform transition-transform duration-300 hover:scale-105 will-change-transform w-full sm:w-auto shadow-[0px_4px_15.9px_0px_#701CC061]`}
                >
                  <span>Exclusive Study</span>
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto mb-10 px-4 md:px-16">
        <div className="max-w-full mx-auto flex justify-center items-center">
          <div className="w-full h-[670px] rounded-[50px] max-sm:rounded-3xl overflow-hidden lg:shadow-[20px_15px_100px_0px_#7A13D080] bg-black">
            {isVideoLoaded ? (
              <iframe
                width="100%"
                height="100%"
                src={videoSrc}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full"
              />
            ) : (
              <button
                type="button"
                className="relative w-full h-full group"
                onClick={() => setIsVideoLoaded(true)}
                aria-label="Play case study video"
              >
                <Image
                  src={videoPoster}
                  alt="Case study video preview"
                  fill
                  sizes="(max-width: 768px) 100vw, 1200px"
                  priority={false}
                  className="object-cover"
                />
                <span className="absolute inset-0 bg-black/30 transition-colors duration-300 group-hover:bg-black/40" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center justify-center w-20 h-20 rounded-full bg-white/90 text-black shadow-lg transition-transform duration-300 group-hover:scale-105">
                    <Play className="w-8 h-8 ml-1" />
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CaseStudies
