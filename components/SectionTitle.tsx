import { Bricolage_Grotesque } from "next/font/google";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });

interface SectionTitleProps {
  title: string;
}

export function SectionTitle({ title }: SectionTitleProps) {
  return (
    <div className="relative">
      {/* Blur Ellipse */}
      <div className="absolute w-[95px] h-[95px] opacity-80 blur-[10px] rotate-[-90deg] rounded-full bg-gradient-to-t from-[#010205] to-[#701CC0] top-[5px] left-[250px] -translate-x-10 -translate-y-10" />

      {/* Section Label */}
      <div className="relative mt-[88px] ml-[218px] mb-20">
        <span
          className={`text-[18px] text-white font-normal ${bricolage.className}`}
        >
          {title}
        </span>
      </div>
    </div>
  );
}
