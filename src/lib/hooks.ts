"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

/** Verdi som bare finnes i nettleseren. Gir `serverValue` under prerendering, og riktig verdi etter hydrering. */
export function useClientValue<T>(getValue: () => T, serverValue: T): T {
  return useSyncExternalStore(noop, getValue, () => serverValue);
}

/** Stabil tom liste, så `useLiveQuery(...) ?? EMPTY` ikke gir ny referanse hver render. */
export const EMPTY: never[] = [];

export type VisualViewportState = { height: number; offsetTop: number; keyboardOpen: boolean };

/**
 * Synlig del av skjermen. På iOS krymper den når tastaturet er oppe, uten at layouten gjør det,
 * så faste elementer må følge `height` og `offsetTop` for å holde seg over tastaturet.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>({ height: 0, offsetTop: 0, keyboardOpen: false });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setState({ height: vv.height, offsetTop: vv.offsetTop, keyboardOpen: window.innerHeight - vv.height > 120 });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return state;
}
