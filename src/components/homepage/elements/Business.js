import styles from "../css/elements/Business.module.css";
import global from "../css/Glodal.module.css";

function Business() {
  return (
    <div className={styles.Container}>
      <div className={styles.LeftSide}>
        <div className={global.TinyTitle}>
          <span className={global.HighLightRed}>growth</span>
        </div>
        <div className={styles.MainTitle}>
          How can we <span className={global.HighLightPurple}>help</span>
          <span className={global.HighLightRed}> your business?</span>
        </div>
        <div className={global.Context}>
          Our solution tools can help your business by streamlining operations,
          increasing efficiency, reducing costs, and improving productivity. Our
          tools can also provide{" "}
          <span className={global.Bolded}>data insights</span> that can help{" "}
          <span className={global.Bolded}>
            with decision-making and strategy planning.
          </span>
        </div>
        <div className={styles.Button}>VIEW OUR BUSINESS SOLUTIONS</div>
      </div>
      <div className={styles.RightSide}>
        <div className={styles.RightSideButtons}>
          <div>STARTUPS</div>
          <div>B2B</div>
        </div>
        <div className={styles.RightSideContext}>
          " improving efficienty, reducing errors, and enhancing customer
          experience. With our high impact tools "
        </div>
        <div className={styles.RightSideSlider}>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    </div>
  );
}

export default Business;
