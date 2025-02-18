import Image from "next/image";
import React from "react";

interface CheckItemProps {
  text: string;
}

const CheckItem: React.FC<CheckItemProps> = ({ text }) => (
  <div className="flex gap-3 items-center mb-4">
    <Image src="/assets/V.png" alt="Check" width={25} height={25} />
    <div className="text-lg tracking-normal leading-none text-white">
      {text}
    </div>
  </div>
);

export default CheckItem;
