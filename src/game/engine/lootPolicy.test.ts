import { describe, expect, it } from "vitest";
import { createStarterEquipment } from "../data/topParts";
import { resolveTopRuntimeStats } from "./topAssembly";
import { applyLootPolicyPreset, defaultLootPolicy, decideLootPolicy, evaluateLootPolicy, loadoutWithPart, lootPolicyPresets, selectPartVerdict } from "./lootPolicy";
import { generateTopPart } from "./topPartGeneration";

function part(id: string, rarity: "common" | "tuned" | "engraved" | "relic" = "common", baseId = "part_tip_needle") {
  return generateTopPart({
    id,
    baseId,
    rarity,
    itemLevel: 1,
    seed: id,
    arenaId: "policy_test",
    enemyLevel: 1,
    source: "debug",
  });
}

describe("loot policy", () => {
  it("keeps protected parts before applying auto salvage rules", () => {
    const equipment = createStarterEquipment();
    const loadout = { equipment };
    const currentStats = resolveTopRuntimeStats("frame_swift_razor", "drive_shard_barrage", loadout);
    const locked = { ...part("locked"), locked: true };
    const engraved = part("engraved", "engraved");
    const lockedVerdict = selectPartVerdict(locked, currentStats, resolveTopRuntimeStats("frame_swift_razor", "drive_shard_barrage", loadoutWithPart(loadout, locked)), false);
    const engravedVerdict = selectPartVerdict(engraved, currentStats, resolveTopRuntimeStats("frame_swift_razor", "drive_shard_barrage", loadoutWithPart(loadout, engraved)), false);

    expect(decideLootPolicy(locked, lockedVerdict, { ...defaultLootPolicy, autoSalvage: true }).reason).toBe("locked");
    expect(decideLootPolicy(engraved, engravedVerdict, { ...defaultLootPolicy, autoSalvage: true }).reason).toBe("protectedRarity");
  });

  it("salvages low rarity junk only when auto salvage is enabled", () => {
    const equipment = createStarterEquipment();
    const junk = part("junk", "common", "part_launcher_redline");
    const loadout = { equipment };

    const disabled = evaluateLootPolicy({
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      loadout,
      policy: defaultLootPolicy,
      parts: [junk],
    });
    const enabled = evaluateLootPolicy({
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      loadout,
      policy: { ...defaultLootPolicy, autoSalvage: true, minRarity: "tuned" },
      parts: [junk],
    });

    expect(disabled.keptParts.map((entry) => entry.id)).toEqual(["junk"]);
    expect(disabled.salvagedParts).toEqual([]);
    expect(enabled.keptParts).toEqual([]);
    expect(enabled.salvagedParts.map((entry) => entry.id)).toEqual(["junk"]);
    expect(enabled.wallet.ash).toBeGreaterThan(0);
    expect(enabled.decisions.get("junk")?.reason).toBe("rarity");
  });

  it("uses target tags and score thresholds after rarity and slot rules pass", () => {
    const equipment = createStarterEquipment();
    const physical = part("physical", "tuned", "part_disk_deep_bearing");
    const lightning = part("lightning", "tuned", "part_launcher_coil");
    const loadout = { equipment };
    const result = evaluateLootPolicy({
      frameId: "frame_swift_razor",
      driveId: "drive_shard_barrage",
      loadout,
      policy: {
        ...defaultLootPolicy,
        autoSalvage: true,
        minRarity: "common",
        targetTags: ["lightning"],
        minScore: -500,
      },
      parts: [physical, lightning],
    });

    expect(result.decisions.get("physical")?.reason).toBe("tag");
    expect(result.decisions.get("lightning")?.action).toBe("keep");
  });

  it("applies named presets as independent policy copies", () => {
    const mapper = applyLootPolicyPreset("mapper");
    const secondMapper = applyLootPolicyPreset("mapper");

    expect(lootPolicyPresets.map((preset) => preset.id)).toEqual(["manual", "balanced", "mapper", "strict"]);
    expect(mapper.autoSalvage).toBe(true);
    expect(mapper.minRarity).toBe("tuned");
    expect(mapper.minScore).toBe(0);
    expect(secondMapper.targetSlots).toEqual(mapper.targetSlots);
    expect(secondMapper.targetSlots).not.toBe(mapper.targetSlots);
    expect(applyLootPolicyPreset("manual")).toEqual(defaultLootPolicy);
  });
});
