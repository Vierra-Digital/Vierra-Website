import { Check } from "lucide-react";
import React from "react";

interface CheckItemProps {
  text: string;
}

const CheckItem: React.FC<CheckItemProps> = ({ text }) => (
  <div className="flex gap-3 items-center mb-4">
    <div className="flex justify-center items-center w-5 h-5 bg-white rounded-full">
      <Check className="w-4 h-4 text-[#7A13D0]" />
    </div>
    <div className="text-lg tracking-normal leading-none text-white">
      {text}
    </div>
  </div>
);

export default CheckItem;
