"use client";
import { motion } from "framer-motion";
import ImageSection from "./ImageSection";
import { Play } from "lucide-react";

export function ImageComponent() {
  const imageSections = [
    {
      src: "/assets/cs/cs1.jpeg",
      alt: "Image for introduction section",
      className:
        "object-cover shrink-0 w-full rounded-[30px] md:rounded-[60px] h-[300px] md:h-[422px] md:w-[716px] lg:shadow-[20px_15px_100px_0px_#7A13D080]",
    },
    {
      src: "/assets/cs/cs2.jpeg",
      alt: "Image for first section",
      className:
        "object-cover shrink-0 w-full rounded-[30px] md:rounded-[60px] h-[269px] md:w-[269px]",
    },

    {
      src: "/assets/cs/cs3.jpeg",
      alt: "Image for second section",
      className:
        "object-cover shrink-0 w-full rounded-[30px] md:rounded-[60px] h-[296px] md:w-[470px]",
    },

    {
      src: "/assets/cs/cs4.jpeg",
      alt: "Image for third section",
      className:
        "object-cover shrink-0 w-full rounded-[30px] md:rounded-[60px] h-[391px] md:w-[280px]",
    },
  ];

  return (
    <div className="container mx-auto mb-10 px-4 md:px-0">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-8 md:gap-12 lg:gap-24 items-center justify-center">
          <div className="flex flex-col gap-8 md:gap-12 w-full lg:w-auto">
            <div
              className="relative flex flex-col items-end w-full"
              tabIndex={0}
              role="img"
              aria-label={imageSections[0].alt}
            >
              <ImageSection {...imageSections[0]} />
              {/* Play Button Overlay */}
              <div className="absolute -top-[30px] left-[75px] w-[170px] h-[170px] flex items-center justify-center">
                {/* Rotating Rings */}
                {[...Array(2)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="max-md:hidden absolute inset-0 flex items-center justify-center border-[1px] border-[#7A13D0] opacity-50 rounded-full"
                    style={{
                      width: "170px",
                      height: "170px",
                    }}
                    animate={{
                      rotate: 360,
                      scale: [1 + i * 0.1, 1.1 + i * 0.1],
                    }}
                    transition={{
                      duration: 1 + i * 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                ))}

                {/* Main Circle with Gradient */}
                <div
                  className="max-md:hidden relative w-[138px] h-[138px] flex items-center justify-center rounded-full"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(112, 28, 192, 0.32) 99.99%, rgba(112, 28, 192, 0) 100%)",
                    backdropFilter: "blur(20px)",

                    boxShadow: "10px 40px 100px 0px #000000CC",
                  }}
                >
                  {/* Play Icon */}
                  <Play size={30} fill="white" />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-8 md:gap-12 lg:gap-28 w-full h-auto lg:h-[356px]">
              <div
                className="flex flex-col w-full sm:w-1/2 lg:w-auto"
                tabIndex={0}
                role="img"
                aria-label={imageSections[1].alt}
              >
                <ImageSection {...imageSections[1]} />
              </div>
              <div
                className="flex flex-col w-full sm:w-1/2 lg:w-auto"
                tabIndex={0}
                role="img"
                aria-label={imageSections[2].alt}
              >
                <ImageSection {...imageSections[2]} />
              </div>
            </div>
          </div>
          <div
            className="flex flex-col w-full lg:w-auto"
            tabIndex={0}
            role="img"
            aria-label={imageSections[3].alt}
          >
            <ImageSection {...imageSections[3]} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImageComponent;
