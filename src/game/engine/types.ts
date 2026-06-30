export type DamageType = "physical" | "fire" | "cold" | "lightning" | "void";

export type SkillTag =
  | "attack"
  | "spell"
  | "projectile"
  | "melee"
  | "area"
  | "physical"
  | "fire"
  | "cold"
  | "lightning"
  | "void"
  | "critical"
  | "minion"
  | "duration";

export type AttributeId = "strength" | "dexterity" | "intelligence";

export type StatId =
  | AttributeId
  | "life"
  | "shield"
  | "armour"
  | "evasion"
  | "accuracy"
  | "blockChance"
  | "recoveryPerSecond"
  | "damage"
  | "flatDamage"
  | "actionSpeed"
  | "critChance"
  | "critMultiplier"
  | "penetration"
  | "extraAsDamage"
  | "itemQuantity"
  | "itemRarity"
  | "resistance";

export type ModifierType =
  | "flat"
  | "increased"
  | "reduced"
  | "more"
  | "less"
  | "cap"
  | "penetration"
  | "extraAs";

export type ModifierSource =
  | "class"
  | "skill"
  | "support"
  | "item"
  | "passive"
  | "area"
  | "craft";

export type StatBlock = Partial<Record<StatId, number>>;

export type LevelCurve = {
  base: number;
  perLevel: number;
  growth?: number;
};

export type ModifierDef = {
  id: string;
  stat: StatId;
  type: ModifierType;
  value: number;
  tags?: SkillTag[];
  source: ModifierSource;
};

export type ClassDef = {
  id: string;
  displayName: string;
  role: string;
  fantasy: string;
  primaryAttributes: AttributeId[];
  baseStats: StatBlock;
  growth: StatBlock;
  startingSkills: string[];
  preferredTags: SkillTag[];
  passiveStartNode: string;
};

export type SkillDef = {
  id: string;
  displayName: string;
  tags: SkillTag[];
  damageTypes: DamageType[];
  baseUseTime: number;
  baseCritChance: number;
  baseDamageByLevel: LevelCurve;
  allowedClassIds?: string[];
};

export type SupportDef = {
  id: string;
  displayName: string;
  requiredTags: SkillTag[];
  excludedTags?: SkillTag[];
  modifiers: ModifierDef[];
  costMultiplier: number;
};

export type EquipmentSlotId =
  | "mainHand"
  | "offHand"
  | "helmet"
  | "bodyArmour"
  | "gloves"
  | "boots"
  | "belt"
  | "amulet"
  | "ringLeft"
  | "ringRight"
  | "charmOne"
  | "charmTwo";

export type ItemBaseDef = {
  id: string;
  displayName: string;
  itemClass: string;
  equipmentSlot: EquipmentSlotId;
  requiredLevel: number;
  baseStats: StatBlock;
  implicitModifiers: ModifierDef[];
  tags: string[];
};

export type AffixTier = {
  min: number;
  max: number;
  itemLevel: number;
};

export type AffixDef = {
  id: string;
  displayName: string;
  slot: "prefix" | "suffix";
  group: string;
  minItemLevel: number;
  weight: number;
  itemClasses: string[];
  modifiers: ModifierDef[];
  tiers: AffixTier[];
};

export type ItemRarity = "normal" | "magic" | "rare" | "relic";

export type RolledAffix = {
  affixId: string;
  displayName: string;
  slot: "prefix" | "suffix";
  group: string;
  tier: number;
  modifiers: ModifierDef[];
};

export type ItemInstance = {
  id: string;
  baseId: string;
  rarity: ItemRarity;
  itemLevel: number;
  affixes: RolledAffix[];
  locked?: boolean;
  generatedAt: string;
  generatedBy: {
    areaId: string;
    monsterLevel: number;
    balanceVersion: string;
    seed: string;
  };
};

export type CurrencyId = "ash" | "glass" | "echo";

export type CurrencyWallet = Record<CurrencyId, number>;

export type SalvageResult = {
  currencies: CurrencyWallet;
  itemValue: number;
};

export type InventoryCapacityResult = {
  inventory: ItemInstance[];
  salvagedItems: ItemInstance[];
  currencies: CurrencyWallet;
};

export type FarmTickResult = {
  seconds: number;
  kills: number;
  items: ItemInstance[];
  currencies: CurrencyWallet;
};

export type EncounterRank = "pack" | "elite" | "boss";

export type EncounterState = {
  id: string;
  areaId: string;
  wave: number;
  rank: EncounterRank;
  enemyName: string;
  maxLife: number;
  life: number;
  threat: number;
  rewardBias: number;
};

export type CombatEventTone = "hit" | "burst" | "kill" | "drop" | "danger" | "reward";

export type CombatEvent = {
  id: string;
  tone: CombatEventTone;
  text: string;
};

export type AreaDef = {
  id: string;
  displayName: string;
  tier: number;
  areaLevel: number;
  monsterLife: number;
  monsterDamage: number;
  enemyEvasion: number;
  enemyAccuracy: number;
  enemyResistance: number;
  maxKillsPerMinute: number;
  baseDropChance: number;
  areaQuantity: number;
  areaRarity: number;
  rewardMultiplier: number;
  bossLife: number;
};

export type CharacterBuild = {
  id: string;
  name: string;
  classId: string;
  level: number;
  skillId: string;
  supportIds: string[];
  modifiers: ModifierDef[];
  equipment: Partial<Record<EquipmentSlotId, ItemInstance>>;
};

export type CombatSummary = {
  averageHit: number;
  dps: number;
  hitChance: number;
  critChance: number;
  critExpectedMultiplier: number;
  effectiveResistance: number;
  hitsPerSecond: number;
  bossTimeToKill: number;
};

export type DefenseSummary = {
  pool: number;
  physicalEhp: number;
  elementalEhp: number;
  armourReduction: number;
  evadeChance: number;
  expectedIncomingDps: number;
  netDamagePerSecond: number;
  deathsPerHour: number;
};

export type LootSummary = {
  farmEfficiency: number;
  killsPerHour: number;
  itemsPerHour: number;
  rareItemsPerHour: number;
  chaseItemsPerHour: number;
  currencyPerHour: number;
  totalEvPerHour: number;
};

export type OfflineSummary = {
  effectiveHours: number;
  effectiveEfficiency: number;
  dropsBeforeCap: number;
  dropsKept: number;
  overflowSalvaged: number;
  offlineEv: number;
};

export type SimulationSummary = {
  combat: CombatSummary;
  defense: DefenseSummary;
  loot: LootSummary;
  offline: OfflineSummary;
};
