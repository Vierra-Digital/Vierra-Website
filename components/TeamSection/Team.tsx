"use client";

import { Bricolage_Grotesque } from "next/font/google";
import Image from "next/image";
import { motion } from "framer-motion";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });

interface TeamMember {
  name: string;
  image: string;
  position: string;
  angle?: number; // For circular positioning
}

const teamMembers: TeamMember[] = [
  {
    name: "Patrick Doe",
    image: "/assets/Team/TeamMember1.png",
    position: "Team Vierra",
    angle: 200, // Bottom left
  },
  {
    name: "John Doe",
    image: "/assets/Team/TeamMember2.png",
    position: "Team Vierra",
    angle: 260, // Top
  },
  {
    name: "Rich Doe",
    image: "/assets/Team/TeamMember3.png",
    position: "Team Vierra",
    angle: 325, // Bottom right
  },

  {
    name: "Marjolein Doe",
    image: "/assets/Team/TeamMember4.png",
    position: "Team Vierra",
    angle: 135, // Left
  },

  {
    name: "John Doe",
    image: "/assets/Team/TeamMember5.png",
    position: "Team Vierra",
    angle: 35, // Right
  },
];

export function TeamSection() {
  const radius = 400; // Adjust this value to change the circle size

  return (
    <section
      className="w-full min-h-screen bg-[#010205] max-md:pt-20 lg:pt-[420px] overflow-hidden"
      id="about"
    >
      <div className="container mx-auto px-4">
        {/* Center Content */}
        <div className="flex flex-col items-center justify-center mb-20">
          {/* Vierra Logo */}
          <Image
            src="/assets/vierra-logo.png"
            alt="Vierra"
            width={80}
            height={80}
            className="mb-6 opacity-40 text-[#701DC0]"
          />
          {/* Title */}
          <h2
            className={`${bricolage.className} text-white text-6xl font-semibold mb-10 relative`}
          >
            Our Team<span className="text-[#7A13D0]">.</span>
          </h2>

          {/* Rotating Rings */}

          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="hidden lg:block absolute border border-[#701CC0]/20 rounded-full"
              style={{
                width: `${600 + i * 90}px`,
                height: `${600 + i * 90}px`,
              }}
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 20 + i * 5,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}
        </div>

        {/* Team Members Circle - Desktop */}
        <div className="hidden lg:block w-full">
          <div className="relative w-[700px] h-[700px] mx-auto">
            {teamMembers.map((member, index) => {
              const angle = member.angle! * (Math.PI / 180);
              const x = radius * Math.cos(angle);
              const y = radius * Math.sin(angle);

              return (
                <div
                  key={index}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30" // Added z-30
                  style={{
                    left: `${50 + (x / radius) * 50}%`,
                    top: `${-18 + (y / radius) * 50}%`,
                  }}
                >
                  {/* Purple Glow Background */}
                  <div className="absolute inset-0 -left-10 top-10 w-[280px] h-[280px] opacity-50 blur-[10px] rotate-[60deg] rounded-full bg-gradient-to-t from-[#010205] to-[#701CC0] -z-10" />

                  {/* Member Image */}
                  <div className="relative w-[200px] h-[200px] mb-4">
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      className="object-contain"
                    />
                  </div>

                  {/* Member Info */}
                  <div className="text-center z-10">
                    <h3
                      className={`${bricolage.className} text-white text-2xl font-semibold mb-2`}
                    >
                      {member.name}
                    </h3>
                    <p
                      className={`${bricolage.className} text-[#701CC0] text-lg`}
                    >
                      {member.position}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Members Grid - Mobile/Tablet */}
        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-10">
          {teamMembers.map((member, index) => (
            <div key={index} className="relative flex flex-col items-center ">
              {/* <div className="absolute inset-0 bg-[#701CC0] rounded-full blur-[60px] opacity-20" /> */}
              <div className="relative w-[200px] h-[200px] mb-4 z-0">
                <div className="absolute w-[270px] h-[270px] -left-5 top-10 opacity-50 blur-[10px] rotate-[60deg] rounded-full bg-gradient-to-t from-[#010205] to-[#701CC0] -z-10" />
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  className="object-contain"
                />
              </div>
              <div className="text-center z-10">
                <h3
                  className={`${bricolage.className} text-white text-2xl font-semibold mb-2`}
                >
                  {member.name}
                </h3>
                <p className={`${bricolage.className} text-[#701CC0] text-lg`}>
                  {member.position}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TeamSection;
