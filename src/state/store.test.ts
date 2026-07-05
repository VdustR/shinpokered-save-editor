import { beforeEach, describe, expect, it } from "vitest";
import { useSaveStore } from "./store";

/** A blank but structurally parseable 32 KiB save buffer. */
function blankSave(): Uint8Array {
  return new Uint8Array(0x8000);
}

function load() {
  useSaveStore.getState().loadFile("test.sav", blankSave());
}

/** Write one byte through the store's mutate path. */
function poke(offset: number, value: number) {
  useSaveStore.getState().mutate((b) => {
    b[offset] = value;
  });
}

beforeEach(() => {
  useSaveStore.getState().closeFile();
});

describe("undo/redo history", () => {
  it("undo restores the previous buffer and redo re-applies it", () => {
    load();
    poke(0x100, 0x11);
    poke(0x100, 0x22);
    expect(useSaveStore.getState().bytes![0x100]).toBe(0x22);

    useSaveStore.getState().undo();
    expect(useSaveStore.getState().bytes![0x100]).toBe(0x11);
    useSaveStore.getState().undo();
    expect(useSaveStore.getState().bytes![0x100]).toBe(0x00);

    useSaveStore.getState().redo();
    expect(useSaveStore.getState().bytes![0x100]).toBe(0x11);
    useSaveStore.getState().redo();
    expect(useSaveStore.getState().bytes![0x100]).toBe(0x22);
  });

  it("is a no-op at the ends of the history", () => {
    load();
    const before = useSaveStore.getState().revision;
    useSaveStore.getState().undo();
    useSaveStore.getState().redo();
    expect(useSaveStore.getState().revision).toBe(before);

    poke(0x100, 0x11);
    useSaveStore.getState().redo(); // nothing to redo
    expect(useSaveStore.getState().bytes![0x100]).toBe(0x11);
  });

  it("a new edit after undo clears the redo branch", () => {
    load();
    poke(0x100, 0x11);
    useSaveStore.getState().undo();
    poke(0x100, 0x33);
    expect(useSaveStore.getState().future).toHaveLength(0);
    useSaveStore.getState().redo(); // no-op
    expect(useSaveStore.getState().bytes![0x100]).toBe(0x33);
  });

  it("revert is undoable", () => {
    load();
    poke(0x100, 0x11);
    useSaveStore.getState().revert();
    expect(useSaveStore.getState().bytes![0x100]).toBe(0x00);
    useSaveStore.getState().undo();
    expect(useSaveStore.getState().bytes![0x100]).toBe(0x11);
  });

  it("loading a file resets both stacks", () => {
    load();
    poke(0x100, 0x11);
    load();
    expect(useSaveStore.getState().past).toHaveLength(0);
    expect(useSaveStore.getState().future).toHaveLength(0);
  });

  it("caps the past stack at 200 snapshots", () => {
    load();
    for (let i = 0; i < 210; i++) poke(0x100, i & 0xff);
    expect(useSaveStore.getState().past).toHaveLength(200);
    // The oldest surviving snapshot is the state before edit #11 (0-indexed 10).
    for (let i = 0; i < 200; i++) useSaveStore.getState().undo();
    expect(useSaveStore.getState().bytes![0x100]).toBe(9);
  });

  it("a no-op mutation records no history and keeps the redo branch", () => {
    load();
    poke(0x100, 0x11);
    useSaveStore.getState().undo();
    expect(useSaveStore.getState().future).toHaveLength(1);

    // Writing the same bytes (e.g. re-clicking a selected option) is a no-op.
    poke(0x100, 0x00);
    expect(useSaveStore.getState().past).toHaveLength(0);
    expect(useSaveStore.getState().future).toHaveLength(1);
    useSaveStore.getState().redo();
    expect(useSaveStore.getState().bytes![0x100]).toBe(0x11);
  });

  it("undo does not mutate the shared snapshot buffers", () => {
    load();
    poke(0x100, 0x11);
    useSaveStore.getState().undo();
    poke(0x200, 0x44); // mutate clones, so the redo snapshot must stay intact
    expect(useSaveStore.getState().bytes![0x100]).toBe(0x00);
  });
});
