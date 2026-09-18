import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS-skall rundt den statiske eksporten i `out/`. Web-appen på GitHub Pages er fortsatt hovedsporet;
 * dette er for å kjøre appen på egen iPhone via Xcode. Se «Kjøre på iPhone via Xcode» i README.
 */
const config: CapacitorConfig = {
  appId: "io.github.fbkzzyjypbwq.hagen",
  appName: "Hagen",
  webDir: "out",
};

export default config;
