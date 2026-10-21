"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type CameraStatus = "starting" | "live" | "denied" | "unavailable";

/** Så langt kan søkeren zoome. Lenger inn blir bildet for grovt til å identifisere noe. */
export const MAX_ZOOM = 3;

type VideoWithFrames = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/** Zoomen kameraet selv kan gjøre, når nettleseren lar oss styre den (iOS 17 og nyere, Chrome). */
type NativeZoom = { min: number; max: number };

function nativeZoomOf(track: MediaStreamTrack): NativeZoom | null {
  const caps = (track.getCapabilities?.() ?? {}) as { zoom?: { min?: number; max?: number } };
  if (!caps.zoom || typeof caps.zoom.max !== "number" || caps.zoom.max <= 1) return null;
  return { min: typeof caps.zoom.min === "number" ? caps.zoom.min : 1, max: caps.zoom.max };
}

/**
 * Levende bilde fra bakkameraet, tegnet inn i et <canvas> så det fyller flaten sin, beskåret i midten slik
 * `object-fit: cover` skulle gjort. Selve <video>-elementet holdes skjult: iOS viser kamerastrømmer i sitt eget lag,
 * der størrelse og beskjæring ikke følger CSS, mens et canvas er en vanlig flate. Strømmen startes når `active` er
 * sann, stoppes når appen går i bakgrunnen (så kameralampen ikke står på unødig) og startes igjen når appen kommer
 * tilbake. iOS stopper strømmen selv når et annet program tar kameraet; da startes den på nytt.
 *
 * `zoom` går fra 1 til `MAX_ZOOM`. Kan kameraet zoome selv, brukes det (skarpere, og bildet kommer ferdig zoomet);
 * ellers beskjæres bildet i canvaset, og `capture` beskjærer likedan, så bildet som sendes er det som vises.
 */
export function useLiveCamera(active: boolean): {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status: CameraStatus;
  capture: () => Promise<Blob | null>;
  zoom: number;
  setZoom: (zoom: number) => void;
  maxZoom: number;
} {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeRef = useRef<NativeZoom | null>(null);
  const zoomRef = useRef(1);
  /** Den delen av zoomen kameraet ikke tar selv, og som canvaset må beskjære. */
  const digitalRef = useRef(1);
  const [status, setStatus] = useState<CameraStatus>("starting");
  const [zoom, setZoomState] = useState(1);

  const setZoom = useCallback((value: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, Number.isFinite(value) ? value : 1));
    zoomRef.current = z;
    setZoomState(z);
    const track = streamRef.current?.getVideoTracks()[0];
    const native = nativeRef.current;
    if (track && native) {
      const own = Math.min(native.max, Math.max(native.min, z));
      digitalRef.current = Math.max(1, z / own);
      // Asynkront, og siste verdi vinner. Feiler det, står kameraet der det sto.
      track.applyConstraints({ advanced: [{ zoom: own } as MediaTrackConstraintSet] }).catch(() => undefined);
    } else {
      digitalRef.current = z;
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let starting = false;
    let frameHandle = 0;
    let usingVideoFrames = false;

    /** Tegner bildet som vises nå, så stort at det dekker hele flaten, med like mye skåret bort på hver side. */
    function draw() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(rect.width * dpr);
      const ch = Math.round(rect.height * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const scale = Math.max(cw / video.videoWidth, ch / video.videoHeight) * digitalRef.current;
      const sw = cw / scale;
      const sh = ch / scale;
      ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, cw, ch);
    }

    // Tegnes for hvert bilde fra kameraet der nettleseren kan si fra om det, ellers for hver skjermoppdatering.
    function schedule() {
      if (cancelled || !streamRef.current) return;
      const video = videoRef.current as VideoWithFrames | null;
      if (video?.requestVideoFrameCallback) {
        usingVideoFrames = true;
        frameHandle = video.requestVideoFrameCallback(tick);
      } else {
        usingVideoFrames = false;
        frameHandle = requestAnimationFrame(tick);
      }
    }
    function tick() {
      draw();
      schedule();
    }
    function stopDrawing() {
      const video = videoRef.current as VideoWithFrames | null;
      if (usingVideoFrames) video?.cancelVideoFrameCallback?.(frameHandle);
      else cancelAnimationFrame(frameHandle);
    }

    function stop() {
      stopDrawing();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      nativeRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    async function start() {
      if (starting || streamRef.current) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
      }
      starting = true;
      setStatus("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        });
        const video = videoRef.current;
        if (cancelled || !video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        nativeRef.current = track ? nativeZoomOf(track) : null;
        // Zoomen fra før strømmen startet på nytt gjelder fortsatt.
        setZoom(zoomRef.current);
        video.srcObject = stream;
        // Avvises play() av autoplay-reglene, starter videoen likevel selv: den er stum og spilles i elementet.
        await video.play().catch(() => undefined);
        if (cancelled) return;
        setStatus("live");
        schedule();
        track?.addEventListener("ended", () => {
          if (cancelled || streamRef.current !== stream) return;
          stop();
          if (document.visibilityState === "visible") void start();
        });
      } catch (err) {
        if (!cancelled) setStatus(err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError") ? "denied" : "unavailable");
      } finally {
        starting = false;
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else void start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState !== "hidden") void start();
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [active, setZoom]);

  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !streamRef.current || video.readyState < 2 || !video.videoWidth) return null;
    // Samme utsnitt som søkeren viser når canvaset står for zoomen.
    const digital = digitalRef.current;
    const sw = Math.round(video.videoWidth / digital);
    const sh = Math.round(video.videoHeight / digital);
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, sw, sh);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  }, []);

  return { videoRef, canvasRef, status, capture, zoom, setZoom, maxZoom: MAX_ZOOM };
}
