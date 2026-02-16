import React from 'react';

interface DefaultAvatarProps {
  name: string;
  size?: number;
  className?: string;
}

const DefaultAvatar: React.FC<DefaultAvatarProps> = ({ name, size = 40, className = "" }) => {
  const getInitials = (name: string): string => {
    if (!name || name.trim().length === 0) return "U";
    
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const initials = getInitials(name);

  return (
    <div 
      className={`bg-gray-500 text-white rounded-full flex items-center justify-center font-semibold ${className}`}
      style={{ 
        width: size, 
        height: size,
        fontSize: size * 0.4,
        minWidth: size,
        minHeight: size
      }}
    >
      {initials}
    </div>
  );
};

export default DefaultAvatar;
