import React from "react";

interface CheckItemProps {
  text: string;
}

const CheckItem: React.FC<CheckItemProps> = ({ text }) => (
  <div className="flex gap-3 items-center mb-4">
    <div className="flex justify-center items-center w-5 h-5 bg-white rounded-full">
      <img
        src="https://cdn.builder.io/api/v1/image/assets/4761759a8de24e7fbb9391230f41b265/829b06f31f8f2175155ef988f5e33c2d0dd29b2c71ef652503c799af8dceb9f4?apiKey=4761759a8de24e7fbb9391230f41b265&"
        alt="check"
      />
    </div>
    <div className="text-lg tracking-normal leading-none text-white">
      {text}
    </div>
  </div>
);

export default CheckItem;
