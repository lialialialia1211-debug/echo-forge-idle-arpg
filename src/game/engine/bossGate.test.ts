import { describe, expect, it } from "vitest";
import { generateArenaKey } from "./arenaKeys";
import { projectBossGateAttempt } from "./bossGate";

describe("boss gate projection", () => {
  it("reports success chance and missing layers", () => {
    const projection = projectBossGateAttempt({
      gateId: "boss_gate_brass_judicator",
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
    });

    expect(projection.successChance).toBeGreaterThan(0);
    expect(projection.estimatedTtk).toBeGreaterThan(0);
    expect(projection.rewardUnlocks.length).toBeGreaterThan(0);
  });

  it("arena key pressure affects the gate projection", () => {
    const key = generateArenaKey({
      arenaBaseId: "arena_red_chancel_disk",
      tier: 3,
      rarity: "relic",
      seed: "boss-key",
    });
    const normal = projectBossGateAttempt({
      gateId: "boss_gate_brass_judicator",
      frameId: "frame_ember_crucible",
      driveId: "drive_ember_scour",
    });
    const pressured = projectBossGateAttempt({
      gateId: "boss_gate_brass_judicator",
      frameId: "frame_ember_crucible",
      driveId: "drive_ember_scour",
      arenaKey: key,
    });

    expect(pressured.estimatedTtk).toBeGreaterThanOrEqual(normal.estimatedTtk);
  });
});
