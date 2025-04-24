import Image from "next/image";
import { Bricolage_Grotesque, Inter } from "next/font/google";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

export default function TeamSection() {
  const team = [
    { name: "Alex Shick", role: "Chief Executive Officer", image: "/assets/Team/Alex.png" },
    { name: "Paul Wahba", role: "Chief Operating Officer", image: "/assets/Team/Paul.png" },
    { name: "Sienna Coffey", role: "Chief Law Officer", image: "/assets/Team/Sienna.png" },
    { name: "Sean Penix", role: "Sales Manager", image: "/assets/Team/Sean.png" },
    { name: "Justin Waller", role: "Manufacturing Manager", image: "/assets/Team/Justin.png" },
    { name: "Sarah Makin", role: "Outreach Team", image: "/assets/Team/Sarah.png" },
  ];

  return (
    <div className="min-h-screen bg-[#010205] p-8 md:p-16 flex items-center" id="about">
      <div className="max-w-7xl mx-auto">
        <h1 className={`${bricolage.className} text-white text-6xl md:text-7xl font-bold mb-16 text-center`}>
          Our Team<span className="text-[#7A13D0]">.</span>
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-8 md:gap-4 lg:gap-6">
          {team.map(({ name, role, image }) => (
            <div key={name} className="flex flex-col items-center">
              <div className="relative w-[140px] h-[140px] sm:w-[150px] sm:h-[150px] md:w-[170px] md:h-[170px] group">
                <Image
                  src={image}
                  alt={name}
                  fill
                  quality={100}
                  className="object-cover rounded-full transition-all duration-300 md:group-hover:drop-shadow-[0_0_80px_#701cc0]"
                />
              </div>
              <div className="mt-4 text-center">
                <h3 className={`${bricolage.className} text-white text-base sm:text-lg md:text-xl font-semibold`}>{name}</h3>
                <p className={`${inter.className} text-white/70 text-xs sm:text-sm md:text-base`}>{role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}