import type { CircuitAtlasBonus, CircuitAtlasNodeDef, TopModifierDef, TopResistanceBlock, TopStatBlock } from "../engine/topTypes";

export type CircuitAtlasRuntimeBonuses = Required<Pick<CircuitAtlasBonus, "enemyIntegrityMultiplier" | "enemyImpactMultiplier">> &
  Required<Pick<CircuitAtlasBonus, "activeEnemyPressure" | "rewardQuantity" | "rewardRarity" | "breachProgressGain" | "breachDuration" | "bossPhasePressure">> & {
    statBonuses: TopStatBlock;
    resistanceBonuses: TopResistanceBlock;
    modifiers: TopModifierDef[];
  };

export const circuitAtlasNodes: CircuitAtlasNodeDef[] = [
  {
    id: "atlas_breach_calibrator",
    displayName: "Breach Calibrator",
    description: "Opens every route with a short Breach Rail window.",
    cost: 1,
    bonuses: { breachDuration: 4, breachProgressGain: 0.08 },
  },
  {
    id: "atlas_dense_rail",
    displayName: "Dense Rail",
    description: "More rivals enter while the route is charging.",
    cost: 1,
    requiredNodeIds: ["atlas_breach_calibrator"],
    bonuses: { activeEnemyPressure: 0.08, rewardQuantity: 0.04 },
  },
  {
    id: "atlas_mapwright_cache",
    displayName: "Mapwright Cache",
    description: "Route rewards favor extra parts and key crafting.",
    cost: 1,
    requiredNodeIds: ["atlas_breach_calibrator"],
    bonuses: { rewardQuantity: 0.08, statBonuses: { partQuantity: 0.04 } },
  },
  {
    id: "atlas_glass_lure",
    displayName: "Glass Lure",
    description: "Riskier rivals, better relic pressure.",
    cost: 2,
    requiredNodeIds: ["atlas_mapwright_cache"],
    bonuses: { enemyIntegrityMultiplier: 1.06, rewardRarity: 0.1, statBonuses: { partRarity: 0.04 } },
  },
  {
    id: "atlas_redline_artery",
    displayName: "Redline Artery",
    description: "Fast rival packs create more high-impact collisions.",
    cost: 2,
    requiredNodeIds: ["atlas_dense_rail"],
    bonuses: { activeEnemyPressure: 0.1, enemyImpactMultiplier: 1.06, breachProgressGain: 0.1 },
  },
  {
    id: "atlas_boss_lantern",
    displayName: "Boss Lantern",
    description: "Boss phases become more rewarding after a stable rail.",
    cost: 2,
    requiredNodeIds: ["atlas_redline_artery"],
    bonuses: { bossPhasePressure: 0.08, rewardRarity: 0.08 },
  },
  {
    id: "atlas_quench_line",
    displayName: "Quench Line",
    description: "Defensive route tuning for long keyed maps.",
    cost: 1,
    requiredNodeIds: ["atlas_dense_rail"],
    bonuses: { statBonuses: { guard: 38, grip: 0.025 }, resistanceBonuses: { heat: 0.03, static: 0.02 } },
  },
  {
    id: "atlas_splinter_switch",
    displayName: "Splinter Switch",
    description: "Projectile and chain builds scale better in open routes.",
    cost: 2,
    requiredNodeIds: ["atlas_mapwright_cache"],
    bonuses: {
      statBonuses: { tracking: 36 },
      modifiers: [{ id: "atlas_splinter_switch_damage", stat: "damage", type: "increased", value: 0.08, tags: ["projectile", "chain"] }],
    },
  },
  {
    id: "atlas_iron_basin",
    displayName: "Iron Basin",
    description: "Heavier rivals, stronger part drops.",
    cost: 2,
    requiredNodeIds: ["atlas_quench_line"],
    bonuses: { enemyIntegrityMultiplier: 1.05, rewardQuantity: 0.08, statBonuses: { mass: 0.04, spinIntegrity: 90 } },
  },
  {
    id: "atlas_furnace_toll",
    displayName: "Furnace Toll",
    description: "Heat routes hold hazards longer but pay better.",
    cost: 2,
    requiredNodeIds: ["atlas_splinter_switch"],
    bonuses: {
      enemyImpactMultiplier: 1.04,
      rewardRarity: 0.06,
      modifiers: [{ id: "atlas_furnace_toll_heat", stat: "heat", type: "more", value: 0.07, tags: ["fire", "duration"] }],
    },
  },
  {
    id: "atlas_storm_divider",
    displayName: "Storm Divider",
    description: "Stabilized rails fork lightning pressure through packs.",
    cost: 2,
    requiredNodeIds: ["atlas_splinter_switch"],
    bonuses: {
      breachProgressGain: 0.08,
      rewardRarity: 0.04,
      modifiers: [{ id: "atlas_storm_divider_static", stat: "static", type: "penetration", value: 0.06, tags: ["lightning", "chain"] }],
    },
  },
  {
    id: "atlas_last_gate",
    displayName: "Last Gate",
    description: "A capstone for boss farming and relic hunting.",
    cost: 3,
    requiredNodeIds: ["atlas_boss_lantern", "atlas_glass_lure"],
    bonuses: {
      enemyIntegrityMultiplier: 1.08,
      enemyImpactMultiplier: 1.06,
      bossPhasePressure: 0.12,
      rewardQuantity: 0.1,
      rewardRarity: 0.12,
      breachDuration: 3,
    },
  },
];

export function getCircuitAtlasNodeDef(nodeId: string): CircuitAtlasNodeDef {
  const node = circuitAtlasNodes.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new Error(`Unknown circuit atlas node: ${nodeId}`);
  }
  return node;
}

function addStats(a: TopStatBlock = {}, b: TopStatBlock = {}): TopStatBlock {
  const next: TopStatBlock = { ...a };
  for (const [stat, value] of Object.entries(b)) {
    next[stat as keyof TopStatBlock] = (next[stat as keyof TopStatBlock] ?? 0) + (value ?? 0);
  }
  return next;
}

function addResistances(a: TopResistanceBlock = {}, b: TopResistanceBlock = {}): TopResistanceBlock {
  const next: TopResistanceBlock = { ...a };
  for (const [type, value] of Object.entries(b)) {
    next[type as keyof TopResistanceBlock] = (next[type as keyof TopResistanceBlock] ?? 0) + (value ?? 0);
  }
  return next;
}

export function resolveCircuitAtlasBonuses(nodeIds: string[] = []): CircuitAtlasRuntimeBonuses {
  const selected = new Set(nodeIds);

  return circuitAtlasNodes.reduce<CircuitAtlasRuntimeBonuses>(
    (bonuses, node) => {
      if (!selected.has(node.id)) {
        return bonuses;
      }

      return {
        enemyIntegrityMultiplier: bonuses.enemyIntegrityMultiplier * (node.bonuses.enemyIntegrityMultiplier ?? 1),
        enemyImpactMultiplier: bonuses.enemyImpactMultiplier * (node.bonuses.enemyImpactMultiplier ?? 1),
        activeEnemyPressure: bonuses.activeEnemyPressure + (node.bonuses.activeEnemyPressure ?? 0),
        rewardQuantity: bonuses.rewardQuantity + (node.bonuses.rewardQuantity ?? 0),
        rewardRarity: bonuses.rewardRarity + (node.bonuses.rewardRarity ?? 0),
        breachProgressGain: bonuses.breachProgressGain + (node.bonuses.breachProgressGain ?? 0),
        breachDuration: bonuses.breachDuration + (node.bonuses.breachDuration ?? 0),
        bossPhasePressure: bonuses.bossPhasePressure + (node.bonuses.bossPhasePressure ?? 0),
        statBonuses: addStats(bonuses.statBonuses, node.bonuses.statBonuses),
        resistanceBonuses: addResistances(bonuses.resistanceBonuses, node.bonuses.resistanceBonuses),
        modifiers: [...bonuses.modifiers, ...(node.bonuses.modifiers ?? [])],
      };
    },
    {
      enemyIntegrityMultiplier: 1,
      enemyImpactMultiplier: 1,
      activeEnemyPressure: 0,
      rewardQuantity: 0,
      rewardRarity: 0,
      breachProgressGain: 0,
      breachDuration: 0,
      bossPhasePressure: 0,
      statBonuses: {},
      resistanceBonuses: {},
      modifiers: [],
    },
  );
}
