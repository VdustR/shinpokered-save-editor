import type { PointerEvent } from "react";
import type { GbButton } from "../emu/testdrive";

/**
 * Touch gamepad for the Test Drive. Pointer events (not click) so presses
 * hold while the finger stays down and multi-touch works (D-pad + A at once);
 * pointer capture keeps the release paired with its button even if the
 * finger slides off.
 */
export function VirtualPad({ onButton }: { onButton: (button: GbButton, pressed: boolean) => void }) {
  function bind(button: GbButton) {
    return {
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onButton(button, true);
      },
      onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        onButton(button, false);
      },
      onPointerCancel: () => onButton(button, false),
      onContextMenu: (e: PointerEvent<HTMLButtonElement>) => e.preventDefault(),
    };
  }

  return (
    <div className="vpad" data-testid="virtual-pad">
      <div className="vpad__dpad" aria-label="D-pad">
        <button type="button" className="vpad__key vpad__key--up" aria-label="Up" {...bind("up")}>
          ▲
        </button>
        <button type="button" className="vpad__key vpad__key--left" aria-label="Left" {...bind("left")}>
          ◀
        </button>
        <span className="vpad__key vpad__key--center" aria-hidden />
        <button type="button" className="vpad__key vpad__key--right" aria-label="Right" {...bind("right")}>
          ▶
        </button>
        <button type="button" className="vpad__key vpad__key--down" aria-label="Down" {...bind("down")}>
          ▼
        </button>
      </div>

      <div className="vpad__middle">
        <button type="button" className="vpad__pill" aria-label="Select" {...bind("select")}>
          SELECT
        </button>
        <button type="button" className="vpad__pill" aria-label="Start" {...bind("start")}>
          START
        </button>
      </div>

      <div className="vpad__actions">
        <button type="button" className="vpad__round vpad__round--b" aria-label="B" {...bind("b")}>
          B
        </button>
        <button type="button" className="vpad__round vpad__round--a" aria-label="A" {...bind("a")}>
          A
        </button>
      </div>
    </div>
  );
}
