import React from "react";

interface ZoyaLogoProps {
  className?: string;
  size?: number;
  showGlow?: boolean;
}

export default function ZoyaLogo({ className = "", size = 36, showGlow = true }: ZoyaLogoProps) {
  return (
    <div 
      className={`relative rounded-full overflow-hidden shrink-0 flex items-center justify-center ${showGlow ? "shadow-lg shadow-red-600/30 ring-1 ring-red-500/60" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/logo.svg"
        alt="Royal Ankit Ahiran Logo"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover select-none"
        width={size}
        height={size}
      />
    </div>
  );
}
