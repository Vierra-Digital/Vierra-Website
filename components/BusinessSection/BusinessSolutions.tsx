import { useEffect, useState } from "react";
import { Bricolage_Grotesque, Inter, Figtree } from "next/font/google";
import { Button } from "@/components/ui/button";
import { StatsGrid } from "./StatsGrid";
import { motion, AnimatePresence } from "framer-motion";
import Timeline from "./Timeline";
import GridComponent from "./GridComponent";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });
const figtree = Figtree({ subsets: ["latin"] });

interface TabItem {
  id: string;
  title: string;
  content: string;
}

const tabs: TabItem[] = [
  {
    id: "onboarding",
    title: "Seamless Onboarding",
    content:
      "We start immediately. Our onboarding process is fast and simple, working towards starting your lead generation swiftly.",
  },
  {
    id: "efficiency",
    title: "Increasing Efficiency",
    content:
      "We take responsibility for your online presence so you can spend more time doing the work you enjoy.",
  },
  {
    id: "costs",
    title: "Reduce Spending",
    content:
      "Spend only the resources required to generate leads that pay back your investments and increase your capital.",
  },
  {
    id: "streamline",
    title: "Streamline Systems",
    content:
      "Automate client acquisition with our case study-driven systems. Patients discover your office through organic outreach.",
  },
];

export function BusinessSolutions() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prevTab) => {
        const currentIndex = tabs.findIndex((tab) => tab.id === prevTab);
        const nextIndex = (currentIndex + 1) % tabs.length; // Loop back to the start
        return tabs[nextIndex].id;
      });
    }, 10000); // Change every 10 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, [activeTab]);

  return (
    <section className="w-full py-20 px-6 bg-[#F3F3F3]" id="solutions">
      <div className="max-w-7xl mx-auto px-6 max-md:px-2">
        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <h2
            className={`text-3xl font-bold text-[#18042A] mb-4 ${bricolage.className}`}
          >
            We Are Not Your Average
            <br />
            “Consultants”
          </h2>
          <p className={`text-[#8A9197] text-lg ${inter.className}`}>
            We reduce complexity by eliminating corporate formalities. We
            implement a clear-cut and simple approach to increasing the return
            on ad spending. Our team hand-picks clients so we can offer more
            leads and focus on your success.
          </p>
        </div>

        {/* Tabs and Image Section */}
        <div className="grid md:grid-cols-2 gap-12 mb-20 place-items-center">
          <div className="space-y-6 relative max-md:min-h-[480px]">
            {tabs.map((tab) => (
              <motion.div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`block text-left w-full cursor-pointer ${bricolage.className}`}
                initial={false}
              >
                <motion.h3
                  className={`text-2xl sm:text-4xl md:text-5xl md:mb-6 relative inline-block ${
                    activeTab === tab.id && "mb-6"
                  } `}
                  animate={{
                    color: activeTab === tab.id ? "#701CC0" : "#929C9A",
                  }}
                  transition={{
                    duration: 0.5,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                >
                  {tab.title}
                  {activeTab === tab.id && (
                    <>
                      <motion.div
                        className="absolute -inset-x-4 inset-y-0 bg-[#701CC0]/5 rounded-lg -z-10"
                        layoutId="background"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                      />

                      <motion.div
                        className="absolute bottom-[-12px] left-0 w-full h-[2px] bg-[#D9DEDD] overflow-hidden"
                        layoutId="underline"
                        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                      >
                        <motion.div
                          className="h-full bg-[#701CC0]"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 10, ease: "linear" }}
                          key={activeTab}
                        />
                      </motion.div>
                    </>
                  )}
                </motion.h3>

                <AnimatePresence mode="wait">
                  {activeTab === tab.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{
                        opacity: 1,
                        height: "auto",
                        transition: {
                          height: {
                            duration: 0.4,
                            ease: [0.32, 0.72, 0, 1],
                          },
                          opacity: {
                            duration: 0.25,
                            delay: 0.15,
                          },
                        },
                      }}
                      exit={{
                        opacity: 0,
                        height: 0,
                        transition: {
                          height: {
                            duration: 0.4,
                            ease: [0.32, 0.72, 0, 1],
                          },
                          opacity: {
                            duration: 0.25,
                          },
                        },
                      }}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                        className={`${figtree.className}`}
                      >
                        <p className="text-[#646A69] text-[18px] mb-2">
                          {tab.content}
                        </p>
                        <Button
                          variant="link"
                          className="text-[#022C22] text-[18px] hover:text-[#701CC0] p-0"
                        >
                          Learn More
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          <div className="relative mx-auto">
            <GridComponent />
          </div>
        </div>
      </div>
      <div className="mt-24">
        <Timeline />
      </div>
      <div className="mt-24">
        <StatsGrid />
      </div>
    </section>
  );
}
