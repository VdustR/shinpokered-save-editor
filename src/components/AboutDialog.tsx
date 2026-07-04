import { useEffect, useRef } from "react";
import "./about.css";

const REPO_URL = "https://github.com/VdustR/shinpokered-save-editor";

/**
 * Source, license, credits, and the Nintendo disclaimer. Reachable from the
 * side-nav footer and the empty-state footer; kept out of the editing flow.
 */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog ref={ref} className="about" onClose={onClose} aria-labelledby="about-title">
      <div className="about__head">
        <h2 className="about__title" id="about-title">
          Shin Pokémon Save Editor <span className="about__version mono">v{__APP_VERSION__}</span>
        </h2>
        {/* Close via the native dialog so the close event drives parent state exactly once. */}
        <button type="button" className="about__x" onClick={() => ref.current?.close()} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="about__body">
        <p>
          A local-first editor for <strong>Shin Pokémon</strong> series battery saves (Red, Blue, and the
          Green/JP-styled builds), including vanilla international Gen 1 Red/Blue. Your save is parsed and
          edited entirely in this browser: no upload, no account, no analytics. It installs as a PWA and
          works offline.
        </p>

        <h3>Source &amp; license</h3>
        <p>
          Open source on{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub — VdustR/shinpokered-save-editor
          </a>
          , released under the{" "}
          <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
            MIT License
          </a>{" "}
          © 2026 VdustR (ViPro). Issues and PRs welcome.
        </p>

        <h3>Credits</h3>
        <ul>
          <li>
            Game data (base stats, moves, items, learnsets, sort order) is generated from the{" "}
            <a href="https://github.com/jojobear13/shinpokered" target="_blank" rel="noreferrer">
              jojobear13/shinpokered
            </a>{" "}
            source at tag 1.25.0.
          </li>
          <li>
            Save structure cross-referenced with the{" "}
            <a href="https://github.com/pret/pokered" target="_blank" rel="noreferrer">
              pret/pokered
            </a>{" "}
            disassembly and{" "}
            <a
              href="https://bulbapedia.bulbagarden.net/wiki/Save_data_structure_(Generation_I)"
              target="_blank"
              rel="noreferrer"
            >
              Bulbapedia
            </a>
            .
          </li>
          <li>
            Sprites from the{" "}
            <a href="https://github.com/PokeAPI/sprites" target="_blank" rel="noreferrer">
              PokeAPI sprites
            </a>{" "}
            collection, fetched at build time for display only.
          </li>
        </ul>

        <h3>Disclaimer</h3>
        <p>
          This is an unofficial fan tool. It is not affiliated with, endorsed, or sponsored by Nintendo,
          Creatures Inc., or GAME FREAK inc. Pokémon and all character names are trademarks of their
          respective owners; sprite artwork remains © Nintendo/Creatures/GAME FREAK. This project
          distributes no ROMs. Editing a save can produce states unreachable in normal play; keep a backup
          of the original file.
        </p>
      </div>
    </dialog>
  );
}
