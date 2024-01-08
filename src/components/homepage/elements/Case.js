"use client";
import { useElementSize } from "@mantine/hooks";
import styles from "./css/Case.module.css";
import global from "./css/Global.module.css";
import Circles from "./utils/Circles";
import Left from "./addons/case/Left.png";
import Middle from "./addons/case/Middle.png";
import Right from "./addons/case/Right.png";
import Image from "next/image";
import { Arrow } from "./addons/Misc";
function Case({ width: wd }) {
  const { ref, width: bop } = useElementSize();
  return (
    <div className={global.Container} ref={ref}>
      <div className={global.Side}></div>
      <div className={global.Main}>
        <div className={styles.TextContainer}>
          <div className={global.TinyTitle}>
            <span className={global.HighLightRed}>Features</span>
          </div>
          <div
            className={global.SectionTitle}
            style={{
              width: "max-width",
            }}
          >
            Case studies/
            <span className={global.HighLightSemiPurple}>articles.</span>
          </div>
          <div className={global.Context}>
            Our case studies showcase how our products and services have helped
            various businesses achieve their goals.
          </div>
          <div className={styles.TextButtons}>
            <div className={styles.CaseButton}>
              <div className={styles.CaseCircle}></div>
              <span className={styles.CaseButtonText}>CASE STUDIES</span>
            </div>
            <div className={styles.ArticleButton}>
              <div className={global.TextUnderline}>ARTICLES</div>
            </div>
          </div>
        </div>
        <div className={styles.CardsContainer}>
          <div className={styles.Card}>
            <div className={styles.CardImage}>
              <Image
                alt={"Image"}
                src={Left}
                className={styles.CardImagePicture}
              />
            </div>
            <div className={styles.CardTitle}>POLLU</div>
            <div className={styles.CardContext}>
              POLLUTION MONITORING SOLUTION
            </div>
          </div>
          <div className={styles.CardMain}>
            <div className={styles.CardImage}>
              <Image
                alt={"Image"}
                src={Middle}
                className={styles.CardImagePictureMain}
              />
            </div>
            <div className={styles.CardTitle}>POLLU</div>
            <div className={styles.CardContext}>
              POLLUTION MONITORING SOLUTION
            </div>
          </div>
          <div className={styles.Card}>
            <div className={styles.CardImage}>
              <Image
                alt={"Image"}
                src={Right}
                className={styles.CardImagePicture}
              />
            </div>
            <div className={styles.CardTitle}>POLLU</div>
            <div className={styles.CardContext}>
              POLLUTION MONITORING SOLUTION
            </div>
          </div>
        </div>
        <div className={global.TextUnderline} style={{ marginTop: "50px" }}>
          <Arrow fill={"#000000"} />
          VIEW ALL CASE STUDIES
        </div>
      </div>
      <div className={global.Side}>
        <Circles
          right={!wd ? "-50vw" : `clamp(-${wd / 4}px,-${wd / 4}px,600px)`}
          color={false}
          width={wd}
          margintop={"-200px"}
        />
        <Circles
          right={!wd ? "-50vw" : `clamp(-${wd / 4}px,-${wd / 4}px,600px)`}
          color={false}
          width={wd}
          margintop={"200px"}
          marginright={"300px"}
        />
      </div>
    </div>
  );
}

export default Case;
