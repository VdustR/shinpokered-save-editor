# PRODUCT.md

## What this is

A local-first web tool for editing Shin Pokémon Red/Blue (and vanilla Gen 1)
`.sav` battery saves. It parses the raw 32 KiB save, exposes trainer/party/box/
item/Pokédex fields with semantic editors backed by an annotated byte view, and
exports a repaired save that the game can load.

## Who uses it

ROM hackers and long-time Gen 1 players editing their own save of a fan romhack.
They are technical, care about not corrupting a save they've invested hours in,
and want a precise instrument — not a toy. They often work at night on a second
monitor while the emulator runs on the first.

## Register

Product. The design serves the task: load a file, change values with
confidence, export. Familiarity with tools like Linear/Raycast is a feature.
Density and precision beat decoration.

## Core principles

1. **Never corrupt silently.** The raw buffer is the source of truth. An
   untouched save exports byte-for-byte identical. Every edit is reversible and
   every checksum repair is reported.
2. **Show the bytes.** Semantic editors always tie back to an offset. Power
   users can drop to the hex view for anything the UI doesn't model.
3. **Local-first.** No upload, no account, no backend. Works fully offline as an
   installable PWA.

## Non-goals

ROM distribution, cloud save sync, live emulator memory editing, online
competitive cheating. Sprites are © Nintendo/Creatures/GAME FREAK and are
fetched locally, never redistributed.
