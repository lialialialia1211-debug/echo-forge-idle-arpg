import { arenaCircuits } from "../../data/arenaCircuits";
import { topFrames } from "../../data/topFrames";
import { createTopArenaRuntime, stepTopArenaRuntime } from "../arenaRuntime";

export type BalanceSoakRow = {
  frameId: string;
  arenaId: string;
  seconds: number;
  kills: number;
  routeClears: number;
  outcome: string;
  survived: boolean;
  drops: number;
};

export type BalanceSoakOptions = {
  seconds?: number;
  stepSeconds?: number;
  maxRows?: number;
};

export function runBalanceSoak(options: BalanceSoakOptions = {}): BalanceSoakRow[] {
  const seconds = options.seconds ?? 90;
  const stepSeconds = options.stepSeconds ?? 0.1;
  const maxRows = options.maxRows ?? topFrames.length * arenaCircuits.length;
  const rows: BalanceSoakRow[] = [];

  for (const frame of topFrames) {
    for (const arena of arenaCircuits) {
      let runtime = createTopArenaRuntime({
        arenaId: arena.id,
        frameId: frame.id,
        driveId: frame.startingDriveId,
        seed: `soak_${frame.id}_${arena.id}`,
      });
      for (let elapsed = 0; elapsed < seconds && runtime.outcome === "ongoing"; elapsed += stepSeconds) {
        runtime = stepTopArenaRuntime(runtime, stepSeconds);
      }
      rows.push({
        frameId: frame.id,
        arenaId: arena.id,
        seconds,
        kills: runtime.kills,
        routeClears: runtime.routeClears,
        outcome: runtime.outcome,
        survived: runtime.outcome !== "defeat",
        drops: runtime.drops.length,
      });
      if (rows.length >= maxRows) {
        return rows;
      }
    }
  }

  return rows;
}

export function formatBalanceSoakCsv(rows: BalanceSoakRow[]): string {
  const header = "frameId,arenaId,seconds,kills,routeClears,outcome,survived,drops";
  return [
    header,
    ...rows.map((row) => [row.frameId, row.arenaId, row.seconds, row.kills, row.routeClears, row.outcome, row.survived ? "true" : "false", row.drops].join(",")),
  ].join("\n");
}

export function assertBalanceSoakThresholds(rows: BalanceSoakRow[]): void {
  if (rows.length === 0) {
    throw new Error("Balance soak produced no rows.");
  }
  const brokenRows = rows.filter((row) => !Number.isFinite(row.kills) || row.kills < 0 || row.kills > 5000);
  if (brokenRows.length > 0) {
    throw new Error(`Balance soak detected invalid kill output: ${brokenRows.map((row) => `${row.frameId}/${row.arenaId}`).join(", ")}`);
  }
}
