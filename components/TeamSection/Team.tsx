import Image from "next/image";
import { Bricolage_Grotesque, Inter } from "next/font/google";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

export default function TeamSection() {
  const team = [
    {
      name: "Alex Shick",
      role: "Chief Executive Officer",
      image: "/assets/Team/Alex2.png",
    },
    {
      name: "Paul Wahba",
      role: "Chief Operating Officer",
      image: "/assets/Team/Paul2.png",
    },
    {
      name: "Sienna Coffey",
      role: "Chief Law Officer",
      image: "/assets/Team/Sienna2.png",
    },
    {
      name: "Sean Penix",
      role: "Sales Manager",
      image: "/assets/Team/Sean2.png",
    },
    {
      name: "Justin Waller",
      role: "Manufacturing Manager",
      image: "/assets/Team/Justin2.png",
    },
    {
      name: "Kanika Khosla",
      role: "Outreach Team",
      image: "/assets/Team/Kanika2.png",
    },
  ];

  return (
    <div className="min-h-screen bg-[#010205] relative p-8 md:p-16" id="about">
      <div className="max-w-7xl mx-auto">
        <h1
          className={`${bricolage.className} text-white text-6xl md:text-7xl font-bold mb-16 md:ml-8`}
        >
          Our Team<span className="text-[#7A13D0]">.</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-24">
          {team.map((member, index) => {
            return (
              <div
                key={member.name}
                className="group flex flex-col items-center"
              >
                <div className="relative w-[319px] h-[319px]">
                  {/* Top-left corner (first image) */}
                  {index === 0 && (
                    <div className="hidden md:block absolute -top-[55px] -left-[60px] w-[171px] h-[171px] bg-[#18042A] rounded-[40px]" />
                  )}
                  {/* Top-right corner (third image) */}
                  {index === 2 && (
                    <div className="hidden md:block absolute -top-[55px] -right-[60px] w-[171px] h-[171px] bg-[#18042A] rounded-[40px]" />
                  )}
                  {/* Bottom-left corner (fourth image) */}
                  {index === 3 && (
                    <div className="hidden md:block absolute -bottom-[55px] -left-[60px] w-[171px] h-[171px] bg-[#18042A] rounded-[40px]" />
                  )}
                  {/* Bottom-right corner (last image) */}
                  {index === 5 && (
                    <div className="hidden md:block absolute -bottom-[55px] -right-[60px] w-[171px] h-[171px] bg-[#18042A] rounded-[40px]" />
                  )}
                  <Image
                    src={member.image || "/placeholder.svg"}
                    alt={member.name}
                    fill
                    quality={100}
                    className="object-cover rounded-[60px] relative z-10 group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="mt-6 text-center z-10">
                  <h3
                    className={`${bricolage.className} text-white text-xl font-semibold`}
                  >
                    {member.name}
                  </h3>
                  <p className={`${inter.className} text-white/80 mt-1`}>
                    {member.role}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
