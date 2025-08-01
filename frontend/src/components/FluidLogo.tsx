// src/components/FluidLogo.tsx
import React, { FC } from "react";

export const FluidLogo: FC = () => {
  return (
    <div className="relative w-20 h-20">
      {/* Cercle de fond floral */}
      <div className="absolute inset-0 animate-pulse" />

      {/* Blob animé façon goutte de sève */}
      <div
        className="absolute top-1/4 left-1/4 w-8 h-8 bg-gradient-to-br from-lime-400 to-emerald-600
                 rounded-full animate-[leafblob_5s_ease-in-out_infinite]"
      />

      {/* Style des keyframes */}
      <style>{`
        @keyframes leafblob {
          0%,
          100% {
            border-radius: 40% 60% 50% 50%;
            transform: scale(1) translate(0, 0);
          }
          25% {
            border-radius: 50% 40% 60% 50%;
            transform: scale(1.1) translate(5%, -5%);
          }
          50% {
            border-radius: 60% 50% 40% 60%;
            transform: scale(0.9) translate(-5%, 5%);
          }
          75% {
            border-radius: 50% 60% 50% 40%;
            transform: scale(1.05) translate(5%, 5%);
          }
        }
      `}</style>
    </div>
  );
};

export default FluidLogo;
