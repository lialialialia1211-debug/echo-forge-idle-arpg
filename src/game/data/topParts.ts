import type { ArenaDrop, TopPartInstance, TopPartSlotId } from "../engine/topTypes";
import {
  createPartFromArenaDrop as createPartFromArenaDropEngine,
  generateTopPart,
} from "../engine/topPartGeneration";
import {
  getTopPartBaseDef,
  partSlotLabels,
  partSlotOrder,
  topPartBases,
} from "./topPartBases";

export { getTopPartBaseDef, partSlotLabels, partSlotOrder, topPartBases };

export function createStarterEquipment(): Record<TopPartSlotId, TopPartInstance> {
  return {
    core: generateTopPart({
      id: "starter_core",
      baseId: "part_core_black_iron_wound",
      rarity: "common",
      itemLevel: 1,
      seed: "starter_core",
      source: "starter",
      arenaId: "starter",
      enemyLevel: 1,
    }),
    attackRing: generateTopPart({
      id: "starter_attack_ring",
      baseId: "part_ring_serrated_halo",
      rarity: "common",
      itemLevel: 1,
      seed: "starter_attack_ring",
      source: "starter",
      arenaId: "starter",
      enemyLevel: 1,
    }),
    weightDisk: generateTopPart({
      id: "starter_weight_disk",
      baseId: "part_disk_deep_bearing",
      rarity: "common",
      itemLevel: 1,
      seed: "starter_weight_disk",
      source: "starter",
      arenaId: "starter",
      enemyLevel: 1,
    }),
    tip: generateTopPart({
      id: "starter_tip",
      baseId: "part_tip_needle",
      rarity: "common",
      itemLevel: 1,
      seed: "starter_tip",
      source: "starter",
      arenaId: "starter",
      enemyLevel: 1,
    }),
    launcher: generateTopPart({
      id: "starter_launcher",
      baseId: "part_launcher_redline",
      rarity: "common",
      itemLevel: 1,
      seed: "starter_launcher",
      source: "starter",
      arenaId: "starter",
      enemyLevel: 1,
    }),
    seal: generateTopPart({
      id: "starter_seal",
      baseId: "part_seal_storm",
      rarity: "common",
      itemLevel: 1,
      seed: "starter_seal",
      source: "starter",
      arenaId: "starter",
      enemyLevel: 1,
    }),
    circuitChip: generateTopPart({
      id: "starter_circuit_chip",
      baseId: "part_chip_etched_route",
      rarity: "common",
      itemLevel: 1,
      seed: "starter_circuit_chip",
      source: "starter",
      arenaId: "starter",
      enemyLevel: 1,
    }),
  };
}

export function createStarterInventory(): TopPartInstance[] {
  return [
    generateTopPart({
      id: "starter_bag_ember_core",
      baseId: "part_core_ashwrought_heart",
      rarity: "tuned",
      itemLevel: 2,
      seed: "starter_bag_ember_core",
      source: "starter",
      arenaId: "starter",
      enemyLevel: 1,
    }),
    generateTopPart({
      id: "starter_bag_arc_ring",
      baseId: "part_ring_arc_teeth",
      rarity: "tuned",
      itemLevel: 2,
      seed: "starter_bag_arc_ring",
      source: "starter",
      arenaId: "starter",
      enemyLevel: 1,
    }),
    generateTopPart({
      id: "starter_bag_flywheel",
      baseId: "part_disk_hollow_flywheel",
      rarity: "tuned",
      itemLevel: 2,
      seed: "starter_bag_flywheel",
      source: "starter",
      arenaId: "starter",
      enemyLevel: 1,
    }),
  ];
}

export function createPartFromArenaDrop(drop: ArenaDrop, arenaTier: number, wave: number): TopPartInstance {
  return createPartFromArenaDropEngine(drop, arenaTier, wave);
}
