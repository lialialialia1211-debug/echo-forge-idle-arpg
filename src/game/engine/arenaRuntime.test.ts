import { describe, expect, it } from "vitest";
import { createTopArenaRuntime, stepTopArenaRuntime } from "./arenaRuntime";

describe("top arena runtime", () => {
  it("spawns enemies automatically when the arena starts", () => {
    const runtime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      seed: "spawn_test",
    });

    const next = stepTopArenaRuntime(runtime, 0.25);

    expect(next.enemies).toHaveLength(1);
    expect(next.events.some((event) => event.text.includes("enters wave 1"))).toBe(true);
  });

  it("uses drive visuals for automatic skill effects", () => {
    const stormRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_storm_needle",
      driveId: "drive_storm_lattice",
      seed: "storm_test",
    });
    const emberRuntime = createTopArenaRuntime({
      arenaId: "arena_cinder_crucible",
      frameId: "frame_ember_crucible",
      driveId: "drive_ember_scour",
      seed: "ember_test",
    });

    const stormNext = stepTopArenaRuntime(stormRuntime, 0.25);
    const emberNext = stepTopArenaRuntime(emberRuntime, 0.25);

    expect(stormNext.effects.some((effect) => effect.kind === "stormArc")).toBe(true);
    expect(emberNext.effects.some((effect) => effect.kind === "emberTrail")).toBe(true);
    expect(stormNext.events.some((event) => event.tone === "skill")).toBe(true);
    expect(emberNext.events.some((event) => event.tone === "skill")).toBe(true);
  });
});
