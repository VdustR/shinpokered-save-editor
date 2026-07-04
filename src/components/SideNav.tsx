import type { ReactNode } from "react";
import { useNav, type PageId } from "../state/nav";

interface NavItem {
  id: PageId;
  label: string;
  icon: () => ReactNode;
}

const ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: IconGrid },
  { id: "trainer", label: "Trainer", icon: IconTrainer },
  { id: "party", label: "Party", icon: IconParty },
  { id: "boxes", label: "Boxes", icon: IconBox },
  { id: "items", label: "Inventory", icon: IconBag },
  { id: "pokedex", label: "Pokédex", icon: IconDex },
  { id: "hex", label: "Raw Hex", icon: IconHex },
];

export function SideNav() {
  const page = useNav((s) => s.page);
  const go = useNav((s) => s.go);
  return (
    <nav className="sidenav" aria-label="Sections">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={`sidenav__item ${page === item.id ? "sidenav__item--active" : ""}`}
            aria-current={page === item.id ? "page" : undefined}
            onClick={() => go(item.id)}
          >
            <span className="sidenav__icon">
              <Icon />
            </span>
            <span className="sidenav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconTrainer() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 16.5a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconParty() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10h14" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" fill="var(--bg)" />
    </svg>
  );
}
function IconBox() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3 6.5 10 3l7 3.5v7L10 17l-7-3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 6.5 10 10l7-3.5M10 10v7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function IconBag() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4.5 7h11l-1 9.5h-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 7a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconDex() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="3.5" y="3" width="13" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 3v14" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="6.5" r="1.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
function IconHex() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 2.5 16.5 6v8L10 17.5 3.5 14V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
