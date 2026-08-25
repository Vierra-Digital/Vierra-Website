import React, { useState } from 'react';
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
  // Remember which src failed rather than a bare "it failed" flag: a new src then simply is not
  // the failed one, so there is nothing to reset. With a boolean, the flag had to be cleared by an
  // effect, which meant one render of the fallback avatar even when the new image was fine.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgError = src != null && src === failedSrc;

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
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
};

export default ProfileImage;
