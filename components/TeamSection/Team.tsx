import Image from "next/image"
import { Bricolage_Grotesque, Inter } from "next/font/google"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const inter = Inter({ subsets: ["latin"] })

export default function TeamSection() {
  const team = [
    { name: "Alex Shick", role: "Founder", image: "/assets/Team/Alex.png" },
    {
      name: "Michael Xie",
      role: "Lead Software Engineer",
      image: "/assets/Team/Michael.png",
    },
    {
      name: "Polina Sokolova",
      role: "Internal Operations",
      image: "/assets/Team/Pola.png",
    },
    {
      name: "Stefan Jian",
      role: "Business Advisor",
      image: "/assets/Team/Stefan.jpeg",
    },
    {
      name: "Justin Waller",
      role: "Business Ops Advisor",
      image: "/assets/Team/Justin.png",
    },
  ]

  return (
    <div
      className="min-h-[70vh] bg-gradient-to-b from-[#010205] via-[#010205] to-[#18042A] px-8 md:px-16 pt-10 md:pt-12 pb-16 md:pb-20 flex items-center"
      id="about"
    >
      <div className="max-w-7xl mx-auto">
        <h2
          className={`${bricolage.className} text-white text-6xl md:text-7xl font-bold mb-16 text-center`}
        >
          Our Leadership Team
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-12 md:gap-x-12 md:gap-y-10 lg:gap-x-16 lg:gap-y-10 justify-items-center max-w-6xl mx-auto">
          {team.map(({ name, role, image }) => (
            <div key={name} className="flex flex-col items-center">
              <div className="relative w-[140px] h-[140px] sm:w-[150px] sm:h-[150px] md:w-[170px] md:h-[170px] group">
                <Image
                  src={image}
                  alt={name}
                  fill
                  quality={80}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  className="object-cover rounded-full transition-all duration-300 select-none [-webkit-user-drag:none] md:group-hover:drop-shadow-[0_0_80px_#701cc0]"
                />
              </div>
              <div className="mt-4 text-center">
                <h3
                  className={`${bricolage.className} text-white text-base sm:text-lg md:text-xl font-semibold`}
                >
                  {name}
                </h3>
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
