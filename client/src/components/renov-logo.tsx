interface RenovLogoProps {
  variant?: "light" | "dark";
  className?: string;
}

export function RenovLogo({ variant = "light", className = "" }: RenovLogoProps) {
  const textColor = variant === "dark" ? "#FFFFFF" : "#000000";
  
  return (
    <svg 
      viewBox="0 0 180 50" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="0"
        y="30"
        fontFamily="Montserrat, sans-serif"
        fontWeight="700"
        fontSize="28"
        fill={textColor}
        letterSpacing="-1"
      >
        ren
      </text>
      <g transform="translate(52, 5)">
        <circle
          cx="12"
          cy="17"
          r="10"
          fill="none"
          stroke="#00A137"
          strokeWidth="4"
        />
        <path
          d="M12 7 L12 2 L17 7"
          fill="none"
          stroke="#00A137"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <text
        x="78"
        y="30"
        fontFamily="Montserrat, sans-serif"
        fontWeight="700"
        fontSize="28"
        fill={textColor}
        letterSpacing="-1"
      >
        v.
      </text>
      <text
        x="50"
        y="46"
        fontFamily="Montserrat, sans-serif"
        fontWeight="600"
        fontSize="16"
        fill={textColor}
        letterSpacing="0"
      >
        home
      </text>
    </svg>
  );
}

export function RenovLogoIcon({ className = "" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 32 32" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="#00A137"
        strokeWidth="4"
      />
      <path
        d="M16 4 L16 -1 L21 4"
        fill="none"
        stroke="#00A137"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
