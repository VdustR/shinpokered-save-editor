import { useState } from "react";

const BASE = `${import.meta.env.BASE_URL}sprites`;

/** Gen 1 species sprite by dex number, with a graceful fallback. */
export function Sprite({ dexNo, size = 56, alt }: { dexNo: number; size?: number; alt: string }) {
  const [failed, setFailed] = useState(false);
  const valid = dexNo >= 1 && dexNo <= 151 && !failed;
  return (
    <span className="sprite" style={{ width: size, height: size }} aria-hidden={!alt}>
      {valid ? (
        <img
          src={`${BASE}/${dexNo}.png`}
          width={size}
          height={size}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <span className="sprite__missing mono" title="No sprite">
          ?
        </span>
      )}
    </span>
  );
}
