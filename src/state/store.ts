import { create } from "zustand";
import { listChecksumMismatches, type ChecksumGroup } from "../save/checksum";
import { countDirtyBytes } from "../save/diff";
import { exportSaveWithReport } from "../save/savefile";
import { parseSave } from "../save/savefile";

export type ThemePreference = "system" | "light" | "dark";

interface SaveState {
  fileName: string | null;
  original: Uint8Array | null;
  bytes: Uint8Array | null;
  warnings: string[];
  /** Bumped on every mutation so selectors that read raw bytes recompute. */
  revision: number;
  theme: ThemePreference;

  loadFile: (name: string, data: Uint8Array) => void;
  closeFile: () => void;
  /** Apply an in-place mutation to a fresh clone of the working buffer. */
  mutate: (fn: (bytes: Uint8Array) => void) => void;
  revert: () => void;
  setTheme: (theme: ThemePreference) => void;
}

const THEME_KEY = "spse.theme";

function initialTheme(): ThemePreference {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export const useSaveStore = create<SaveState>((set, get) => ({
  fileName: null,
  original: null,
  bytes: null,
  warnings: [],
  revision: 0,
  theme: initialTheme(),

  loadFile: (name, data) => {
    const { bytes, warnings } = parseSave(data);
    set({
      fileName: name,
      original: Uint8Array.from(bytes),
      bytes,
      warnings,
      revision: get().revision + 1,
    });
  },

  closeFile: () =>
    set({ fileName: null, original: null, bytes: null, warnings: [], revision: get().revision + 1 }),

  mutate: (fn) => {
    const current = get().bytes;
    if (!current) return;
    const next = Uint8Array.from(current);
    fn(next);
    set({ bytes: next, revision: get().revision + 1 });
  },

  revert: () => {
    const { original } = get();
    if (!original) return;
    set({ bytes: Uint8Array.from(original), revision: get().revision + 1 });
  },

  setTheme: (theme) => {
    if (typeof localStorage !== "undefined") {
      if (theme === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    }
    set({ theme });
  },
}));

export interface SaveSummary {
  dirtyBytes: number;
  mismatches: ChecksumGroup[];
  /** Which checksum groups the export will rewrite, given current edits. */
  repairPreview: ChecksumGroup[];
}

export function summarize(bytes: Uint8Array, original: Uint8Array): SaveSummary {
  const dirtyBytes = countDirtyBytes(bytes, original);
  const mismatches = listChecksumMismatches(bytes);
  const repairPreview = exportSaveWithReport(bytes, original).repaired;
  return { dirtyBytes, mismatches, repairPreview };
}
