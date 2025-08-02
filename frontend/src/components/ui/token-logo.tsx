import React from "react";

interface TokenLogoProps {
  symbol: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const TokenLogo: React.FC<TokenLogoProps> = ({
  symbol,
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const getLogoComponent = (symbol: string) => {
    switch (symbol.toLowerCase()) {
      case "eth":
      case "ethereum":
        return (
          <div
            className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-sm`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-3/4 h-3/4">
              <path
                d="M12 2L12.5 8.5L18 12L12 14L12.5 22L6 12L12 2Z"
                fill="white"
              />
            </svg>
          </div>
        );

      case "near":
        return (
          <div
            className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center shadow-sm`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-3/4 h-3/4">
              <path
                d="M8 4L16 20L12 16L8 4Z M16 4L8 20L12 8L16 4Z"
                fill="white"
              />
            </svg>
          </div>
        );

      case "trx":
      case "tron":
        return (
          <div
            className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center shadow-sm`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-3/4 h-3/4">
              <path d="M4 4L20 8L8 20L4 4Z" fill="white" />
            </svg>
          </div>
        );

      case "usdc":
        return (
          <div
            className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-r from-blue-400 to-blue-500 flex items-center justify-center shadow-sm`}
          >
            <span className="text-white font-bold text-xs">$</span>
          </div>
        );

      case "weth":
        return (
          <div
            className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center shadow-sm`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-3/4 h-3/4">
              <path
                d="M12 2L12.5 8.5L18 12L12 14L12.5 22L6 12L12 2Z"
                fill="white"
              />
            </svg>
          </div>
        );

      case "wbtc":
        return (
          <div
            className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center shadow-sm`}
          >
            <span className="text-white font-bold text-xs">₿</span>
          </div>
        );

      case "dai":
        return (
          <div
            className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 flex items-center justify-center shadow-sm`}
          >
            <span className="text-white font-bold text-xs">◈</span>
          </div>
        );

      default:
        return (
          <div
            className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-r from-gray-400 to-gray-500 flex items-center justify-center shadow-sm`}
          >
            <span className="text-white font-bold text-xs">
              {symbol.charAt(0).toUpperCase()}
            </span>
          </div>
        );
    }
  };

  return getLogoComponent(symbol);
};
