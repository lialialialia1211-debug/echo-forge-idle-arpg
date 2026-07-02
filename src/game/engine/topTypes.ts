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
  | "control"
  | "thorns"
  | "risk";

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
  | "fluxCost"
  | "cooldownRecovery"
  | "reservationEfficiency"
  | "stagger"
  | "ringOutPressure"
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
  // NOT-YET-CONSUMED (見 Codex 計畫 R3/F2):
  scope?: "local" | "global";
  condition?: CombatCondition;
};

export type CombatEventKind = TopCollisionKind | "ringout" | "overheat" | "discharge" | "stabilize" | "stance_shift";

export type CombatCondition =
  | { kind: "attr"; attr: "mass" | "volume" | "spinEnergyRatio" | "fluxRatio" | "omega" | "maxFlux"; op: ">=" | "<=" | "<" | ">" | "=="; value: number }
  | { kind: "event"; event: CombatEventKind }
  | { kind: "and" | "or"; terms: CombatCondition[] };

export type DriveAttributeRequirement = Extract<CombatCondition, { kind: "attr" }>;

export type TopFrameDef = {
  id: string;
  displayName: string;
  role: string;
  fantasy: string;
  baseStats: Required<Pick<TopRuntimeStats, "maxSpinIntegrity" | "maxFluxGuard" | "guard" | "drift" | "tracking" | "impact" | "rpm" | "mass" | "grip" | "edge" | "fracture" | "resonance">>;
  preferredTags: DriveTag[];
  startingDriveId: string;
};

export type DriveTrigger =
  | "onCollision"
  | "onCooldown"
  | "onHeavyCollision"
  | "onCrit"
  | "onKill"
  | "onSpinLow"
  | "onEnemyEnterRadius"
  | "whenDamaged";

export type TopDamageSource = "collision" | "drive" | "trail" | "satellite" | "recoil" | "hazard";

export type FluxCost = {
  amount: number;
  reserve?: number;
};

export type CooldownDef = {
  baseSeconds: number;
  recoveryStat?: TopStatId;
};

export type HitProfile = {
  source: TopDamageSource;
  damage: DamagePacket;
  // NOT-YET-CONSUMED (見 Codex 計畫 R3/F2):
  usesTracking: boolean;
  canCrit: boolean;
};

// NOT-YET-CONSUMED (見 Codex 計畫 R3/F2):
export type DotProfile = {
  source: TopDamageSource;
  damageType: TopDamageType;
  baseDps: number;
  duration: number;
};

export type AilmentKind = "burn" | "shock" | "bleed" | "slow" | "stagger";

export type AilmentState = {
  id: string;
  kind: AilmentKind;
  sourceDamageType: TopDamageType;
  sourceId: string;
  magnitude: number;
  duration: number;
  remainingSeconds: number;
};

export type SatelliteProfile = {
  count: number;
  attackRate: number;
  damage: DamagePacket;
  duration: number;
};

export type HazardProfile = {
  damageType: TopDamageType;
  baseDps: number;
  radius: number;
  duration: number;
};

export type ScalingRule = {
  stat: TopStatId | TopDamageType | "damage";
  coefficient: number;
  tags?: DriveTag[];
};

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
  cost?: FluxCost;
  cooldown?: CooldownDef;
  hit?: HitProfile;
  dot?: DotProfile;
  minion?: SatelliteProfile;
  arenaEffect?: HazardProfile;
  // NOT-YET-CONSUMED (見 Codex 計畫 R3/F2):
  scaling?: ScalingRule[];
  requiredAttributes?: DriveAttributeRequirement[];
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

export type ArenaAnomalyDef = {
  id: string;
  displayName: string;
  description: string;
  minTier: number;
  enemyIntegrityMultiplier: number;
  enemyImpactMultiplier: number;
  rewardQuantity: number;
  rewardRarity: number;
  requiredBossGateId?: string;
};

export type TopPartSlotId = "core" | "attackRing" | "weightDisk" | "tip" | "launcher" | "seal" | "circuitChip";

export type TopPartRarity = "common" | "tuned" | "engraved" | "relic";

export type TopAffixSlot = "prefix" | "suffix";

export type TopAffixTier = {
  min: number;
  max: number;
  itemLevel: number;
};

export type TopEngravingDef = {
  id: string;
  displayName: string;
  slot: TopAffixSlot;
  group: string;
  minItemLevel: number;
  weight: number;
  slots?: TopPartSlotId[];
  tags?: DriveTag[];
  statBonuses?: TopStatBlock;
  resistanceBonuses?: TopResistanceBlock;
  modifiers?: TopModifierDef[];
  tiers?: TopAffixTier[];
};

export type TopRolledEngraving = {
  engravingId: string;
  displayName: string;
  slot: TopAffixSlot;
  group: string;
  tier: number;
  statBonuses: TopStatBlock;
  resistanceBonuses: TopResistanceBlock;
  modifiers: TopModifierDef[];
};

export type TopPartGeneratedBy = {
  arenaId: string;
  enemyLevel: number;
  balanceVersion: string;
  seed: string;
  source: "drop" | "starter" | "craft" | "debug";
};

export type LauncherProfile = {
  initialSpeedScalar: number;
  initialEnergyBonus: number;
  entrySkillId?: string;
};

export type TopPartBaseDef = {
  id: string;
  slot: TopPartSlotId;
  displayName: string;
  tags: DriveTag[];
  itemClass?: string;
  requiredLevel?: number;
  baseWeight?: number;
  uniqueEffect?: {
    id: "glass_rebound" | "storm_orbit" | "magnet_heart" | "mapwright_contract";
    description: string;
  };
  implicitStats?: TopStatBlock;
  implicitResistances?: TopResistanceBlock;
  implicitModifiers?: TopModifierDef[];
  launcherProfile?: LauncherProfile;
};

export type TopPartInstance = {
  id: string;
  baseId: string;
  displayName: string;
  slot: TopPartSlotId;
  rarity: TopPartRarity;
  itemLevel: number;
  affixes?: TopRolledEngraving[];
  statBonuses: TopStatBlock;
  resistanceBonuses: TopResistanceBlock;
  modifiers: TopModifierDef[];
  revision?: number;
  locked?: boolean;
  sourceDropId?: string;
  generatedAt?: string;
  generatedBy?: TopPartGeneratedBy;
};

export type TopEquipment = Partial<Record<TopPartSlotId, TopPartInstance | null>>;

export type TuningRuneDef = {
  id: string;
  displayName: string;
  requiredTags: DriveTag[];
  excludedTags?: DriveTag[];
  supportFamily?: string;
  costMultiplier?: number;
  // NOT-YET-CONSUMED (見 Codex 計畫 R3/F2):
  instability?: number;
  behavior?: "projectileCount" | "repeat" | "chain" | "area" | "duration" | "trigger" | "defense" | "risk";
  statBonuses?: TopStatBlock;
  resistanceBonuses?: TopResistanceBlock;
  modifiers: TopModifierDef[];
};

export type TalentNodeDef = {
  id: string;
  displayName: string;
  description: string;
  cost: number;
  position: { x: number; y: number };
  kind: "minor" | "notable" | "keystone";
  clusterId?: string;
  requiredNodeIds?: string[];
  statBonuses?: TopStatBlock;
  resistanceBonuses?: TopResistanceBlock;
  modifiers?: TopModifierDef[];
};

export type CircuitAtlasBonus = {
  enemyIntegrityMultiplier?: number;
  enemyImpactMultiplier?: number;
  activeEnemyPressure?: number;
  rewardQuantity?: number;
  rewardRarity?: number;
  breachProgressGain?: number;
  breachDuration?: number;
  bossPhasePressure?: number;
  statBonuses?: TopStatBlock;
  resistanceBonuses?: TopResistanceBlock;
  modifiers?: TopModifierDef[];
};

export type CircuitAtlasNodeDef = {
  id: string;
  displayName: string;
  description: string;
  cost: number;
  requiredNodeIds?: string[];
  bonuses: CircuitAtlasBonus;
};

export type CircuitNetworkNodeDef = {
  id: string;
  displayName: string;
  description: string;
  arenaId: string;
  requiredBossGateId?: string;
  anomalyId?: string;
  requiredNodeIds?: string[];
};

export type DoctrineRule = "selfHazardSafe" | "anchorMass" | "overloadSurge" | "precisionBleed" | "fluxRecursion" | "stormConduit";

export type DoctrineNodeDef = {
  id: string;
  displayName: string;
  description: string;
  statBonuses?: TopStatBlock;
  resistanceBonuses?: TopResistanceBlock;
  modifiers?: TopModifierDef[];
  rule?: DoctrineRule;
};

export type DoctrineDef = {
  id: string;
  frameId: string;
  displayName: string;
  description: string;
  nodes: DoctrineNodeDef[];
};

export type TopLoadoutConfig = {
  equipment?: TopEquipment;
  runeIds?: string[];
  talentIds?: string[];
  circuitAtlasNodeIds?: string[];
  doctrineId?: string | null;
  anomalyId?: string | null;
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
  fluxCost?: number;
  cooldownRecovery?: number;
  reservationEfficiency?: number;
  stagger?: number;
  ringOutPressure?: number;
  partQuantity: number;
  partRarity: number;
  resistances: Required<TopResistanceBlock>;
  modifiers: TopModifierDef[];
};

export type EnemyBehaviorId = "hunter" | "charger" | "orbiter" | "mineLayer" | "bossJudicator";

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
  maxSpinEnergy?: number;
  spinEnergy?: number;
  maxFlux?: number;
  flux?: number;
  wobble: number;
  cooldownRemaining: number;
  stats: TopRuntimeStats;
  driveId?: string;
  enemyModifier?: EnemyModifierState;
  behaviorId?: EnemyBehaviorId;
  bossPhase?: 1 | 2 | 3;
  phaseGateCooldown?: number;
  ailments?: AilmentState[];
};

export type TopCollisionKind = "scrape" | "clash" | "smash" | "grind";

export type CombatEvent = {
  kind: CombatEventKind;
  sourceId: string;
  targetId?: string;
  magnitude: number;
  x: number;
  y: number;
  driveId?: string;
  tags?: DriveTag[];
};

export type TopCollisionEvent = {
  id: string;
  playerId: string;
  enemyId: string;
  kind: TopCollisionKind;
  x: number;
  y: number;
  normalX: number;
  normalY: number;
  tangentX: number;
  tangentY: number;
  normalImpulse: number;
  tangentImpulse: number;
  relativeNormalSpeed: number;
  relativeTangentialSpeed: number;
  surfaceShear: number;
  sparkIntensity: number;
  contactAge: number;
  heavy: boolean;
};

export type ArenaEffectKind = "spark" | "frictionSpark" | "emberTrail" | "stormArc" | "shockwave" | "hazard" | "chargeLine" | "drop" | "spawn" | "bossSignal";

export type ArenaTuningConfig = {
  basinPullMultiplier: number;
  collisionLaunchMultiplier: number;
  sparkMultiplier: number;
  activeEnemyPressure: number;
  bossWeightMultiplier: number;
  hitStopMultiplier: number;
};

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
  slot: TopPartSlotId;
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

export type ArenaRouteMechanicState = {
  id: "breach_rail";
  displayName: string;
  active: boolean;
  progress: number;
  maxProgress: number;
  timeRemaining: number;
  maxTime: number;
  stabilized: boolean;
  rewardQuantity: number;
  rewardRarity: number;
};

export type TopArenaOutcome = "ongoing" | "victory" | "defeat";

export type TopArenaDefeatCause = "spinout" | "break" | "ringout";

export type TopArenaRuntime = {
  seed: string;
  arenaId: string;
  mode: "route" | "duel";
  arenaKey?: ArenaKey;
  activeEvent?: ArenaEventState;
  routeMechanic?: ArenaRouteMechanicState;
  frameId: string;
  driveId: string;
  loadout: TopLoadoutConfig;
  time: number;
  outcome: TopArenaOutcome;
  defeatCause?: TopArenaDefeatCause;
  wave: number;
  kills: number;
  mapKills: number;
  mapKillTarget: number;
  bossSpawned: boolean;
  spawnIndex: number;
  routeClears: number;
  nextEnemyIn: number;
  routeTransitionCooldown: number;
  eventIndex: number;
  player: TopRuntimeEntity;
  enemies: TopRuntimeEntity[];
  effects: ArenaEffect[];
  drops: ArenaDrop[];
  events: ArenaLogEvent[];
  combatEvents: CombatEvent[];
  lastCollision?: TopCollisionEvent;
  collisionContacts: Record<string, number>;
};

export type ArenaKeyRarity = TopPartRarity;

export type ArenaRewardBias = {
  target: TopPartSlotId | "forgeMedia" | "bossFragment" | "any";
  weight: number;
};

export type EnemyModifierDef = {
  id: string;
  displayName: string;
  minTier: number;
  weight: number;
  tags?: DriveTag[];
  integrityMultiplier?: number;
  impactMultiplier?: number;
  guardMultiplier?: number;
  rpmMultiplier?: number;
  resistanceBonuses?: TopResistanceBlock;
  rewardQuantity?: number;
  rewardRarity?: number;
};

export type EnemyModifierState = {
  modifierId: string;
  displayName: string;
  rewardQuantity: number;
  rewardRarity: number;
};

export type ArenaEventDef = {
  id: string;
  displayName: string;
  minTier: number;
  weight: number;
  logText: string;
  enemyIntegrityMultiplier?: number;
  enemyImpactMultiplier?: number;
  enemyGuardMultiplier?: number;
  enemyRpmMultiplier?: number;
  playerDriftMultiplier?: number;
  rewardQuantity?: number;
  rewardRarity?: number;
  rewardBias?: ArenaRewardBias[];
};

export type ArenaEventState = {
  eventId: string;
  displayName: string;
  logText: string;
  enemyIntegrityMultiplier: number;
  enemyImpactMultiplier: number;
  enemyGuardMultiplier: number;
  enemyRpmMultiplier: number;
  playerDriftMultiplier: number;
  rewardQuantity: number;
  rewardRarity: number;
  rewardBias: ArenaRewardBias[];
};

export type ArenaKeyAffixDef = {
  id: string;
  displayName: string;
  slot: TopAffixSlot;
  group: string;
  minTier: number;
  weight: number;
  enemyIntegrityMultiplier?: number;
  enemyImpactMultiplier?: number;
  enemyGuardMultiplier?: number;
  enemyRpmMultiplier?: number;
  rewardQuantity?: number;
  rewardRarity?: number;
  bossPressure?: number;
  rewardBias?: ArenaRewardBias[];
};

export type ArenaKeyAffix = {
  affixId: string;
  displayName: string;
  slot: TopAffixSlot;
  group: string;
  tier: number;
  enemyIntegrityMultiplier: number;
  enemyImpactMultiplier: number;
  enemyGuardMultiplier: number;
  enemyRpmMultiplier: number;
  rewardQuantity: number;
  rewardRarity: number;
  bossPressure: number;
  rewardBias: ArenaRewardBias[];
};

export type ArenaKey = {
  id: string;
  tier: number;
  arenaBaseId: string;
  rarity: ArenaKeyRarity;
  itemLevel: number;
  quality: number;
  prefixes: ArenaKeyAffix[];
  suffixes: ArenaKeyAffix[];
  rewardBias: ArenaRewardBias[];
  bossGateId?: string;
  generatedAt: string;
  generatedBy: {
    arenaId: string;
    balanceVersion: string;
    seed: string;
  };
};

export type BossGateDef = {
  id: string;
  displayName: string;
  arenaId: string;
  tier: number;
  bossIntegrity: number;
  requiredDps: number;
  requiredTracking: number;
  requiredGuard: number;
  requiredDrift: number;
  requiredGrip: number;
  requiredResistance: Partial<Record<TopDamageType, number>>;
  rewardUnlocks: string[];
};

export type BossGateFailureReason = "dps" | "tracking" | "guard" | "drift" | "grip" | "resistance" | "sustain";

export type BossGateAttemptProjection = {
  gateId: string;
  successChance: number;
  estimatedTtk: number;
  failureReasons: BossGateFailureReason[];
  recommendedStats: Partial<Record<BossGateFailureReason, number>>;
  rewardUnlocks: string[];
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
