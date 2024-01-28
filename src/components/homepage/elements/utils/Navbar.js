"use client";

import { useEffect, useState } from "react";
import styles from "./css/Navbar.module.css";
import { motion } from "framer-motion";
import Image from "next/image";
import Logo from "../addons/footer/Vierralogo.png";
import { useRouter } from "next/navigation";

function Navbar() {
  const router = useRouter();
  const [nav, setNav] = useState(false);
  const [hover, setHover] = useState(false);
  let bop = {};
  if (typeof window !== "undefined") {
    bop = document.scrollingElement;
  }
  function useImperativeDisableScroll({ element, disabled }) {
    useEffect(() => {
      if (!element) {
        return;
      }
      element.style.overflowY = disabled ? "hidden" : "scroll";
      return () => {
        element.style.overflowY = "scroll";
      };
    }, [disabled]);
  }

  useImperativeDisableScroll({
    element: bop,
    disabled: nav,
  });

  const buttonVariant = {
    hover: { gap: ["5px", "20px", "5px"] },
    unhover: { gap: ["5px", "20px", "5px"] },
  };

  return (
    <div className={styles.Container}>
      <div className={styles.Left}>
        <div className={styles.Logo} onClick={() => router.refresh()}>
          <Image
            src={Logo}
            alt={"vierralogo"}
            height={50}
            className={styles.LogoPicture}
          />
        </div>
        <div className={styles.Buttons}>
          <div>Features</div>
          <div>Demo</div>
          <div>Products</div>
          <div>Downloads</div>
          <div>About Us</div>
        </div>
      </div>
      <div className={styles.Right}>
        <div className={styles.Connect}>CONNECT WITH US</div>
        <div className={styles.Dropdown}>
          <div className={styles.Dropdowndowner} onClick={() => setNav(!nav)}>
            <div className={styles.DropdownLine}></div>
            <div className={styles.DropdownLine}></div>
            <div className={styles.DropdownLine}></div>
          </div>
          <motion.div
            className={styles.DropdownNav}
            animate={{
              width: !nav ? "0px" : "100vw",
            }}
            initial={{
              width: "0px",
            }}
          >
            <div className={styles.DropdownNavContainer}>
              <div>Features</div>
              <div>Demo</div>
              <div>Products</div>
              <div>Downloads</div>
              <div>About Us</div>
              <div className={styles.DropdownLogin}>
                <div className={styles.LoginCircle}></div>
                <div className={styles.LoginWord}>LOGIN</div>
              </div>
            </div>
          </motion.div>
        </div>
        <motion.div
          className={styles.Login}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          initial={{ gap: "5px" }}
          animate={hover ? "hover" : "unhover"}
          variants={buttonVariant}
          transition={{ duration: 1, ease: "easeInOut" }}
        >
          <div className={styles.LoginCircle}></div>
          <div className={styles.LoginWord}>LOGIN</div>
        </motion.div>
      </div>
    </div>
  );
}

export default Navbar;
