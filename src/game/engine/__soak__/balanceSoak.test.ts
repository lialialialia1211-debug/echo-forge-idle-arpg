import { describe, expect, it } from "vitest";
import { namedRivals } from "../../data/namedRivals";
import { assertBalanceSoakThresholds, balanceTalentRouteScenarios, formatBalanceSoakCsv, runBalanceSoak } from "./balanceSoak";

describe("balance soak harness", () => {
  it("runs a headless soak report and emits CSV", () => {
    const rows = runBalanceSoak({ seconds: 12, stepSeconds: 0.1, maxRows: 3 });
    const csv = formatBalanceSoakCsv(rows);

    expect(rows).toHaveLength(3);
    expect(csv.split("\n")[0]).toBe("scenario,scenarioId,frameId,driveId,arenaId,rivalId,talentRouteId,seconds,elapsedSeconds,kills,routeClears,outcome,survived,drops,playerIntegrityRemaining");
    expect(rows.every((row) => row.scenario === "arena")).toBe(true);
    expect(csv).toContain("frame_");
    expect(() => assertBalanceSoakThresholds(rows)).not.toThrow();
  });

  it("covers talent routes and named rival duels", () => {
    const rows = runBalanceSoak({ seconds: 18, stepSeconds: 0.1 });

    expect(new Set(rows.filter((row) => row.scenario === "talentRoute").map((row) => row.talentRouteId))).toEqual(new Set(balanceTalentRouteScenarios.map((route) => route.id)));
    expect(new Set(rows.filter((row) => row.scenario === "rivalDuel").map((row) => row.rivalId))).toEqual(new Set(namedRivals.map((rival) => rival.id)));
    expect(rows.filter((row) => row.scenario === "rivalDuel")).toHaveLength(namedRivals.length);
    expect(() => assertBalanceSoakThresholds(rows)).not.toThrow();
  });

  it("fails threshold checks for overflow kill output", () => {
    expect(() =>
      assertBalanceSoakThresholds([
        {
          scenario: "arena",
          scenarioId: "overflow",
          frameId: "frame_swift_razor",
          driveId: "drive_shard_barrage",
          arenaId: "arena_cinder_crucible",
          seconds: 60,
          elapsedSeconds: 60,
          kills: 999999,
          routeClears: 0,
          outcome: "ongoing",
          survived: true,
          drops: 0,
          playerIntegrityRemaining: 100,
        },
      ]),
    ).toThrow("invalid output");
  });
});
