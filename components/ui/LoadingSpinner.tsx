import React from "react";

type LoadingSpinnerProps = {
  label?: string;
  className?: string;
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ label, className }) => {
  return (
    <div className={`text-center${className ? ` ${className}` : ""}`}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#701CC0] mx-auto" />
      {label ? <p className="mt-2 text-sm text-[#6B7280]">{label}</p> : null}
    </div>
  );
};

export default LoadingSpinner;
