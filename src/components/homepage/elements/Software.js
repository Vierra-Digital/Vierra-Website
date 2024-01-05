import styles from "./css/Software.module.css"
import global from "./css/Global.module.css"

function Software({ width }) {
  return (
    <div className={global.Container} style={{ marginTop: "100px" }}>
      <div className={global.Side}></div>
      <div className={global.Main}>
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
        <div className={styles.Main}></div>
      </div>
      <div className={global.Side}></div>
    </div>
  )
}

export default Software
