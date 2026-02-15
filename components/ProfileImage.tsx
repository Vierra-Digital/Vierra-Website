import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import DefaultAvatar from './DefaultAvatar';

interface ProfileImageProps {
  src?: string | null;
  alt: string;
  name: string;
  size?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
}

const ProfileImage: React.FC<ProfileImageProps> = ({ 
  src, 
  alt, 
  name, 
  size = 40, 
  className = "",
  priority = false,
  quality = 100
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  // Use default avatar when no src, empty src, or image failed to load
  if (!src || src.length === 0 || imgError) {
    return (
      <DefaultAvatar 
        name={name} 
        size={size} 
        className={className}
      />
    );
  }

  return (
    <div 
      className={`rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="w-full h-full object-cover"
        style={{ borderRadius: "50%" }}
        priority={priority}
        quality={quality}
        unoptimized
        onError={() => setImgError(true)}
      />
    </div>
  );
};

export default ProfileImage;
