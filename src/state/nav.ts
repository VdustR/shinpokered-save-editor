import { create } from "zustand";

export type PageId =
  | "overview"
  | "trainer"
  | "party"
  | "boxes"
  | "items"
  | "pokedex"
  | "flags"
  | "encyclopedia"
  | "hex";

interface NavState {
  page: PageId;
  /** Offset the hex view should scroll to and highlight, if any. */
  hexTarget: number | null;
  go: (page: PageId) => void;
  jumpToHex: (offset: number) => void;
  clearHexTarget: () => void;
}

export const useNav = create<NavState>((set) => ({
  page: "overview",
  hexTarget: null,
  go: (page) => set({ page }),
  jumpToHex: (offset) => set({ page: "hex", hexTarget: offset }),
  clearHexTarget: () => set({ hexTarget: null }),
}));
