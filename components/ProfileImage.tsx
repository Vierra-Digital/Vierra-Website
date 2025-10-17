import React from 'react';
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
  // If we have a custom image source, use it
  if (src && src.length > 0) {
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
        />
      </div>
    );
  }

  // Otherwise, use the default avatar with initials
  return (
    <DefaultAvatar 
      name={name} 
      size={size} 
      className={className}
    />
  );
};

export default ProfileImage;
