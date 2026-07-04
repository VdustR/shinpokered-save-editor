import { useMemo, useState } from "react";
import { formatMoveEffect } from "../save/describe";
import { TYPE_NAMES, typeName, type MoveEntry } from "../save/gamedata";
import { searchMoves, type MoveSort, type SortDir } from "../save/search";
import { PickerDialog } from "./PickerDialog";
import { Segmented, Select } from "./ui/ui";

const TYPE_OPTIONS = Object.entries(TYPE_NAMES)
  .map(([id, name]) => ({ id: Number(id), name }))
  .filter((t, i, arr) => arr.findIndex((x) => x.name === t.name) === i)
  .sort((a, b) => a.name.localeCompare(b.name));

const SORTS: { value: MoveSort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "power", label: "Power" },
  { value: "accuracy", label: "Acc" },
  { value: "pp", label: "PP" },
];

/** Modal move picker with fuzzy search, type filter, sort, and per-row detail. */
export function MovePicker({
  open,
  selectedId,
  monTypes,
  onSelect,
  onClose,
}: {
  open: boolean;
  selectedId: number;
  /** The editing mon's types, for a STAB hint. */
  monTypes?: [number, number];
  onSelect: (moveId: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<number | "">("");
  const [sort, setSort] = useState<MoveSort>("name");
  const [dir, setDir] = useState<SortDir>("asc");

  const items = useMemo(
    () => searchMoves({ query, type: type === "" ? undefined : type, sort, dir }),
    [query, type, sort, dir],
  );

  const controls = (
    <>
      <Select value={type} onChange={(e) => setType(e.target.value === "" ? "" : Number(e.target.value))} aria-label="Filter by type">
        <option value="">All types</option>
        {TYPE_OPTIONS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      <Segmented
        ariaLabel="Sort by"
        value={sort}
        onChange={(s) => {
          setSort(s as MoveSort);
          setDir(s === "name" ? "asc" : "desc");
        }}
        options={SORTS}
      />
      {sort !== "name" && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
          title="Toggle sort direction"
        >
          {dir === "asc" ? "Asc ▲" : "Desc ▼"}
        </button>
      )}
    </>
  );

  return (
    <PickerDialog<MoveEntry>
      open={open}
      title="Choose a move"
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search moves…"
      controls={controls}
      items={items}
      keyOf={(m) => m.id}
      isSelected={(m) => m.id === selectedId}
      onPick={(m) => {
        onSelect(m.id);
        onClose();
      }}
      onClose={onClose}
      footer={<span className="picker__hint">↑↓ to navigate · Enter to choose · Esc to close</span>}
      renderRow={(m) => {
        const stab = monTypes?.includes(m.type);
        return (
          <>
            <span className="picker__name">{m.name}</span>
            <span className={`type-tag type-${m.type}`}>{typeName(m.type)}</span>
            {stab ? <span className="picker__stab" title="Same-type attack bonus">STAB</span> : null}
            <span className="picker__stats mono">
              {m.power ? `${m.power} pow` : "—"} · {m.accuracy ? `${m.accuracy}%` : "—"} · {m.pp} PP
            </span>
            <span className="picker__effect">{formatMoveEffect(m.effect)}</span>
          </>
        );
      }}
    />
  );
}
