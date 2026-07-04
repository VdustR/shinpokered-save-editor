import { useState } from "react";
import { AboutDialog } from "./AboutDialog";

/**
 * One-line meta footer: version, repo, license, and the About dialog trigger.
 * Rendered at the bottom of the side nav and under the empty-state dropzone.
 */
export function AppFooter() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div className="app-footer">
      <span className="mono">v{__APP_VERSION__}</span>
      <span className="app-footer__sep" aria-hidden>
        ·
      </span>
      <a
        href="https://github.com/VdustR/shinpokered-save-editor"
        target="_blank"
        rel="noreferrer"
        aria-label="Source code on GitHub"
      >
        GitHub
      </a>
      <span className="app-footer__sep" aria-hidden>
        ·
      </span>
      <span>MIT © 2026 VdustR</span>
      <span className="app-footer__sep" aria-hidden>
        ·
      </span>
      <button type="button" onClick={() => setAboutOpen(true)} data-testid="about-open">
        About
      </button>
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
