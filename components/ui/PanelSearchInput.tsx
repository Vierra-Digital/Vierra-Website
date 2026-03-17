import React from "react";
import { FiSearch } from "react-icons/fi";

type PanelSearchInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  widthClassName?: string;
};

const PanelSearchInput: React.FC<PanelSearchInputProps> = ({
  id,
  value,
  onChange,
  placeholder = "Search",
  label = "Search",
  widthClassName = "w-64 md:w-80",
}) => {
  return (
    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-transparent focus-within:ring-2 focus-within:ring-[#701CC0] transition">
      <FiSearch className="w-4 h-4 text-[#701CC0] flex-shrink-0" />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${widthClassName} text-sm text-[#111827] placeholder:text-[#9CA3AF] bg-transparent outline-none`}
      />
    </div>
  );
};

export default PanelSearchInput;
