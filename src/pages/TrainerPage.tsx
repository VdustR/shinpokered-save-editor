import { OFFSETS } from "../save/layout";
import {
  BADGE_NAMES,
  MAX_COINS,
  MAX_MONEY,
  getBadges,
  getCoins,
  getMoney,
  getOptions,
  getPlayTime,
  getPlayerId,
  getPlayerName,
  getRivalName,
  isEncodableName,
  setBadge,
  setCoins,
  setMoney,
  setOptions,
  setPlayTime,
  setPlayerId,
  setPlayerName,
  setRivalName,
} from "../save/savefile";
import { isEncodable } from "../save/text";
import { useNav } from "../state/nav";
import { useSaveStore } from "../state/store";
import { Field, NumberInput, NumberWithMax, Panel, Segmented, TextInput, Toggle } from "../components/ui/ui";
import { PageHeader } from "../components/PageHeader";

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
              <Toggle
                checked={options.battleAnimationOff}
                label="Battle animations off"
                onChange={(v) => mutate((b) => setOptions(b, { ...options, battleAnimationOff: v }))}
              />
              <Toggle
                checked={options.battleStyleSet}
                label="Battle style: Set"
                onChange={(v) => mutate((b) => setOptions(b, { ...options, battleStyleSet: v }))}
              />
            </div>
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
