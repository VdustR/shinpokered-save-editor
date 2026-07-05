# Vendored binjgb

`binjgb.js` and `binjgb.wasm` are the prebuilt WebAssembly build of
[binji/binjgb](https://github.com/binji/binjgb), an accuracy-focused Game Boy
emulator in C (MIT, see `LICENSE`).

- Upstream commit: `c60e138da5a795ebb55e56b11b7e90024e41112c` (2026-06-15)
- Source of the binaries: the `docs/` directory of that commit (the files the
  demo at <https://binji.github.io/binjgb/> serves)
- Retrieved: 2026-07-05

Local modification: the trailing UMD export block of `binjgb.js`
(`if(typeof exports==="object"...define([],()=>Binjgb);`) is replaced with
`export default Binjgb;` so the Emscripten glue imports as an ES module under
Vite and vitest (the CJS branch breaks against their read-only `module`
shims). Everything else is byte-identical to upstream.

To update: clone the upstream repo, copy `docs/binjgb.js` + `docs/binjgb.wasm`
and the root `LICENSE` here, re-append the export line, and record the new
commit hash and date above. Rebuilding from C source instead requires
emscripten + cmake (see upstream README); the prebuilt binaries are preferred
to keep this repo's toolchain small.

Why binjgb: shinpokered's title menu runs hardware-accuracy self-checks
(mode-3 VRAM locking, memory-access timing adapted from blargg's mem_timing).
The previous pure-TS core failed both, printing "Emulator ERROR!" on the menu.
binjgb passes both (verified with a real shinpokered 1.25.0 ROM) and renders
the romhack's GBC colors.
