import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Setting } from "@shared/schema";
import { useTheme } from "@/hooks/use-theme";
import { fetchWithAuth } from "@/lib/queryClient";

interface PitziLogoProps {
  variant?: "light" | "dark" | "white" | "auto";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/** @deprecated Use PitziLogoProps */
type RenovLogoProps = PitziLogoProps;

const sizeMap = {
  sm: { width: 90, height: 25 },
  md: { width: 120, height: 34 },
  lg: { width: 150, height: 42 },
  xl: { width: 180, height: 50 },
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function normalizeObjectPath(path: string): string {
  if (!path) return "";
  const normalized = path.startsWith("/objects/")
    ? path
    : `/objects/${path.replace(/^\/objects\/?/, "").replace(/^\//, "")}`;
  return `${API_BASE}${normalized}`;
}

export function PitziLogo({ variant = "auto", size = "md", className = "" }: PitziLogoProps) {
  const { theme } = useTheme();
  // 0 = nenhum erro, 1 = DB falhou (tenta static), 2 = static falhou (usa SVG inline)
  const [imgError, setImgError] = useState<0 | 1 | 2>(0);

  const { data: logoUrlLight, isLoading: isLoadingLight } = useQuery<Setting>({
    queryKey: ["/api/settings/logo_url_light"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/settings/logo_url_light");
      if (!res.ok) return { value: "" };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: logoUrlDark, isLoading: isLoadingDark } = useQuery<Setting>({
    queryKey: ["/api/settings/logo_url_dark"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/settings/logo_url_dark");
      if (!res.ok) return { value: "" };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });


  // Resetar ao trocar de setting
  useEffect(() => {
    setImgError(0);
  }, [logoUrlLight?.value, logoUrlDark?.value]);

  const { width, height } = sizeMap[size];

  const resolvedVariant = variant === "auto" ? theme : variant;
  const logoUrlSetting = resolvedVariant === "dark" || resolvedVariant === "white" ? logoUrlDark : logoUrlLight;
  const isLoading = resolvedVariant === "dark" || resolvedVariant === "white" ? isLoadingDark : isLoadingLight;

  const staticSrc = resolvedVariant === "dark" || resolvedVariant === "white"
    ? "/brand/pitzi-logo-dark.svg"
    : "/brand/pitzi-logo-light.svg";

  if (isLoading) {
    return <div style={{ width, height }} className={className} />;
  }

  // Nível 1: URL do banco (upload customizado)
  if (logoUrlSetting?.value && imgError === 0) {
    return (
      <img
        src={normalizeObjectPath(logoUrlSetting.value)}
        alt="Pitzi Logo"
        style={{ width, height, objectFit: 'contain' }}
        className={className}
        onError={() => setImgError(1)}
      />
    );
  }

  // Nível 2: Asset estático versionado no repositório
  if (imgError < 2) {
    return (
      <img
        src={staticSrc}
        alt="Pitzi Logo"
        style={{ width, height, objectFit: 'contain' }}
        className={className}
        onError={() => setImgError(2)}
      />
    );
  }

  // Nível 3: SVG inline (zero dependência externa)
  const textColor = resolvedVariant === "dark" || resolvedVariant === "white" ? "#FFFFFF" : "#0A0A0A";
  const accentColor = resolvedVariant === "dark" || resolvedVariant === "white" ? "#FFFFFF" : "#3B42DE";

  return (
    <svg
      viewBox="0 0 280 90"
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(42, 45) rotate(-12) translate(-27, -40)">
        <rect x="2" y="2" width="50" height="76" rx="11" fill="none" stroke={accentColor} strokeWidth="4"/>
        <circle cx="27" cy="16" r="5.5" stroke={accentColor} strokeWidth="3" fill="none"/>
        <circle cx="15" cy="58" r="4" fill={accentColor}/>
        <circle cx="27" cy="58" r="4" fill={accentColor}/>
        <circle cx="39" cy="58" r="4" fill={accentColor}/>
        <circle cx="15" cy="69" r="4" fill={accentColor}/>
        <circle cx="27" cy="69" r="4" fill={accentColor}/>
        <circle cx="39" cy="69" r="4" fill={accentColor}/>
      </g>
      <text
        x="88"
        y="62"
        fontFamily="Montserrat, Arial, sans-serif"
        fontWeight="800"
        fontSize="56"
        fill={textColor}
        letterSpacing="-2"
      >
        pitzi
      </text>
    </svg>
  );
}

/** @deprecated Use PitziLogo */
export const RenovLogo = PitziLogo;

export function PitziLogoIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="8" fill="#0A0A0A" />
      <text
        x="5"
        y="24"
        fontFamily="Montserrat, Arial, sans-serif"
        fontWeight="800"
        fontSize="22"
        fill="#FFFFFF"
        letterSpacing="-1"
      >P</text>
    </svg>
  );
}

/** @deprecated Use PitziLogoIcon */
export const RenovLogoIcon = PitziLogoIcon;
