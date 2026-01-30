import { useQuery } from "@tanstack/react-query";
import { type Setting } from "@shared/schema";

interface RenovLogoProps {
  variant?: "light" | "dark" | "white";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: { width: 90, height: 25 },
  md: { width: 120, height: 34 },
  lg: { width: 150, height: 42 },
  xl: { width: 180, height: 50 },
};

function normalizeObjectPath(path: string): string {
  if (!path) return "";
  if (path.startsWith("/objects/")) return path;
  return `/objects/${path.replace(/^\/objects\/?/, "").replace(/^\//, "")}`;
}

export function RenovLogo({ variant = "light", size = "md", className = "" }: RenovLogoProps) {
  const { data: logoUrlLight } = useQuery<Setting>({ 
    queryKey: ["/api/settings/logo_url_light"]
  });

  const { data: logoUrlDark } = useQuery<Setting>({ 
    queryKey: ["/api/settings/logo_url_dark"]
  });

  const { width, height } = sizeMap[size];

  const logoUrlSetting = variant === "dark" || variant === "white" ? logoUrlDark : logoUrlLight;

  if (logoUrlSetting?.value) {
    const src = normalizeObjectPath(logoUrlSetting.value);

    return (
      <img 
        src={src} 
        alt="Renov Logo" 
        style={{ width, height, objectFit: 'contain' }}
        className={className}
        onError={(e) => {
          // If image fails to load, hide it to show SVG fallback
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  const textColor = variant === "dark" || variant === "white" ? "#FFFFFF" : "#000000";
  
  return (
    <svg 
      viewBox="0 0 180 50" 
      width={width}
      height={height}
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
          stroke={variant === "white" ? "#FFFFFF" : "#00A137"}
          strokeWidth="4"
        />
        <path
          d="M12 7 L12 2 L17 7"
          fill="none"
          stroke={variant === "white" ? "#FFFFFF" : "#00A137"}
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
