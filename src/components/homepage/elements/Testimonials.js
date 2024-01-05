import styles from "./css/Testimonials.module.css"
import global from "./css/Global.module.css"
import Circles from "./utils/Circles"
import Testimonialbox from "./utils/Testimonialbox"
import { useMemo } from "react"
import { Swiper, SwiperSlide } from "swiper/react"
import { Autoplay } from "swiper/modules"
import "swiper/css"
import Pictureone from "./addons/testimonials/Pictureone.png"
import Picturetwo from "./addons/testimonials/Picturetwo.png"
import Picturethree from "./addons/testimonials/Picturethree.png"
import Picturefour from "./addons/testimonials/Picturefour.png"
import Image from "next/image"

function Testimonials({ width }) {
  const list = useMemo(
    () => [
      {
        name: "Somerville Dental",
        context:
          "The management software tool that I reviewed is highly effective in managing projects, tasks, and team communication. It has a user-friendly interface and provides excellent collaboration features. The customizable dashboard allows quick access to all the important information, and the auto-assignment and reminder features help keep everyone on track. The tool's analytics section offers insightful reports to track progress and performance. Overall, I think this management software tool is a great option for teams and businesses looking to streamline their workflows and improve productivity.",
        position: "Dental Practice",
      },
      {
        name: "Jaxon Easton",
        context:
          "The management software tool that I reviewed is highly effective in managing projects, tasks, and team communication. It has a user-friendly interface and provides excellent collaboration features. The customizable dashboard allows quick access to all the important information, and the auto-assignment and reminder features help keep everyone on track. The tool's analytics section offers insightful reports to track progress and performance. Overall, I think this management software tool is a great option for teams and businesses looking to streamline their workflows and improve productivity.",
        position: "Production Manager",
      },
      {
        name: "Jaxon Easton",
        context:
          "The management software tool that I reviewed is highly effective in managing projects, tasks, and team communication. It has a user-friendly interface and provides excellent collaboration features. The customizable dashboard allows quick access to all the important information, and the auto-assignment and reminder features help keep everyone on track. The tool's analytics section offers insightful reports to track progress and performance. Overall, I think this management software tool is a great option for teams and businesses looking to streamline their workflows and improve productivity.",
        position: "Production Manager",
      },
      {
        name: "Jaxon Easton",
        context:
          "The management software tool that I reviewed is highly effective in managing projects, tasks, and team communication. It has a user-friendly interface and provides excellent collaboration features. The customizable dashboard allows quick access to all the important information, and the auto-assignment and reminder features help keep everyone on track. The tool's analytics section offers insightful reports to track progress and performance. Overall, I think this management software tool is a great option for teams and businesses looking to streamline their workflows and improve productivity.",
        position: "Production Manager",
      },
      {
        name: "Jaxon Easton",
        context:
          "The management software tool that I reviewed is highly effective in managing projects, tasks, and team communication. It has a user-friendly interface and provides excellent collaboration features. The customizable dashboard allows quick access to all the important information, and the auto-assignment and reminder features help keep everyone on track. The tool's analytics section offers insightful reports to track progress and performance. Overall, I think this management software tool is a great option for teams and businesses looking to streamline their workflows and improve productivity.",
        position: "Production Manager",
      },
      {
        name: "Jaxon Easton",
        context:
          "The management software tool that I reviewed is highly effective in managing projects, tasks, and team communication. It has a user-friendly interface and provides excellent collaboration features. The customizable dashboard allows quick access to all the important information, and the auto-assignment and reminder features help keep everyone on track. The tool's analytics section offers insightful reports to track progress and performance. Overall, I think this management software tool is a great option for teams and businesses looking to streamline their workflows and improve productivity.",
        position: "Production Manager",
      },
    ],
    []
  )
  return (
    <div className={global.Container}>
      <div className={global.Side}>
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
        <div className={styles.Text}>
          <div className={global.HighLightRed}>Features</div>
          <div className={styles.MainTitle}>
            <div>{width > 570 ? "Our Client" : ""}</div>

            <div className={styles.MainTitlePic}>
              <div className={styles.Pic}>
                <Image alt={"Pic"} src={Pictureone} className={styles.Pic} />
              </div>
              <div className={styles.Pic}>
                <Image alt={"Pic"} src={Picturetwo} className={styles.Pic} />
              </div>
              <div className={styles.Pic}>
                <Image alt={"Pic"} src={Picturethree} className={styles.Pic} />
              </div>
              <div className={styles.Pic}>
                <Image alt={"Pic"} src={Picturefour} className={styles.Pic} />
              </div>
            </div>
            <div className={global.HighLightSemiPurple}>
              {" "}
              <div>{width > 570 ? "Testimonials" : "Our Client"}</div>
            </div>
          </div>
          <div className={global.Context} style={{ textAlign: "center" }}>
            Our solution tools have received high praise from our clients for
            being highly useful and easy to use.
          </div>
        </div>
        <div className={styles.Slider}>
          <Swiper
            style={{ display: "flex", justifyContent: "center" }}
            loop={true}
            className="mySwiper"
            autoplay={{
              delay: 2500,
              disableOnInteraction: false,
            }}
            breakpoints={{
              700: {
                slidesPerView: 2,
                spaceBetween: 15,
              },
              1020: {
                slidesPerView: 3,
                spaceBetween: 30,
              },
              1440: {
                slidesPerView: 3,
                spaceBetween: 30,
              },
              1620: {
                slidesPerView: 4,
                spaceBetween: 30,
              },
            }}
            modules={[Autoplay]}
          >
            {list.map((bop, i) => (
              <SwiperSlide key={i}>
                <Testimonialbox
                  key={i}
                  name={bop.name}
                  context={bop.context}
                  position={bop.position}
                />
              </SwiperSlide>
            ))}
          </Swiper>
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
          marginright={"400px"}
        />
      </div>
    </div>
  )
}

export default Testimonials
