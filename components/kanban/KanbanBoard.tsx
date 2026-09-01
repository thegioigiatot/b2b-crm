"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { setDragCursor } from "@/lib/dom";

export type KanbanColumn<T> = {
  id: string;
  title: React.ReactNode;
  headerRight?: React.ReactNode;
  accent?: string | null;
  footer?: React.ReactNode;
  items: T[];
};

type Props<T extends { id: string }> = {
  columns: KanbanColumn<T>[];
  renderCard: (item: T, dragging: boolean) => React.ReactNode;
  onMove: (itemId: string, toColumnId: string, orderedIds: string[]) => void | Promise<void>;
  columnClassName?: string;
  className?: string;
};

function signatureOf<T extends { id: string }>(cols: KanbanColumn<T>[]) {
  return cols.map((c) => `${c.id}:${c.items.map((i) => i.id).join(",")}`).join("|");
}

const DRAG_THRESHOLD = 5;

export default function KanbanBoard<T extends { id: string }>({
  columns,
  renderCard,
  onMove,
  columnClassName,
  className,
}: Props<T>) {
  const [cols, setCols] = useState(columns);
  const [isPending, startTransition] = useTransition();

  // Pointer-drag state
  const [drag, setDrag] = useState<{
    item: T;
    fromCol: string;
    width: number;
    height: number;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [over, setOver] = useState<{ col: string; index: number } | null>(null);
  const pending = useRef<{ item: T; fromCol: string; startX: number; startY: number; rect: DOMRect } | null>(null);
  const movedRef = useRef(false);
  const justDragged = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Refs mirror state so the window-level pointer handlers (captured once on
  // pointerdown) always read the latest values.
  const overRef = useRef<{ col: string; index: number } | null>(null);
  const colsRef = useRef(cols);
  useEffect(() => {
    colsRef.current = cols;
  }, [cols]);
  const setOverBoth = (v: { col: string; index: number } | null) => {
    overRef.current = v;
    setOver(v);
  };

  // Re-sync with server state when it changes and we're idle (render-time adjustment).
  const sig = signatureOf(columns);
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig && !isPending && !drag) {
    setPrevSig(sig);
    setCols(columns);
  }

  function computeOver(clientX: number, clientY: number) {
    const el = document.elementFromPoint(clientX, clientY);
    const colEl = el?.closest<HTMLElement>("[data-col-id]");
    if (!colEl) return null;
    const colId = colEl.dataset.colId!;
    const cards = Array.from(colEl.querySelectorAll<HTMLElement>("[data-kanban-item]"));
    let index = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        index = i;
        break;
      }
    }
    return { col: colId, index };
  }

  function onPointerDown(e: React.PointerEvent, item: T, fromCol: string) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, select, input, textarea")) return;
    const card = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pending.current = { item, fromCol, startX: e.clientX, startY: e.clientY, rect: card };
    movedRef.current = false;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  function onPointerMove(e: PointerEvent) {
    const p = pending.current;
    if (!p) return;
    if (!movedRef.current) {
      const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
      if (dist < DRAG_THRESHOLD) return;
      movedRef.current = true;
      setDrag({
        item: p.item,
        fromCol: p.fromCol,
        width: p.rect.width,
        height: p.rect.height,
        x: e.clientX,
        y: e.clientY,
        offsetX: p.startX - p.rect.left,
        offsetY: p.startY - p.rect.top,
      });
      setDragCursor(true);
    }
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    setOverBoth(computeOver(e.clientX, e.clientY));
  }

  function onPointerUp() {
    window.removeEventListener("pointermove", onPointerMove);
    setDragCursor(false);
    const p = pending.current;
    pending.current = null;

    if (p && movedRef.current) {
      const target = overRef.current ?? { col: p.fromCol, index: 0 };
      const next = colsRef.current.map((c) => ({ ...c, items: [...c.items] }));
      const src = next.find((c) => c.items.some((i) => i.id === p.item.id));
      const dst = next.find((c) => c.id === target.col);
      if (src && dst) {
        const moved = src.items.find((i) => i.id === p.item.id)!;
        const wasIndex = src.items.findIndex((i) => i.id === p.item.id);
        src.items = src.items.filter((i) => i.id !== p.item.id);
        let insertAt = target.index;
        if (src.id === dst.id && wasIndex < target.index) insertAt -= 1;
        insertAt = Math.max(0, Math.min(insertAt, dst.items.length));
        dst.items.splice(insertAt, 0, moved);
        setCols(next);
        startTransition(() => {
          void onMove(
            p.item.id,
            dst.id,
            dst.items.map((i) => i.id),
          );
        });
      }
    }
    if (p && movedRef.current) {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
    }
    setDrag(null);
    setOverBoth(null);
    movedRef.current = false;
  }

  return (
    <div ref={rootRef} className={clsx("flex gap-4 overflow-x-auto pb-3 thin-scroll", className)}>
      {cols.map((col) => {
        const isTarget = over?.col === col.id && drag != null;
        return (
          <div
            key={col.id}
            data-col-id={col.id}
            className={clsx(
              "kanban-col w-[300px] shrink-0 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col transition-colors",
              isTarget && "drop-target",
              columnClassName,
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                {col.accent && (
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: col.accent }} />
                )}
                <span className="text-sm font-semibold text-slate-800 truncate">{col.title}</span>
                <span className="text-xs text-slate-400">{col.items.length}</span>
              </div>
              {col.headerRight}
            </div>

            <div className="flex-1 px-2 pb-2 space-y-2 min-h-[80px] max-h-[calc(100vh-16rem)] overflow-y-auto thin-scroll">
              {col.items.map((item, i) => {
                const isDragged = drag?.item.id === item.id;
                return (
                  <div key={item.id} data-kanban-item={item.id}>
                    {isTarget && over?.index === i && !isDragged && <div className="drop-indicator" />}
                    <div
                      onPointerDown={(e) => onPointerDown(e, item, col.id)}
                      onClickCapture={(e) => {
                        if (justDragged.current) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      className={clsx("kanban-card", isDragged && "opacity-30")}
                    >
                      {renderCard(item, !!isDragged)}
                    </div>
                  </div>
                );
              })}
              {isTarget && (over?.index ?? 0) >= col.items.length && <div className="drop-indicator" />}
              {col.items.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-8 select-none">Kéo thẻ vào đây</p>
              )}
            </div>

            {col.footer && <div className="px-2 pb-2">{col.footer}</div>}
          </div>
        );
      })}

      {drag && (
        <div
          className="pointer-events-none fixed z-50 rotate-1"
          style={{
            left: drag.x - drag.offsetX,
            top: drag.y - drag.offsetY,
            width: drag.width,
          }}
        >
          {renderCard(drag.item, true)}
        </div>
      )}
    </div>
  );
}
