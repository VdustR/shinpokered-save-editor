# Shin Pokémon Red Save Editor

A local-first, offline-capable web save editor for
[Shin Pokémon Red/Blue](https://github.com/jojobear13/shinpokered)
(and vanilla Gen 1 Red/Blue) battery saves (`.sav` / `.srm`).

Your save file never leaves the browser: no upload, no account, no backend.

## Features

- Parse and edit 32 KiB Gen 1 battery saves: trainer, party, PC boxes,
  inventory, Pokédex, badges, options, play time.
- Byte-for-byte round-trip guarantee: exporting without edits reproduces the
  original file exactly.
- Automatic checksum validation and repair (main data + per-bank box
  checksums) on export.
- Game data (base stats, moves, items, species) generated from the
  [shinpokered](https://github.com/jojobear13/shinpokered) source at tag
  `1.25.0` — not hand-copied.
- Installable PWA with full offline support and in-app update prompt.
- Responsive layout, automatic light/dark theme.

## Development

```bash
pnpm install
pnpm gen:sprites  # download Gen 1 sprites into public/sprites (once; needs network)
pnpm dev          # dev server
pnpm test         # unit tests (vitest)
pnpm e2e          # browser e2e tests (playwright)
pnpm build        # production build (also regenerates the PWA service worker)
```

Sprites are not committed (they are © Nintendo/Creatures/GAME FREAK). Run
`pnpm gen:sprites` once; the PWA then precaches them for offline use. App icons
are original artwork and are committed, but can be regenerated with
`pnpm gen:icons`.

Game data is generated from the shinpokered source:

```bash
pnpm gen:data  # regenerate src/gen/gamedata.json (clones the pinned 1.25.0 tag)
```

See [DESIGN.md](DESIGN.md) for the design system and architecture notes.

## Testing & verification

The correctness strategy has four layers, from cheapest to strongest:

1. **Unit tests** (`pnpm test`) — checksum vectors, Gen 1 text/BCD codecs,
   Pokémon record round-trips, stat/EXP formulas, and field accessors.
2. **Real fixture** — `tests/fixtures/newgame.sav` is a genuine battery save
   produced by scripting the game's intro in a headless emulator
   (`SHINPOKERED_ROM=… pnpm make:fixture`). The suite asserts it parses and
   round-trips byte-for-byte.
3. **Browser e2e** (`pnpm e2e`) — loads the fixture, edits it, exports, and
   asserts the downloaded bytes: correct field values, a valid main checksum,
   and no unrelated bytes changed.
4. **Emulator smoke test** (`SHINPOKERED_ROM=… pnpm smoke`) — the release gate.
   Edits a save through the real save-core, boots the ROM with it, chooses
   CONTINUE, reaches the overworld, and asserts the game's own WRAM reflects the
   edits. This proves exported saves are loadable by the game, not merely
   well-formed. It is skipped when `SHINPOKERED_ROM` is unset.

## Credits

- Save structure and game data derived from
  [jojobear13/shinpokered](https://github.com/jojobear13/shinpokered) and the
  [pret/pokered](https://github.com/pret/pokered) disassembly.
- Gen 1 save layout cross-referenced with
  [Bulbapedia: Save data structure (Generation I)](https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_(Generation_I)).
- This project does not distribute ROMs. Pokémon is © Nintendo / Creatures
  Inc. / GAME FREAK inc. This is an unofficial fan tool.

## License

[MIT](LICENSE) © 2026 VdustR (ViPro)
