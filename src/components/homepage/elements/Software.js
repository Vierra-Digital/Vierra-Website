import styles from "./css/Software.module.css";
import global from "./css/Global.module.css";
import Image from "next/image";
import ReactPlayer from "react-player";
import { useEffect, useState } from "react";
import { useRef } from "react";
import { useInView } from "framer-motion";
function Software({ width }) {
  const [state, setState] = useState(false);
  useEffect(() => {
    setState(true);
  }, []);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  return (
    <div className={global.Container} style={{ marginTop: "100px" }}>
      <div className={global.Side}></div>
      <div
        className={global.Main}
        ref={ref}
        style={{
          transform: isInView ? "none" : "translateY(-200px)",
          opacity: isInView ? 1 : 0,
          transition: "all 0.9s cubic-bezier(0.17, 0.55, 0.55, 1) 0.5s",
        }}
      >
        <div className={global.TinyTitle}>
          <span className={global.HighLightRed}>Softwares</span>
        </div>
        <div className={global.SectionTitle}>
          Launch Your Products With Our{" "}
          <span className={global.HighLightRed}>
            <span className={global.HighLightRed}>Top</span> Of The Line
            Software
          </span>
        </div>
        <div className={global.ContextAligned}>
          Our state-of-the-art software is the perfect tool to help you
          successfulyl launch your products.
        </div>
        <div className={styles.Buttons}>
          <div className={styles.ButtonColored}>DASHBOARD</div>
          <div>FORMS</div>
          <div>TIME MANAGEMENT</div>
          <div>ONBOARDING</div>
          <div>REVENUE</div>
        </div>
        <div className={styles.Main}>
          {state && (
            <ReactPlayer
              url="https://firebasestorage.googleapis.com/v0/b/picture-host.appspot.com/o/dashboard_1.webm?alt=media&token=35b323ab-a3a4-4ad8-9092-2d1284983033"
              loop={true}
              playing={true}
              width={"100%"}
              height={"100%"}
              volume={0}
            />
          )}
        </div>
      </div>
      <div className={global.Side}></div>
    </div>
  );
}

export default Software;
