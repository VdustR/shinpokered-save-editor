/**
 * Gen 1 text codec driven by the charmap generated from shinpokered
 * `charmap.asm`. Names are fixed-length fields terminated by "@" ($50).
 */
import gamedata from "../gen/gamedata.json";

export const TEXT_TERMINATOR = 0x50;

const byteToToken = new Map<number, string>();
for (const [code, token] of Object.entries(gamedata.charmap as Record<string, string>)) {
  byteToToken.set(Number(code), token);
}

const tokenToByte = new Map<string, number>();
for (const [code, token] of byteToToken) {
  // Prefer the canonical printable range ($60+) when the same token appears
  // twice; encode must produce bytes the game font actually renders.
  if (!tokenToByte.has(token) || code >= 0x60) tokenToByte.set(token, code);
}

const maxTokenLength = Math.max(...[...tokenToByte.keys()].map((token) => token.length));

export function decodeText(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    if (byte === TEXT_TERMINATOR) break;
    const token = byteToToken.get(byte);
    out += token ?? `<$${byte.toString(16).padStart(2, "0")}>`;
  }
  return out;
}

/**
 * Decode a Gen 1 name field for display. Unlike decodeText, it also stops at a
 * 0x00 byte: some saves leave never-set name fields as 0x00 padding rather than
 * the 0x50 terminator, and rendering those as "<$00>" is noise. Raw bytes are
 * untouched, so this is display-only and does not affect round-trips.
 */
export function decodeName(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    if (byte === TEXT_TERMINATOR || byte === 0x00) break;
    const token = byteToToken.get(byte);
    out += token ?? `<$${byte.toString(16).padStart(2, "0")}>`;
  }
  return out;
}

/**
 * Encode into a fixed-length field. The remainder is filled with terminators,
 * which is how the game initializes name fields. At least one terminator must
 * fit, so the maximum text length is `fieldLength - 1` bytes.
 */
export function encodeText(text: string, fieldLength: number): Uint8Array {
  const codes: number[] = [];
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (let len = Math.min(maxTokenLength, text.length - i); len >= 1; len--) {
      const byte = tokenToByte.get(text.slice(i, i + len));
      if (byte !== undefined) {
        codes.push(byte);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new Error(`Cannot encode character: ${JSON.stringify(text[i])}`);
    }
  }
  if (codes.length >= fieldLength) {
    throw new Error(`Text too long: needs ${codes.length + 1} bytes, field is ${fieldLength}`);
  }
  const out = new Uint8Array(fieldLength).fill(TEXT_TERMINATOR);
  out.set(codes, 0);
  return out;
}

export function isEncodable(text: string): boolean {
  try {
    // Length is not this function's concern; use a field large enough.
    encodeText(text, text.length * 2 + 2);
    return true;
  } catch {
    return false;
  }
}
