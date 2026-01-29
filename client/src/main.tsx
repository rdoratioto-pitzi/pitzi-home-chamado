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
      if (!res.ok) return { value: "" };
      return res.json();
    },
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (faviconSetting?.value) {
      const existingLinks = document.querySelectorAll("link[rel*='icon']");
      existingLinks.forEach(link => link.remove());
      
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/x-icon';
      link.href = faviconSetting.value + (faviconSetting.value.includes('?') ? '&' : '?') + 't=' + Date.now();
      document.getElementsByTagName('head')[0].appendChild(link);
      
      const shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      shortcutLink.href = faviconSetting.value + (faviconSetting.value.includes('?') ? '&' : '?') + 't=' + Date.now();
      document.getElementsByTagName('head')[0].appendChild(shortcutLink);
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
