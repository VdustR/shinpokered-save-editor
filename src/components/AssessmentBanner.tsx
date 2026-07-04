import { useSaveStore } from "../state/store";
import "./assessment-banner.css";

/**
 * Shown after loading a file whose main checksum does not match:
 * - "suspect": structure looks like Gen 1, likely a corrupted save;
 * - "invalid": structure is nonsense, probably not a Gen 1 save at all.
 * Editing stays available either way (the hex view is still useful), but the
 * user is told clearly what they opened.
 */
export function AssessmentBanner() {
  const assessment = useSaveStore((s) => s.assessment);
  const dismiss = useSaveStore((s) => s.dismissAssessment);
  if (!assessment) return null;

  const invalid = assessment.verdict === "invalid";
  return (
    <div className={`assess assess--${assessment.verdict}`} role="alert" data-testid="assessment-banner">
      <div className="assess__text">
        <strong className="assess__title">
          {invalid
            ? "This file does not look like a Gen 1 / Shin Pokémon save."
            : "This save's checksum is invalid — it may be corrupted."}
        </strong>
        <span className="assess__detail">
          {assessment.issues.join(" · ")}
          {invalid
            ? " — you can still inspect it in Raw Hex, but the editors may show garbage."
            : " — exporting will repair the checksum of any section you edit."}
        </span>
      </div>
      <button type="button" className="assess__dismiss" onClick={dismiss}>
        Dismiss
      </button>
    </div>
  );
}
