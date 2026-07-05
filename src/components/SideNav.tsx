import type { ReactNode } from "react";
import { useNav, type PageId } from "../state/nav";
import { AppFooter } from "./AppFooter";

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
  { id: "flags", label: "Story Flags", icon: IconFlag },
  { id: "hof", label: "Hall of Fame", icon: IconTrophy },
  { id: "encyclopedia", label: "Encyclopedia", icon: IconBook },
  { id: "testdrive", label: "Test Drive", icon: IconPlay },
  { id: "compare", label: "Compare", icon: IconCompare },
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
      <AppFooter />
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
function IconTrophy() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6 3.5h8v4a4 4 0 0 1-8 0v-4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 5H3.5v1a3 3 0 0 0 2.8 3M14 5h2.5v1a3 3 0 0 1-2.8 3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 11.5v2.5M7.5 16.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 17V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M5 4h9.5l-2.2 3 2.2 3H5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 4.5C8.5 3.5 6 3.2 3.8 3.6v11c2.2-.4 4.7-.1 6.2.9 1.5-1 4-1.3 6.2-.9v-11C14 3.2 11.5 3.5 10 4.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 4.5v11" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2.5" y="5" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 8v4l3.5-2z" fill="currentColor" />
    </svg>
  );
}
function IconCompare() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M12 3.5 15.5 7 12 10.5M15.5 7h-11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9.5 4.5 13 8 16.5M4.5 13h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
