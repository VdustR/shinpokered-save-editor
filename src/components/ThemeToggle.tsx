import { useSaveStore, type ThemePreference } from "../state/store";

const ORDER: ThemePreference[] = ["system", "light", "dark"];
const LABEL: Record<ThemePreference, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

export function ThemeToggle() {
  const theme = useSaveStore((s) => s.theme);
  const setTheme = useSaveStore((s) => s.setTheme);
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

  return (
    <button
      type="button"
      className="theme-toggle"
      title={`${LABEL[theme]} (click for ${LABEL[next].toLowerCase()})`}
      aria-label={LABEL[theme]}
      onClick={() => setTheme(next)}
    >
      {theme === "system" ? <IconSystem /> : theme === "light" ? <IconSun /> : <IconMoon />}
    </button>
  );
}

function IconSun() {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M16 4l-1.4 1.4M5.4 14.6 4 16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconMoon() {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden>
      <path
        d="M16 11.5A6.5 6.5 0 1 1 8.5 4a5 5 0 0 0 7.5 7.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSystem() {
  return (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden>
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 16.5h6M10 13.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
