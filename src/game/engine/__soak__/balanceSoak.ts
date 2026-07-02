import { arenaCircuits } from "../../data/arenaCircuits";
import { namedRivals } from "../../data/namedRivals";
import { topFrames } from "../../data/topFrames";
import { createTopArenaRuntime, stepTopArenaRuntime } from "../arenaRuntime";
import type { TopArenaOutcome, TopLoadoutConfig } from "../topTypes";

export type BalanceSoakScenario = "arena" | "talentRoute" | "rivalDuel";

type BalanceTalentRouteScenario = {
  id: string;
  frameId: string;
  driveId: string;
  arenaId: string;
  loadout: TopLoadoutConfig;
};

export type BalanceSoakRow = {
  scenario: BalanceSoakScenario;
  scenarioId: string;
  frameId: string;
  driveId: string;
  arenaId: string;
  rivalId?: string;
  talentRouteId?: string;
  seconds: number;
  elapsedSeconds: number;
  kills: number;
  routeClears: number;
  outcome: TopArenaOutcome;
  survived: boolean;
  drops: number;
  playerIntegrityRemaining: number;
};

export type BalanceSoakOptions = {
  seconds?: number;
  stepSeconds?: number;
  maxRows?: number;
};

export const balanceTalentRouteScenarios: BalanceTalentRouteScenario[] = [
  {
    id: "glass_edge",
    frameId: "frame_swift_razor",
    driveId: "drive_shard_barrage",
    arenaId: "arena_glass_mire_basin",
    loadout: {
      talentIds: [
        "talent_iron_rotation",
        "talent_razor_geometry",
        "talent_impact_entry",
        "talent_impact_calibrator",
        "talent_impact_path",
        "talent_impact_notable",
        "talent_glass_entry",
        "talent_glass_calibrator",
        "talent_glass_path",
        "talent_glass_notable",
        "talent_keystone_glass_blade",
      ],
      doctrineId: "doctrine_swift_razor_edge",
    },
  },
  {
    id: "storm_chain",
    frameId: "frame_storm_needle",
    driveId: "drive_chain_tempest",
    arenaId: "arena_red_chancel_disk",
    loadout: {
      runeIds: ["rune_ion_pulse", "rune_echo_coil", "rune_wide_scoring"],
      talentIds: [
        "talent_iron_rotation",
        "talent_live_bearing",
        "talent_storm_lattice",
        "talent_speed_entry",
        "talent_speed_calibrator",
        "talent_speed_path",
        "talent_speed_notable",
        "talent_static_entry",
        "talent_static_calibrator",
        "talent_static_path",
        "talent_static_notable",
        "talent_keystone_overload_bearing",
      ],
      doctrineId: "doctrine_storm_chain_savant",
    },
  },
  {
    id: "ember_mass",
    frameId: "frame_ember_crucible",
    driveId: "drive_molten_groove",
    arenaId: "arena_red_chancel_disk",
    loadout: {
      runeIds: ["rune_red_heat", "rune_echo_coil", "rune_wide_scoring"],
      talentIds: [
        "talent_iron_rotation",
        "talent_live_bearing",
        "talent_furnace_scoring",
        "talent_guard_entry",
        "talent_guard_calibrator",
        "talent_guard_path",
        "talent_guard_notable",
        "talent_thermal_mass_entry",
        "talent_thermal_mass_calibrator",
        "talent_thermal_mass_path",
        "talent_thermal_mass_notable",
        "talent_fire_entry",
        "talent_fire_calibrator",
        "talent_fire_path",
        "talent_fire_notable",
        "talent_keystone_resonance_meltdown",
      ],
      doctrineId: "doctrine_ember_rail_monk",
    },
  },
  {
    id: "route_farming",
    frameId: "frame_swift_razor",
    driveId: "drive_razor_rebound",
    arenaId: "arena_red_chancel_disk",
    loadout: {
      runeIds: ["rune_bite_return", "rune_bloodless_line", "rune_deep_bearing"],
      talentIds: [
        "talent_iron_rotation",
        "talent_razor_geometry",
        "talent_salvage_rites",
        "talent_loot_entry",
        "talent_loot_calibrator",
        "talent_loot_path",
        "talent_loot_notable",
        "talent_route_engine_entry",
        "talent_route_engine_calibrator",
        "talent_route_engine_path",
        "talent_route_engine_notable",
        "talent_keystone_greedy_route",
      ],
      doctrineId: "doctrine_swift_orbit_duelist",
    },
  },
];

const balanceRivalDuelScenario: BalanceTalentRouteScenario = {
  id: "anchor_duelist",
  frameId: "frame_ember_crucible",
  driveId: "drive_molten_groove",
  arenaId: "arena_red_chancel_disk",
  loadout: {
    runeIds: ["rune_red_heat", "rune_echo_coil", "rune_wide_scoring", "rune_furnace_wall"],
    talentIds: [
      "talent_iron_rotation",
      "talent_guard_entry",
      "talent_guard_calibrator",
      "talent_guard_path",
      "talent_guard_notable",
      "talent_flux_entry",
      "talent_flux_calibrator",
      "talent_flux_path",
      "talent_flux_notable",
      "talent_thermal_mass_entry",
      "talent_thermal_mass_calibrator",
      "talent_thermal_mass_path",
      "talent_thermal_mass_notable",
      "talent_keystone_anchor_singularity",
    ],
    doctrineId: "doctrine_ember_rail_monk",
  },
};

const roundMetric = (value: number) => Number(value.toFixed(3));

function simulateSoakRow({
  scenario,
  scenarioId,
  frameId,
  driveId,
  arenaId,
  loadout = {},
  rivalId,
  seconds,
  stepSeconds,
}: {
  scenario: BalanceSoakScenario;
  scenarioId: string;
  frameId: string;
  driveId: string;
  arenaId: string;
  loadout?: TopLoadoutConfig;
  rivalId?: string;
  seconds: number;
  stepSeconds: number;
}): BalanceSoakRow {
  let runtime = createTopArenaRuntime({
    arenaId,
    frameId,
    driveId,
    loadout,
    seed: `soak_${scenarioId}`,
    mode: scenario === "rivalDuel" ? "duel" : "route",
    rivalId,
  });

  for (let elapsed = 0; elapsed < seconds && runtime.outcome === "ongoing"; elapsed += stepSeconds) {
    runtime = stepTopArenaRuntime(runtime, stepSeconds);
  }

  return {
    scenario,
    scenarioId,
    frameId,
    driveId,
    arenaId,
    rivalId,
    talentRouteId: scenario === "talentRoute" ? scenarioId : undefined,
    seconds,
    elapsedSeconds: roundMetric(runtime.time),
    kills: runtime.kills,
    routeClears: runtime.routeClears,
    outcome: runtime.outcome,
    survived: runtime.outcome !== "defeat",
    drops: runtime.drops.length,
    playerIntegrityRemaining: roundMetric(runtime.player.spinIntegrity),
  };
}

export function runBalanceSoak(options: BalanceSoakOptions = {}): BalanceSoakRow[] {
  const seconds = options.seconds ?? 90;
  const stepSeconds = options.stepSeconds ?? 0.1;
  const maxRows = options.maxRows ?? topFrames.length * arenaCircuits.length + balanceTalentRouteScenarios.length + namedRivals.length;
  const rows: BalanceSoakRow[] = [];

  for (const frame of topFrames) {
    for (const arena of arenaCircuits) {
      rows.push(
        simulateSoakRow({
          scenario: "arena",
          scenarioId: `${frame.id}_${arena.id}`,
          frameId: frame.id,
          driveId: frame.startingDriveId,
          arenaId: arena.id,
          seconds,
          stepSeconds,
        }),
      );
      if (rows.length >= maxRows) {
        return rows;
      }
    }
  }

  for (const route of balanceTalentRouteScenarios) {
    rows.push(
      simulateSoakRow({
        scenario: "talentRoute",
        scenarioId: route.id,
        frameId: route.frameId,
        driveId: route.driveId,
        arenaId: route.arenaId,
        loadout: route.loadout,
        seconds,
        stepSeconds,
      }),
    );
    if (rows.length >= maxRows) {
      return rows;
    }
  }

  for (const rival of namedRivals) {
    rows.push(
      simulateSoakRow({
        scenario: "rivalDuel",
        scenarioId: rival.id,
        frameId: balanceRivalDuelScenario.frameId,
        driveId: balanceRivalDuelScenario.driveId,
        arenaId: balanceRivalDuelScenario.arenaId,
        loadout: balanceRivalDuelScenario.loadout,
        rivalId: rival.id,
        seconds,
        stepSeconds,
      }),
    );
    if (rows.length >= maxRows) {
      return rows;
    }
  }

  return rows;
}

export function formatBalanceSoakCsv(rows: BalanceSoakRow[]): string {
  const header = "scenario,scenarioId,frameId,driveId,arenaId,rivalId,talentRouteId,seconds,elapsedSeconds,kills,routeClears,outcome,survived,drops,playerIntegrityRemaining";
  return [
    header,
    ...rows.map((row) =>
      [
        row.scenario,
        row.scenarioId,
        row.frameId,
        row.driveId,
        row.arenaId,
        row.rivalId ?? "",
        row.talentRouteId ?? "",
        row.seconds,
        row.elapsedSeconds,
        row.kills,
        row.routeClears,
        row.outcome,
        row.survived ? "true" : "false",
        row.drops,
        row.playerIntegrityRemaining,
      ].join(","),
    ),
  ].join("\n");
}

export function assertBalanceSoakThresholds(rows: BalanceSoakRow[]): void {
  if (rows.length === 0) {
    throw new Error("Balance soak produced no rows.");
  }
  const brokenRows = rows.filter(
    (row) =>
      !Number.isFinite(row.kills) ||
      !Number.isFinite(row.routeClears) ||
      !Number.isFinite(row.drops) ||
      !Number.isFinite(row.elapsedSeconds) ||
      !Number.isFinite(row.playerIntegrityRemaining) ||
      row.kills < 0 ||
      row.kills > 5000 ||
      row.routeClears < 0 ||
      row.drops < 0 ||
      row.elapsedSeconds < 0 ||
      row.elapsedSeconds > row.seconds + 1,
  );
  if (brokenRows.length > 0) {
    throw new Error(`Balance soak detected invalid output: ${brokenRows.map((row) => `${row.scenarioId}/${row.arenaId}`).join(", ")}`);
  }

  const talentRows = rows.filter((row) => row.scenario === "talentRoute");
  if (talentRows.length >= 3) {
    const sortedKills = talentRows.map((row) => row.kills).sort((left, right) => left - right);
    const medianKills = sortedKills[Math.floor(sortedKills.length / 2)] ?? 0;
    const maxKills = sortedKills[sortedKills.length - 1] ?? 0;
    if (maxKills > Math.max(40, medianKills * 6)) {
      throw new Error("Balance soak detected a dominant talent route.");
    }
  }

  const rivalRows = rows.filter((row) => row.scenario === "rivalDuel");
  if (rivalRows.length > 0) {
    const instantDefeatRows = rivalRows.filter((row) => row.outcome === "defeat" && row.elapsedSeconds <= 0.5);
    if (instantDefeatRows.length > 0) {
      throw new Error(`Balance soak detected instant rival defeats: ${instantDefeatRows.map((row) => row.rivalId ?? row.scenarioId).join(", ")}`);
    }
  }
}
