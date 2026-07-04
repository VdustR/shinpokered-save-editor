import { useEffect, useRef, useState, type ReactNode } from "react";
import "./picker.css";

/**
 * A command-palette style modal picker: a search box, a filter/sort slot, and a
 * keyboard-navigable result list. Rendered as a native modal <dialog> so it
 * escapes any overflow/stacking context of the field that opened it.
 *
 * The parent owns the query/filter/sort state and passes the computed `items`;
 * this component owns focus, the active row, and keyboard handling.
 */
export function PickerDialog<T>({
  open,
  title,
  query,
  onQuery,
  searchPlaceholder,
  controls,
  items,
  keyOf,
  renderRow,
  isSelected,
  onPick,
  onClose,
  footer,
  emptyText = "No matches.",
}: {
  open: boolean;
  title: string;
  query: string;
  onQuery: (q: string) => void;
  searchPlaceholder: string;
  controls?: ReactNode;
  items: T[];
  keyOf: (item: T) => string | number;
  renderRow: (item: T, active: boolean) => ReactNode;
  isSelected?: (item: T) => boolean;
  onPick: (item: T) => void;
  onClose: () => void;
  footer?: ReactNode;
  emptyText?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      setActive(0);
      listRef.current?.scrollTo(0, 0); // reset any preserved scroll on reopen
      // Focus the search box once the dialog is shown.
      requestAnimationFrame(() => searchRef.current?.focus());
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  // Reset the highlight to the first result whenever the result set changes
  // (a new query, filter, or sort), so it never points at a stale row.
  useEffect(() => {
    setActive(0);
  }, [items]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item !== undefined) onPick(item);
    }
  }

  return (
    <dialog ref={dialogRef} className="picker" onClose={onClose} onCancel={onClose} onKeyDown={onKeyDown}>
      <div className="picker__head">
        <h2 className="picker__title">{title}</h2>
        <button className="picker__x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="picker__search">
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden className="picker__search-icon">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m11 11 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={searchRef}
          className="control"
          value={query}
          placeholder={searchPlaceholder}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search"
        />
      </div>
      {controls && <div className="picker__controls">{controls}</div>}
      <div className="picker__list" ref={listRef} role="listbox" aria-label={title}>
        {items.length === 0 ? (
          <p className="picker__empty">{emptyText}</p>
        ) : (
          items.map((item, i) => (
            <button
              key={keyOf(item)}
              type="button"
              data-idx={i}
              role="option"
              aria-selected={isSelected?.(item) ?? false}
              className={`picker__row ${i === active ? "picker__row--active" : ""} ${
                isSelected?.(item) ? "picker__row--selected" : ""
              }`}
              onClick={() => onPick(item)}
            >
              {renderRow(item, i === active)}
            </button>
          ))
        )}
      </div>
      {footer && <div className="picker__footer">{footer}</div>}
    </dialog>
  );
}
