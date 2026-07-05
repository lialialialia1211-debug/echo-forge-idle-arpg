import { describe, expect, it } from "vitest";
import { balanceConfig } from "../data/balanceConfig";
import { namedRivals } from "../data/namedRivals";
import { createStarterEquipment } from "../data/topParts";
import { resolveOfflineElapsedSeconds, resolveOfflineSettlement } from "./offlineSettlement";
import type { TopLoadoutConfig } from "./topTypes";

function input(overrides: Partial<Parameters<typeof resolveOfflineSettlement>[0]> = {}): Parameters<typeof resolveOfflineSettlement>[0] {
  return {
    frameId: "frame_swift_razor",
    driveId: "drive_shard_barrage",
    arenaId: "arena_cinder_crucible",
    loadout: { equipment: createStarterEquipment() },
    elapsedSeconds: 3600,
    arenaTier: 1,
    seed: "offline_test",
    partQuantity: 0,
    partRarity: 0,
    ...overrides,
  };
}

describe("resolveOfflineSettlement", () => {
  it("is deterministic for identical input", () => {
    const first = resolveOfflineSettlement(input());
    const second = resolveOfflineSettlement(input());

    expect(second).toEqual(first);
  });

  it("caps long offline durations", () => {
    const result = resolveOfflineSettlement(input({ elapsedSeconds: balanceConfig.offline.capSeconds * 10 }));

    expect(result.effectiveSeconds).toBe(balanceConfig.offline.capSeconds);
    expect(result.cappedByTime).toBe(true);
  });

  it("returns no rewards for zero or negative time", () => {
    const result = resolveOfflineSettlement(input({ elapsedSeconds: -5 }));

    expect(result.kills).toBe(0);
    expect(result.parts).toEqual([]);
    expect(result.wallet).toEqual({ ash: 0, glass: 0, echo: 0 });
  });

  it("flags future settlement timestamps without granting elapsed time", () => {
    const now = Date.parse("2026-07-03T12:00:00.000Z");
    const result = resolveOfflineElapsedSeconds("2026-07-03T12:02:00.000Z", now);

    expect(result.futureClockSkew).toBe(true);
    expect(result.elapsedSeconds).toBe(0);
  });

  it("returns elapsed seconds for a normal past settlement timestamp", () => {
    const now = Date.parse("2026-07-03T12:00:00.000Z");
    const result = resolveOfflineElapsedSeconds("2026-07-03T11:42:30.000Z", now);

    expect(result.futureClockSkew).toBe(false);
    expect(result.elapsedSeconds).toBe(1050);
  });

  it("does not reduce kills for a stronger loadout", () => {
    const weak = resolveOfflineSettlement(input({ loadout: {} }));
    const strongLoadout: TopLoadoutConfig = {
      equipment: createStarterEquipment(),
      talentIds: ["talent_iron_rotation", "talent_razor_geometry", "talent_live_bearing"],
    };
    const strong = resolveOfflineSettlement(input({ loadout: strongLoadout }));

    expect(strong.kills).toBeGreaterThanOrEqual(weak.kills);
  });

  it("caps dropped parts and converts excess drops into wallet", () => {
    const result = resolveOfflineSettlement(
      input({
        elapsedSeconds: balanceConfig.offline.capSeconds,
        partQuantity: 5,
        partRarity: 1,
      }),
    );

    expect(result.parts.length).toBeLessThanOrEqual(balanceConfig.offline.dropCap);
    expect(result.wallet.ash + result.wallet.glass + result.wallet.echo).toBeGreaterThan(0);
  });

  it("scopes offline drop ids by settlement seed", () => {
    const first = resolveOfflineSettlement(
      input({
        elapsedSeconds: balanceConfig.offline.capSeconds,
        partQuantity: 5,
        partRarity: 1,
        seed: "offline_seed_a",
      }),
    );
    const second = resolveOfflineSettlement(
      input({
        elapsedSeconds: balanceConfig.offline.capSeconds,
        partQuantity: 5,
        partRarity: 1,
        seed: "offline_seed_b",
      }),
    );
    const secondPartIds = new Set(second.parts.map((part) => part.id));

    expect(first.parts.length).toBeGreaterThan(0);
    expect(second.parts.length).toBeGreaterThan(0);
    expect(first.parts.some((part) => secondPartIds.has(part.id))).toBe(false);
  });

  it("uses the circuit node arena as the offline target", () => {
    const result = resolveOfflineSettlement(
      input({
        arenaId: "arena_cinder_crucible",
        arenaTier: 1,
        circuitNodeId: "network_magnet_well",
      }),
    );

    expect(result.circuitNodeId).toBe("network_magnet_well");
    expect(result.targetArenaId).toBe("arena_red_chancel_disk");
    expect(result.targetArenaTier).toBe(3);
  });

  it("halves anomaly player-rule rewards during offline settlement", () => {
    const result = resolveOfflineSettlement(
      input({
        circuitNodeId: "network_magnet_well",
      }),
    );

    expect(result.anomalyId).toBe("anomaly_flux_monsoon");
    expect(result.anomalyRewardScalar).toBe(balanceConfig.offline.anomalyRuleRewardScalar);
  });

  it("does not create named rival unique drops for offline rival nodes", () => {
    const rivalUniqueBaseIds = new Set(namedRivals.flatMap((rival) => rival.uniqueDropBaseIds));
    const result = resolveOfflineSettlement(
      input({
        elapsedSeconds: balanceConfig.offline.capSeconds,
        circuitNodeId: "network_magnet_well",
        partQuantity: 5,
        partRarity: 100,
      }),
    );

    expect(result.rivalUniqueDropsBlocked).toBe(true);
    expect(result.parts.some((part) => rivalUniqueBaseIds.has(part.baseId))).toBe(false);
  });
});
