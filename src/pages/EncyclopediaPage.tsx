import { useMemo, useState } from "react";
import { formatMoveEffect } from "../save/describe";
import { TYPE_NAMES, typeName } from "../save/gamedata";
import {
  searchItems,
  searchMoves,
  type ItemCategory,
  type MoveSort,
  type SortDir,
} from "../save/search";
import { Segmented, Select, TextInput } from "../components/ui/ui";
import { PageHeader } from "../components/PageHeader";
import "./encyclopedia.css";

type Kind = "moves" | "items";

const TYPE_OPTIONS = Object.entries(TYPE_NAMES)
  .map(([id, name]) => ({ id: Number(id), name }))
  .filter((t, i, arr) => arr.findIndex((x) => x.name === t.name) === i) // de-dupe TYPELESS/NORMAL aliases
  .sort((a, b) => a.name.localeCompare(b.name));

export function EncyclopediaPage() {
  const [kind, setKind] = useState<Kind>("moves");
  const [query, setQuery] = useState("");

  return (
    <div className="page">
      <PageHeader
        title="Encyclopedia"
        subtitle="Search moves and items from the Shin 1.25.0 data. Fuzzy name search, type filter, and sorting."
        actions={
          <Segmented
            ariaLabel="Data set"
            value={kind}
            onChange={(k) => setKind(k as Kind)}
            options={[
              { value: "moves", label: "Moves" },
              { value: "items", label: "Items" },
            ]}
          />
        }
      />
      {kind === "moves" ? <MoveSearch query={query} setQuery={setQuery} /> : <ItemSearch query={query} setQuery={setQuery} />}
    </div>
  );
}

function SearchBar({
  query,
  setQuery,
  placeholder,
  children,
}: {
  query: string;
  setQuery: (v: string) => void;
  placeholder: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="enc-controls">
      <div className="enc-search">
        <SearchIcon />
        <TextInput
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
        />
        {query && (
          <button className="enc-search__clear" onClick={() => setQuery("")} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function MoveSearch({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  const [type, setType] = useState<number | "">("");
  const [sort, setSort] = useState<MoveSort>("name");
  const [dir, setDir] = useState<SortDir>("asc");

  const results = useMemo(
    () => searchMoves({ query, type: type === "" ? undefined : type, sort, dir }),
    [query, type, sort, dir],
  );

  function toggleSort(key: MoveSort) {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "name" || key === "type" ? "asc" : "desc");
    }
  }

  const arrow = (key: MoveSort) => (sort === key ? (dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <>
      <SearchBar query={query} setQuery={setQuery} placeholder="Search moves by name…">
        <Select value={type} onChange={(e) => setType(e.target.value === "" ? "" : Number(e.target.value))} aria-label="Type filter">
          <option value="">All types</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </SearchBar>

      <div className="enc-count mono">{results.length} moves</div>

      <div className="enc-table-wrap">
        <table className="enc-table">
          <thead>
            <tr>
              <th><button onClick={() => toggleSort("name")}>Name{arrow("name")}</button></th>
              <th><button onClick={() => toggleSort("type")}>Type{arrow("type")}</button></th>
              <th className="num"><button onClick={() => toggleSort("power")}>Power{arrow("power")}</button></th>
              <th className="num"><button onClick={() => toggleSort("accuracy")}>Acc{arrow("accuracy")}</button></th>
              <th className="num"><button onClick={() => toggleSort("pp")}>PP{arrow("pp")}</button></th>
              <th>Effect</th>
            </tr>
          </thead>
          <tbody>
            {results.map((m) => (
              <tr key={m.id}>
                <td className="enc-name">{m.name}</td>
                <td>
                  <span className={`type-tag type-${m.type}`}>{typeName(m.type)}</span>
                </td>
                <td className="num mono">{m.power || "—"}</td>
                <td className="num mono">{m.accuracy || "—"}</td>
                <td className="num mono">{m.pp}</td>
                <td className="enc-effect">{formatMoveEffect(m.effect)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && <p className="enc-empty">No moves match “{query}”.</p>}
      </div>
    </>
  );
}

function ItemSearch({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  const [category, setCategory] = useState<ItemCategory>("all");
  const results = useMemo(() => searchItems({ query, category }), [query, category]);

  return (
    <>
      <SearchBar query={query} setQuery={setQuery} placeholder="Search items by name…">
        <Segmented
          ariaLabel="Item category"
          value={category}
          onChange={(c) => setCategory(c as ItemCategory)}
          options={[
            { value: "all", label: "All" },
            { value: "regular", label: "Items" },
            { value: "tm", label: "TMs" },
            { value: "hm", label: "HMs" },
          ]}
        />
      </SearchBar>

      <div className="enc-count mono">{results.length} items</div>

      <div className="enc-table-wrap">
        <table className="enc-table">
          <thead>
            <tr>
              <th className="num">ID</th>
              <th>Name</th>
              <th>Kind</th>
            </tr>
          </thead>
          <tbody>
            {results.map((it) => (
              <tr key={it.id}>
                <td className="num mono">${it.id.toString(16).padStart(2, "0").toUpperCase()}</td>
                <td className="enc-name">{it.name}</td>
                <td>{it.tm ? `TM${it.tm}` : it.hm ? `HM${it.hm}` : "Item"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && <p className="enc-empty">No items match “{query}”.</p>}
      </div>
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden className="enc-search__icon">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m11 11 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
