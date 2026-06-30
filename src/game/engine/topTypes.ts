export type TopDamageType = "impact" | "heat" | "glass" | "static" | "void";

export type DriveTag =
  | "attack"
  | "spell"
  | "projectile"
  | "melee"
  | "area"
  | "duration"
  | "chain"
  | "minion"
  | "physical"
  | "fire"
  | "cold"
  | "lightning"
  | "void"
  | "critical"
  | "speed"
  | "control";

export type TopStatId =
  | "spinIntegrity"
  | "fluxGuard"
  | "guard"
  | "drift"
  | "tracking"
  | "impact"
  | "rpm"
  | "mass"
  | "grip"
  | "edge"
  | "fracture"
  | "resonance"
  | "partQuantity"
  | "partRarity";

export type DamagePacket = Record<TopDamageType, number>;

export type TopStatBlock = Partial<Record<TopStatId, number>>;

export type TopResistanceBlock = Partial<Record<TopDamageType, number>>;

export type TopModifierType =
  | "flat"
  | "increased"
  | "reduced"
  | "more"
  | "less"
  | "penetration"
  | "extraAs"
  | "conversion";

export type TopModifierDef = {
  id: string;
  stat: TopStatId | TopDamageType | "damage";
  type: TopModifierType;
  value: number;
  tags?: DriveTag[];
  fromDamageType?: TopDamageType;
  toDamageType?: TopDamageType;
};

export type TopFrameDef = {
  id: string;
  displayName: string;
  role: string;
  fantasy: string;
  baseStats: Required<Pick<TopRuntimeStats, "maxSpinIntegrity" | "maxFluxGuard" | "guard" | "drift" | "tracking" | "impact" | "rpm" | "mass" | "grip" | "edge" | "fracture" | "resonance">>;
  preferredTags: DriveTag[];
  startingDriveId: string;
};

export type DriveTrigger = "onCollision" | "onCooldown" | "onHeavyCollision";

export type DriveCoreDef = {
  id: string;
  displayName: string;
  tags: DriveTag[];
  damageTypes: TopDamageType[];
  trigger: DriveTrigger;
  baseCooldown: number;
  baseDamage: DamagePacket;
  modifiers: TopModifierDef[];
  visual: "sparks" | "emberTrail" | "stormArc" | "voidPull" | "satellite";
};

export type ArenaCircuitDef = {
  id: string;
  displayName: string;
  tier: number;
  radius: number;
  enemyLevel: number;
  enemyIntegrity: number;
  enemyImpact: number;
  enemyGuard: number;
  rewardMultiplier: number;
};

export type TopPartSlotId = "core" | "attackRing" | "weightDisk" | "tip" | "launcher" | "seal" | "circuitChip";

export type TopPartRarity = "common" | "tuned" | "engraved" | "relic";

export type TopPartBaseDef = {
  id: string;
  slot: TopPartSlotId;
  displayName: string;
  tags: DriveTag[];
  implicitStats?: TopStatBlock;
  implicitResistances?: TopResistanceBlock;
  implicitModifiers?: TopModifierDef[];
};

export type TopPartInstance = {
  id: string;
  baseId: string;
  displayName: string;
  slot: TopPartSlotId;
  rarity: TopPartRarity;
  itemLevel: number;
  statBonuses: TopStatBlock;
  resistanceBonuses: TopResistanceBlock;
  modifiers: TopModifierDef[];
  locked?: boolean;
  sourceDropId?: string;
};

export type TopEquipment = Partial<Record<TopPartSlotId, TopPartInstance | null>>;

export type TuningRuneDef = {
  id: string;
  displayName: string;
  requiredTags: DriveTag[];
  statBonuses?: TopStatBlock;
  resistanceBonuses?: TopResistanceBlock;
  modifiers: TopModifierDef[];
};

export type TalentNodeDef = {
  id: string;
  displayName: string;
  description: string;
  cost: number;
  requiredNodeIds?: string[];
  statBonuses?: TopStatBlock;
  resistanceBonuses?: TopResistanceBlock;
  modifiers?: TopModifierDef[];
};

export type TopLoadoutConfig = {
  equipment?: TopEquipment;
  runeIds?: string[];
  talentIds?: string[];
};

export type TopRuntimeStats = {
  maxSpinIntegrity: number;
  maxFluxGuard: number;
  guard: number;
  drift: number;
  tracking: number;
  impact: number;
  rpm: number;
  mass: number;
  grip: number;
  edge: number;
  fracture: number;
  resonance: number;
  partQuantity: number;
  partRarity: number;
  resistances: Required<TopResistanceBlock>;
  modifiers: TopModifierDef[];
};

export type TopRuntimeEntity = {
  id: string;
  team: "player" | "enemy";
  name: string;
  rank: "player" | "pack" | "elite" | "boss";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  spinIntegrity: number;
  fluxGuard: number;
  spinPower: number;
  cooldownRemaining: number;
  stats: TopRuntimeStats;
  driveId?: string;
};

export type ArenaEffectKind = "spark" | "emberTrail" | "stormArc" | "shockwave" | "drop" | "spawn";

export type ArenaEffect = {
  id: string;
  kind: ArenaEffectKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  age: number;
  lifetime: number;
  intensity: number;
};

export type ArenaDrop = {
  id: string;
  label: string;
  rarity: "common" | "tuned" | "engraved" | "relic";
  x: number;
  y: number;
  age: number;
};

export type ArenaLogEvent = {
  id: string;
  tone: "hit" | "skill" | "kill" | "drop" | "danger" | "reward";
  text: string;
};

export type TopArenaRuntime = {
  seed: string;
  arenaId: string;
  frameId: string;
  driveId: string;
  loadout: TopLoadoutConfig;
  time: number;
  wave: number;
  kills: number;
  routeClears: number;
  nextEnemyIn: number;
  eventIndex: number;
  player: TopRuntimeEntity;
  enemies: TopRuntimeEntity[];
  effects: ArenaEffect[];
  drops: ArenaDrop[];
  events: ArenaLogEvent[];
};

export const emptyDamagePacket = (): DamagePacket => ({
  impact: 0,
  heat: 0,
  glass: 0,
  static: 0,
  void: 0,
});

export const zeroResistances = (): Required<TopResistanceBlock> => ({
  impact: 0,
  heat: 0,
  glass: 0,
  static: 0,
  void: 0,
});
