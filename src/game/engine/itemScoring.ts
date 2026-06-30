import { runSimulation } from "./simulation";
import { equipItem } from "./items";
import type { CharacterBuild, ItemInstance } from "./types";

export type ItemDelta = {
  dps: number;
  physicalEhp: number;
  elementalEhp: number;
  lootEv: number;
};

export function buildWithEquippedItem(build: CharacterBuild, item: ItemInstance): CharacterBuild {
  return {
    ...build,
    equipment: equipItem(build.equipment, item),
  };
}

export function compareItemForBuild(build: CharacterBuild, areaId: string, item: ItemInstance): ItemDelta {
  const current = runSimulation(build, areaId);
  const preview = runSimulation(buildWithEquippedItem(build, item), areaId);

  return {
    dps: preview.combat.dps - current.combat.dps,
    physicalEhp: preview.defense.physicalEhp - current.defense.physicalEhp,
    elementalEhp: preview.defense.elementalEhp - current.defense.elementalEhp,
    lootEv: preview.loot.totalEvPerHour - current.loot.totalEvPerHour,
  };
}
