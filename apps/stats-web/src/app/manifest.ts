import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Akash Stats",
    short_name: "Akash Stats",
    description: "Akash Stats - The Akash Network Dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#fff",
    theme_color: "#fff",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/android-chrome-384x384.png",
        sizes: "384x384",
        type: "image/png"
      }
    ]
  };
}
