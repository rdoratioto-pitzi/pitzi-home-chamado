import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Setting } from "@shared/schema";
import { useTheme } from "@/hooks/use-theme";

interface RenovLogoProps {
  variant?: "light" | "dark" | "white" | "auto";
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

export function RenovLogo({ variant = "auto", size = "md", className = "" }: RenovLogoProps) {
  const { theme } = useTheme();
  // 0 = nenhum erro, 1 = DB falhou (tenta static), 2 = static falhou (usa SVG inline)
  const [imgError, setImgError] = useState<0 | 1 | 2>(0);

  const { data: logoUrlLight, isLoading: isLoadingLight } = useQuery<Setting>({
    queryKey: ["/api/settings/logo_url_light"],
    queryFn: async () => {
      const res = await fetch("/api/settings/logo_url_light");
      if (!res.ok) return { value: "" };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: logoUrlDark, isLoading: isLoadingDark } = useQuery<Setting>({
    queryKey: ["/api/settings/logo_url_dark"],
    queryFn: async () => {
      const res = await fetch("/api/settings/logo_url_dark");
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

  // Asset estático comprometido no repositório — fallback garantido
  const staticSrc = resolvedVariant === "dark" || resolvedVariant === "white"
    ? "/brand/renov-logo-dark.svg"
    : "/brand/renov-logo-light.svg";

  if (isLoading) {
    return <div style={{ width, height }} className={className} />;
  }

  // Nível 1: URL do banco (upload customizado)
  if (logoUrlSetting?.value && imgError === 0) {
    return (
      <img
        src={normalizeObjectPath(logoUrlSetting.value)}
        alt="Renov Logo"
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
        alt="Renov Logo"
        style={{ width, height, objectFit: 'contain' }}
        className={className}
        onError={() => setImgError(2)}
      />
    );
  }

  // Nível 3: SVG inline (zero dependência externa)
  const textColor = resolvedVariant === "dark" || resolvedVariant === "white" ? "#FFFFFF" : "#000000";

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
          stroke={resolvedVariant === "white" ? "#FFFFFF" : "#00A137"}
          strokeWidth="4"
        />
        <path
          d="M12 7 L12 2 L17 7"
          fill="none"
          stroke={resolvedVariant === "white" ? "#FFFFFF" : "#00A137"}
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
