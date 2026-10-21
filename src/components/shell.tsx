"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDrag } from "@use-gesture/react";
import { PlantsScreen } from "@/components/screens/plants";
import { AssistantScreen } from "@/components/screens/assistant";
import { IdentifyScreen, type ShellTarget } from "@/components/screens/identify";
import { IdentifyHistoryPanel } from "@/components/screens/identify-history";
import { Frame } from "@/components/frame";

/** Sidene i skallet, fra venstre: plantene, kameraet (der appen starter) og assistenten. */
type Pane = 0 | 1 | 2;
const PLANTS: Pane = 0;
const CAMERA: Pane = 1;
const ASSISTANT: Pane = 2;

type Props = {
  /** `vis` i adressen: hvilken del som er åpen. Tom betyr kameraet. */
  vis: string | null;
  focusPlantId?: string;
  initialQuestion?: string;
};

/** Hva et drag har vist seg å være: sidebytte, historikk-panelet, eller noe siden selv tar seg av (ruller, skriver). */
type DragMemo = { mode?: "x" | "y" | "none" };

const TRANSITION = "transform 340ms cubic-bezier(0.22, 1, 0.36, 1)";
const FIELDS = "input, textarea, select";

function paneFromVis(vis: string | null): Pane {
  return vis === "planter" ? PLANTS : vis === "assistent" ? ASSISTANT : CAMERA;
}

function visFor(pane: Pane, history: boolean): string | null {
  return history ? "historikk" : pane === PLANTS ? "planter" : pane === ASSISTANT ? "assistent" : null;
}

/** Sant når berøringen startet i noe som ruller sidelengs selv (kategorirad, referansebilder). */
function scrollsSideways(target: Element, root: Element): boolean {
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    const style = getComputedStyle(el);
    if ((style.overflowX === "auto" || style.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

/** Flytter sideraden: hele sider i prosent av raden (tre sider brede), pluss fingerens forskyvning i piksler. */
function moveStrip(el: HTMLElement | null, pane: Pane, dx: number, animate: boolean) {
  if (!el) return;
  el.style.transition = animate ? TRANSITION : "none";
  el.style.transform = `translate3d(calc(${(-pane * 100) / 3}% + ${dx}px), 0, 0)`;
}

/** Historikk-panelet ligger under skjermen og dras opp. */
function moveHistory(el: HTMLElement | null, open: boolean, dy: number, animate: boolean) {
  if (!el) return;
  el.style.transition = animate ? TRANSITION : "none";
  el.style.transform = open ? `translate3d(0, ${dy}px, 0)` : `translate3d(0, calc(100% + ${dy}px), 0)`;
}

/**
 * Forsiden, lagt opp som Snapchat: kameraet står på med en gang, plantene ligger til venstre (sveip mot høyre) og
 * assistenten til høyre (sveip mot venstre), og historikken over identifiseringer dras opp nedenfra. Alle tre sidene
 * er montert hele tiden, så kameraet er varmt og samtalen står der den var. Hvilken del som er åpen speiles i adressen
 * (`?vis=`), så en side som åpnes derfra (en plante, en identifisering, innstillingene) kommer tilbake til samme sted.
 */
export function Shell({ vis, focusPlantId, initialQuestion }: Props) {
  const [pane, setPane] = useState<Pane>(() => paneFromVis(vis));
  const [historyOpen, setHistoryOpen] = useState(vis === "historikk");
  const [reviewing, setReviewing] = useState(false);
  // Startstillingen settes én gang i markeringen; etterpå flyttes elementene direkte, uten å gå om React.
  const [initialPane] = useState(pane);
  const [initialHistory] = useState(historyOpen);
  /** Adressen sist den ble lest, så en ny `vis` (en lenke til /?vis=assistent fra et forslagskort) bytter side. */
  const [seenVis, setSeenVis] = useState(vis);
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef(pane);
  const historyOpenRef = useRef(historyOpen);
  const reviewingRef = useRef(reviewing);
  /** Etter et drag med musen kommer det et klikk på det som lå under pekeren. Det skal ikke åpne noe. */
  const suppressClickUntil = useRef(0);

  if (vis !== seenVis) {
    setSeenVis(vis);
    setPane(paneFromVis(vis));
    setHistoryOpen(vis === "historikk");
  }
  useEffect(() => {
    paneRef.current = pane;
  }, [pane]);
  useEffect(() => {
    historyOpenRef.current = historyOpen;
  }, [historyOpen]);
  useEffect(() => {
    reviewingRef.current = reviewing;
  }, [reviewing]);
  useLayoutEffect(() => {
    moveStrip(stripRef.current, pane, 0, true);
  }, [pane]);
  useLayoutEffect(() => {
    moveHistory(historyRef.current, historyOpen, 0, true);
  }, [historyOpen]);

  const syncUrl = useCallback((next: Pane, history: boolean) => {
    const params = new URLSearchParams(window.location.search);
    const v = visFor(next, history);
    if (v) params.set("vis", v);
    else params.delete("vis");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  const goTo = useCallback(
    (next: Pane) => {
      paneRef.current = next;
      setPane(next);
      syncUrl(next, false);
    },
    [syncUrl]
  );

  const showHistory = useCallback(
    (open: boolean) => {
      historyOpenRef.current = open;
      setHistoryOpen(open);
      syncUrl(paneRef.current, open);
    },
    [syncUrl]
  );

  const navigate = useCallback(
    (target: ShellTarget) => {
      if (target === "historikk") showHistory(true);
      else goTo(target === "planter" ? PLANTS : ASSISTANT);
    },
    [goTo, showHistory]
  );

  // Sidebytte med fingeren, og historikken opp fra kameraet. Berøringshendelser med passive: false, så siden kan
  // hindre rullingen når draget er vårt, og la den gå når det ikke er det.
  useDrag(
    ({ first, active, tap, movement: [mx, my], velocity: [vx, vy], event, memo, cancel }) => {
      let m = memo as DragMemo | undefined;
      if (first) {
        m = {};
        const target = event.target as Element;
        if (reviewingRef.current || historyOpenRef.current || target.closest(FIELDS)) {
          m.mode = "none";
          cancel();
        }
      }
      if (!m || m.mode === "none" || tap) return m;
      if (!m.mode) {
        const ax = Math.abs(mx);
        const ay = Math.abs(my);
        if (Math.max(ax, ay) < 6) return m;
        if (ax > ay) {
          if (scrollsSideways(event.target as Element, rootRef.current!)) {
            m.mode = "none";
            cancel();
            return m;
          }
          m.mode = "x";
        } else if (paneRef.current === CAMERA && my < 0) {
          m.mode = "y";
        } else {
          // Loddrett på plantene eller assistenten er vanlig rulling.
          m.mode = "none";
          cancel();
          return m;
        }
      }
      if (event.cancelable) event.preventDefault();
      const root = rootRef.current!;
      if (m.mode === "x") {
        const from = paneRef.current;
        // Det finnes ingen side til venstre for plantene eller til høyre for assistenten: raden gir bare litt etter.
        const beyond = (from === PLANTS && mx > 0) || (from === ASSISTANT && mx < 0);
        if (active) {
          moveStrip(stripRef.current, from, beyond ? mx * 0.3 : mx, false);
          return m;
        }
        const flick = Math.abs(vx) > 0.5 && Math.abs(mx) > 20;
        const far = Math.abs(mx) > root.clientWidth * 0.35;
        const next = flick || far ? (Math.min(ASSISTANT, Math.max(PLANTS, from + (mx < 0 ? 1 : -1))) as Pane) : from;
        suppressClickUntil.current = Date.now() + 400;
        goTo(next);
        moveStrip(stripRef.current, next, 0, true);
      } else {
        if (active) {
          moveHistory(historyRef.current, false, Math.min(0, my), false);
          return m;
        }
        const open = -my > root.clientHeight * 0.2 || (Math.abs(vy) > 0.5 && -my > 20);
        suppressClickUntil.current = Date.now() + 400;
        showHistory(open);
        moveHistory(historyRef.current, open, 0, true);
      }
      return m;
    },
    { target: rootRef, pointer: { touch: true }, eventOptions: { passive: false }, filterTaps: true }
  );

  // Historikken lukkes ved å dra den ned, men bare når listen står øverst. Ellers ruller listen som vanlig.
  useDrag(
    ({ first, active, tap, movement: [mx, my], velocity: [, vy], event, memo, cancel }) => {
      let m = memo as DragMemo | undefined;
      if (first) {
        m = {};
        if ((event.target as Element).closest(FIELDS)) {
          m.mode = "none";
          cancel();
        }
      }
      if (!m || m.mode === "none" || tap) return m;
      if (!m.mode) {
        const ax = Math.abs(mx);
        const ay = Math.abs(my);
        if (Math.max(ax, ay) < 4) return m;
        const atTop = (historyScrollRef.current?.scrollTop ?? 0) <= 0;
        if (ay >= ax && my > 0 && atTop) {
          m.mode = "y";
        } else {
          m.mode = "none";
          cancel();
          return m;
        }
      }
      if (event.cancelable) event.preventDefault();
      if (active) {
        moveHistory(historyRef.current, true, Math.max(0, my), false);
        return m;
      }
      const close = my > rootRef.current!.clientHeight * 0.2 || (Math.abs(vy) > 0.5 && my > 20);
      suppressClickUntil.current = Date.now() + 400;
      showHistory(!close);
      moveHistory(historyRef.current, !close, 0, true);
      return m;
    },
    { target: historyRef, pointer: { touch: true }, eventOptions: { passive: false }, filterTaps: true }
  );

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 overflow-hidden bg-background"
      // Med mus ville et drag som starter på en lenke eller et bilde blitt til dra-og-slipp, og sveipet stoppet.
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (Date.now() < suppressClickUntil.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div
        ref={stripRef}
        className="absolute inset-y-0 left-0 flex w-[300%] will-change-transform"
        style={{ transform: `translate3d(${(-initialPane * 100) / 3}%, 0, 0)` }}
      >
        <section aria-label="Planter" inert={pane !== PLANTS} className="relative h-full w-1/3 bg-background" style={{ touchAction: "pan-y" }}>
          <Frame>
            <div className="pb-4">
              <PlantsScreen />
            </div>
          </Frame>
        </section>
        <section
          aria-label="Identifiser"
          inert={pane !== CAMERA}
          className="relative h-full w-1/3 overflow-hidden bg-background"
          style={{ touchAction: reviewing ? "pan-y" : "none" }}
        >
          <IdentifyScreen onNavigate={navigate} onReviewingChange={setReviewing} />
        </section>
        <section aria-label="Assistent" inert={pane !== ASSISTANT} className="relative h-full w-1/3 bg-background" style={{ touchAction: "pan-y" }}>
          <Frame>
            <div className="pb-4">
              {/* Ny nøkkel når man kommer fra en plante, så samtalen starter på nytt med riktig fokus. */}
              <AssistantScreen key={`${focusPlantId ?? ""}|${initialQuestion ?? ""}`} focusPlantId={focusPlantId} initialQuestion={initialQuestion} />
            </div>
          </Frame>
        </section>
      </div>
      <div
        ref={historyRef}
        inert={!historyOpen}
        className="absolute inset-0 z-20 bg-background will-change-transform"
        style={{ transform: `translate3d(0, ${initialHistory ? 0 : 100}%, 0)` }}
      >
        <IdentifyHistoryPanel scrollRef={historyScrollRef} onClose={() => showHistory(false)} />
      </div>
    </div>
  );
}
