import Image from "next/image";
import ComputerImage from "@/public/Computer.jpg";
import styles from "@/app/css/Hero.module.css"; // Import CSS Module

const Hero = () => {
  return (
    <div className="hero min-h-screen relative">
      <Image
        src={ComputerImage}
        alt="Computer"
        layout="fill"
        objectFit="cover"
        className="absolute inset-0"
      />
      {/* กระจกขุ่นๆ */}
      <div className={styles.overlay}></div>
      <div className="hero-content text-center text-neutral-content">
        <div className="max-w-md">
          <h1 className="mb-5 text-5xl font-bold">Everest Thailand</h1>
          <p className="mb-5">
            Data IT Team
          </p>
        </div>
      </div>
    </div>
  );
};

export default Hero;
