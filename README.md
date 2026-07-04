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
pnpm dev        # dev server
pnpm test       # unit tests (vitest)
pnpm e2e        # browser e2e tests (playwright)
pnpm build      # production build
```

See [DESIGN.md](DESIGN.md) for the design system and architecture notes.

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
