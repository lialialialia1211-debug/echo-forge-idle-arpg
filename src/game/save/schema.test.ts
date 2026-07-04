import { describe, expect, it } from "vitest";
import { accountSaveSchema, createNewAccountSave } from "./schema";
import { migrateUnknownSave } from "./migrations";
import { generateArenaKey } from "../engine/arenaKeys";
import { defaultLootPolicy } from "../engine/lootPolicy";

describe("save schema", () => {
  it("creates a server-compatible local account shell", () => {
    const save = createNewAccountSave("ironbound");
    const parsed = accountSaveSchema.parse(save);

    expect(parsed.schemaVersion).toBe(8);
    expect(parsed.accountId).toBeNull();
    expect(parsed.roster[0].classId).toBe("ironbound");
    expect(parsed.roster[0].build.supportIds.length).toBeGreaterThan(0);
    expect(parsed.top.equipment.core?.slot).toBe("core");
    expect(parsed.top.inventory.length).toBeGreaterThan(0);
    expect(parsed.top.circuitAtlasNodeIds).toEqual([]);
    expect(parsed.top.doctrineId).toBeNull();
    expect(parsed.top.clearedRivalIds).toEqual([]);
    expect(parsed.top.totalKills).toBe(0);
    expect(parsed.top.seenTutorialIds).toEqual([]);
    expect(parsed.top.lootPolicy).toEqual(defaultLootPolicy);
    expect(parsed.top.endgameMasterNodeIds).toEqual({});
    expect(parsed.top.wallet.ash).toBeGreaterThanOrEqual(12);
    expect(parsed.top.wallet.glass).toBeGreaterThanOrEqual(2);
  });

  it("migrates legacy v1 saves into top arena state", () => {
    const now = new Date(0).toISOString();
    const migrated = migrateUnknownSave({
      schemaVersion: 1,
      accountId: null,
      settings: {
        reduceMotion: false,
        compactNumbers: false,
      },
      roster: [
        {
          id: "legacy_character",
          name: "Legacy",
          classId: "veilrunner",
          level: 1,
          xp: 0,
          selectedAreaId: "area_cinder_road",
          build: {
            skillId: "skill_shard_volley",
            supportIds: ["support_fast_cast"],
          },
          lastSettledAt: now,
        },
      ],
      sharedStash: {
        itemIds: [],
      },
      currencies: {
        ash: 3,
        glass: 1,
        echo: 0,
      },
      achievements: {},
      lastSavedAt: now,
    });

    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.top.selectedFrameId).toBe("frame_swift_razor");
    expect(migrated.top.wallet.ash).toBe(3);
    expect(migrated.top.circuitAtlasNodeIds).toEqual([]);
    expect(migrated.top.doctrineId).toBeNull();
    expect(migrated.top.totalKills).toBe(0);
    expect(migrated.top.seenTutorialIds).toEqual([]);
    expect(migrated.top.lootPolicy).toEqual(defaultLootPolicy);
    expect(migrated.top.endgameMasterNodeIds).toEqual({});
  });

  it("migrates structurally valid v2 saves without totalKills", () => {
    const save = createNewAccountSave("veilrunner");
    const topWithoutTotalKills: Partial<typeof save.top> = { ...save.top };
    delete topWithoutTotalKills.totalKills;

    const migrated = migrateUnknownSave({
      ...save,
      schemaVersion: 2,
      top: {
        ...topWithoutTotalKills,
        talentIds: ["talent_iron_rotation"],
      },
    });

    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.top.totalKills).toBe(0);
    expect(migrated.top.talentIds).toEqual(["talent_iron_rotation"]);
    expect(migrated.top.doctrineId).toBeNull();
    expect(migrated.top.seenTutorialIds).toEqual([]);
    expect(migrated.top.lootPolicy).toEqual(defaultLootPolicy);
    expect(migrated.top.endgameMasterNodeIds).toEqual({});
  });

  it("migrates v3 saves to v8 with doctrine, rival, tutorial, loot policy, and endgame defaults", () => {
    const save = createNewAccountSave("veilrunner");
    const migrated = migrateUnknownSave({
      ...save,
      schemaVersion: 3,
      top: {
        ...save.top,
        doctrineId: undefined,
        totalKills: 44,
      },
    });

    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.top.totalKills).toBe(44);
    expect(migrated.top.doctrineId).toBeNull();
    expect(migrated.top.clearedRivalIds).toEqual([]);
    expect(migrated.top.seenTutorialIds).toEqual([]);
    expect(migrated.top.lootPolicy).toEqual(defaultLootPolicy);
    expect(migrated.top.endgameMasterNodeIds).toEqual({});
  });

  it("migrates v4 saves to v8 with cleared rival, tutorial, loot policy, and endgame defaults", () => {
    const save = createNewAccountSave("veilrunner");
    const topWithoutClearedRivals: Partial<typeof save.top> = { ...save.top };
    delete topWithoutClearedRivals.clearedRivalIds;

    const migrated = migrateUnknownSave({
      ...save,
      schemaVersion: 4,
      top: {
        ...topWithoutClearedRivals,
        totalKills: 137,
        doctrineId: "doctrine_swift_razor_edge",
      },
    });

    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.top.totalKills).toBe(137);
    expect(migrated.top.doctrineId).toBe("doctrine_swift_razor_edge");
    expect(migrated.top.clearedRivalIds).toEqual([]);
    expect(migrated.top.seenTutorialIds).toEqual([]);
    expect(migrated.top.lootPolicy).toEqual(defaultLootPolicy);
    expect(migrated.top.endgameMasterNodeIds).toEqual({});
  });

  it("migrates v5 saves and sanitizes tutorial ids during round trips", () => {
    const save = createNewAccountSave("veilrunner");
    const migrated = migrateUnknownSave({
      ...save,
      schemaVersion: 5,
      top: {
        ...save.top,
        totalKills: 137,
        doctrineId: "doctrine_swift_razor_edge",
        clearedRivalIds: ["rival_sable_reflector"],
        seenTutorialIds: ["tut_welcome", "tut_welcome", "missing_tutorial", "tut_first_drop"],
      },
    });

    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.top.totalKills).toBe(137);
    expect(migrated.top.doctrineId).toBe("doctrine_swift_razor_edge");
    expect(migrated.top.clearedRivalIds).toEqual(["rival_sable_reflector"]);
    expect(migrated.top.seenTutorialIds).toEqual(["tut_welcome", "tut_first_drop"]);
    expect(migrated.top.lootPolicy).toEqual(defaultLootPolicy);
    expect(migrated.top.endgameMasterNodeIds).toEqual({});
  });

  it("migrates v6 saves to v8 and sanitizes loot policy", () => {
    const save = createNewAccountSave("veilrunner");
    const migrated = migrateUnknownSave({
      ...save,
      schemaVersion: 6,
      top: {
        ...save.top,
        lootPolicy: {
          autoSalvage: true,
          minRarity: "missing",
          targetSlots: ["core", "missing", "core"],
          targetTags: ["fire", "missing", "fire"],
          minItemLevel: -4,
          minScore: 9999,
        },
      },
    });

    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.top.lootPolicy).toEqual({
      ...defaultLootPolicy,
      autoSalvage: true,
      targetSlots: ["core"],
      targetTags: ["fire"],
      minItemLevel: 1,
      minScore: 500,
    });
    expect(migrated.top.endgameMasterNodeIds).toEqual({});
  });

  it("migrates v7 saves to v8 and sanitizes endgame master allocations", () => {
    const save = createNewAccountSave("veilrunner");
    const migrated = migrateUnknownSave({
      ...save,
      schemaVersion: 7,
      top: {
        ...save.top,
        endgameMasterNodeIds: {
          master_mapwright: [
            "master_mapwright_cache_route",
            "master_mapwright_route_survey",
            "master_mapwright_blank_keys",
            "master_mapwright_basin_ledger",
            "master_mapwright_key_recycling",
            "master_mapwright_signal_chart",
            "master_forgesmith_scrap_tithe",
            "missing_node",
          ],
          missing_master: ["master_mapwright_route_survey"],
        },
      },
    });

    expect(migrated.schemaVersion).toBe(8);
    expect(migrated.top.endgameMasterNodeIds).toEqual({
      master_mapwright: [
        "master_mapwright_route_survey",
        "master_mapwright_blank_keys",
        "master_mapwright_basin_ledger",
        "master_mapwright_cache_route",
      ],
    });
  });

  it("sanitizes structurally valid v3 saves with stale top data IDs", () => {
    const save = createNewAccountSave("veilrunner");
    const staleArenaKey = generateArenaKey({
      arenaBaseId: "arena_cinder_crucible",
      tier: 1,
      rarity: "tuned",
      seed: "stale_key",
    });

    const migrated = migrateUnknownSave({
      ...save,
      currencies: {
        ash: -10,
      },
      top: {
        ...save.top,
        selectedFrameId: "missing_frame",
        selectedDriveId: "missing_drive",
        selectedArenaId: "missing_arena",
        runeIds: ["missing_rune"],
        talentIds: ["missing_talent"],
        circuitAtlasNodeIds: ["missing_atlas", "atlas_breach_calibrator"],
        doctrineId: "doctrine_ember_rail_monk",
        wallet: {
          ash: -3,
          glass: 1.8,
          echo: 0,
        },
        equipment: {
          ...save.top.equipment,
          core: {
            ...save.top.equipment.core,
            baseId: "missing_part_base",
          },
        },
        inventory: [
          {
            ...save.top.inventory[0],
            baseId: "missing_part_base",
          },
        ],
        arenaKeys: [
          {
            ...staleArenaKey,
            arenaBaseId: "missing_arena",
          },
        ],
        clearedBossGateIds: ["missing_boss_gate"],
        clearedRivalIds: ["missing_rival", "rival_sable_reflector"],
        routeClears: {
          missing_arena: 5,
          arena_cinder_crucible: -1,
        },
        totalKills: -9,
        endgameMasterNodeIds: {
          master_mapwright: ["missing_node", "master_mapwright_route_survey", "master_forgesmith_scrap_tithe"],
        },
      },
    });

    expect(migrated.top.selectedFrameId).toBe("frame_swift_razor");
    expect(migrated.top.selectedDriveId).toBe("drive_shard_barrage");
    expect(migrated.top.selectedArenaId).toBe("arena_cinder_crucible");
    expect(migrated.top.runeIds).toEqual([]);
    expect(migrated.top.talentIds).toEqual([]);
    expect(migrated.top.circuitAtlasNodeIds).toEqual(["atlas_breach_calibrator"]);
    expect(migrated.top.doctrineId).toBeNull();
    expect(migrated.top.equipment.core?.baseId).toBe("part_core_black_iron_wound");
    expect(migrated.top.inventory.length).toBeGreaterThan(0);
    expect(migrated.top.arenaKeys).toEqual([]);
    expect(migrated.top.clearedBossGateIds).toEqual([]);
    expect(migrated.top.clearedRivalIds).toEqual(["rival_sable_reflector"]);
    expect(migrated.top.routeClears).toEqual({ arena_cinder_crucible: 0 });
    expect(migrated.top.totalKills).toBe(0);
    expect(migrated.top.seenTutorialIds).toEqual([]);
    expect(migrated.top.lootPolicy).toEqual(defaultLootPolicy);
    expect(migrated.top.endgameMasterNodeIds).toEqual({ master_mapwright: ["master_mapwright_route_survey"] });
    expect(migrated.top.wallet.ash).toBe(0);
    expect(migrated.top.wallet.glass).toBe(1);
    expect(migrated.currencies.ash).toBe(0);
  });
});
