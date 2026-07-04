import { useRef, useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import "./ui.css";

/* --- Button --------------------------------------------------------------- */

type ButtonVariant = "primary" | "default" | "ghost" | "danger";

export function Button({
  variant = "default",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <button className={`btn btn--${variant} btn--${size} ${className}`} {...props} />;
}

/* --- Offset chip: jumps to the hex view ----------------------------------- */

export function OffsetChip({ offset, onJump }: { offset: number; onJump?: (offset: number) => void }) {
  const label = `0x${offset.toString(16).toUpperCase().padStart(4, "0")}`;
  if (!onJump) return <span className="offset-chip mono">{label}</span>;
  return (
    <button
      type="button"
      className="offset-chip offset-chip--link mono"
      onClick={() => onJump(offset)}
      title={`Jump to ${label} in the hex view`}
    >
      {label}
    </button>
  );
}

/* --- Field wrapper -------------------------------------------------------- */

export function Field({
  label,
  offset,
  hint,
  error,
  onJump,
  children,
  htmlFor,
}: {
  label: string;
  offset?: number;
  hint?: string;
  error?: string;
  onJump?: (offset: number) => void;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={`field ${error ? "field--error" : ""}`}>
      <div className="field__head">
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
        {offset !== undefined && <OffsetChip offset={offset} onJump={onJump} />}
      </div>
      {children}
      {error ? (
        <p className="field__msg field__msg--error">{error}</p>
      ) : hint ? (
        <p className="field__msg">{hint}</p>
      ) : null}
    </div>
  );
}

/* --- Text / number / select ----------------------------------------------- */

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`control ${props.className ?? ""}`} {...props} />;
}

export function NumberInput({
  value,
  min,
  max,
  onValue,
  className = "",
  mono = true,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: number;
  onValue: (n: number) => void;
  mono?: boolean;
}) {
  // Commit on blur / Enter rather than on every keystroke. A controlled input
  // that clamps per-keystroke fights the user when typing multi-digit values
  // (e.g. typing "123" over "0" briefly becomes an out-of-range number and
  // gets mangled). While focused we keep a free-form string draft.
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number.parseInt(draft, 10);
    let next = Number.isNaN(parsed) ? value : parsed;
    if (typeof min === "number") next = Math.max(next, Number(min));
    if (typeof max === "number") next = Math.min(next, Number(max));
    setDraft(null);
    if (next !== value) onValue(next);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className={`control ${mono ? "mono" : ""} ${className}`}
      value={draft ?? String(Number.isFinite(value) ? value : 0)}
      min={min}
      max={max}
      onFocus={() => setDraft(String(Number.isFinite(value) ? value : 0))}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          ref.current?.blur();
        } else if (e.key === "Escape") {
          setDraft(null);
          ref.current?.blur();
        }
      }}
      {...props}
    />
  );
}

/** A select-styled button that opens a modal picker; shows the current label. */
export function PickerTrigger({
  label,
  empty,
  onOpen,
  ariaLabel,
}: {
  label: string;
  empty?: boolean;
  onOpen: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      className="picker-trigger"
      onClick={onOpen}
      // Keep the visible label inside the accessible name (WCAG 2.5.3): the
      // extra context (e.g. "Move 1") is prefixed, not a replacement.
      aria-label={ariaLabel ? `${ariaLabel}: ${label}` : undefined}
      aria-haspopup="dialog"
    >
      <span className={`picker-trigger__label ${empty ? "picker-trigger__label--empty" : ""}`}>{label}</span>
      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden className="picker-trigger__caret">
        <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </button>
  );
}

/** A number field with an inline "Max" button that sets it to `max`. */
export function NumberWithMax({
  value,
  min,
  max,
  onValue,
  "aria-label": ariaLabel,
}: {
  value: number;
  min?: number;
  max: number;
  onValue: (n: number) => void;
  "aria-label"?: string;
}) {
  return (
    <div className="input-row">
      <NumberInput value={value} min={min} max={max} onValue={onValue} aria-label={ariaLabel} />
      <button
        type="button"
        className="btn btn--default btn--sm input-row__max"
        onClick={() => onValue(max)}
        disabled={value === max}
        title={`Set to ${max.toLocaleString()}`}
      >
        Max
      </button>
    </div>
  );
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className={`select ${className}`}>
      <select {...props}>{children}</select>
      <svg viewBox="0 0 12 12" aria-hidden className="select__caret">
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </div>
  );
}

/* --- Toggle --------------------------------------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle ${checked ? "toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__track">
        <span className="toggle__thumb" />
      </span>
      <span className="toggle__label">{label}</span>
    </button>
  );
}

/* --- Segmented control ---------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`segmented__btn ${value === opt.value ? "segmented__btn--active" : ""}`}
          aria-pressed={value === opt.value}
          title={opt.title}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* --- Badge / status pill -------------------------------------------------- */

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "info";
  children: ReactNode;
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Panel({
  title,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel__head">
          {title && <h2 className="panel__title">{title}</h2>}
          {actions && <div className="panel__actions">{actions}</div>}
        </header>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}
