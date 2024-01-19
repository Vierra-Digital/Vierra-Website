"use client";

import Business from "@/components/homepage/elements/Business";
import Case from "@/components/homepage/elements/Case";
import Experience from "@/components/homepage/elements/Experience";
import Footer from "@/components/homepage/elements/Footer";
import Growth from "@/components/homepage/elements/Growth";
import Hero from "@/components/homepage/elements/Hero";
import Software from "@/components/homepage/elements/Software";
import Testimonials from "@/components/homepage/elements/Testimonials";
import { useElementSize } from "@mantine/hooks";
import styles from "./Main.module.css";

function Page() {
  const main = {
    display: "flex",
    justifyContent: "center",
    overflow: "hidden",
  };

  const container = {
    display: "flex",
    width: "clamp(1px,100vw,1920px)",
    minHeight: "100vh",
    justifyContent: "space-between",
    flexDirection: "column",
  };

  const { width, ref } = useElementSize();

  return (
    <div style={main}>
      <div style={container} className={styles.Cont} ref={ref}>
        <Hero width={width} />
        <Business width={width} />
        <Growth width={width} />
        <Software width={width} />
        <Experience width={width} />
        <Case width={width} />
        <Testimonials width={width} />
        <Footer width={width} />
      </div>
    </div>
  );
}

export default Page;
