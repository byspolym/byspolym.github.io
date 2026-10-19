import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { HubProvider } from "@/lib/hub";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Byspolyhub";

function ThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem("byspoly-theme");
    if (stored === "dark") document.documentElement.classList.add("dark");
  }, []);
  return null;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: "The official social hub for Bayelsa State Polytechnic, Aleibiri." },
      { name: "theme-color", content: "#0C2D6B" },
    ],
    links: [
      { rel: "icon", type: "image/jpeg", href: "/crest-official.jpg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <ThemeInit />
        <AuthProvider>
          <HubProvider>
            <Outlet />
            <Toaster position="top-center" richColors />
          </HubProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
