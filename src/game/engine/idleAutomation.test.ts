import { describe, expect, it } from "vitest";
import { createStarterEquipment, createStarterInventory } from "../data/topParts";
import type { AccountRuntimeState } from "./accountState";
import { defaultLootPolicy } from "./lootPolicy";
import { applyIdleAutomation } from "./idleAutomation";
import { generateTopPart } from "./topPartGeneration";

function createState(): AccountRuntimeState {
  return {
    frameId: "frame_swift_razor",
    driveId: "drive_shard_barrage",
    arenaId: "arena_cinder_crucible",
    equipment: createStarterEquipment(),
    inventory: createStarterInventory(),
    runeSlots: [null, null, null],
    talentIds: [],
    circuitAtlasNodeIds: [],
    doctrineId: null,
    wallet: { ash: 0, glass: 0, echo: 0 },
    arenaKeys: [],
    clearedBossGateIds: [],
    clearedRivalIds: [],
    routeClears: {},
    totalKills: 0,
    seenTutorialIds: [],
    lootPolicy: defaultLootPolicy,
  };
}

function part(id: string, rarity: "common" | "tuned" | "engraved" | "relic", baseId = "part_ring_serrated_halo") {
  return generateTopPart({
    id,
    baseId,
    rarity,
    itemLevel: 10,
    seed: id,
    arenaId: "arena_cinder_crucible",
    enemyLevel: 10,
    source: "debug",
  });
}

describe("idle automation", () => {
  it("auto-equips better drops through account reducer actions", () => {
    const drop = part("auto_equip_ring", "relic", "part_ring_glass_splinter");
    const result = applyIdleAutomation(createState(), [drop], {
      enabled: true,
      autoEquipBetter: true,
      salvageBelowRarity: "common",
    });

    expect(result.equippedPartIds).toEqual([drop.id]);
    expect(result.state.equipment.attackRing.id).toBe(drop.id);
  });

  it("salvages drops below the configured rarity floor", () => {
    const drop = part("auto_salvage_ring", "common");
    const result = applyIdleAutomation(createState(), [drop], {
      enabled: true,
      autoEquipBetter: false,
      salvageBelowRarity: "tuned",
    });

    expect(result.salvagedPartIds).toEqual([drop.id]);
    expect(result.state.inventory.some((part) => part.id === drop.id)).toBe(false);
    expect(result.state.wallet.ash).toBeGreaterThan(0);
  });
});
