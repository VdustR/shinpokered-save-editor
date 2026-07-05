import { speciesName } from "../save/gamedata";
import { OFFSETS } from "../save/layout";
import { MAPS, POSITION_OFFSETS, getPosition, mapName, setPosition } from "../save/position";
import {
  BADGE_NAMES,
  MAX_COINS,
  MAX_MONEY,
  PLAYER_STARTER_OFFSET,
  RIVAL_STARTER_OFFSET,
  getBadges,
  getCoins,
  getMoney,
  getOptions,
  getPlayTime,
  getPlayerId,
  getPlayerName,
  getPlayerStarter,
  getRivalName,
  getRivalStarter,
  isEncodableName,
  setBadge,
  setCoins,
  setMoney,
  setOptions,
  setPlayTime,
  setPlayerId,
  setPlayerName,
  setPlayerStarter,
  setRivalName,
  setRivalStarter,
} from "../save/savefile";
import {
  RANDOMIZER_SEED_OFFSET,
  ROM_HACK_VERSION_OFFSET,
  WIN_STREAK_OFFSET,
  getRandomizerSeed,
  getRomHackVersion,
  getShinFlags,
  getWinStreak,
  setRandomizerSeed,
  setShinFlag,
  setWinStreak,
} from "../save/shin";
import { getEventFlag, setEventFlag } from "../save/events";
import { isEncodable } from "../save/text";
import { useNav } from "../state/nav";
import { useSaveStore } from "../state/store";
import {
  Field,
  NumberInput,
  NumberWithMax,
  Panel,
  Segmented,
  Select,
  TextInput,
  Toggle,
} from "../components/ui/ui";
import { PageHeader } from "../components/PageHeader";

/** EVENT_90E — the Oak-aide "gender/caught indicators" toggle. */
const GENDER_INDICATOR_EVENT = 0x90e;

const TEXT_SPEEDS = [
  { value: "1", label: "Fast" },
  { value: "3", label: "Mid" },
  { value: "5", label: "Slow" },
];

export function TrainerPage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const jump = useNav((s) => s.jumpToHex);

  const name = getPlayerName(bytes);
  const rival = getRivalName(bytes);
  const options = getOptions(bytes);
  const time = getPlayTime(bytes);
  const badges = getBadges(bytes);
  const shinFlags = getShinFlags(bytes);
  const position = getPosition(bytes);
  const dims = MAPS[position.map];
  const maxX = (dims?.width ?? 128) * 2 - 1;
  const maxY = (dims?.height ?? 128) * 2 - 1;

  const nameError = name && !isEncodable(name) ? "Contains characters the game can't store." : undefined;

  return (
    <div className="page">
      <PageHeader title="Trainer" subtitle="Identity, money, badges, and options." />

      <div className="page__grid">
        <Panel title="Identity">
          <div className="form-grid">
            <Field label="Player name" offset={OFFSETS.playerName} onJump={jump} error={nameError} hint="Max 10 characters.">
              <TextInput
                value={name}
                maxLength={10}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  if (isEncodableName(v)) mutate((b) => setPlayerName(b, v));
                }}
              />
            </Field>
            <Field label="Rival name" offset={OFFSETS.rivalName} onJump={jump} hint="Max 10 characters.">
              <TextInput
                value={rival}
                maxLength={10}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  if (isEncodableName(v)) mutate((b) => setRivalName(b, v));
                }}
              />
            </Field>
            <Field label="Trainer ID" offset={OFFSETS.playerId} onJump={jump} hint="0 – 65535">
              <NumberInput
                value={getPlayerId(bytes)}
                min={0}
                max={65535}
                onValue={(n) => mutate((b) => setPlayerId(b, n))}
              />
            </Field>
            <Field
              label="Rival's starter"
              offset={RIVAL_STARTER_OFFSET}
              onJump={jump}
              hint="Picks the team he brings to every rival battle."
            >
              <StarterSelect
                ariaLabel="Rival's starter"
                value={getRivalStarter(bytes)}
                onChange={(id) => mutate((b) => setRivalStarter(b, id))}
              />
            </Field>
            <Field
              label="Your starter"
              offset={PLAYER_STARTER_OFFSET}
              onJump={jump}
              hint="Recorded pick; referenced by some dialogue."
            >
              <StarterSelect
                ariaLabel="Your starter"
                value={getPlayerStarter(bytes)}
                onChange={(id) => mutate((b) => setPlayerStarter(b, id))}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Resources">
          <div className="form-grid">
            <Field label="Money" offset={OFFSETS.money} onJump={jump} hint={`0 – ${MAX_MONEY.toLocaleString()}`}>
              <div className="input-row">
                <NumberInput
                  data-testid="money-input"
                  value={getMoney(bytes)}
                  min={0}
                  max={MAX_MONEY}
                  onValue={(n) => mutate((b) => setMoney(b, n))}
                />
                <button
                  type="button"
                  className="btn btn--default btn--sm input-row__max"
                  onClick={() => mutate((b) => setMoney(b, MAX_MONEY))}
                  disabled={getMoney(bytes) === MAX_MONEY}
                >
                  Max
                </button>
              </div>
            </Field>
            <Field label="Coins" offset={OFFSETS.coins} onJump={jump} hint={`0 – ${MAX_COINS.toLocaleString()}`}>
              <NumberWithMax
                value={getCoins(bytes)}
                min={0}
                max={MAX_COINS}
                onValue={(n) => mutate((b) => setCoins(b, n))}
                aria-label="Coins"
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Badges" className="span-2">
          <div className="badge-grid">
            {BADGE_NAMES.map((badgeName, bit) => (
              <button
                key={badgeName}
                type="button"
                className={`badge-toggle ${badges[bit] ? "badge-toggle--on" : ""}`}
                aria-pressed={badges[bit]}
                onClick={() => mutate((b) => setBadge(b, bit, !badges[bit]))}
              >
                <span className="badge-toggle__disc" aria-hidden />
                <span className="badge-toggle__name">{badgeName}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Options">
          <div className="form-grid">
            <Field label="Text speed" offset={OFFSETS.options} onJump={jump}>
              <Segmented
                ariaLabel="Text speed"
                options={TEXT_SPEEDS}
                value={String(options.textSpeed)}
                onChange={(v) => mutate((b) => setOptions(b, { ...options, textSpeed: Number(v) }))}
              />
            </Field>
            <div className="toggle-row">
              {/* The save stores "animations off" (wOptions bit 7 = 1); present
                  it positively so checked always means the feature is on. */}
              <Toggle
                checked={!options.battleAnimationOff}
                label="Battle animations"
                onChange={(v) => mutate((b) => setOptions(b, { ...options, battleAnimationOff: !v }))}
              />
            </div>
            <Field label="Battle style" hint="Set skips the switch prompt after enemy KOs.">
              <Segmented
                ariaLabel="Battle style"
                options={[
                  { value: "shift", label: "Shift" },
                  { value: "set", label: "Set" },
                ]}
                value={options.battleStyleSet ? "set" : "shift"}
                onChange={(v) => mutate((b) => setOptions(b, { ...options, battleStyleSet: v === "set" }))}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Shin features">
          <div className="form-grid">
            <div className="toggle-row">
              <Toggle
                checked={shinFlags.femaleTrainer}
                label="Female trainer"
                onChange={(v) => mutate((b) => setShinFlag(b, "femaleTrainer", v))}
              />
              <Toggle
                checked={shinFlags.sixtyFps}
                label="60 FPS mode"
                onChange={(v) => mutate((b) => setShinFlag(b, "sixtyFps", v))}
              />
              <Toggle
                checked={shinFlags.gbcColors}
                label="Enhanced GBC colors"
                onChange={(v) => mutate((b) => setShinFlag(b, "gbcColors", v))}
              />
              <Toggle
                checked={shinFlags.obedienceCap}
                label="Obedience level cap"
                onChange={(v) => mutate((b) => setShinFlag(b, "obedienceCap", v))}
              />
              <Toggle
                checked={shinFlags.nuzlocke}
                label="Nuzlocke mode"
                onChange={(v) => mutate((b) => setShinFlag(b, "nuzlocke", v))}
              />
              {/* Oak-aide toggle (EVENT_90E): shows caught-ball and gender
                  symbols on the status screen and battle HUD once the player
                  has the Pokédex. */}
              <Toggle
                checked={getEventFlag(bytes, GENDER_INDICATOR_EVENT)}
                label="Caught & gender indicators"
                onChange={(v) => mutate((b) => setEventFlag(b, GENDER_INDICATOR_EVENT, v))}
              />
            </div>
            <div className="form-grid form-grid--2">
              <Field
                label="Randomizer seed"
                offset={RANDOMIZER_SEED_OFFSET}
                onJump={jump}
                hint="Used by the wild-encounter randomizer."
              >
                <NumberInput
                  value={getRandomizerSeed(bytes)}
                  min={0}
                  max={255}
                  onValue={(n) => mutate((b) => setRandomizerSeed(b, n))}
                />
              </Field>
              <Field label="Save format version" offset={ROM_HACK_VERSION_OFFSET} onJump={jump} hint="Set by the ROM on save.">
                <NumberInput value={getRomHackVersion(bytes)} min={0} max={255} onValue={() => {}} disabled />
              </Field>
              <Field
                label="Underground win streak"
                offset={WIN_STREAK_OFFSET}
                onJump={jump}
                hint="Post-E4 random-battle NPC; reach 5 to spawn the M.GENE."
              >
                <NumberInput
                  value={getWinStreak(bytes)}
                  min={0}
                  max={255}
                  aria-label="Underground win streak"
                  onValue={(n) => mutate((b) => setWinStreak(b, n))}
                />
              </Field>
            </div>
            <p className="hint-line">
              Shin-only settings stored in the save (vanilla games ignore these bytes).
            </p>
          </div>
        </Panel>

        <Panel title="Position">
          <div className="form-grid">
            <Field
              label="Current map"
              offset={POSITION_OFFSETS.map}
              onJump={jump}
              hint="Where the game puts you on continue — edit to escape a softlock."
            >
              <Select
                value={position.map}
                aria-label="Current map"
                onChange={(e) => {
                  const map = Number(e.target.value);
                  const dims = MAPS[map];
                  mutate((b) =>
                    setPosition(b, {
                      map,
                      // Clamp into the new map's bounds so the warp lands inside it.
                      x: Math.min(position.x, (dims?.width ?? 128) * 2 - 1),
                      y: Math.min(position.y, (dims?.height ?? 128) * 2 - 1),
                    }),
                  );
                }}
              >
                {position.map >= MAPS.length && (
                  <option value={position.map} disabled>
                    {mapName(position.map)} (${position.map.toString(16).padStart(2, "0").toUpperCase()})
                  </option>
                )}
                {MAPS.map((_m, id) => (
                  <option key={id} value={id}>
                    {mapName(id)} (${id.toString(16).padStart(2, "0").toUpperCase()})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="form-grid form-grid--2">
              <Field label="X" offset={POSITION_OFFSETS.x} onJump={jump} hint={`0 – ${maxX}`}>
                <NumberInput
                  value={position.x}
                  min={0}
                  max={maxX}
                  aria-label="X coordinate"
                  onValue={(n) => mutate((b) => setPosition(b, { ...position, x: n }))}
                />
              </Field>
              <Field label="Y" offset={POSITION_OFFSETS.y} onJump={jump} hint={`0 – ${maxY}`}>
                <NumberInput
                  value={position.y}
                  min={0}
                  max={maxY}
                  aria-label="Y coordinate"
                  onValue={(n) => mutate((b) => setPosition(b, { ...position, y: n }))}
                />
              </Field>
            </div>
            <p className="hint-line">
              Coordinates are tiles from the map's top-left. Landing on a solid tile can re-strand you:
              small values near the map centre are safest.
            </p>
          </div>
        </Panel>

        <Panel title="Play time">
          <div className="form-grid form-grid--3">
            <Field label="Hours" offset={OFFSETS.playTimeHours} onJump={jump}>
              <NumberInput value={time.hours} min={0} max={255} onValue={(n) => mutate((b) => setPlayTime(b, { ...time, hours: n }))} />
            </Field>
            <Field label="Minutes">
              <NumberInput value={time.minutes} min={0} max={59} onValue={(n) => mutate((b) => setPlayTime(b, { ...time, minutes: n }))} />
            </Field>
            <Field label="Seconds">
              <NumberInput value={time.seconds} min={0} max={59} onValue={(n) => mutate((b) => setPlayTime(b, { ...time, seconds: n }))} />
            </Field>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// The three Gen 1 starters by species internal id (constants/starter_mons.asm).
const STARTERS = [0xb0, 0xb1, 0x99]; // CHARMANDER, SQUIRTLE, BULBASAUR

/**
 * Starter picker constrained to the three legal values; an out-of-range byte
 * (possible on odd saves) is shown as a disabled "Unknown" entry so the value
 * is visible without offering an option the game's team-selection code does
 * not understand.
 */
function StarterSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (speciesId: number) => void;
  ariaLabel: string;
}) {
  const known = STARTERS.includes(value);
  return (
    <Select value={value} aria-label={ariaLabel} onChange={(e) => onChange(Number(e.target.value))}>
      {!known && (
        <option value={value} disabled>
          Unknown (${value.toString(16).padStart(2, "0").toUpperCase()})
        </option>
      )}
      {STARTERS.map((id) => (
        <option key={id} value={id}>
          {speciesName(id)}
        </option>
      ))}
    </Select>
  );
}
