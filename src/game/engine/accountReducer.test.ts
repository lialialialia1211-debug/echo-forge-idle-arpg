import { describe, expect, it } from "vitest";
import { generateArenaKey } from "./arenaKeys";
import { accountReducer, availableAtlasPoints, availableTalentPoints, inventoryCapacity } from "./accountReducer";
import type { AccountRuntimeState } from "./accountState";
import { createStarterEquipment, createStarterInventory } from "../data/topParts";
import { generateTopPart } from "./topPartGeneration";

function createState(overrides: Partial<AccountRuntimeState> = {}): AccountRuntimeState {
  const equipment = createStarterEquipment();
  return {
    frameId: "frame_swift_razor",
    driveId: "drive_shard_barrage",
    arenaId: "arena_cinder_crucible",
    equipment,
    inventory: createStarterInventory(),
    runeSlots: [null, null, null],
    talentIds: [],
    circuitAtlasNodeIds: [],
    doctrineId: null,
    wallet: { ash: 100, glass: 100, echo: 10 },
    arenaKeys: [],
    clearedBossGateIds: [],
    routeClears: {},
    totalKills: 0,
    ...overrides,
  };
}

function part(id: string, baseId = "part_tip_needle") {
  return generateTopPart({
    id,
    baseId,
    rarity: "common",
    itemLevel: 1,
    seed: id,
    arenaId: "test",
    enemyLevel: 1,
    source: "debug",
  });
}

describe("accountReducer", () => {
  it("selects a frame with its starter drive and clears incompatible runes and doctrine", () => {
    const state = createState({
      frameId: "frame_ember_crucible",
      driveId: "drive_ember_scour",
      runeSlots: ["rune_red_heat", "rune_slow_burn", null],
      doctrineId: "doctrine_ember_rail_monk",
    });

    const next = accountReducer(state, { type: "selectFrame", frameId: "frame_storm_needle" });

    expect(next.frameId).toBe("frame_storm_needle");
    expect(next.driveId).toBe("drive_storm_lattice");
    expect(next.runeSlots).toEqual([null, null, null]);
    expect(next.doctrineId).toBeNull();
  });

  it("selects a drive and keeps only compatible rune sockets", () => {
    const state = createState({
      driveId: "drive_shard_barrage",
      runeSlots: ["rune_splintered_edge", "rune_red_heat", null],
    });

    const next = accountReducer(state, { type: "selectDrive", driveId: "drive_ember_scour" });

    expect(next.driveId).toBe("drive_ember_scour");
    expect(next.runeSlots).toEqual([null, "rune_red_heat", null]);
  });

  it("selects arenas and marks boss gates idempotently", () => {
    const state = createState();
    const arenaSelected = accountReducer(state, { type: "selectArena", arenaId: "arena_red_chancel_disk" });
    const cleared = accountReducer(arenaSelected, { type: "markBossGateCleared", gateId: "boss_gate_brass_judicator" });
    const repeated = accountReducer(cleared, { type: "markBossGateCleared", gateId: "boss_gate_brass_judicator" });

    expect(arenaSelected.arenaId).toBe("arena_red_chancel_disk");
    expect(cleared.clearedBossGateIds).toEqual(["boss_gate_brass_judicator"]);
    expect(repeated.clearedBossGateIds).toEqual(["boss_gate_brass_judicator"]);
  });

  it("equips a part and returns the replaced part to inventory", () => {
    const nextTip = part("new_tip");
    const state = createState({ inventory: [nextTip] });
    const previousTip = state.equipment.tip;
    const next = accountReducer(state, { type: "equipPart", part: nextTip });

    expect(next.equipment.tip.id).toBe("new_tip");
    expect(next.inventory.some((item) => item.id === "new_tip")).toBe(false);
    expect(next.inventory[0].id).toBe(previousTip.id);
  });

  it("does not salvage locked parts and pays for unlocked parts", () => {
    const locked = { ...part("locked_tip"), locked: true };
    const loose = part("loose_tip");
    const state = createState({ inventory: [locked, loose], wallet: { ash: 0, glass: 0, echo: 0 } });

    const afterLocked = accountReducer(state, { type: "salvagePart", partId: locked.id });
    const afterLoose = accountReducer(afterLocked, { type: "salvagePart", partId: loose.id });

    expect(afterLocked.inventory).toHaveLength(2);
    expect(afterLoose.inventory.map((item) => item.id)).toEqual([locked.id]);
    expect(afterLoose.wallet.ash).toBe(2);
  });

  it("assigns compatible runes without duplicates and clamps socket indexes", () => {
    const state = createState();
    const first = accountReducer(state, { type: "assignRune", runeId: "rune_splintered_edge", socketIndex: 9 });
    const second = accountReducer(first, { type: "assignRune", runeId: "rune_splintered_edge", socketIndex: 0 });
    const incompatible = accountReducer(second, { type: "assignRune", runeId: "rune_red_heat", socketIndex: 1 });

    expect(first.runeSlots).toEqual([null, null, "rune_splintered_edge"]);
    expect(second.runeSlots).toEqual(["rune_splintered_edge", null, null]);
    expect(incompatible.runeSlots).toEqual(second.runeSlots);
  });

  it("enforces talent prerequisites and point limits", () => {
    const state = createState();
    const blocked = accountReducer(state, { type: "allocateTalent", talentId: "talent_razor_geometry" });
    const root = accountReducer(blocked, { type: "allocateTalent", talentId: "talent_iron_rotation" });
    const child = accountReducer(root, { type: "allocateTalent", talentId: "talent_razor_geometry" });

    expect(blocked.talentIds).toEqual([]);
    expect(child.talentIds).toEqual(["talent_iron_rotation", "talent_razor_geometry"]);
    expect(availableTalentPoints(child)).toBe(1);
  });

  it("enforces atlas prerequisites and route-derived point budget", () => {
    const state = createState();
    const root = accountReducer(state, { type: "allocateAtlasNode", nodeId: "atlas_breach_calibrator" });
    const child = accountReducer(root, { type: "allocateAtlasNode", nodeId: "atlas_dense_rail" });
    const tooExpensive = accountReducer(child, { type: "allocateAtlasNode", nodeId: "atlas_glass_lure" });

    expect(child.circuitAtlasNodeIds).toEqual(["atlas_breach_calibrator", "atlas_dense_rail"]);
    expect(tooExpensive.circuitAtlasNodeIds).toEqual(child.circuitAtlasNodeIds);
    expect(availableAtlasPoints(child)).toBe(0);
  });

  it("selects only doctrines that match the active frame", () => {
    const state = createState();
    const selected = accountReducer(state, { type: "selectDoctrine", doctrineId: "doctrine_swift_razor_edge" });
    const rejected = accountReducer(selected, { type: "selectDoctrine", doctrineId: "doctrine_ember_rail_monk" });
    const cleared = accountReducer(selected, { type: "selectDoctrine", doctrineId: null });

    expect(selected.doctrineId).toBe("doctrine_swift_razor_edge");
    expect(rejected.doctrineId).toBe("doctrine_swift_razor_edge");
    expect(cleared.doctrineId).toBeNull();
  });

  it("ingests drops and salvages overflow deterministically", () => {
    const current = Array.from({ length: inventoryCapacity }, (_, index) => part(`current_${index}`));
    const incoming = [part("incoming_a"), part("incoming_b")];
    const state = createState({ inventory: current, wallet: { ash: 0, glass: 0, echo: 0 } });
    const next = accountReducer(state, { type: "ingestDrops", parts: incoming, capacity: inventoryCapacity });

    expect(next.inventory).toHaveLength(inventoryCapacity);
    expect(next.inventory.slice(0, 2).map((item) => item.id)).toEqual(["incoming_a", "incoming_b"]);
    expect(next.wallet.ash).toBe(4);
  });

  it("applies craft results, route clears, keys, and kills in one consistent chain", () => {
    const source = part("craft_source");
    const crafted = { ...source, id: "crafted_source", displayName: "Crafted Source" };
    const key = generateArenaKey({ arenaBaseId: "arena_cinder_crucible", tier: 1, seed: "chain_key", rarity: "tuned" });
    const state = createState({ inventory: [source], wallet: { ash: 10, glass: 10, echo: 1 } });
    const craftedState = accountReducer(state, { type: "applyCraft", sourcePartId: source.id, result: { part: crafted, spent: { ash: 3, glass: 2, echo: 0 } } });
    const keyed = accountReducer(craftedState, { type: "forgeArenaKey", key, cost: { ash: 6, glass: 1, echo: 0 } });
    const cleared = accountReducer(keyed, { type: "addRouteClear", arenaId: "arena_cinder_crucible", keys: [key] });
    const killed = accountReducer(cleared, { type: "addKills", amount: 12 });

    expect(killed.inventory[0].id).toBe("crafted_source");
    expect(killed.wallet).toEqual({ ash: 1, glass: 7, echo: 1 });
    expect(killed.arenaKeys).toHaveLength(2);
    expect(killed.routeClears.arena_cinder_crucible).toBe(1);
    expect(killed.totalKills).toBe(12);
  });
});
