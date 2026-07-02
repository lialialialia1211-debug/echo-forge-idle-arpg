import { describe, expect, it } from "vitest";
import { balanceConfig } from "../data/balanceConfig";
import { createStarterEquipment } from "../data/topParts";
import { resolveOfflineSettlement } from "./offlineSettlement";
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
});
