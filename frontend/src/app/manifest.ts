import type { MetadataRoute } from "next";
import { PLATFORM_NAME, PLATFORM_DESCRIPTION } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PLATFORM_NAME,
    short_name: PLATFORM_NAME,
    description: PLATFORM_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
