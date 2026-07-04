/**
 * Heuristics for "is this actually a Gen 1 / Shin battery save?".
 *
 * The game itself only verifies the main-data checksum on continue, so a
 * matching checksum is treated as authoritative. When the checksum fails we
 * look at structural signals to distinguish "corrupted Gen 1 save" from
 * "not a Gen 1 save at all" and word the user-facing alert accordingly.
 */
import { computeChecksum } from "./checksum";
import { MONS_PER_BOX, NAME_LENGTH, NUM_BOXES, OFFSETS, PARTY_LENGTH, SAVE_SIZE } from "./layout";
import { decodeName } from "./text";

export type SaveVerdict = "valid" | "suspect" | "invalid";

export interface SaveAssessment {
  verdict: SaveVerdict;
  mainChecksumValid: boolean;
  /** Human-readable descriptions of the signals that failed. */
  issues: string[];
}

export function assessSave(bytes: Uint8Array): SaveAssessment {
  // parseSave rejects short files before this runs, but keep assessSave safe
  // as a standalone API: undersized input can never be a Gen 1 save.
  if (bytes.length < SAVE_SIZE) {
    return {
      verdict: "invalid",
      mainChecksumValid: false,
      issues: ["File is too small to be a Gen 1 save"],
    };
  }

  const mainChecksumValid =
    bytes[OFFSETS.mainChecksum] ===
    computeChecksum(bytes, OFFSETS.playerName, OFFSETS.mainChecksum - OFFSETS.playerName);

  if (mainChecksumValid) {
    return { verdict: "valid", mainChecksumValid, issues: [] };
  }

  const issues: string[] = ["Main data checksum does not match"];
  let structuralPasses = 0;

  // Party list: count in range and the species list 0xff-terminated at count.
  const partyCount = bytes[OFFSETS.partyCount];
  if (partyCount <= PARTY_LENGTH && bytes[OFFSETS.partySpecies + partyCount] === 0xff) {
    structuralPasses += 1;
  } else {
    issues.push("Party list is not a valid Gen 1 structure");
  }

  // Player name: non-empty and fully decodable with the game's charmap.
  const name = decodeName(bytes.subarray(OFFSETS.playerName, OFFSETS.playerName + NAME_LENGTH));
  if (name.length > 0 && !name.includes("<$")) {
    structuralPasses += 1;
  } else {
    issues.push("Player name is not readable game text");
  }

  // Current box index and box count in range.
  const boxIndex = bytes[OFFSETS.currentBoxNum] & 0x7f;
  const boxCount = bytes[OFFSETS.currentBox];
  if (boxIndex < NUM_BOXES && boxCount <= MONS_PER_BOX) {
    structuralPasses += 1;
  } else {
    issues.push("Current-box data is out of range");
  }

  // With most structure intact this is plausibly a corrupted Gen 1 save;
  // otherwise it is probably some other kind of file.
  return { verdict: structuralPasses >= 2 ? "suspect" : "invalid", mainChecksumValid, issues };
}
