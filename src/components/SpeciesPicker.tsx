import { useEffect, useMemo, useState } from "react";
import { TYPE_NAMES, typeName } from "../save/gamedata";
import { searchSpecies, type SortDir, type SpeciesResult, type SpeciesSort } from "../save/search";
import { PickerDialog } from "./PickerDialog";
import { Segmented, Select } from "./ui/ui";
import { Sprite } from "./Sprite";

const TYPE_OPTIONS = Object.entries(TYPE_NAMES)
  .map(([id, name]) => ({ id: Number(id), name }))
  .filter((t, i, arr) => arr.findIndex((x) => x.name === t.name) === i)
  .sort((a, b) => a.name.localeCompare(b.name));

const SORTS: { value: SpeciesSort; label: string }[] = [
  { value: "dex", label: "Dex" },
  { value: "name", label: "Name" },
  { value: "bst", label: "BST" },
];

/** Modal species picker with fuzzy search, type filter, and sorting. */
export function SpeciesPicker({
  open,
  selectedId,
  onSelect,
  onClose,
}: {
  open: boolean;
  selectedId: number;
  onSelect: (internalId: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<number | "">("");
  const [sort, setSort] = useState<SpeciesSort>("dex");
  const [dir, setDir] = useState<SortDir>("asc");

  useEffect(() => {
    if (open) {
      setQuery("");
      setType("");
      setSort("dex");
      setDir("asc");
    }
  }, [open]);

  const items = useMemo(
    () => searchSpecies({ query, type: type === "" ? undefined : type, sort, dir }),
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
          setSort(s as SpeciesSort);
          setDir(s === "bst" ? "desc" : "asc");
        }}
        options={SORTS}
      />
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
        title="Toggle sort direction"
      >
        {dir === "asc" ? "Asc ▲" : "Desc ▼"}
      </button>
    </>
  );

  return (
    <PickerDialog<SpeciesResult>
      open={open}
      title="Choose a species"
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search Pokémon…"
      controls={controls}
      items={items}
      keyOf={(s) => s.internalId}
      isSelected={(s) => s.internalId === selectedId}
      onPick={(s) => {
        onSelect(s.internalId);
        onClose();
      }}
      onClose={onClose}
      footer={<span className="picker__hint">↑↓ to navigate · Enter to choose · Esc to close</span>}
      renderRow={(s) => (
        <>
          <span className="picker__dex mono">#{String(s.dexNo).padStart(3, "0")}</span>
          <Sprite dexNo={s.dexNo} size={28} alt={s.name} />
          <span className="picker__name">{s.name}</span>
          {s.types.map((t, i) =>
            i === 1 && s.types[0] === s.types[1] ? null : (
              <span key={i} className={`type-tag type-${t}`}>
                {typeName(t)}
              </span>
            ),
          )}
          <span className="picker__stats mono">BST {s.bst}</span>
        </>
      )}
    />
  );
}
