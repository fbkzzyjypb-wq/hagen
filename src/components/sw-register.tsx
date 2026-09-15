"use client";

import { useEffect } from "react";
import { asset, BASE_PATH } from "@/lib/base-path";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker
      .register(asset("/sw.js"), { scope: `${BASE_PATH}/` })
      .catch((err) => console.warn("Service worker feilet", err));
  }, []);
  return null;
}
