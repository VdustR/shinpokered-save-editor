import { useState, type DragEvent } from "react";

/**
 * Small HTML5 drag-and-drop reorder helper. A dedicated grip is the draggable
 * source (so inputs/buttons inside a row still work), each row is a drop
 * target, and `moveBy` powers keyboard/button fallbacks for accessibility.
 */
export function useDragReorder(onReorder: (from: number, to: number) => void, count: number) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function reset() {
    setDragIndex(null);
    setOverIndex(null);
  }

  function gripProps(index: number) {
    return {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
      },
      onDragEnd: reset,
    };
  }

  function rowProps(index: number) {
    return {
      onDragOver: (e: DragEvent) => {
        if (dragIndex === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (overIndex !== index) setOverIndex(index);
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
        reset();
      },
      "data-dragging": dragIndex === index || undefined,
      "data-drag-over": (overIndex === index && dragIndex !== null && dragIndex !== index) || undefined,
    };
  }

  /** Keyboard/button fallback: shift the item at `index` by `delta` slots. */
  function moveBy(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= count) return;
    onReorder(index, to);
  }

  return { gripProps, rowProps, moveBy, dragIndex };
}
