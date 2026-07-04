import { useEffect, useMemo, useRef, useState } from "react";
import { CHECKSUM_GROUPS } from "../save/checksum";
import { SAVE_SIZE } from "../save/layout";
import gamedata from "../gen/gamedata.json";
import { useNav } from "../state/nav";
import { useSaveStore } from "../state/store";
import { PageHeader } from "../components/PageHeader";
import "./hex.css";

const BYTES_PER_ROW = 16;
const ROW_HEIGHT = 22;
const OVERSCAN = 6;
const charmap = gamedata.charmap as Record<string, string>;

function bankOf(offset: number): number {
  return Math.floor(offset / 0x2000);
}

/** Build a per-byte flag: is it a checksum output byte, and is it inside a checksum range. */
function buildChecksumMap(): Uint8Array {
  const map = new Uint8Array(SAVE_SIZE); // 0 none, 1 covered, 2 output
  for (const g of CHECKSUM_GROUPS) {
    for (let i = g.start; i < g.start + g.length; i++) map[i] ||= 1;
    map[g.output] = 2;
  }
  return map;
}

export function HexView() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const original = useSaveStore((s) => s.original)!;
  const hexTarget = useNav((s) => s.hexTarget);
  const clearHexTarget = useNav((s) => s.clearHexTarget);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);
  const [gotoValue, setGotoValue] = useState("");
  const [highlight, setHighlight] = useState<number | null>(null);

  const checksumMap = useMemo(buildChecksumMap, []);
  const totalRows = SAVE_SIZE / BYTES_PER_ROW;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewport(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (hexTarget === null || !scrollRef.current) return;
    const row = Math.floor(hexTarget / BYTES_PER_ROW);
    scrollRef.current.scrollTop = Math.max(0, row * ROW_HEIGHT - viewport / 2);
    setHighlight(hexTarget);
    clearHexTarget();
    const t = setTimeout(() => setHighlight(null), 2400);
    return () => clearTimeout(t);
  }, [hexTarget, viewport, clearHexTarget]);

  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const lastRow = Math.min(totalRows, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN);

  const rows = [];
  for (let r = firstRow; r < lastRow; r++) {
    const base = r * BYTES_PER_ROW;
    const cells = [];
    let ascii = "";
    for (let c = 0; c < BYTES_PER_ROW; c++) {
      const offset = base + c;
      const value = bytes[offset];
      const dirty = value !== original[offset];
      const cs = checksumMap[offset];
      const token = charmap[String(value)];
      ascii += token && token.length === 1 && value >= 0x7f ? token : value === 0x50 ? "." : "·";
      cells.push(
        <span
          key={c}
          className={`hx__b ${dirty ? "hx__b--dirty" : ""} ${cs === 2 ? "hx__b--cksum-out" : cs === 1 ? "hx__b--cksum" : ""} ${
            offset === highlight ? "hx__b--target" : ""
          }`}
          title={`0x${offset.toString(16).toUpperCase().padStart(4, "0")}`}
        >
          {value.toString(16).toUpperCase().padStart(2, "0")}
        </span>,
      );
    }
    rows.push(
      <div className="hx__row" style={{ top: r * ROW_HEIGHT }} key={r}>
        <span className="hx__off mono">
          {base.toString(16).toUpperCase().padStart(4, "0")}
        </span>
        <span className="hx__bank mono">B{bankOf(base)}</span>
        <span className="hx__bytes">{cells}</span>
        <span className="hx__ascii mono">{ascii}</span>
      </div>,
    );
  }

  function doGoto(raw: string) {
    const parsed = raw.trim().startsWith("0x") ? parseInt(raw.trim(), 16) : parseInt(raw.trim(), 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed < SAVE_SIZE && scrollRef.current) {
      const row = Math.floor(parsed / BYTES_PER_ROW);
      scrollRef.current.scrollTop = Math.max(0, row * ROW_HEIGHT - viewport / 2);
      setHighlight(parsed);
      setTimeout(() => setHighlight(null), 2400);
    }
  }

  return (
    <div className="page page--hex">
      <PageHeader
        title="Raw Hex"
        subtitle="Every byte of the 32 KiB save. Changed bytes are highlighted; checksum ranges and outputs are shaded."
        actions={
          <form
            className="hx__goto"
            onSubmit={(e) => {
              e.preventDefault();
              doGoto(gotoValue);
            }}
          >
            <input
              className="control mono"
              placeholder="Go to 0x…"
              value={gotoValue}
              onChange={(e) => setGotoValue(e.target.value)}
              aria-label="Go to offset"
            />
          </form>
        }
      />

      <div className="hx__legend">
        <span className="hx__key"><i className="hx__sw hx__sw--dirty" /> Changed</span>
        <span className="hx__key"><i className="hx__sw hx__sw--cksum" /> Checksum range</span>
        <span className="hx__key"><i className="hx__sw hx__sw--out" /> Checksum byte</span>
      </div>

      <div
        className="hx"
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div className="hx__spacer" style={{ height: totalRows * ROW_HEIGHT }}>
          {rows}
        </div>
      </div>
    </div>
  );
}
