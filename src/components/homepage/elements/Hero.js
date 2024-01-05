import styles from "./css/Hero.module.css"
import global from "./css/Global.module.css"
import Circles from "./utils/Circles"
import Navbar from "./utils/Navbar"
import Image from "next/image"

function Hero({ width }) {
  const list = [
    {
      name: "CRM",
      image: "test",
    },
    {
      name: "Sales",
      image: "test",
    },
    {
      name: "Marketing",
      image: "test",
    },
    {
      name: "Accounting",
      image: "test",
    },
    {
      name: "Outreach",
      image: "test",
    },
  ]
  const logos = [
    {
      image: "Doctor",
    },
    {
      image: "Glossy",
    },
    {
      image: "Cloud",
    },
    {
      image: "Hues",
    },
    {
      image: "Scale",
    },
    {
      image: "Invert",
    },
  ]
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
              <div className={styles.SchemaPicture}>{container.image}</div>
            </div>
          ))}
        </div>
        <div className={styles.LogosContainer}>
          {logos.map((logos, i) => (
            <div key={i}>
              {/* <Image src={logos.image} height={75} alt={"image"} /> */}
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
  )
}

export default Hero
