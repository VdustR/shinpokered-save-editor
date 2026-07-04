/** Packed big-endian BCD, used by Gen 1 for money (3 bytes) and coins (2 bytes). */

export function decodeBcd(bytes: Uint8Array): number {
  let value = 0;
  for (const byte of bytes) {
    value = value * 100 + (byte >> 4) * 10 + (byte & 0x0f);
  }
  return value;
}

export function encodeBcd(value: number, byteLength: number): Uint8Array {
  const max = 10 ** (byteLength * 2) - 1;
  let clamped = Math.min(Math.max(Math.trunc(value), 0), max);
  const out = new Uint8Array(byteLength);
  for (let i = byteLength - 1; i >= 0; i--) {
    const pair = clamped % 100;
    out[i] = (Math.floor(pair / 10) << 4) | pair % 10;
    clamped = Math.floor(clamped / 100);
  }
  return out;
}
