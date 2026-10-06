"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const MIN_SCORE = 0;
const MAX_SCORE = 10;
const ITEM_W = 76;
const DIGITS = Array.from({ length: 11 }, (_, i) => i);

interface RatingWheelProps {
  /** Persisted score (from DB) or null. Syncs position until first interaction. */
  score: number | null;
  /** Fires on every center change while scrolling (live selection only —
   *  saving happens when the user presses the «Оценить» button). */
  onScoreChange?: (score: number) => void;
}

function clampScore(n: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, n));
}

function digitColor(dist: number): string {
  if (dist === 0) return "text-primary";
  if (dist === 1) return "text-foreground/60";
  if (dist === 2) return "text-foreground/40";
  return "text-foreground/20";
}

function digitSize(dist: number): string {
  if (dist === 0) return "46px";
  if (dist === 1) return "27px";
  if (dist === 2) return "22px";
  return "18px";
}

/**
 * Kinopoisk-style horizontal rating wheel 0–10.
 * Snap scrolling + drag (mouse) + wheel + click + keyboard arrows + haptics.
 * Selection only — persistence is explicit via the «Оценить» button.
 */
export function RatingWheel({
  score,
  onScoreChange,
}: RatingWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState(5);
  const [spacerW, setSpacerW] = useState(0);

  const centerRef = useRef(5);
  const interactedRef = useRef(false);
  const spacerRef = useRef(0);
  const rafRef = useRef(0);
  const magnetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ x: number; left: number } | null>(null);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);

  // Always call the latest callbacks (they capture fresh review drafts etc.)
  const changeRef = useRef(onScoreChange);
  const scoreRef = useRef(score);
  useEffect(() => {
    changeRef.current = onScoreChange;
    scoreRef.current = score;
  });

  const leftFor = useCallback((i: number): number => {
    const el = containerRef.current;
    const w = el?.clientWidth ?? 0;
    return spacerRef.current + i * ITEM_W + ITEM_W / 2 - w / 2;
  }, []);

  const applyCenter = useCallback((i: number, fromUser = false) => {
    const changed = i !== centerRef.current;
    if (!changed && !fromUser) return;
    if (changed) {
      centerRef.current = i;
      setCenter(i);
    }
    if (!fromUser) return;
    // Light haptic feedback on Android — only when the digit actually changed
    if (
      changed &&
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      try {
        navigator.vibrate(10);
      } catch {
        /* vibration not permitted */
      }
    }
    changeRef.current?.(i);
  }, []);

  const computeCenterFromScroll = useCallback((): number => {
    const el = containerRef.current;
    if (!el) return centerRef.current;
    const raw =
      (el.scrollLeft + el.clientWidth / 2 - spacerRef.current - ITEM_W / 2) /
      ITEM_W;
    return clampScore(Math.round(raw));
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      applyCenter(computeCenterFromScroll(), interactedRef.current);
    });
  }, [applyCenter, computeCenterFromScroll]);

  const scrollToScore = useCallback(
    (i: number, behavior: ScrollBehavior = "smooth") => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTo({ left: leftFor(i), behavior });
    },
    [leftFor],
  );

  const scrollToItem = useCallback(
    (i: number) => {
      const el = containerRef.current;
      if (!el) return;
      interactedRef.current = true;
      const target = leftFor(i);
      if (Math.abs(el.scrollLeft - target) < 2) {
        // Already centered (e.g. browser focus-scroll + snap moved the strip
        // before the click): no scroll events will fire, so apply the
        // selection right now.
        applyCenter(i, true);
      } else {
        scrollToScore(i);
      }
    },
    [leftFor, scrollToScore, applyCenter],
  );

  // Measure spacer width so that 0 and 10 can reach the center
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.max(0, el.clientWidth / 2 - ITEM_W / 2);
      spacerRef.current = w;
      setSpacerW(w);
      if (!interactedRef.current) {
        const target = scoreRef.current ?? 5;
        el.scrollTo({ left: leftFor(target) });
        applyCenter(target);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [leftFor, applyCenter]);

  // External sync (my ratings loaded / rating removed) until user interacts
  useEffect(() => {
    const el = containerRef.current;
    if (!el || interactedRef.current || score === null) return;
    el.scrollTo({ left: leftFor(score) });
    // apply the center on the next frame (scroll events may not fire if the
    // position is already correct)
    const raf = requestAnimationFrame(() => applyCenter(score));
    return () => cancelAnimationFrame(raf);
  }, [score, spacerW, leftFor, applyCenter]);

  // Vertical mouse wheel → horizontal scroll, then magnet to nearest digit
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      interactedRef.current = true;
      el.scrollLeft += e.deltaY * 1.3;
      if (magnetTimerRef.current) clearTimeout(magnetTimerRef.current);
      magnetTimerRef.current = setTimeout(() => {
        magnetTimerRef.current = null;
        scrollToScore(computeCenterFromScroll());
      }, 160);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (magnetTimerRef.current) clearTimeout(magnetTimerRef.current);
    };
  }, [scrollToScore, computeCenterFromScroll]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const handleItemClick = (i: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    scrollToItem(i);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = clampScore(centerRef.current + 1);
    else if (e.key === "ArrowLeft") next = clampScore(centerRef.current - 1);
    else if (e.key === "Home") next = MIN_SCORE;
    else if (e.key === "End") next = MAX_SCORE;
    if (next === null) return;
    e.preventDefault();
    scrollToItem(next);
  };

  // Drag-to-scroll with a mouse (touch uses native scroll + snap)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = containerRef.current;
    if (!el) return;
    dragRef.current = { x: e.clientX, left: el.scrollLeft };
    draggingRef.current = false;
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const el = containerRef.current;
    if (!el) return;
    const dx = e.clientX - drag.x;
    if (!draggingRef.current && Math.abs(dx) > 6) {
      draggingRef.current = true;
      interactedRef.current = true;
      suppressClickRef.current = true;
    }
    if (draggingRef.current) {
      el.scrollLeft = drag.left - dx;
    }
  };
  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (draggingRef.current) {
      draggingRef.current = false;
      scrollToScore(computeCenterFromScroll());
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 80);
    }
  };

  return (
    <div
      className="relative w-full min-w-0 select-none"
      role="group"
      aria-label="Колесо оценки от 0 до 10: листайте, нажмите цифру или используйте стрелки"
    >
      {/* soft neon glow behind the center digit */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-2xl"
      />
      <div
        ref={containerRef}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        className="wheel-strip relative z-10 h-[100px] w-full cursor-grab snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:cursor-grabbing"
      >
        <div className="flex h-full items-center" style={{ width: "max-content" }}>
          <div aria-hidden className="shrink-0" style={{ width: spacerW }} />
          {DIGITS.map((i) => {
            const dist = Math.abs(i - center);
            return (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleItemClick(i)}
                aria-label={`Оценка ${i}`}
                aria-current={i === center ? "true" : undefined}
                className="flex h-[84px] shrink-0 cursor-pointer snap-center items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-none"
                style={{ width: ITEM_W }}
              >
                <span
                  className={cn(
                    "wheel-digit font-extrabold tabular-nums",
                    digitColor(dist),
                    dist === 0 ? "scale-110" : "scale-100",
                  )}
                  style={{ fontSize: digitSize(dist) }}
                >
                  {i}
                </span>
              </button>
            );
          })}
          <div aria-hidden className="shrink-0" style={{ width: spacerW }} />
        </div>
      </div>
      {/* center caret under the selected digit */}
      <div
        aria-hidden
        className="relative z-20 -mt-1 flex h-3 items-start justify-center"
      >
        <div className="h-1.5 w-10 rounded-full bg-primary shadow-[0_0_14px_var(--primary)]" />
      </div>
    </div>
  );
}
