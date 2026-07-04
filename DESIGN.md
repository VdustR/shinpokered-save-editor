# DESIGN.md

The design system for the Shin Pokémon Red Save Editor. See
[PRODUCT.md](PRODUCT.md) for what the product is and who it serves.

## Design direction

A **precision instrument**, not a retro toy. The obvious move for a Game Boy
tool is DMG pea-green kitsch; we reject it. Instead the interface reads like a
modern technical tool (Linear / Raycast density) with one committed identity
color — Pokédex scarlet — and a dedicated monospace channel for the raw byte
data that is the heart of the app.

Scene sentence that anchors the choices: *a tinkerer at a desk at night, editing
their childhood cartridge's save, who wants an exact, trustworthy instrument
that respects how easy it is to brick a save.* That mood lives in the red +
typography, not in a tinted background.

Register: **product**, color strategy **restrained** (neutral surfaces + one
accent), with the Overview and Export moments allowed to lean **committed** on
the scarlet.

## Color

OKLCH throughout, defined as CSS custom properties in
[src/styles/tokens.css](src/styles/tokens.css). Light and dark are both
first-class; the theme follows `prefers-color-scheme` automatically and can be
overridden with a manual toggle (persisted in `localStorage`).

### Roles

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | pure white | deep cool charcoal | app background |
| `--surface` | cool near-white | raised charcoal | panels, cards |
| `--surface-2` | cooler gray | deeper charcoal | sidebar, toolbars, table headers |
| `--border` | `oklch(0.90 …)` | `oklch(0.32 …)` | hairlines, dividers |
| `--ink` | near-black | near-white | primary text |
| `--ink-muted` | mid-gray ≥4.5:1 | light gray ≥4.5:1 | secondary text, labels |
| `--primary` | scarlet `oklch(0.55 0.20 27)` | brighter scarlet `oklch(0.66 0.19 27)` | primary actions, current selection, dirty/active state |
| `--danger` | red-orange | red-orange | destructive actions, fatal validation |
| `--warning` | amber | amber | warnings, checksum mismatch |
| `--success` | green | green | valid checksum, saved |
| `--info` | blue | blue | informational hints |

### Why scarlet, not the seed rose

The brand seed suggested a rose-red (hue ~353°). The product is literally
"Red", and the Pokédex/cartridge identity is a warmer scarlet (~27°). Identity
preservation wins over the generated seed here; this is a deliberate deviation.

### Contrast rules

- Body text hits ≥4.5:1 against its surface; `--ink-muted` is tuned to stay at
  or above 4.5:1 on both `--bg` and `--surface`, never a decorative light gray.
- The scarlet primary uses white text (`--on-primary`) at ≥4.5:1.
- Risk is never color-only: validation and dirty state also carry an icon or
  text label.

## Typography

One system sans for all UI; one monospace for raw byte/offset data. No web
fonts — the PWA must work offline and load instantly, and system fonts also fit
the product register.

- UI: `system-ui, -apple-system, "Segoe UI", Roboto, …`
- Mono: `ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", …`

Fixed rem scale (product UI, not fluid): 0.75 / 0.8125 / 0.875 / 1 / 1.125 /
1.375 / 1.75 rem, ratio ≈1.15–1.2. Weight contrast (400 body, 500 labels,
600 headings) carries hierarchy. Offsets, hex, species IDs, and byte data are
always monospace with `font-variant-numeric: tabular-nums`.

## Layout

- **App shell**: top bar (file name · profile · checksum status · dirty count ·
  Export) + left nav + main content + optional right inspector.
- Responsive is **structural**, not fluid type. Left nav collapses to a bottom
  tab bar under 720px; the inspector moves below content; grids reflow with
  `auto-fill, minmax()`.
- Spacing scale (`--space-*`): 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48px. Vary
  spacing for rhythm rather than a single uniform gap.
- Radii: 6px controls, 10px panels, pill for tags/badges. No 24px+ card
  rounding.
- Semantic z-index scale in tokens (`--z-nav` → `--z-modal` → `--z-toast`).

## Components

Every interactive control ships default / hover / focus-visible / active /
disabled states. Shared vocabulary:

- **Button** variants: `primary`, `default`, `ghost`, `danger`; sizes sm/md.
- **Field**: label + control + offset chip + optional hint/error. The offset
  chip (e.g. `0x25F3`) is a monospace tag that jumps to the hex view.
- **NumberField / TextField / Select / Toggle / SegmentedControl.**
- **StatBar** for Pokémon stats; **SpriteBadge** for species.
- **Empty state** teaches loading a save; **loading** uses skeletons, not
  spinners mid-content.

## Motion

150–250ms, ease-out. Motion conveys state (panel/tab change, toast in/out,
dirty pulse), never decoration. Respects `prefers-reduced-motion: reduce` with
instant/crossfade fallbacks. No page-load choreography — the tool loads into the
task.

## Save-integrity UX

The product's defining constraint drives specific patterns:

- **Dirty tracking** in the top bar: a live count of changed byte ranges, with a
  Revert affordance.
- **Export dialog** shows the diff summary (fields changed, byte ranges, which
  checksums will be repaired) before writing a new file — export never
  overwrites the original.
- **Checksum status** is always visible in the top bar (valid / repairable /
  mismatch) with an icon, not color alone.
- **Byte annotations**: the hex view highlights dirty bytes and checksum-covered
  ranges, and every semantic field links to its offset.

## Assets

Gen 1 sprites are fetched locally by `scripts/fetch-sprites.mjs` into
`public/sprites/` (gitignored, never redistributed) and precached by the service
worker for offline use.
