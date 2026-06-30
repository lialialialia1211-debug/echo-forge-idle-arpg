import { describe, expect, it } from "vitest";
import { createEncounter, damageEncounter, getEncounterRank, getRouteProgress, getRouteStep } from "./encounter";

describe("encounter engine", () => {
  it("creates deterministic encounters from area, seed, and wave", () => {
    const first = createEncounter("area_cinder_road", "seed", 4);
    const second = createEncounter("area_cinder_road", "seed", 4);

    expect(first).toEqual(second);
    expect(first.rank).toBe("elite");
    expect(first.maxLife).toBeGreaterThan(720);
  });

  it("marks every eighth wave as a boss", () => {
    expect(getEncounterRank(1)).toBe("pack");
    expect(getEncounterRank(4)).toBe("elite");
    expect(getEncounterRank(8)).toBe("boss");
  });

  it("applies damage and reports kills", () => {
    const encounter = createEncounter("area_cinder_road", "damage", 1);
    const result = damageEncounter(encounter, encounter.maxLife + 10);

    expect(result.killed).toBe(true);
    expect(result.encounter.life).toBe(0);
    expect(result.overkill).toBe(10);
  });

  it("tracks route steps across loops", () => {
    expect(getRouteStep(1)).toBe(1);
    expect(getRouteStep(8)).toBe(8);
    expect(getRouteStep(9)).toBe(1);
    expect(getRouteProgress(5)).toBe(50);
  });
});
