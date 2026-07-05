import { create } from "zustand";
import { listChecksumMismatches, type ChecksumGroup } from "../save/checksum";
import { countDirtyBytes } from "../save/diff";
import { exportSaveWithReport } from "../save/savefile";
import { parseSave } from "../save/savefile";
import { assessSave, type SaveAssessment } from "../save/validate";

export type ThemePreference = "system" | "light" | "dark";

interface SaveState {
  fileName: string | null;
  original: Uint8Array | null;
  bytes: Uint8Array | null;
  warnings: string[];
  /** Recognition verdict for the loaded file; null once dismissed. */
  assessment: SaveAssessment | null;
  /** Bumped on every mutation so selectors that read raw bytes recompute. */
  revision: number;
  theme: ThemePreference;
  /** Snapshots for undo (past) and redo (future); capped at HISTORY_LIMIT. */
  past: Uint8Array[];
  future: Uint8Array[];

  loadFile: (name: string, data: Uint8Array) => void;
  closeFile: () => void;
  dismissAssessment: () => void;
  /** Apply an in-place mutation to a fresh clone of the working buffer. */
  mutate: (fn: (bytes: Uint8Array) => void) => void;
  undo: () => void;
  redo: () => void;
  revert: () => void;
  setTheme: (theme: ThemePreference) => void;
}

/** 32 KiB per snapshot; 200 steps is ~6.4 MB, comfortably cheap. */
const HISTORY_LIMIT = 200;

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
  assessment: null,
  revision: 0,
  theme: initialTheme(),
  past: [],
  future: [],

  loadFile: (name, data) => {
    const { bytes, warnings } = parseSave(data);
    const assessment = assessSave(bytes);
    set({
      fileName: name,
      original: Uint8Array.from(bytes),
      bytes,
      warnings,
      assessment: assessment.verdict === "valid" ? null : assessment,
      past: [],
      future: [],
      revision: get().revision + 1,
    });
  },

  closeFile: () =>
    set({
      fileName: null,
      original: null,
      bytes: null,
      warnings: [],
      assessment: null,
      past: [],
      future: [],
      revision: get().revision + 1,
    }),

  dismissAssessment: () => set({ assessment: null }),

  mutate: (fn) => {
    const { bytes: current, past } = get();
    if (!current) return;
    const next = Uint8Array.from(current);
    fn(next);
    set({
      bytes: next,
      past: [...past.slice(-(HISTORY_LIMIT - 1)), current],
      future: [],
      revision: get().revision + 1,
    });
  },

  undo: () => {
    const { bytes, past, future } = get();
    if (!bytes || past.length === 0) return;
    set({
      bytes: past[past.length - 1],
      past: past.slice(0, -1),
      future: [...future, bytes],
      revision: get().revision + 1,
    });
  },

  redo: () => {
    const { bytes, past, future } = get();
    if (!bytes || future.length === 0) return;
    set({
      bytes: future[future.length - 1],
      future: future.slice(0, -1),
      past: [...past, bytes],
      revision: get().revision + 1,
    });
  },

  revert: () => {
    const { original, bytes, past } = get();
    if (!original || !bytes) return;
    // Revert is itself undoable: the pre-revert state joins the past.
    set({
      bytes: Uint8Array.from(original),
      past: [...past.slice(-(HISTORY_LIMIT - 1)), bytes],
      future: [],
      revision: get().revision + 1,
    });
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
