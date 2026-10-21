"use client";

import { useEffect } from "react";
import { requestSync, startCloudSync } from "@/lib/cloud-sync";

/** Starter synkroniseringen mot Google Disk, og synkroniserer når nettet kommer tilbake og når appen kommer i forgrunnen. */
export function CloudSync() {
  useEffect(() => {
    void startCloudSync();
    const onOnline = () => requestSync();
    const onVisible = () => {
      if (document.visibilityState === "visible") requestSync();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
