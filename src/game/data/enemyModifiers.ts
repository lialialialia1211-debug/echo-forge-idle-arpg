import type { EnemyModifierDef } from "../engine/topTypes";

export const enemyModifiers: EnemyModifierDef[] = [
  {
    id: "enemy_mod_tempered_shell",
    displayName: "Tempered",
    minTier: 1,
    weight: 100,
    tags: ["physical"],
    integrityMultiplier: 1.18,
    guardMultiplier: 1.22,
    rewardQuantity: 0.05,
  },
  {
    id: "enemy_mod_redline_motor",
    displayName: "Redline",
    minTier: 1,
    weight: 92,
    tags: ["speed"],
    rpmMultiplier: 1.24,
    impactMultiplier: 1.08,
    rewardRarity: 0.06,
  },
  {
    id: "enemy_mod_furnace_core",
    displayName: "Furnace",
    minTier: 1,
    weight: 86,
    tags: ["fire"],
    impactMultiplier: 1.12,
    resistanceBonuses: { heat: 0.16 },
    rewardQuantity: 0.04,
    rewardRarity: 0.04,
  },
  {
    id: "enemy_mod_arc_lashed",
    displayName: "Arc-Lashed",
    minTier: 2,
    weight: 82,
    tags: ["lightning", "chain"],
    rpmMultiplier: 1.16,
    resistanceBonuses: { static: 0.16 },
    rewardRarity: 0.08,
  },
  {
    id: "enemy_mod_mirror_bitten",
    displayName: "Mirror-Bitten",
    minTier: 2,
    weight: 72,
    tags: ["critical", "cold"],
    integrityMultiplier: 1.1,
    resistanceBonuses: { glass: 0.18 },
    rewardRarity: 0.1,
  },
  {
    id: "enemy_mod_void_touched",
    displayName: "Void-Touched",
    minTier: 3,
    weight: 52,
    tags: ["void", "risk"],
    integrityMultiplier: 1.2,
    impactMultiplier: 1.14,
    resistanceBonuses: { void: 0.2 },
    rewardQuantity: 0.08,
    rewardRarity: 0.12,
  },
];

export function getEnemyModifierDef(modifierId: string): EnemyModifierDef {
  const modifier = enemyModifiers.find((entry) => entry.id === modifierId);
  if (!modifier) {
    throw new Error(`Unknown enemy modifier: ${modifierId}`);
  }
  return modifier;
}
