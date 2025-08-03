interface OneInchLogoProps {
  className?: string;
  size?: number;
}

export function OneInchLogo({ className = "", size = 24 }: OneInchLogoProps) {
  return (
    <img
      src="https://1inch.io/assets/token-logo/1inch_token.svg"
      alt="1inch Logo"
      className={className}
      width={size}
      height={size}
    />
  );
}
