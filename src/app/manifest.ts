import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/base-path";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hagen",
    short_name: "Hagen",
    description: "Oversikt over hagen: planter, kart, bilder og oppgaver gjennom året.",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    id: `${BASE_PATH}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8f4",
    theme_color: "#f7f8f4",
    lang: "nb",
    icons: [
      { src: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE_PATH}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
      {
        src: `${BASE_PATH}/icons/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
