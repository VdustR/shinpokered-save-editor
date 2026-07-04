import { speciesByInternalId, speciesName } from "../save/gamedata";
import {
  HOF_CAPACITY,
  HOF_COUNT_OFFSET,
  HOF_OFFSET,
  HOF_TEAM_SIZE,
  clearHallOfFame,
  getHofCount,
  readHofTeams,
  setHofCount,
} from "../save/halloffame";
import { useNav } from "../state/nav";
import { useSaveStore } from "../state/store";
import { Button, Field, NumberInput, Panel } from "../components/ui/ui";
import { EmptyLine } from "../components/EmptyLine";
import { PageHeader } from "../components/PageHeader";
import { Sprite } from "../components/Sprite";

/** Read-mostly viewer for the bank-0 Hall of Fame records. */
export function HallOfFamePage() {
  const bytes = useSaveStore((s) => s.bytes)!;
  const mutate = useSaveStore((s) => s.mutate);
  const jump = useNav((s) => s.jumpToHex);

  const count = getHofCount(bytes);
  const teams = readHofTeams(bytes);
  // Leftover record bytes can exist with a zeroed counter; Clear must stay
  // available until the whole region is actually empty.
  const regionHasData = bytes
    .subarray(HOF_OFFSET, HOF_OFFSET + HOF_TEAM_SIZE * HOF_CAPACITY)
    .some((b) => b !== 0);

  return (
    <div className="page">
      <PageHeader
        title="Hall of Fame"
        subtitle="Championship records from SRAM bank 0. The win counter keeps counting past the 50 stored teams."
        actions={
          <Button
            variant="danger"
            size="sm"
            onClick={() => mutate((b) => clearHallOfFame(b))}
            disabled={count === 0 && !regionHasData}
          >
            Clear records
          </Button>
        }
      />

      <Panel title="Wins">
        <div className="form-grid form-grid--2">
          <Field
            label="Championships"
            offset={HOF_COUNT_OFFSET}
            onJump={jump}
            hint={`Stored teams: ${teams.length} / ${HOF_CAPACITY}`}
          >
            <NumberInput
              value={count}
              min={0}
              max={255}
              aria-label="Championship count"
              onValue={(n) => mutate((b) => setHofCount(b, n))}
            />
          </Field>
          <Field label="Records region" offset={HOF_OFFSET} onJump={jump} hint="No checksum covers bank 0.">
            <span className="mono muted">{HOF_CAPACITY} teams × 96 bytes</span>
          </Field>
        </div>
      </Panel>

      {teams.length === 0 ? (
        <EmptyLine
          title="No recorded teams"
          body="Beat the Elite Four to record a team, or raise the win counter — the game only stores a team when the ceremony plays."
        />
      ) : (
        <div className="hof-teams">
          {teams.map((team, t) => (
            <Panel key={t} title={`Entry ${t + 1}`} className="hof-team">
              <div className="hof-team__mons">
                {team.length === 0 ? (
                  <p className="hint-line">Empty record.</p>
                ) : (
                  team.map((mon, s) => {
                    const sp = speciesByInternalId(mon.species);
                    return (
                      <div className="hof-mon" key={s}>
                        <Sprite dexNo={sp?.dexNo ?? 0} size={40} alt={speciesName(mon.species)} />
                        <span className="hof-mon__name">{mon.nickname || speciesName(mon.species)}</span>
                        <span className="hof-mon__meta mono">
                          Lv{mon.level} · {speciesName(mon.species)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
