import type { MetadataRoute } from "next";

// Makes the app installable to a phone's home screen ("Add to Home Screen"),
// where it opens fullscreen with its own icon instead of in a browser tab.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finance & Operations Control Center",
    short_name: "Finance Ops",
    description:
      "Integrated sales, invoicing, receivables and payables control for digital marketing and offline/print divisions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f6f7f9",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
