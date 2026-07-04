import { getTopPartBaseDef, partSlotOrder } from "../data/topPartBases";
import { resolveTopRuntimeStats } from "./topAssembly";
import { salvageTopPart } from "./topCrafting";
import type { AccountWallet } from "./accountState";
import type { DriveTag, TopEquipment, TopLoadoutConfig, TopPartInstance, TopPartRarity, TopPartSlotId, TopRuntimeStats } from "./topTypes";

export const lootPolicyRarities = ["common", "tuned", "engraved", "relic"] as const;

export const lootPolicyDriveTags = [
  "attack",
  "spell",
  "projectile",
  "melee",
  "area",
  "duration",
  "chain",
  "minion",
  "physical",
  "fire",
  "cold",
  "lightning",
  "void",
  "critical",
  "speed",
  "control",
  "thorns",
  "risk",
] as const satisfies readonly DriveTag[];

export type LootPolicy = {
  autoSalvage: boolean;
  minRarity: TopPartRarity;
  targetSlots: TopPartSlotId[];
  targetTags: DriveTag[];
  minItemLevel: number;
  minScore: number;
};

export type LootPolicyPresetId = "manual" | "balanced" | "mapper" | "strict";

export type LootPolicyPresetDef = {
  id: LootPolicyPresetId;
  label: string;
  description: string;
  policy: LootPolicy;
};

export type PartVerdictAction = "equipped" | "equip" | "forge" | "salvage";
export type PartVerdictTone = "good" | "warn" | "rare" | "neutral";

export type PartVerdictProjection = {
  action: PartVerdictAction;
  tone: PartVerdictTone;
  score: number;
  impactDelta: number;
  ehpDelta: number;
  controlDelta: number;
  rewardDelta: number;
};

export type LootPolicyReason =
  | "policyDisabled"
  | "equipped"
  | "locked"
  | "protectedRarity"
  | "upgrade"
  | "forgeCandidate"
  | "rarity"
  | "slot"
  | "tag"
  | "itemLevel"
  | "score"
  | "policyMatch";

export type LootPolicyDecision = {
  action: "keep" | "salvage";
  reason: LootPolicyReason;
  verdict: PartVerdictProjection;
};

export type LootPolicyEvaluationInput = {
  frameId: string;
  driveId: string;
  loadout: TopLoadoutConfig;
  policy: LootPolicy;
  parts: TopPartInstance[];
  equippedPartIds?: ReadonlySet<string>;
};

export type LootPolicyEvaluation = {
  keptParts: TopPartInstance[];
  salvagedParts: TopPartInstance[];
  decisions: Map<string, LootPolicyDecision>;
  wallet: AccountWallet;
};

export const rarityRank: Record<TopPartRarity, number> = {
  common: 0,
  tuned: 1,
  engraved: 2,
  relic: 3,
};

export const defaultLootPolicy: LootPolicy = {
  autoSalvage: false,
  minRarity: "tuned",
  targetSlots: [...partSlotOrder],
  targetTags: [],
  minItemLevel: 1,
  minScore: -20,
};

export const lootPolicyPresets: LootPolicyPresetDef[] = [
  {
    id: "manual",
    label: "手動確認",
    description: "所有掉落先進背包，只標示拆解候選。",
    policy: defaultLootPolicy,
  },
  {
    id: "balanced",
    label: "保守清理",
    description: "只拆明顯低分普通件，保留可鍛造候選。",
    policy: {
      autoSalvage: true,
      minRarity: "common",
      targetSlots: [...partSlotOrder],
      targetTags: [],
      minItemLevel: 1,
      minScore: -20,
    },
  },
  {
    id: "mapper",
    label: "刷圖精簡",
    description: "普通低分件自動回收，背包主要留下魔法以上與升級件。",
    policy: {
      autoSalvage: true,
      minRarity: "tuned",
      targetSlots: [...partSlotOrder],
      targetTags: [],
      minItemLevel: 1,
      minScore: 0,
    },
  },
  {
    id: "strict",
    label: "高稀有",
    description: "只保留升級件、稀有以上與高分鍛造底材。",
    policy: {
      autoSalvage: true,
      minRarity: "engraved",
      targetSlots: [...partSlotOrder],
      targetTags: [],
      minItemLevel: 1,
      minScore: 30,
    },
  },
];

export function applyLootPolicyPreset(presetId: LootPolicyPresetId): LootPolicy {
  return {
    ...(lootPolicyPresets.find((preset) => preset.id === presetId)?.policy ?? defaultLootPolicy),
    targetSlots: [...(lootPolicyPresets.find((preset) => preset.id === presetId)?.policy.targetSlots ?? defaultLootPolicy.targetSlots)],
    targetTags: [...(lootPolicyPresets.find((preset) => preset.id === presetId)?.policy.targetTags ?? defaultLootPolicy.targetTags)],
  };
}

function walletAdd(left: AccountWallet, right: AccountWallet): AccountWallet {
  return {
    ash: left.ash + right.ash,
    glass: left.glass + right.glass,
    echo: left.echo + right.echo,
  };
}

function runtimeStat(stats: TopRuntimeStats, stat: keyof TopRuntimeStats): number {
  const value = stats[stat];
  return typeof value === "number" ? value : 0;
}

export function selectPartVerdict(part: TopPartInstance, currentStats: TopRuntimeStats, previewStats: TopRuntimeStats, equipped: boolean): PartVerdictProjection {
  const impactDelta = runtimeStat(previewStats, "impact") - runtimeStat(currentStats, "impact");
  const ehpDelta =
    runtimeStat(previewStats, "maxSpinIntegrity") +
    runtimeStat(previewStats, "guard") -
    (runtimeStat(currentStats, "maxSpinIntegrity") + runtimeStat(currentStats, "guard"));
  const controlDelta = runtimeStat(previewStats, "tracking") - runtimeStat(currentStats, "tracking") + (runtimeStat(previewStats, "rpm") - runtimeStat(currentStats, "rpm")) * 34;
  const rewardDelta = runtimeStat(previewStats, "partQuantity") - runtimeStat(currentStats, "partQuantity") + runtimeStat(previewStats, "partRarity") - runtimeStat(currentStats, "partRarity");
  const score = impactDelta * 0.8 + ehpDelta * 0.08 + controlDelta * 0.08 + rewardDelta * 260;

  if (equipped) {
    return { action: "equipped", tone: "good", score, impactDelta, ehpDelta, controlDelta, rewardDelta };
  }

  if (score >= 55 || impactDelta > 45 || ehpDelta > 180 || rewardDelta > 0.08) {
    return { action: "equip", tone: "good", score, impactDelta, ehpDelta, controlDelta, rewardDelta };
  }

  if (rarityRank[part.rarity] >= rarityRank.engraved || score >= -20) {
    return { action: "forge", tone: part.rarity === "relic" ? "rare" : "warn", score, impactDelta, ehpDelta, controlDelta, rewardDelta };
  }

  return { action: "salvage", tone: "neutral", score, impactDelta, ehpDelta, controlDelta, rewardDelta };
}

function partMatchesTargetTags(part: TopPartInstance, targetTags: readonly DriveTag[]): boolean {
  if (targetTags.length === 0) {
    return true;
  }
  const base = getTopPartBaseDef(part.baseId);
  const modifierTags = part.modifiers.flatMap((modifier) => modifier.tags ?? []);
  const partTags = new Set<DriveTag>([...base.tags, ...modifierTags]);
  return targetTags.some((tag) => partTags.has(tag));
}

export function decideLootPolicy(part: TopPartInstance, verdict: PartVerdictProjection, policy: LootPolicy, equipped = false): LootPolicyDecision {
  if (equipped || verdict.action === "equipped") {
    return { action: "keep", reason: "equipped", verdict };
  }
  if (part.locked) {
    return { action: "keep", reason: "locked", verdict };
  }
  if (rarityRank[part.rarity] >= rarityRank.engraved) {
    return { action: "keep", reason: "protectedRarity", verdict };
  }
  if (verdict.action === "equip") {
    return { action: "keep", reason: "upgrade", verdict };
  }
  if (!policy.autoSalvage) {
    return { action: "keep", reason: verdict.action === "forge" ? "forgeCandidate" : "policyDisabled", verdict };
  }
  if (rarityRank[part.rarity] < rarityRank[policy.minRarity]) {
    return { action: "salvage", reason: "rarity", verdict };
  }
  if (!policy.targetSlots.includes(part.slot)) {
    return { action: "salvage", reason: "slot", verdict };
  }
  if (!partMatchesTargetTags(part, policy.targetTags)) {
    return { action: "salvage", reason: "tag", verdict };
  }
  if (part.itemLevel < policy.minItemLevel) {
    return { action: "salvage", reason: "itemLevel", verdict };
  }
  if (verdict.score < policy.minScore) {
    return { action: "salvage", reason: "score", verdict };
  }
  if (verdict.action === "forge") {
    return { action: "keep", reason: "forgeCandidate", verdict };
  }
  return { action: "keep", reason: "policyMatch", verdict };
}

export function loadoutWithPart(loadout: TopLoadoutConfig, part: TopPartInstance): TopLoadoutConfig {
  return {
    ...loadout,
    equipment: {
      ...(loadout.equipment ?? {}),
      [part.slot]: part,
    } as TopEquipment,
  };
}

export function evaluateLootPolicy({ frameId, driveId, loadout, policy, parts, equippedPartIds = new Set() }: LootPolicyEvaluationInput): LootPolicyEvaluation {
  const currentStats = resolveTopRuntimeStats(frameId, driveId, loadout);
  const keptParts: TopPartInstance[] = [];
  const salvagedParts: TopPartInstance[] = [];
  const decisions = new Map<string, LootPolicyDecision>();
  let wallet: AccountWallet = { ash: 0, glass: 0, echo: 0 };

  for (const part of parts) {
    const equipped = equippedPartIds.has(part.id);
    const previewStats = equipped ? currentStats : resolveTopRuntimeStats(frameId, driveId, loadoutWithPart(loadout, part));
    const verdict = selectPartVerdict(part, currentStats, previewStats, equipped);
    const decision = decideLootPolicy(part, verdict, policy, equipped);
    decisions.set(part.id, decision);
    if (decision.action === "salvage") {
      salvagedParts.push(part);
      wallet = walletAdd(wallet, salvageTopPart(part));
    } else {
      keptParts.push(part);
    }
  }

  return { keptParts, salvagedParts, decisions, wallet };
}
