import React, { useContext, useEffect, useState } from "react";
import styles from "./CreateAccount.module.css";
import { IoMdClose } from "react-icons/io";
import { MainContext } from "../../Contexts/MainContext";
import { FaHeart } from "react-icons/fa";
import { BsStars } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
export default function CreateAccount() {
  const { products, setProducts, userBag, setUserBag, setCreateAccountIsActive } = useContext(MainContext);
  const [isFading, setIsFading] = useState(false);

  const navigate = useNavigate();

  const handleAnimationEnd = () => {
    if (isFading) {
        setCreateAccountIsActive(false);
      document.body.style.overflow = 'auto';
    }
  };

  const handleBackgroundClick = () => {
    setIsFading(true);
  };

  const handleButtons = (url)=>{
    document.body.style.overflow = 'auto';
    navigate(url);
    setCreateAccountIsActive(false);
  }

  return (
    <div className={styles.container}>
      <div
        className={`${styles.backgroundContainer} ${isFading ? styles.fadeOut : styles.fadeIn}`}
        onClick={handleBackgroundClick}
        onAnimationEnd={handleAnimationEnd}
      />
      <div
        className={`${styles.wrapper} ${isFading ? styles.slideOut : styles.slideIn}`}
        onAnimationEnd={handleAnimationEnd}
      >
        <span className={styles.headerWrapper}>
          <p className={styles.headerTitleText}><FaHeart /> SAVE TO WISHLIST</p>
          <IoMdClose className={styles.headerExitButton} onClick={handleBackgroundClick} />
        </span>
        <span className={styles.bodyWrapper}>
        <p className = {styles.favText}>A simple way to revisit your favourite outfits whenever you want,  it's like magic {<BsStars style = {{color: "rgb(10, 150, 250)"}}/>}</p>

        <div className = {styles.actionsContainer}>
            <button className = {styles.createAccountButton} onClick = {()=>handleButtons("/signup")}>CREATE YOUR ACCOUNT</button>
            <p style = {{textAlign:"center"}}>or</p>
            <button className = {styles.logInButton} onClick={()=>handleButtons("/signin")}>LOG IN</button>
        </div>
        </span>
      </div>
    </div>
  );
}