import styles from "./css/Growth.module.css";
import global from "./css/Global.module.css";
import Circles from "./utils/Circles";
import Arrivals from "./addons/business/Arrivals.png";
import Patients from "./addons/business/Patients.png";
import Arrow from "./addons/business/Arrow.png";
import Launch from "./addons/business/Launch.png";

import Image from "next/image";

function Growth({ width }) {
  return (
    <div
      className={global.Container}
      style={{ marginTop: "100px", marginBottom: "150px" }}
    >
      <div className={global.Side}></div>
      <div className={global.Main}>
        <div className={global.TinyTitle}>
          <span className={global.HighLightRed}>Growth</span>
        </div>
        <div className={global.SectionTitle} style={{ marginBottom: "30px" }}>
          Business <span className={global.HighLightSemiPurple}>Growth.</span>
        </div>
        <div className={styles.Arrivals}>
          <Image src={Arrivals} alt={"Pic"} />
        </div>
        <div className={global.Context}>
          According to a study by SCORE, a non-profit association for small
          businesses, the average revenue growth rate for small businesses with
          less than $5 million in annual{" "}
          <span className={global.Bolded}>revenue is 7.5% annually</span>.
          Additionally, they found that the average attention rate of growth for{" "}
          <span className={global.Bolded}>small businesses is 1% annually</span>
          . While growth rates vary widely depending on the industry and
          location of the business, these statistics provide a general overview
          of what small business owners can expect in terms of revenue and
          attention growth.
        </div>{" "}
        <div className={styles.Helped}>
          <div className={styles.HelpedNumber}>
            <span className={styles.SilvedHighlight}>6+</span>
          </div>
          <div className={styles.HelpedWord}>Business Helped</div>
        </div>
        <div className={styles.Gained}>
          <div className={styles.HelpedNumber}>
            <span className={styles.SilvedHighlight}>
              $20k+{" "}
              <div className={styles.Business}>
                <Image
                  src={Launch}
                  alt={"Pic"}
                  className={styles.BusinessPic}
                />
              </div>
            </span>
          </div>
          <div className={styles.HelpedWord}>
            Business Revenue Gained{" "}
            <div className={styles.Patients}>
              <Image src={Patients} alt={"Pic"} />
            </div>
          </div>
        </div>
        <div className={styles.ArrowStatic}>
          <Image src={Arrow} alt={"Arrow"} />
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
      </div>
    </div>
  );
}

export default Growth;
