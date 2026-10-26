"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { SITE } from "@/lib/site-info";

const MIN_SCALE = 1;
const MAX_SCALE = 6;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type Props = {
  label?: string;
  className?: string;
  children?: React.ReactNode;
};

export default function CampusMap({
  label = "View campus map",
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ distance: number; scale: number; cx: number; cy: number; ox: number; oy: number } | null>(null);

  function reset() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    pointers.current.clear();
    last.current = null;
    pinch.current = null;
  }

  function close() {
    setOpen(false);
    reset();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!open || !viewport) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      setScale((current) => {
        const next = clamp(current * (event.deltaY < 0 ? 1.15 : 0.87), MIN_SCALE, MAX_SCALE);
        if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
        return next;
      });
    }
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [open]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      last.current = { x: event.clientX, y: event.clientY };
      pinch.current = null;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        ox: offset.x,
        oy: offset.y,
      };
      last.current = null;
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 1 && last.current && scale > 1) {
      const dx = event.clientX - last.current.x;
      const dy = event.clientY - last.current.y;
      last.current = { x: event.clientX, y: event.clientY };
      setOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
      return;
    }

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = distance / (pinch.current.distance || distance);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const next = clamp(pinch.current.scale * ratio, MIN_SCALE, MAX_SCALE);
      setScale(next);
      setOffset(
        next === MIN_SCALE
          ? { x: 0, y: 0 }
          : {
              x: pinch.current.ox + (cx - pinch.current.cx),
              y: pinch.current.oy + (cy - pinch.current.cy),
            }
      );
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setDragging(false);
    if (pointers.current.size < 2) pinch.current = null;
    const remaining = [...pointers.current.values()][0];
    last.current = remaining ?? null;
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} aria-haspopup="dialog">
        {children ?? label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="EVSU campus map"
          onClick={close}
        >
          <div
            className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div>
                <p className="text-sm font-bold">Campus map</p>
                <p className="text-xs text-[var(--muted)]">
                  Scroll or pinch to zoom, drag to move.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setScale((s) => clamp(s * 0.8, MIN_SCALE, MAX_SCALE))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Zoom out"
                  disabled={scale <= MIN_SCALE}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setScale((s) => clamp(s * 1.25, MIN_SCALE, MAX_SCALE))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Zoom in"
                  disabled={scale >= MAX_SCALE}
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-slate-600 hover:bg-slate-50"
                  aria-label="Reset view"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                  aria-label="Close map"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              ref={viewportRef}
              className="relative flex-1 touch-none select-none overflow-hidden bg-slate-100"
              style={{ cursor: dragging ? "grabbing" : scale > 1 ? "grab" : "default" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={() => setScale((s) => (s >= MAX_SCALE ? 1 : clamp(s * 1.6, MIN_SCALE, MAX_SCALE)))}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={SITE.campusMap}
                alt="EVSU campus map showing numbered buildings, roads and the main gate"
                draggable={false}
                className="absolute left-1/2 top-1/2 max-h-none max-w-none origin-center"
                style={{
                  width: "100%",
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
                  transition: dragging ? "none" : "transform 120ms ease-out",
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-2.5 text-xs text-[var(--muted)]">
              <span>Main Gate is where visitors register.</span>
              <a
                href={SITE.campusMap}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--brand)] hover:underline"
              >
                Open original image
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
