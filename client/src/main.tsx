import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { useQuery, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { queryClient } from "./lib/queryClient";

function FaviconManager() {
  const { data: faviconSetting } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/favicon_url"],
    queryFn: async () => {
      const res = await fetch("/api/settings/favicon_url");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (faviconSetting?.value) {
      const link = (document.querySelector("link[rel*='icon']") || document.createElement('link')) as HTMLLinkElement;
      link.rel = 'shortcut icon';
      link.href = faviconSetting.value;
      if (!link.parentNode) {
        document.getElementsByTagName('head')[0].appendChild(link);
      }
    }
  }, [faviconSetting]);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <FaviconManager />
    <App />
  </QueryClientProvider>
);
