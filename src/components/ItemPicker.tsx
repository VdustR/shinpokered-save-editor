import { useMemo, useState } from "react";
import type { ItemEntry } from "../save/gamedata";
import { searchItems, type ItemCategory } from "../save/search";
import { PickerDialog } from "./PickerDialog";
import { Segmented } from "./ui/ui";

/** Modal item picker with fuzzy search and category filter. */
export function ItemPicker({
  open,
  selectedId,
  onSelect,
  onClose,
}: {
  open: boolean;
  selectedId: number;
  onSelect: (itemId: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ItemCategory>("all");

  const items = useMemo(() => searchItems({ query, category }), [query, category]);

  const controls = (
    <Segmented
      ariaLabel="Filter by category"
      value={category}
      onChange={(c) => setCategory(c as ItemCategory)}
      options={[
        { value: "all", label: "All" },
        { value: "regular", label: "Items" },
        { value: "tm", label: "TMs" },
        { value: "hm", label: "HMs" },
      ]}
    />
  );

  return (
    <PickerDialog<ItemEntry>
      open={open}
      title="Choose an item"
      query={query}
      onQuery={setQuery}
      searchPlaceholder="Search items…"
      controls={controls}
      items={items}
      keyOf={(it) => it.id}
      isSelected={(it) => it.id === selectedId}
      onPick={(it) => {
        onSelect(it.id);
        onClose();
      }}
      onClose={onClose}
      footer={<span className="picker__hint">↑↓ to navigate · Enter to choose · Esc to close</span>}
      renderRow={(it) => (
        <>
          <span className="picker__name">{it.name}</span>
          <span className="picker__kind mono">{it.tm ? `TM${it.tm}` : it.hm ? `HM${it.hm}` : "Item"}</span>
          <span className="picker__id mono">${it.id.toString(16).padStart(2, "0").toUpperCase()}</span>
        </>
      )}
    />
  );
}
