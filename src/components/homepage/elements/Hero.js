import styles from "./css/Hero.module.css";
import global from "./css/Global.module.css";
import Circles from "./utils/Circles";
import Navbar from "./utils/Navbar";
import Image from "next/image";
import Cmr from "./addons/hero/Crm.png";
import Accounting from "./addons/hero/Accounting.png";
import Marketing from "./addons/hero/Marketing.png";
import Outreach from "./addons/hero/Outreach.png";
import Sales from "./addons/hero/Sales.png";
import Doctor from "./addons/hero/Doctor.png";
import Glossy from "./addons/hero/Glossy.png";
import Cloud from "./addons/hero/Cloud.png";
import Hues from "./addons/hero/Hues.png";
import Scale from "./addons/hero/Scale.png";
import Invert from "./addons/hero/Invert.png";

function Hero({ width }) {
  const list = [
    {
      name: "CRM",
      image: Cmr,
      height: 135,
      width: 208,
    },
    {
      name: "Sales",
      image: Sales,
      height: 165,
      width: 208,
    },
    {
      name: "Marketing",
      image: Marketing,
      height: 165,
      width: 208,
    },
    {
      name: "Accounting",
      image: Accounting,
      height: 135,
      width: 208,
    },
    {
      name: "Outreach",
      image: Outreach,
      height: 135,
      width: 208,
    },
  ];
  const logos = [
    {
      image: Doctor,
    },
    {
      image: Glossy,
    },
    {
      image: Cloud,
    },
    {
      image: Hues,
    },
    {
      image: Scale,
    },
    {
      image: Invert,
    },
  ];
  return (
    <div className={global.Container}>
      <div className={global.Side}>
        <Circles
          left={
            !width ? "-50vw" : `clamp(-${width / 4}px,-${width / 4}px,600px)`
          }
          color={false}
          top={"-100px"}
        />
      </div>
      <div className={global.Main}>
        <Navbar />
        <div className={styles.TextContainer}>
          <div className={global.SectionTitle}>
            Real-Time <span className={global.HighLightPurple}>Solution</span>{" "}
            <span className={global.HighLightSemiPurple}>Tools</span> For Your
            Entire <div className={styles.Plus}></div> Business{" "}
            <div className={styles.Factor}></div>
          </div>
          <div className={global.Context}>
            Our comprehensive tools offers small business owners a one-stop-shop
            solution <span className={global.Bolded}>to manage</span> their
            accounting, sales, marketing, outreach efforts, CRM, financial
            models, email campaigns, QuickBooks integration, record-keeping, and
            a range of other{" "}
            <span className={global.Bolded}>crucial business functions.</span>
          </div>
          <div className={styles.HeroButton}>
            <div className={styles.HeroButtonCircle}></div>
            <div className={styles.HeroButtonText}>TRY DEMO</div>
          </div>
        </div>
        <div className={styles.SchemasContainer}>
          {list.map((container, i) => (
            <div className={styles.SchemaBox} key={i}>
              <div className={styles.SchemaDot}>
                <div className={styles.Dot}></div>
              </div>
              <div className={styles.SchemaTitle}>{container.name}</div>
              <Image
                src={container.image}
                alt={"HeroPic"}
                className={styles.SchemaPicture}
                height={container.height}
                width={container.width}
              />
            </div>
          ))}
        </div>
        <div className={styles.LogosContainer}>
          {logos.map((logos, i) => (
            <div key={i}>
              <Image src={logos.image} height={75} alt={"image"} />
            </div>
          ))}
        </div>
      </div>
      <div className={global.Side}>
        <Circles
          right={
            !width ? "-50vw" : `clamp(-${width / 4}px,-${width / 4}px,600px)`
          }
          color={true}
          top={"50px"}
        />
      </div>
    </div>
  );
}

export default Hero;
