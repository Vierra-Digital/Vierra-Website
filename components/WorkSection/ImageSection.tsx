import React from "react";

interface ImageSectionProps {
  src: string;
  alt: string;
  className: string;
}

const ImageSection: React.FC<ImageSectionProps> = ({ src, alt, className }) => {
  return <img loading="lazy" src={src} alt={alt} className={className} />;
};

export default ImageSection;
