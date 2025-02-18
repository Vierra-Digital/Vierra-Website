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
  );
};

export default GridComponent;
