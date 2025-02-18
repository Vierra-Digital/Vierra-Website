import Image from "next/image";
import React from "react";

const gridLayout = [
  [false, false, true, false, false, false],
  [true, false, false, true, true, false],
  [false, true, true, true, false, true],
  [true, false, false, true, false, false],
  [false, false, true, true, true, false],
  [false, true, false, false, false, false],
];

const imagesMap = {
  "3-0": "/assets/Socials/Facebook.png",
  "1-4": "/assets/Socials/GoogleAnalytics.png",
  "2-2": "/assets/Socials/Instagram.png",
  "2-5": "/assets/Socials/SEO.png",
  "4-2": "/assets/Socials/LinkedIn.png",
  "4-4": "/assets/Socials/Email.png",
};

const GridComponent = () => {
  return (
    <div className="relative" style={{ width: "fit-content" }}>
      {/* SVG layer for connections */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{
          minWidth: "100%",
          minHeight: "100%",
        }}
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 600 600"
      >
        <defs>
          <linearGradient
            id="instagramToFacebook"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0.43%" stopColor="#F50478" />
            <stop offset="96.7%" stopColor="#1877F2" />
          </linearGradient>
          <linearGradient
            id="instagramToLinkedIn"
            x1="0"
            y1="295"
            x2="0"
            y2="410"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#C10CB6" />
            <stop offset="100%" stopColor="#007EBB" />
          </linearGradient>
          <linearGradient
            id="googleAnalyticsToSeo"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="2.84%" stopColor="#FFC600" />
            <stop offset="65.97%" stopColor="#E93948" />
          </linearGradient>
          <linearGradient
            id="googleAnalyticsToEmail"
            x1="0"
            y1="189"
            x2="0"
            y2="410"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#F77E00" />
            <stop offset="62.81%" stopColor="#E52226" />
          </linearGradient>
        </defs>

        {/* Facebook to Instagram */}
        <path
          d="M240,295 L240,340 C240,348 232,355 224,355 L95,355"
          stroke="url(#instagramToFacebook)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          className="opacity-70"
        />
        {/* Instagram to LinkedIn */}
        <path
          d="M250,295 L250,410"
          stroke="url(#instagramToLinkedIn)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          className="opacity-70"
        />
        {/* Google Analytics to Email */}
        <path
          d="M450,189 L450,410"
          stroke="url(#googleAnalyticsToEmail)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          className="opacity-70"
        />
        {/* Google Analytics to SEO */}
        <path
          d="M460,189 L460,240 C460,248 468,255 476,255 L505,255"
          stroke="url(#googleAnalyticsToSeo)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-70"
        />
      </svg>

      <div
        className="grid grid-cols-6 gap-x-2 gap-y-3 mx-auto"
        style={{ width: "fit-content" }}
      >
        {gridLayout.map((row, rowIndex) =>
          row.map((isFilled, colIndex) => {
            const key = `${rowIndex}-${colIndex}`;
            return (
              <div
                key={key}
                className="w-[45px] h-[45px] sm:w-[55px] sm:h-[55px] md:w-[80px] md:h-[80px] flex items-center justify-center"
              >
                {isFilled ? (
                  <div
                    className={`w-full h-full flex items-center justify-center ${
                      imagesMap[key as keyof typeof imagesMap]
                        ? "bg-white rounded-lg shadow-md"
                        : "border border-[#D9DEDD] rounded-lg"
                    }`}
                  >
                    {imagesMap[key as keyof typeof imagesMap] ? (
                      <Image
                        src={imagesMap[key as keyof typeof imagesMap]}
                        alt="Icon"
                        className="w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] object-contain"
                        width={57}
                        height={57}
                      />
                    ) : (
                      <div className="w-[30px] h-[30px] sm:w-[40px] sm:h-[40px] md:w-[57px] md:h-[57px] rounded-full border border-[#D9DEDD]" />
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GridComponent;
