import type { DragEvent } from "react";
import "./reorder.css";

/**
 * A drag grip plus up/down buttons for reordering a list item. Drag is the
 * primary interaction; the buttons are the keyboard/accessible fallback.
 */
export function ReorderControls({
  index,
  count,
  label,
  gripProps,
  onMove,
  vertical = true,
}: {
  index: number;
  count: number;
  label: string;
  gripProps: { draggable: boolean; onDragStart: (e: DragEvent) => void; onDragEnd: () => void };
  onMove: (delta: number) => void;
  vertical?: boolean;
}) {
  return (
    <div className={`reorder ${vertical ? "reorder--v" : "reorder--h"}`}>
      <span className="reorder__grip" title={`Drag to reorder ${label}`} aria-hidden {...gripProps}>
        <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor">
          <circle cx="2.5" cy="3" r="1.2" />
          <circle cx="7.5" cy="3" r="1.2" />
          <circle cx="2.5" cy="8" r="1.2" />
          <circle cx="7.5" cy="8" r="1.2" />
          <circle cx="2.5" cy="13" r="1.2" />
          <circle cx="7.5" cy="13" r="1.2" />
        </svg>
      </span>
      <button
        type="button"
        className="reorder__btn"
        disabled={index === 0}
        aria-label={`Move ${label} ${vertical ? "up" : "left"}`}
        onClick={() => onMove(-1)}
      >
        {vertical ? "▲" : "◀"}
      </button>
      <button
        type="button"
        className="reorder__btn"
        disabled={index === count - 1}
        aria-label={`Move ${label} ${vertical ? "down" : "right"}`}
        onClick={() => onMove(1)}
      >
        {vertical ? "▼" : "▶"}
      </button>
    </div>
  );
}
