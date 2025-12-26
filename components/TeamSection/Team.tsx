import Image from "next/image"
import { Bricolage_Grotesque, Inter } from "next/font/google"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

export default function TeamSection() {
  const team = [
    { name: "Alex Shick", role: "Founder", image: "/assets/Team/Alex.png" },
    {
      name: "Vilhjalmur Johnsson",
      role: "Development Lead",
      image: "/assets/Team/Vilhjalmur.png",
    },
    {
      name: "Stefan Jian",
      role: "Business Advisor",
      image: "/assets/Team/Stefan.jpeg",
    },
    {
      name: "Sienna Coffey",
      role: "Law Lead",
      image: "/assets/Team/Sienna.png",
    },
    {
      name: "Justin Waller",
      role: "Business Ops Advisor",
      image: "/assets/Team/Justin.png",
    },
  ]

  return (
    <div
      className="min-h-screen bg-[#010205] p-8 md:p-16 flex items-center"
      id="about"
    >
      <div className="max-w-7xl mx-auto">
        <h2
          className={`${bricolage.className} text-white text-6xl md:text-7xl font-bold mb-16 text-center`}
        >
          Our Leadership Team<span className="text-[#7A13D0]">.</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-8 md:gap-4 lg:gap-6 justify-items-center max-w-5xl mx-auto">
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
                <h2
                  className={`${bricolage.className} text-white text-base sm:text-lg md:text-xl font-semibold`}
                >
                  {name}
                </h2>
                <p
                  className={`${inter.className} text-white/70 text-xs sm:text-sm md:text-base`}
                >
                  {role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
