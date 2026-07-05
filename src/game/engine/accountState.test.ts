import { describe, expect, it } from "vitest";
import { createStarterEquipment } from "../data/topParts";
import { defaultLootPolicy } from "./lootPolicy";
import { accountStateToSaveTop, saveTopToAccountState, type AccountRuntimeState, type SaveTopLike } from "./accountState";
import { generateTopPart } from "./topPartGeneration";

function part(id: string) {
  return generateTopPart({
    id,
    baseId: "part_tip_needle",
    rarity: "common",
    itemLevel: 1,
    seed: id,
    arenaId: "test",
    enemyLevel: 1,
    source: "debug",
  });
}

function saveTop(overrides: Partial<SaveTopLike> = {}): SaveTopLike {
  return {
    selectedFrameId: "frame_swift_razor",
    selectedDriveId: "drive_shard_barrage",
    selectedArenaId: "arena_cinder_crucible",
    equipment: createStarterEquipment(),
    inventory: [],
    runeIds: [],
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
    endgameMasterNodeIds: {},
    lastSettledAt: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("accountState", () => {
  it("deduplicates invalid inventory part ids when loading and saving", () => {
    const duplicate = part("duplicate_part");
    const loaded = saveTopToAccountState(saveTop({ inventory: [duplicate, { ...duplicate, itemLevel: 3 }] }), createStarterEquipment());

    expect(loaded.inventory.map((item) => item.id)).toEqual(["duplicate_part"]);

    const saved = accountStateToSaveTop(
      {
        ...loaded,
        inventory: [duplicate, { ...duplicate, itemLevel: 3 }],
      } satisfies AccountRuntimeState,
      "2026-07-05T00:01:00.000Z",
    );

    expect(saved.inventory.map((item) => item.id)).toEqual(["duplicate_part"]);
  });
});
