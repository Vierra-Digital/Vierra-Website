import styles from "./css/Business.module.css";
import global from "./css/Global.module.css";
import Circles from "./utils/Circles";
import { useRef } from "react";
import { useInView } from "framer-motion";

function Business({ width }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  return (
    <div className={global.Container}>
      <div className={global.Side}>
        {/* <Circles
          left={
            !width ? "-50vw" : `clamp(-${width / 4}px,-${width / 4}px,600px)`
          }
          color={false}
          width={width}
          margintop={"200px"}
        /> */}
        <Circles
          left={
            !width ? "-50vw" : `clamp(-${width / 4}px,-${width / 4}px,600px)`
          }
          color={true}
          width={width}
          margintop={"-250px"}
        />
      </div>
      <div className={global.Main}>
        <div className={styles.Container} ref={ref}>
          <div
            className={styles.LeftSide}
            style={{
              transform: isInView ? "none" : "translateX(-200px)",
              opacity: isInView ? 1 : 0,
              transition: "all 0.9s cubic-bezier(0.17, 0.55, 0.55, 1) 0.5s",
            }}
          >
            <div className={global.TinyTitle}>
              <span className={global.HighLightRed}>Growth</span>
            </div>
            <div className={styles.MainTitle}>
              How can we <span className={global.HighLightPurple}>help</span>
              <span className={global.HighLightRed}> your business?</span>
            </div>
            <div className={global.Context}>
              Our solution tools can help your business by streamlining
              operations, increasing efficiency, reducing costs, and improving
              productivity. Our tools can also provide{" "}
              <span className={global.Bolded}>data insights</span> that can help{" "}
              <span className={global.Bolded}>
                with decision-making and strategy planning.
              </span>
            </div>
            <div className={global.TextUnderline}>
              VIEW OUR BUSINESS SOLUTIONS
            </div>
          </div>
          <div
            className={styles.RightSide}
            style={{
              transform: isInView ? "none" : "translateX(200px)",
              opacity: isInView ? 1 : 0,
              transition: "all 0.9s cubic-bezier(0.17, 0.55, 0.55, 1) 0.5s",
            }}
          >
            <div className={styles.RightSideButtons}>
              <div>STARTUPS</div>
              <div>B2B</div>
            </div>
            <div className={styles.RightSideContext}>
              &quot;improving efficienty, reducing errors, and enhancing
              customer experience. With our high impact tools&quot;
            </div>
            <div className={styles.RightSideSlider}>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        </div>
      </div>
      <div className={global.Side}>
        <Circles
          right={
            !width ? "-50vw" : `clamp(-${width / 4}px,-${width / 4}px,600px)`
          }
          color={true}
          width={width}
          margintop={"-200px"}
        />
        <Circles
          right={
            !width ? "-50vw" : `clamp(-${width / 4}px,-${width / 4}px,600px)`
          }
          color={false}
          width={width}
          margintop={"-100px"}
          marginright={"700px"}
        />
      </div>
    </div>
  );
}

export default Business;
