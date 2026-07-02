import { describe, expect, it } from "vitest";
import { assertBalanceSoakThresholds, formatBalanceSoakCsv, runBalanceSoak } from "./balanceSoak";

describe("balance soak harness", () => {
  it("runs a headless soak report and emits CSV", () => {
    const rows = runBalanceSoak({ seconds: 12, stepSeconds: 0.1, maxRows: 3 });
    const csv = formatBalanceSoakCsv(rows);

    expect(rows).toHaveLength(3);
    expect(csv.split("\n")[0]).toBe("frameId,arenaId,seconds,kills,routeClears,outcome,survived,drops");
    expect(csv).toContain("frame_");
    expect(() => assertBalanceSoakThresholds(rows)).not.toThrow();
  });

  it("fails threshold checks for overflow kill output", () => {
    expect(() =>
      assertBalanceSoakThresholds([
        {
          frameId: "frame_swift_razor",
          arenaId: "arena_cinder_crucible",
          seconds: 60,
          kills: 999999,
          routeClears: 0,
          outcome: "ongoing",
          survived: true,
          drops: 0,
        },
      ]),
    ).toThrow("invalid kill output");
  });
});
