import { useState } from "react";
import { ITEMS, itemName } from "../save/gamedata";
import { BAG_CAPACITY, OFFSETS, PC_ITEM_CAPACITY } from "../save/layout";
import {
  getBagItems,
  getPcItems,
  setBagItems,
  setPcItems,
  type ItemStack,
} from "../save/savefile";
import { autoSortItems, moveInArray } from "../save/reorder";
import { useNav } from "../state/nav";
import { useSaveStore } from "../state/store";
import { Button, NumberInput, OffsetChip, Panel, PickerTrigger } from "../components/ui/ui";
import { EmptyLine } from "../components/EmptyLine";
import { ItemPicker } from "../components/ItemPicker";
import { PageHeader } from "../components/PageHeader";
import { ReorderControls } from "../components/ReorderControls";
import { useDragReorder } from "../components/useDragReorder";

const DEFAULT_ITEM = ITEMS[0]?.id ?? 1;

function ItemList({
  title,
  offset,
  items,
  capacity,
  onChange,
}: {
  title: string;
  offset: number;
  items: ItemStack[];
  capacity: number;
  onChange: (items: ItemStack[]) => void;
}) {
  const jump = useNav((s) => s.jumpToHex);
  const [openRow, setOpenRow] = useState<number | null>(null);

  function update(index: number, patch: Partial<ItemStack>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function add() {
    if (items.length >= capacity) return;
    onChange([...items, { id: DEFAULT_ITEM, count: 1 }]);
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  const drag = useDragReorder((from, to) => onChange(moveInArray(items, from, to)), items.length);

  return (
    <Panel
      title={
        <span className="panel-title-row">
          {title} <OffsetChip offset={offset} onJump={jump} />
        </span>
      }
      actions={
        <div className="btn-row">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(autoSortItems(items))}
            disabled={items.length < 2}
            title="Sort into the game's built-in bag order"
          >
            Sort
          </Button>
          <span className="mono muted">
            {items.length} / {capacity}
          </span>
        </div>
      }
    >
      {items.length === 0 ? (
        <EmptyLine title="No items" body="This pocket is empty." action={<Button size="sm" variant="primary" onClick={add}>Add item</Button>} />
      ) : (
        <div className="item-list">
          {items.map((item, i) => (
            <div className="item-row" key={i} {...drag.rowProps(i)}>
              <ReorderControls
                index={i}
                count={items.length}
                label={itemName(item.id)}
                gripProps={drag.gripProps(i)}
                onMove={(d) => drag.moveBy(i, d)}
              />
              <PickerTrigger label={itemName(item.id)} ariaLabel="Item" onOpen={() => setOpenRow(i)} />
              <NumberInput
                className="item-row__count"
                value={item.count}
                min={1}
                max={99}
                onValue={(n) => update(i, { count: n })}
                aria-label="Quantity"
              />
              <Button variant="ghost" size="sm" onClick={() => remove(i)} aria-label="Remove item">
                <TrashIcon />
              </Button>
            </div>
          ))}
          <Button variant="default" size="sm" onClick={add} disabled={items.length >= capacity}>
            Add item
          </Button>
          <ItemPicker
            open={openRow !== null}
            selectedId={openRow !== null ? items[openRow]?.id ?? 0 : 0}
            onClose={() => setOpenRow(null)}
            onSelect={(id) => {
              if (openRow !== null) update(openRow, { id });
            }}
          />
        </div>
      )}
    </Panel>
  );
}

export function ItemsPage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);

  return (
    <div className="page">
      <PageHeader title="Inventory" subtitle="Bag and PC item storage. Counts run 1–99 per stack." />
      <div className="page__grid">
        <ItemList
          title="Bag"
          offset={OFFSETS.bagItemCount}
          items={getBagItems(bytes)}
          capacity={BAG_CAPACITY}
          onChange={(items) => mutate((b) => setBagItems(b, items))}
        />
        <ItemList
          title="PC storage"
          offset={OFFSETS.pcItemCount}
          items={getPcItems(bytes)}
          capacity={PC_ITEM_CAPACITY}
          onChange={(items) => mutate((b) => setPcItems(b, items))}
        />
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
