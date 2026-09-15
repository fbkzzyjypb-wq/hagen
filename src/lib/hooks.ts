"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Verdi som bare finnes i nettleseren. Gir `serverValue` under prerendering, og riktig verdi etter hydrering. */
export function useClientValue<T>(getValue: () => T, serverValue: T): T {
  return useSyncExternalStore(noop, getValue, () => serverValue);
}

/** Stabil tom liste, så `useLiveQuery(...) ?? EMPTY` ikke gir ny referanse hver render. */
export const EMPTY: never[] = [];
