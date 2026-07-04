import {
  Activity,
  AlertTriangle,
  Boxes,
  CircleDot,
  Flame,
  Gauge,
  Gem,
  Hammer,
  Map as MapIcon,
  Network,
  PackageOpen,
  Pause,
  Play,
  Radar,
  Recycle,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Swords,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { arenaCircuits, getArenaCircuitDef } from "../../data/arenaCircuits";
import { getArenaAnomalyDef } from "../../data/arenaAnomalies";
import { chapters } from "../../data/chapters";
import { circuitAtlasNodes, getCircuitAtlasNodeDef } from "../../data/circuitAtlasNodes";
import { circuitNetworkNodes } from "../../data/circuitNetwork";
import { doctrineForFrame, getDoctrineDef } from "../../data/doctrines";
import { driveCores, getDriveCoreDef } from "../../data/driveCores";
import { getNamedRivalDef, namedRivals } from "../../data/namedRivals";
import { talentNodes, getTalentNodeDef } from "../../data/talentNodes";
import { getTopFrameDef, topFrames } from "../../data/topFrames";
import { tutorialSteps, type TutorialStepDef, type TutorialTrigger } from "../../data/tutorialSteps";
import {
  createPartFromArenaDrop,
  createStarterEquipment,
  createStarterInventory,
  getTopPartBaseDef,
  partSlotLabels,
  partSlotOrder,
} from "../../data/topParts";
import { isRuneCompatible, tuningRunes } from "../../data/tuningRunes";
import {
  accountReducer,
  atlasPointTotal,
  availableAtlasPoints as resolveAvailableAtlasPoints,
  availableTalentPoints as resolveAvailableTalentPoints,
  canSpend,
  keyForgeCost,
  talentPointTotal,
  inventoryCapacity,
} from "../../engine/accountReducer";
import { accountStateToSaveTop, compactRuneSlots, saveTopToAccountState, toRuneSlots, type AccountRuntimeState, type AccountWallet } from "../../engine/accountState";
import { createTopArenaRuntime, defaultArenaTuning, stepTopArenaRuntime } from "../../engine/arenaRuntime";
import { generateArenaKey, summarizeArenaKeyRiskReward } from "../../engine/arenaKeys";
import { projectBossGateAttempt } from "../../engine/bossGate";
import { validateRuneLoadout } from "../../engine/driveRuneValidation";
import { clamp, formatNumber, formatPercent, round } from "../../engine/math";
import { resolveOfflineElapsedSeconds, resolveOfflineSettlement, type OfflineSettlementResult } from "../../engine/offlineSettlement";
import { resolveTopRuntimeStats } from "../../engine/topAssembly";
import {
  decideLootPolicy,
  evaluateLootPolicy,
  loadoutWithPart,
  lootPolicyDriveTags,
  lootPolicyRarities,
  selectPartVerdict,
  type LootPolicy,
  type LootPolicyDecision,
  type LootPolicyReason,
  type PartVerdictProjection,
} from "../../engine/lootPolicy";
import {
  addRandomEngraving,
  canApplyForgeAction,
  forgeActionCost,
  removeRandomEngraving,
  rerollTopPartAffixes,
  rerollTopPartValues,
  upgradeTopPartRarity,
  type TopCraftAction,
  type TopCraftResult,
} from "../../engine/topCrafting";
import { loadLocalSave, writeLocalSave } from "../../save/localStore";
import {
  dataDescription,
  dataName,
  formatTags,
  localizeEntityName,
  localizeDropLabel,
  modifierSourceLabel,
  t,
  term,
  translateRuntimeText,
} from "../../locale/zh-Hant";
import type {
  ArenaEffect,
  ArenaKey,
  ArenaAnomalyRule,
  ArenaTuningConfig,
  BossGateFailureReason,
  CombatEvent,
  CircuitAtlasNodeDef,
  CircuitNetworkNodeDef,
  DoctrineDef,
  DriveTag,
  TalentNodeDef,
  TopArenaRuntime,
  TopArenaDefeatCause,
  TopEquipment,
  TopLoadoutConfig,
  TopModifierDef,
  TopPartInstance,
  TopPartRarity,
  TopPartSlotId,
  TopResistanceBlock,
  TopRuntimeEntity,
  TopRuntimeStats,
  TopStatBlock,
  TuningRuneDef,
} from "../../engine/topTypes";
import { ArenaPhaserView, type ArenaRendererMetrics } from "./ArenaPhaserView";
import { TalentTreeView } from "./TalentTreeView";
import {
  selectAttackFrequency,
  selectBreakpointStatus,
  selectBuildArchetypeProjection,
  selectDpsBreakdown,
  selectDriveGateStatus,
  selectEquipCompare,
  selectESustain,
  selectFluxLow,
  selectFluxRatio,
  selectLifeRatio,
  selectOmega,
  selectRecommendedRunes,
  selectRouteStrategyRecommendations,
  selectRouteStrategyProjection,
  isFeatureUnlocked,
  selectVisibleNetworkNodeIds,
  shouldCollapseCircuitAtlas,
  type BreakpointStatus,
  type BuildArchetypeGap,
  type BuildArchetypeId,
  type FeatureUnlockId,
  type RouteRewardTarget,
  type RouteStrategyAction,
  type RouteStrategyReason,
} from "./runtimeSelectors";
import "./CombatArena.css";

type ArenaScreen = "home" | "combat" | "map" | "workbench";

type ActivePanel = "loadout" | "inventory" | "skills" | "forge" | "talents";

type LootNotice = {
  id: string;
  tone: "drop" | "salvage" | "reward";
  text: string;
  rarity?: TopPartRarity;
};

type OfflineReport = OfflineSettlementResult & {
  elapsedSeconds: number;
};

const initialRendererMetrics: ArenaRendererMetrics = {
  fps: 0,
  renderMs: 0,
  entities: 0,
  effects: 0,
  drops: 0,
  skippedFrames: 0,
  impactFlash: false,
  budget: "stable",
};

type DangerCue = {
  id: string;
  label: string;
  detail: string;
  progress: number;
  tone: "warn" | "danger" | "rare";
  priority: number;
};

type PartVerdict = {
  label: string;
  detail: string;
  tone: "neutral" | "good" | "warn" | "rare";
  action: "equip" | "forge" | "salvage" | "equipped";
  score: number;
};

type PartRetention = {
  label: string;
  detail: string;
  tone: "keep" | "upgrade" | "forge" | "salvage";
};

type DecisionCueTone = "neutral" | "good" | "warn" | "rare";

type DecisionCue = {
  label: string;
  value: string;
  tone?: DecisionCueTone;
};

type ArenaTuningKey = keyof ArenaTuningConfig;

type ArenaTuningControl = {
  key: ArenaTuningKey;
  min: number;
  max: number;
  step: number;
};

const arenaTuningControls: ArenaTuningControl[] = [
  { key: "basinPullMultiplier", min: 0.6, max: 2.4, step: 0.05 },
  { key: "collisionLaunchMultiplier", min: 0.6, max: 2.4, step: 0.05 },
  { key: "sparkMultiplier", min: 0.5, max: 2.1, step: 0.05 },
  { key: "activeEnemyPressure", min: 0.55, max: 1.65, step: 0.05 },
  { key: "bossWeightMultiplier", min: 0.75, max: 1.55, step: 0.05 },
  { key: "hitStopMultiplier", min: 0.35, max: 1.8, step: 0.05 },
];

type NextActionPrompt = {
  tone: DecisionCueTone;
  icon: ReactNode;
  label: string;
  detail: string;
  button: string;
  cues: [DecisionCue, DecisionCue, DecisionCue];
  onClick: () => void;
};

type ObjectiveSegmentState = "cleared" | "active" | "pending" | "boss";

const rarityTone: Record<TopPartRarity, "neutral" | "good" | "rare" | "warn"> = {
  common: "neutral",
  tuned: "good",
  engraved: "warn",
  relic: "rare",
};

const trackedStats: Array<keyof TopStatBlock> = ["spinIntegrity", "impact", "rpm", "guard", "tracking", "edge", "resonance", "partQuantity", "partRarity"];

const atlasNodePositions: Record<string, { x: number; y: number }> = {
  atlas_breach_calibrator: { x: 50, y: 84 },
  atlas_dense_rail: { x: 32, y: 68 },
  atlas_mapwright_cache: { x: 68, y: 68 },
  atlas_redline_artery: { x: 22, y: 49 },
  atlas_quench_line: { x: 42, y: 49 },
  atlas_splinter_switch: { x: 68, y: 48 },
  atlas_glass_lure: { x: 84, y: 49 },
  atlas_iron_basin: { x: 36, y: 29 },
  atlas_furnace_toll: { x: 60, y: 28 },
  atlas_storm_divider: { x: 78, y: 28 },
  atlas_boss_lantern: { x: 24, y: 24 },
  atlas_last_gate: { x: 50, y: 10 },
};

const networkNodePositions: Record<string, { x: number; y: number }> = {
  network_cinder_gate: { x: 12, y: 76 },
  network_molten_spur: { x: 25, y: 62 },
  network_glass_branch: { x: 26, y: 84 },
  network_rim_fortress: { x: 40, y: 82 },
  network_brass_judicator: { x: 53, y: 70 },
  network_molten_bastion: { x: 68, y: 58 },
  network_flux_monsoon: { x: 66, y: 82 },
  network_magnet_well: { x: 78, y: 78 },
  network_lattice_slip: { x: 86, y: 63 },
  network_phase_lattice: { x: 92, y: 48 },
  network_orbit_confluence: { x: 55, y: 90 },
  network_chancel_apex: { x: 78, y: 39 },
  network_mapwright_accord: { x: 72, y: 24 },
  network_null_tide: { x: 58, y: 12 },
  network_compression_ring: { x: 84, y: 13 },
  network_resonant_crush: { x: 70, y: 6 },
};

const rarityRank: Record<TopPartRarity, number> = {
  common: 0,
  tuned: 1,
  engraved: 2,
  relic: 3,
};

const lootPolicyScorePresets = [-50, -20, 0, 30] as const;
const lootPolicyItemLevelPresets = [1, 3, 5, 8] as const;

const enemyDangerWindows = {
  charger: 0.82,
  mineLayer: 0.95,
  bossJudicator: 1.18,
} as const;

function isPart(part: TopPartInstance | null | undefined): part is TopPartInstance {
  return Boolean(part);
}

function statLabel(stat: string): string {
  if (stat === "maxSpinIntegrity") {
    return term("stat", "spinIntegrity");
  }
  if (stat === "maxFluxGuard") {
    return term("stat", "fluxGuard");
  }
  if (["impact", "heat", "glass", "static", "void"].includes(stat)) {
    return term("damage", stat, stat);
  }
  return term("stat", stat, stat);
}

function formatStatValue(stat: string, value: number): string {
  if (["edge", "grip", "resonance", "inertiaBias", "partQuantity", "partRarity"].includes(stat)) {
    return formatPercent(value, 0);
  }
  if (stat === "fracture") {
    return `+${round(value, 2)}x`;
  }
  if (["rpm", "mass"].includes(stat)) {
    return formatNumber(value, 2);
  }
  return formatNumber(value, 0);
}

function statFromRuntime(stats: TopRuntimeStats, stat: keyof TopStatBlock): number {
  if (stat === "spinIntegrity") {
    return stats.maxSpinIntegrity;
  }
  if (stat === "fluxGuard") {
    return stats.maxFluxGuard;
  }
  return stats[stat] ?? 0;
}

function displaySlot(slot: TopPartSlotId): string {
  return term("slot", slot, partSlotLabels[slot]);
}

function displayRarity(rarity: TopPartRarity): string {
  return term("rarity", rarity, rarity);
}

function displayPartName(part: TopPartInstance): string {
  const base = getTopPartBaseDef(part.baseId);
  const prefix = base.uniqueEffect ? term("rarity", "unique") : displayRarity(part.rarity);
  const affixName = part.affixes?.[0] ? dataName("engraving", part.affixes[0].engravingId, part.affixes[0].displayName) : "";
  return [prefix, affixName, dataName("part", part.baseId, base.displayName)].filter(Boolean).join(" ");
}

function displayDropLabel(label: string, baseId?: string): string {
  return baseId ? dataName("part", baseId, label) : localizeDropLabel(label);
}

function displayDriveName(driveId: string, fallback: string): string {
  return dataName("drive", driveId, fallback);
}

function displayRuneName(rune: TuningRuneDef): string {
  return dataName("rune", rune.id, rune.displayName);
}

function displayFrameName(frameId: string, fallback: string): string {
  return dataName("frame", frameId, fallback);
}

function bossFailureLabel(reason: BossGateFailureReason): string {
  if (reason === "dps") {
    return term("stat", "dps", "DPS");
  }
  if (reason === "resistance") {
    return term("stat", "resistance", reason);
  }
  return term("stat", reason, reason);
}

function anomalyRuleLabel(rule: ArenaAnomalyRule | undefined): string {
  return rule ? t(`ui.anomaly.rule.${rule}`) : t("ui.anomaly.rule.none");
}

function routeStrategyActionLabel(action: RouteStrategyAction): string {
  switch (action) {
    case "locked":
      return "先解鎖";
    case "stabilize":
      return "先強化裝備";
    case "farm":
      return "安全刷場";
    case "duel":
      return "挑戰強敵";
    case "offline":
      return "適合離線";
    case "push":
    default:
      return "推下一關";
  }
}

function routeStrategyReasonLabel(reason: RouteStrategyReason): string {
  switch (reason) {
    case "locked":
      return "未解鎖";
    case "requiresBossGate":
      return "需要 Boss 挑戰";
    case "requiresRival":
      return "需要強敵";
    case "lowDamage":
      return "傷害不足";
    case "lowControl":
      return "控制不足";
    case "fragile":
      return "防線偏薄";
    case "ringout":
      return "出界風險";
    case "anomaly":
      return "特殊加壓";
    case "rival":
      return "強敵關卡";
    case "highReward":
      return "高收益";
    case "idleReady":
      return "離線穩定";
    case "safeFarm":
    default:
      return "安全農場";
  }
}

function routeRewardTargetLabel(target: RouteRewardTarget): string {
  switch (target) {
    case "parts":
      return "零件";
    case "forgeMedia":
      return "鍛材";
    case "keySustain":
      return "鑰匙";
    case "rivalUnique":
      return "名宿裝";
    case "bossFragment":
      return "Boss";
    case "atlasProgress":
    default:
      return "星圖";
  }
}

function buildArchetypeLabel(id: BuildArchetypeId): string {
  switch (id) {
    case "projectileClear":
      return "高速投射清圖";
    case "fireTrail":
      return "火痕持續控場";
    case "chainTrigger":
      return "連鎖觸發";
    case "heavyDuel":
      return "重撞決鬥";
    case "bossing":
      return "Boss 爆發";
    case "idleSafety":
    default:
      return "安全掛機";
  }
}

function buildArchetypeGapLabel(gap: BuildArchetypeGap): string {
  switch (gap) {
    case "lowClear":
      return "清場不足";
    case "lowBossing":
      return "單體不足";
    case "lowSafety":
      return "掛機偏危險";
    case "lowSynergy":
      return "符文不協同";
    case "highRisk":
    default:
      return "風險偏高";
  }
}

function formatPartVerdict(verdict: PartVerdictProjection): PartVerdict {
  if (verdict.action === "equipped") {
    return {
      label: t("ui.verdict.equipped"),
      detail: t("ui.verdict.equippedDetail"),
      tone: verdict.tone,
      action: verdict.action,
      score: verdict.score,
    };
  }

  if (verdict.action === "equip") {
    return {
      label: t("ui.verdict.upgrade"),
      detail: `分數 ${verdict.score >= 0 ? "+" : ""}${round(verdict.score, 0)} / ${term("stat", "impact")} ${verdict.impactDelta >= 0 ? "+" : ""}${formatNumber(verdict.impactDelta, 0)} / EHP ${verdict.ehpDelta >= 0 ? "+" : ""}${formatNumber(verdict.ehpDelta, 0)}`,
      tone: verdict.tone,
      action: verdict.action,
      score: verdict.score,
    };
  }

  if (verdict.action === "forge") {
    return {
      label: t("ui.verdict.forge"),
      detail: t("ui.verdict.forgeDetail", { score: `${verdict.score >= 0 ? "+" : ""}${round(verdict.score, 0)}` }),
      tone: verdict.tone,
      action: verdict.action,
      score: verdict.score,
    };
  }

  return {
    label: t("ui.verdict.salvage"),
    detail: t("ui.verdict.salvageDetail", { score: round(verdict.score, 0) }),
    tone: verdict.tone,
    action: verdict.action,
    score: verdict.score,
  };
}

function policyReasonText(reason: LootPolicyReason, verdict: PartVerdict): Pick<PartRetention, "label" | "detail" | "tone"> {
  switch (reason) {
    case "equipped":
      return { label: "已裝備", detail: verdict.detail, tone: "keep" };
    case "locked":
      return { label: "已鎖定", detail: "手動保留，不會自動拆解。", tone: "keep" };
    case "protectedRarity":
      return { label: "高稀有保留", detail: "銘刻與遺物不會被自動拆解。", tone: "forge" };
    case "upgrade":
      return { label: "推薦裝備", detail: verdict.detail, tone: "upgrade" };
    case "forgeCandidate":
      return { label: "推薦強化", detail: verdict.detail, tone: "forge" };
    case "rarity":
      return { label: "稀有度過低", detail: "低於目前戰利品規則設定。", tone: "salvage" };
    case "slot":
      return { label: "非目標槽位", detail: "這個槽位不在目前保留清單。", tone: "salvage" };
    case "tag":
      return { label: "非目標標籤", detail: "沒有符合目前追蹤的 build 標籤。", tone: "salvage" };
    case "itemLevel":
      return { label: "物品等級過低", detail: "低於目前戰利品規則設定。", tone: "salvage" };
    case "score":
      return { label: "分數過低", detail: verdict.detail, tone: "salvage" };
    case "policyMatch":
      return { label: "符合規則", detail: verdict.detail, tone: "keep" };
    case "policyDisabled":
    default:
      return verdict.action === "salvage"
        ? { label: "拆解候選", detail: "自動拆解尚未啟用，先保留供你確認。", tone: "salvage" }
        : { label: "保留", detail: verdict.detail, tone: "keep" };
  }
}

function formatPartRetention(decision: LootPolicyDecision, verdict: PartVerdict): PartRetention {
  return policyReasonText(decision.reason, verdict);
}

function formatStatLines(stats: TopStatBlock | undefined): string[] {
  return Object.entries(stats ?? {}).map(
    ([stat, value]) => `+${formatStatValue(stat, value ?? 0)} ${statLabel(stat)}`,
  );
}

function formatResistanceLines(resistances: TopResistanceBlock | undefined): string[] {
  return Object.entries(resistances ?? {}).map(([type, value]) => `+${formatPercent(value ?? 0, 0)} ${term("damage", type, type)}抗性`);
}

function formatModifierLine(modifier: TopModifierDef): string {
  if (modifier.type === "flat") {
    const stat = modifier.stat as keyof TopStatBlock;
    const label = statLabel(stat);
    return `+${formatStatValue(stat, modifier.value)} ${label}`;
  }
  if (modifier.type === "more") {
    return `${formatPercent(modifier.value, 0)} ${term("modifier", "more")} ${statLabel(modifier.stat)}`;
  }
  if (modifier.type === "less") {
    return `${formatPercent(modifier.value, 0)} ${term("modifier", "less")} ${statLabel(modifier.stat)}`;
  }
  if (modifier.type === "increased") {
    return `+${formatPercent(modifier.value, 0)} ${term("modifier", "increased")} ${statLabel(modifier.stat)}`;
  }
  if (modifier.type === "reduced") {
    return `${formatPercent(modifier.value, 0)} ${term("modifier", "reduced")} ${statLabel(modifier.stat)}`;
  }
  if (modifier.type === "penetration") {
    return `+${formatPercent(modifier.value, 0)} ${term("damage", modifier.stat, modifier.stat)}${term("modifier", "penetration")}`;
  }
  if (modifier.type === "extraAs" && modifier.fromDamageType && modifier.toDamageType) {
    return `${term("modifier", "extraAs")} ${formatPercent(modifier.value, 0)} ${term("damage", modifier.fromDamageType)} → ${term("damage", modifier.toDamageType)}`;
  }
  if (modifier.type === "conversion" && modifier.fromDamageType && modifier.toDamageType) {
    return `${term("modifier", "conversion")} ${formatPercent(modifier.value, 0)} ${term("damage", modifier.fromDamageType)} → ${term("damage", modifier.toDamageType)}`;
  }
  return `${term("modifier", modifier.type, modifier.type)} ${statLabel(modifier.stat)}`;
}

function formatPartLines(part: TopPartInstance): string[] {
  const uniqueEffect = getTopPartBaseDef(part.baseId).uniqueEffect;
  const uniqueLine = uniqueEffect ? dataDescription("unique", uniqueEffect.id, uniqueEffect.description) : undefined;
  return [...(uniqueLine ? [uniqueLine] : []), ...formatStatLines(part.statBonuses), ...formatResistanceLines(part.resistanceBonuses), ...part.modifiers.map(formatModifierLine)];
}

function formatRuneLines(rune: TuningRuneDef): string[] {
  return [...formatStatLines(rune.statBonuses), ...formatResistanceLines(rune.resistanceBonuses), ...rune.modifiers.map(formatModifierLine)];
}

function formatCombatEvent(event: CombatEvent): string {
  if (event.kind === "stance_shift") {
    return `${term("event", "stance_shift")}: 減免 ${formatNumber(event.magnitude, 1)}`;
  }
  const label = event.driveId ? `${term("event", event.kind)} / ${displayDriveName(event.driveId, event.driveId)}` : term("event", event.kind);
  return `${label}: ${formatNumber(event.magnitude, 1)}`;
}

function displaySourceName(sourceId: string): string {
  const drive = driveCores.find((entry) => sourceId.includes(entry.id));
  if (drive) {
    return displayDriveName(drive.id, drive.displayName);
  }
  const rune = tuningRunes.find((entry) => sourceId.includes(entry.id));
  if (rune) {
    return displayRuneName(rune);
  }
  const talent = talentNodes.find((entry) => sourceId.includes(entry.id));
  if (talent) {
    return dataName("talent", talent.id, talent.displayName);
  }
  const atlas = circuitAtlasNodes.find((entry) => sourceId.includes(entry.id));
  if (atlas) {
    return dataName("atlas", atlas.id, atlas.displayName);
  }
  const doctrine = doctrineForFrame("frame_swift_razor")
    .concat(doctrineForFrame("frame_ember_crucible"), doctrineForFrame("frame_storm_needle"))
    .flatMap((entry) => [entry, ...entry.nodes])
    .find((entry) => sourceId.includes(entry.id));
  if (doctrine) {
    return dataName("doctrine", doctrine.id, doctrine.displayName);
  }
  return modifierSourceLabel(sourceId);
}

function breakpointDeltaText(status: BreakpointStatus): string {
  if (status.triggered) {
    return t("ui.breakpoint.triggered");
  }
  const value = formatNumber(status.delta, status.attr === "spinEnergyRatio" || status.attr === "fluxRatio" ? 2 : 1);
  if (status.op === ">=" || status.op === ">") {
    return t("ui.breakpoint.needMore", { value });
  }
  return t("ui.breakpoint.needLess", { value });
}

function formatDefeatCause(cause?: TopArenaDefeatCause): string {
  if (cause === "spinout") {
    return t("ui.defeat.spinout");
  }
  if (cause === "break") {
    return t("ui.defeat.break");
  }
  if (cause === "ringout") {
    return t("ui.defeat.ringout");
  }
  return t("ui.defeat.default");
}

function formatDefeatDetail(cause?: TopArenaDefeatCause): string {
  if (cause === "spinout") {
    return t("ui.defeat.spinoutDetail");
  }
  if (cause === "break") {
    return t("ui.defeat.breakDetail");
  }
  if (cause === "ringout") {
    return t("ui.defeat.ringoutDetail");
  }
  return t("ui.defeat.defaultDetail");
}

function formatTalentLines(talent: TalentNodeDef): string[] {
  return [...formatStatLines(talent.statBonuses), ...formatResistanceLines(talent.resistanceBonuses), ...(talent.modifiers ?? []).map(formatModifierLine)];
}

function formatAtlasLines(node: CircuitAtlasNodeDef): string[] {
  const bonuses = node.bonuses;
  return [
    bonuses.enemyIntegrityMultiplier ? `敵人 ${formatPercent(bonuses.enemyIntegrityMultiplier - 1, 0)} ${term("stat", "spinIntegrity")}` : null,
    bonuses.enemyImpactMultiplier ? `敵人 ${formatPercent(bonuses.enemyImpactMultiplier - 1, 0)} ${term("stat", "impact")}` : null,
    bonuses.activeEnemyPressure ? `+${formatPercent(bonuses.activeEnemyPressure, 0)} 名宿壓力` : null,
    bonuses.rewardQuantity ? `+${formatPercent(bonuses.rewardQuantity, 0)} ${term("stat", "partQuantity")}` : null,
    bonuses.rewardRarity ? `+${formatPercent(bonuses.rewardRarity, 0)} ${term("stat", "partRarity")}` : null,
    bonuses.breachProgressGain ? `+${formatPercent(bonuses.breachProgressGain, 0)} 裂隙充能` : null,
    bonuses.breachDuration ? `+${round(bonuses.breachDuration, 0)}秒 裂隙軌` : null,
    bonuses.bossPhasePressure ? `+${formatPercent(bonuses.bossPhasePressure, 0)} Boss 階段壓力` : null,
    ...formatStatLines(bonuses.statBonuses),
    ...formatResistanceLines(bonuses.resistanceBonuses),
    ...(bonuses.modifiers ?? []).map(formatModifierLine),
  ].filter((line): line is string => Boolean(line));
}

function formatDoctrineLines(doctrine: DoctrineDef): string[] {
  return doctrine.nodes.flatMap((node) => [
    node.rule ? `${dataName("doctrine", node.id, node.displayName)}: ${node.rule}` : dataName("doctrine", node.id, node.displayName),
    ...formatStatLines(node.statBonuses),
    ...formatResistanceLines(node.resistanceBonuses),
    ...(node.modifiers ?? []).map(formatModifierLine),
  ]);
}

function distanceBetween(left: Pick<TopRuntimeEntity, "x" | "y">, right: Pick<TopRuntimeEntity, "x" | "y">): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function buildEnemyDangerCue(enemy: TopRuntimeEntity, player: TopRuntimeEntity): DangerCue | null {
  const behaviorId = enemy.behaviorId;
  if (!behaviorId || !(behaviorId in enemyDangerWindows)) {
    return null;
  }

  const window = enemyDangerWindows[behaviorId as keyof typeof enemyDangerWindows];
  if (enemy.cooldownRemaining > window) {
    return null;
  }

  const progress = 1 - clamp(enemy.cooldownRemaining / window, 0, 1);
  const seconds = Math.max(0, enemy.cooldownRemaining);
  const distance = distanceBetween(enemy, player);
  const label = behaviorId === "bossJudicator" ? "裁決者波次" : behaviorId === "mineLayer" ? "熔爐溝槽" : "紅線衝鋒";
  const tone = behaviorId === "bossJudicator" ? "rare" : progress > 0.72 || distance < enemy.radius + player.radius + 54 ? "danger" : "warn";

  return {
    id: `enemy_${enemy.id}_${behaviorId}`,
    label,
    detail: `${localizeEntityName(enemy.name)} / ${seconds.toFixed(1)}秒`,
    progress,
    tone,
    priority: (behaviorId === "bossJudicator" ? 4 : behaviorId === "charger" ? 3 : 2) + progress,
  };
}

function buildHazardDangerCue(effect: ArenaEffect, player: TopRuntimeEntity): DangerCue | null {
  if (effect.kind !== "hazard") {
    return null;
  }

  const armSeconds = 0.45;
  const dx = player.x - effect.x;
  const dy = player.y - effect.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const radius = 58 * effect.intensity;
  const armProgress = clamp(effect.age / armSeconds, 0, 1);

  if (effect.age < armSeconds && distance <= radius + 150) {
    return {
      id: `hazard_arm_${effect.id}`,
      label: "溝槽蓄熱",
      detail: `${(armSeconds - effect.age).toFixed(1)}秒後形成熱場`,
      progress: armProgress,
      tone: "warn",
      priority: 2.5 + armProgress,
    };
  }

  if (distance <= radius * 1.12) {
    return {
      id: `hazard_live_${effect.id}`,
      label: "熱場",
      detail: "離開溝槽",
      progress: 1,
      tone: "danger",
      priority: 4.8,
    };
  }

  return null;
}

function objectiveSegmentState(index: number, routeProgress: number): ObjectiveSegmentState {
  if (index === 8 && routeProgress >= 8) {
    return "boss";
  }
  if (index < routeProgress) {
    return "cleared";
  }
  if (index === routeProgress) {
    return "active";
  }
  return "pending";
}

function completeEquipment(
  saved: Partial<Record<TopPartSlotId, TopPartInstance | null>> | undefined,
  fallback: Record<TopPartSlotId, TopPartInstance>,
): Record<TopPartSlotId, TopPartInstance> {
  return partSlotOrder.reduce(
    (equipment, slot) => ({
      ...equipment,
      [slot]: saved?.[slot] ?? fallback[slot],
    }),
    {} as Record<TopPartSlotId, TopPartInstance>,
  );
}

function loadoutFromAccountState(state: AccountRuntimeState): TopLoadoutConfig {
  return {
    equipment: state.equipment,
    runeIds: compactRuneSlots(state.runeSlots),
    talentIds: state.talentIds,
    circuitAtlasNodeIds: state.circuitAtlasNodeIds,
    doctrineId: state.doctrineId,
  };
}

function formatCost(cost: AccountWallet): string {
  return [`${t("ui.resource.ash")} ${cost.ash}`, `${t("ui.resource.glass")} ${cost.glass}`, `${t("ui.resource.echo")} ${cost.echo}`].join(" / ");
}

function formatKeyTitle(key: ArenaKey): string {
  const arena = getArenaCircuitDef(key.arenaBaseId);
  return `T${key.tier} ${dataName("arena", arena.id, arena.displayName)}`;
}

function readDevOptionsEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("dev") === "1" || window.localStorage.getItem("echo-forge-dev") === "1" || window.localStorage.getItem("echoForgeDev") === "1";
  } catch {
    return false;
  }
}

function StatPill({
  icon,
  label,
  value,
  tone = "neutral",
  meter,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn" | "rare";
  meter?: number;
}) {
  const meterValue = typeof meter === "number" ? `${clamp(meter, 0, 1) * 100}%` : undefined;

  return (
    <div className={`arena-stat arena-stat-${tone}`}>
      <span className="arena-stat-icon" aria-hidden>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {meterValue ? (
          <span className="arena-stat-meter" aria-hidden>
            <i style={{ width: meterValue }} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PanelTab({ active, icon, label, onClick, tutorialAnchor }: { active: boolean; icon: ReactNode; label: string; onClick: () => void; tutorialAnchor?: string }) {
  return (
    <button aria-label={label} className={active ? "panel-tab panel-tab-active" : "panel-tab"} data-tutorial-anchor={tutorialAnchor} onClick={onClick} title={label} type="button">
      {icon}
      <span aria-hidden>{label}</span>
    </button>
  );
}

function ScreenTab({ active, icon, label, onClick, tutorialAnchor }: { active: boolean; icon: ReactNode; label: string; onClick: () => void; tutorialAnchor?: string }) {
  return (
    <button aria-label={label} className={active ? "screen-tab screen-tab-active" : "screen-tab"} data-tutorial-anchor={tutorialAnchor} onClick={onClick} title={label} type="button">
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TutorialCard({ replaying, step, onDismiss, onSkip }: { replaying: boolean; step: TutorialStepDef; onDismiss: () => void; onSkip: () => void }) {
  return (
    <aside className="tutorial-card" role="status" aria-live="polite">
      <div className="tutorial-card-head">
        <span>{replaying ? t("ui.tutorial.replay") : t("ui.chapter.cinder")}</span>
        <button className="icon-button" aria-label={t("ui.tutorial.skip")} onClick={onSkip} type="button">
          <X size={14} aria-hidden />
        </button>
      </div>
      <strong>{t(step.titleKey)}</strong>
      <p>{t(step.bodyKey)}</p>
      <button className="arena-button" onClick={onDismiss} type="button">
        <Sparkles size={15} aria-hidden />
        {t("ui.tutorial.next")}
      </button>
    </aside>
  );
}

function drivePhysicsLines(driveId: string): string[] {
  switch (driveId) {
    case "drive_shard_barrage":
      return ["刮擦 / 對撞：表面剪切與切向衝量會追加撞擊碎片。", "高轉速提高剪切，讓接觸觸發的碎片更可靠。"];
    case "drive_razor_rebound":
      return ["刮擦：切向衝量追加切削傷害。", "重擊：法向衝量追加反彈爆發。"];
    case "drive_ember_scour":
      return ["刮擦 / 磨削：表面剪切追加熱能。", "磨削：接觸時間提高燃燒壓力。"];
    case "drive_molten_groove":
      return ["磨削：持續高剪切接觸會留下熔融危害。", "抓地與轉速讓接觸更容易維持。"];
    case "drive_storm_lattice":
      return ["高火花：火花強度越過門檻時，靜電放電會導向接觸目標。", "轉速透過表面剪切提高火花強度。"];
    case "drive_chain_tempest":
      return ["重擊 / 重對撞：碰撞衝量會放大連鎖閃電。", "高火花強度可把重接觸轉成爆發窗口。"];
    default:
      return ["當觸發支援接觸時，碰撞資料可縮放此驅動。"];
  }
}

export function CombatArena() {
  const starterEquipment = useMemo(() => createStarterEquipment(), []);
  const starterInventory = useMemo(() => createStarterInventory(), []);
  const initialSave = useMemo(() => loadLocalSave(), []);
  const initialEquipment = useMemo(
    () => completeEquipment(initialSave.top.equipment as Partial<Record<TopPartSlotId, TopPartInstance | null>>, starterEquipment),
    [initialSave.top.equipment, starterEquipment],
  );
  const initialInventory = useMemo(
    () => ((initialSave.top.inventory as TopPartInstance[]).length > 0 ? (initialSave.top.inventory as TopPartInstance[]) : starterInventory),
    [initialSave.top.inventory, starterInventory],
  );
  const initialRuneSlots = useMemo(
    () => toRuneSlots(validateRuneLoadout(initialSave.top.selectedDriveId, initialSave.top.runeIds).validRuneIds),
    [initialSave.top.runeIds, initialSave.top.selectedDriveId],
  );
  const initialLoadout = useMemo<TopLoadoutConfig>(
    () => ({
      equipment: initialEquipment,
      runeIds: compactRuneSlots(initialRuneSlots),
      talentIds: initialSave.top.talentIds,
      circuitAtlasNodeIds: initialSave.top.circuitAtlasNodeIds ?? [],
      doctrineId: initialSave.top.doctrineId ?? null,
    }),
    [initialEquipment, initialRuneSlots, initialSave.top.circuitAtlasNodeIds, initialSave.top.doctrineId, initialSave.top.talentIds],
  );
  const initialAccountState = useMemo(
    () =>
      saveTopToAccountState(
        {
          ...initialSave.top,
          equipment: initialEquipment,
          inventory: initialInventory,
          runeIds: compactRuneSlots(initialRuneSlots),
          circuitAtlasNodeIds: initialSave.top.circuitAtlasNodeIds ?? [],
          doctrineId: initialSave.top.doctrineId ?? null,
          arenaKeys: initialSave.top.arenaKeys as ArenaKey[],
          totalKills: initialSave.top.totalKills ?? 0,
        },
        initialEquipment,
      ),
    [initialEquipment, initialInventory, initialRuneSlots, initialSave.top],
  );
  const saveShellRef = useRef(initialSave);
  const [account, dispatchAccount] = useReducer(accountReducer, initialAccountState);
  const { frameId, driveId, arenaId, equipment, inventory, runeSlots, talentIds, circuitAtlasNodeIds, doctrineId, wallet, arenaKeys, clearedBossGateIds, clearedRivalIds, routeClears, totalKills, seenTutorialIds, lootPolicy } = account;
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(false);
  const [showDebugHud, setShowDebugHud] = useState(false);
  const [showTuningHud, setShowTuningHud] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [combatDataExpanded, setCombatDataExpanded] = useState(false);
  const devOptionsEnabled = useMemo(() => readDevOptionsEnabled(), []);
  const [arenaTuning, setArenaTuning] = useState<ArenaTuningConfig>(defaultArenaTuning);
  const [rendererMetrics, setRendererMetrics] = useState<ArenaRendererMetrics>(initialRendererMetrics);
  const [screen, setScreen] = useState<ArenaScreen>("home");
  const [activePanel, setActivePanel] = useState<ActivePanel>("loadout");
  const [tutorialReplayStepId, setTutorialReplayStepId] = useState<string | null>(null);
  const [inventoryFilter, setInventoryFilter] = useState<TopPartSlotId | "all">("all");
  const [selectedPartId, setSelectedPartId] = useState(initialInventory[0]?.id ?? initialEquipment.core.id);
  const [selectedRuneSocket, setSelectedRuneSocket] = useState(0);
  const [runeCatalogExpanded, setRuneCatalogExpanded] = useState(false);
  const [selectedTalentId, setSelectedTalentId] = useState(talentNodes[0].id);
  const [selectedAtlasNodeId, setSelectedAtlasNodeId] = useState(circuitAtlasNodes[0].id);
  const [selectedNetworkNodeId, setSelectedNetworkNodeId] = useState(circuitNetworkNodes[0].id);
  const [selectedArenaKeyId, setSelectedArenaKeyId] = useState<string | null>((initialSave.top.arenaKeys as ArenaKey[])[0]?.id ?? null);
  const [selectedOfflineNodeId, setSelectedOfflineNodeId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [doctrineExpanded, setDoctrineExpanded] = useState(false);
  const [clearsExpanded, setClearsExpanded] = useState(false);
  const [currentArenaKey, setCurrentArenaKey] = useState<ArenaKey | null>(null);
  const [activeAnomalyId, setActiveAnomalyId] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [lootNotices, setLootNotices] = useState<LootNotice[]>([]);
  const [offlineReport, setOfflineReport] = useState<OfflineReport | null>(null);
  const seenDropIdsRef = useRef(new Set<string>());
  const lastKillRef = useRef({ seed: "", kills: 0 });
  const lastRouteClearRef = useRef({ seed: "", routeClears: 0 });
  const lastDuelVictoryRef = useRef("");
  const offlineSettlementAppliedRef = useRef(false);
  const runeIds = useMemo(() => compactRuneSlots(runeSlots), [runeSlots]);

  const openPanel = useCallback((panel: ActivePanel) => {
    setActivePanel(panel);
    setScreen("workbench");
    setInspectorOpen(false);
  }, []);

  const openMap = useCallback(() => {
    setScreen("map");
    setInspectorOpen(false);
  }, []);

  const makeLoadout = useCallback(
    (
      nextEquipment: TopEquipment = equipment,
      nextRuneIds = runeIds,
      nextTalentIds = talentIds,
      nextCircuitAtlasNodeIds = circuitAtlasNodeIds,
      nextDoctrineId: string | null = doctrineId,
      nextAnomalyId: string | null = activeAnomalyId,
    ): TopLoadoutConfig => ({
      equipment: nextEquipment,
      runeIds: nextRuneIds,
      talentIds: nextTalentIds,
      circuitAtlasNodeIds: nextCircuitAtlasNodeIds,
      doctrineId: nextDoctrineId,
      anomalyId: nextAnomalyId,
    }),
    [activeAnomalyId, circuitAtlasNodeIds, doctrineId, equipment, runeIds, talentIds],
  );

  const [runtime, setRuntime] = useState(() =>
    createTopArenaRuntime({
      arenaId: initialSave.top.selectedArenaId,
      frameId: initialSave.top.selectedFrameId,
      driveId: initialSave.top.selectedDriveId,
      loadout: initialLoadout,
      seed: `arena_${Date.now()}`,
    }),
  );
  const runtimeRef = useRef(runtime);
  const arenaTuningRef = useRef(arenaTuning);

  const publishRuntime = useCallback((nextRuntime: TopArenaRuntime) => {
    runtimeRef.current = nextRuntime;
    setRuntime(nextRuntime);
  }, []);

  const frame = useMemo(() => getTopFrameDef(frameId), [frameId]);
  const drive = useMemo(() => getDriveCoreDef(driveId), [driveId]);
  const arena = useMemo(() => getArenaCircuitDef(arenaId), [arenaId]);
  const loadout = useMemo(() => makeLoadout(), [makeLoadout]);
  const selectedArenaKey = useMemo(() => arenaKeys.find((key) => key.id === selectedArenaKeyId) ?? null, [arenaKeys, selectedArenaKeyId]);
  const selectedArenaKeySummary = useMemo(() => (selectedArenaKey ? summarizeArenaKeyRiskReward(selectedArenaKey) : null), [selectedArenaKey]);
  const currentArenaKeySummary = useMemo(() => (currentArenaKey ? summarizeArenaKeyRiskReward(currentArenaKey) : null), [currentArenaKey]);
  const bossProjection = useMemo(
    () =>
      projectBossGateAttempt({
        gateId: "boss_gate_brass_judicator",
        frameId,
        driveId,
        loadout,
        arenaKey: selectedArenaKey ?? undefined,
      }),
    [driveId, frameId, loadout, selectedArenaKey],
  );
  const allKnownParts = useMemo(() => [...inventory, ...Object.values(equipment).filter(isPart)], [equipment, inventory]);
  const filteredInventory = useMemo(
    () => (inventoryFilter === "all" ? inventory : inventory.filter((part) => part.slot === inventoryFilter)),
    [inventory, inventoryFilter],
  );
  const inventoryCells = useMemo(
    () => Array.from({ length: inventoryCapacity }, (_, index) => filteredInventory[index] ?? null),
    [filteredInventory],
  );
  const lootPolicyPreview = useMemo(
    () =>
      evaluateLootPolicy({
        frameId,
        driveId,
        loadout,
        policy: { ...lootPolicy, autoSalvage: true },
        parts: inventory,
      }),
    [driveId, frameId, inventory, loadout, lootPolicy],
  );
  const selectedPart = allKnownParts.find((part) => part.id === selectedPartId) ?? inventory[0] ?? equipment.core;
  const selectedCurrentPart = selectedPart ? equipment[selectedPart.slot] : null;
  const selectedRuneId = runeSlots[selectedRuneSocket];
  const selectedRune = selectedRuneId ? tuningRunes.find((entry) => entry.id === selectedRuneId) : null;
  const currentStats = useMemo(() => resolveTopRuntimeStats(frameId, driveId, loadout), [driveId, frameId, loadout]);
  const previewStats = useMemo(() => {
    if (!selectedPart) {
      return currentStats;
    }
    return resolveTopRuntimeStats(frameId, driveId, makeLoadout({ ...equipment, [selectedPart.slot]: selectedPart }));
  }, [currentStats, driveId, equipment, frameId, makeLoadout, selectedPart]);
  const playerIntegrity = selectLifeRatio(runtime.player);
  const playerFluxRatio = selectFluxRatio(runtime.player);
  const playerFluxLow = selectFluxLow(runtime.player);
  const runtimeDefeated = runtime.outcome === "defeat";
  const defeatCauseLabel = formatDefeatCause(runtime.defeatCause);
  const defeatCauseDetail = formatDefeatDetail(runtime.defeatCause);
  const playerOmega = selectOmega(runtime.player);
  const playerAttackFrequency = selectAttackFrequency(runtime.player);
  const target = runtime.enemies[0] ?? null;
  const targetIntegrity = target ? selectLifeRatio(target) : 0;
  const bossEnemy = runtime.enemies.find((enemy) => enemy.rank === "boss") ?? null;
  const bossIntegrity = bossEnemy ? selectLifeRatio(bossEnemy) : 0;
  const eliteEnemies = runtime.enemies.filter((enemy) => enemy.rank === "elite").slice(0, 4);
  const dpsTarget = bossEnemy ?? target;
  const dpsBreakdown = selectDpsBreakdown(runtime.player, runtime.combatEvents, driveId, { arenaId, frameId, driveId, loadout, targetStats: dpsTarget?.stats, targetName: dpsTarget?.name });
  const damageModifierLines = dpsBreakdown.lines.filter((line) => !["base", "crit", "frequency", "dps"].includes(line.type));
  const breakpointStatuses = selectBreakpointStatus(runtime.player, driveId, runtime.combatEvents);
  const equipCompare = useMemo(() => selectEquipCompare(currentStats, previewStats, driveId), [currentStats, driveId, previewStats]);
  const eSustain = selectESustain(runtime.player);
  const driveGateStatus = selectDriveGateStatus(runtime.player, driveId, runtime.combatEvents);
  const cooldownRatio = drive.baseCooldown > 0 ? 1 - clamp(runtime.player.cooldownRemaining / drive.baseCooldown, 0, 1) : 1;
  const routeMechanic = runtime.routeMechanic;
  const routeMechanicProgress = routeMechanic ? clamp(routeMechanic.progress / routeMechanic.maxProgress, 0, 1) : 0;
  const activeAnomaly = runtime.loadout.anomalyId ? getArenaAnomalyDef(runtime.loadout.anomalyId) : null;
  const dangerCue = useMemo(() => {
    const cues = [
      ...runtime.enemies.map((enemy) => buildEnemyDangerCue(enemy, runtime.player)),
      ...runtime.effects.map((effect) => buildHazardDangerCue(effect, runtime.player)),
      playerIntegrity < 0.24
        ? {
            id: "player_integrity_low",
            label: "結構危急",
            detail: `剩餘 ${formatPercent(playerIntegrity, 0)}`,
            progress: 1 - playerIntegrity,
            tone: "danger" as const,
            priority: 5.2,
          }
        : null,
    ].filter((cue): cue is DangerCue => Boolean(cue));

    return cues.sort((left, right) => right.priority - left.priority)[0] ?? null;
  }, [playerIntegrity, runtime.effects, runtime.enemies, runtime.player]);
  const lastCollision = runtime.lastCollision;
  const collisionDebugClass = lastCollision ? `collision-debug collision-debug-${lastCollision.kind}` : "collision-debug collision-debug-idle";
  const talentPoints = talentPointTotal(totalKills);
  const availableTalentPoints = resolveAvailableTalentPoints({ talentIds, totalKills });
  const atlasPoints = atlasPointTotal(totalKills, routeClears);
  const availableAtlasPoints = resolveAvailableAtlasPoints({ circuitAtlasNodeIds, routeClears, totalKills });
  const rivalById = useMemo(() => new Map(namedRivals.map((rival) => [rival.id, rival])), []);
  const unlockedCircuitNodeIds = useMemo(() => {
    const byId = new Map(circuitNetworkNodes.map((node) => [node.id, node]));
    const memo = new Map<string, boolean>();
    const isUnlocked = (nodeId: string, visiting = new Set<string>()): boolean => {
      if (memo.has(nodeId)) {
        return memo.get(nodeId)!;
      }
      if (visiting.has(nodeId)) {
        return false;
      }
      const node = byId.get(nodeId);
      if (!node) {
        return false;
      }
      visiting.add(nodeId);
      const prerequisitesMet = (node.requiredNodeIds ?? []).every((requiredId) => isUnlocked(requiredId, visiting));
      visiting.delete(nodeId);
      const unlocked =
        prerequisitesMet &&
        (!node.requiredBossGateId || clearedBossGateIds.includes(node.requiredBossGateId)) &&
        (!node.requiredRivalId || clearedRivalIds.includes(node.requiredRivalId));
      memo.set(nodeId, unlocked);
      return unlocked;
    };

    return new Set(circuitNetworkNodes.filter((node) => isUnlocked(node.id)).map((node) => node.id));
  }, [clearedBossGateIds, clearedRivalIds]);
  const visibleNetworkNodeIds = useMemo(() => selectVisibleNetworkNodeIds(circuitNetworkNodes, unlockedCircuitNodeIds), [unlockedCircuitNodeIds]);
  const selectedNetworkNode = useMemo(
    () => circuitNetworkNodes.find((node) => node.id === selectedNetworkNodeId && visibleNetworkNodeIds.has(node.id)) ?? circuitNetworkNodes.find((node) => visibleNetworkNodeIds.has(node.id)) ?? circuitNetworkNodes[0]!,
    [selectedNetworkNodeId, visibleNetworkNodeIds],
  );
  const routeStrategyByNodeId = useMemo(
    () =>
      new Map(
        circuitNetworkNodes.map((node) => [
          node.id,
          selectRouteStrategyProjection({
            node,
            frameId,
            driveId,
            loadout,
            unlockedNodeIds: unlockedCircuitNodeIds,
            clearedBossGateIds,
            clearedRivalIds,
            partQuantity: currentStats.partQuantity,
            partRarity: currentStats.partRarity,
          }),
        ]),
      ),
    [clearedBossGateIds, clearedRivalIds, currentStats.partQuantity, currentStats.partRarity, driveId, frameId, loadout, unlockedCircuitNodeIds],
  );
  const selectedRouteStrategy =
    routeStrategyByNodeId.get(selectedNetworkNode.id) ??
    selectRouteStrategyProjection({
        node: selectedNetworkNode,
        frameId,
        driveId,
        loadout,
        unlockedNodeIds: unlockedCircuitNodeIds,
        clearedBossGateIds,
        clearedRivalIds,
        partQuantity: currentStats.partQuantity,
        partRarity: currentStats.partRarity,
      });
  const activeRunes = useMemo(() => runeIds.map((runeId) => tuningRunes.find((entry) => entry.id === runeId)).filter((rune): rune is TuningRuneDef => Boolean(rune)), [runeIds]);
  const buildArchetypeProjection = useMemo(
    () =>
      selectBuildArchetypeProjection({
        drive,
        runes: activeRunes,
        stats: currentStats,
        dps: dpsBreakdown,
        routeStrategy: selectedRouteStrategy,
      }),
    [activeRunes, currentStats, dpsBreakdown, drive, selectedRouteStrategy],
  );
  const routeRecommendations = useMemo(
    () =>
      selectRouteStrategyRecommendations({
        nodes: circuitNetworkNodes,
        visibleNodeIds: visibleNetworkNodeIds,
        unlockedNodeIds: unlockedCircuitNodeIds,
        strategyByNodeId: routeStrategyByNodeId,
      }),
    [routeStrategyByNodeId, unlockedCircuitNodeIds, visibleNetworkNodeIds],
  );
  const recommendedOfflineNode = routeRecommendations.offlineNodeId ? circuitNetworkNodes.find((node) => node.id === routeRecommendations.offlineNodeId) ?? null : null;
  const recommendedProgressNode = routeRecommendations.progressNodeId ? circuitNetworkNodes.find((node) => node.id === routeRecommendations.progressNodeId) ?? null : null;
  const offlineReportNode = useMemo(
    () => (offlineReport?.circuitNodeId ? circuitNetworkNodes.find((node) => node.id === offlineReport.circuitNodeId) ?? null : null),
    [offlineReport?.circuitNodeId],
  );
  const shouldShowAtlasSummary = shouldCollapseCircuitAtlas(availableAtlasPoints, circuitAtlasNodeIds);
  const ownedRuneIds = useMemo(() => new Set(runeIds), [runeIds]);
  const visibleRunes = useMemo(
    () => selectRecommendedRunes(tuningRunes, ownedRuneIds, runeCatalogExpanded, { driveTags: drive.tags, buildArchetype: buildArchetypeProjection }),
    [buildArchetypeProjection, drive.tags, ownedRuneIds, runeCatalogExpanded],
  );
  const chapterOne = chapters[0]!;
  const chapterProgress = useMemo(() => {
    const nodeDone = chapterOne.nodeIds.filter((nodeId) => unlockedCircuitNodeIds.has(nodeId)).length;
    const rivalDone = chapterOne.rivalIds.filter((rivalId) => clearedRivalIds.includes(rivalId)).length;
    const bossDone = clearedBossGateIds.includes(chapterOne.bossGateId) ? 1 : 0;
    const total = chapterOne.nodeIds.length + chapterOne.rivalIds.length + 1;
    const done = nodeDone + rivalDone + bossDone;
    return {
      done,
      total,
      ratio: total > 0 ? done / total : 0,
      complete: done >= total,
    };
  }, [chapterOne, clearedBossGateIds, clearedRivalIds, unlockedCircuitNodeIds]);

  const resetArena = useCallback(
    (
      nextFrameId = frameId,
      nextDriveId = driveId,
      nextArenaId = arenaId,
      nextLoadout = makeLoadout(),
      nextArenaKey: ArenaKey | null = currentArenaKey,
      nextMode: TopArenaRuntime["mode"] = runtimeRef.current.mode,
      nextRivalId: string | null = null,
    ) => {
      setRuntimeError(null);
      setCurrentArenaKey(nextArenaKey);
      publishRuntime(
        createTopArenaRuntime({
          arenaId: nextArenaId,
          frameId: nextFrameId,
          driveId: nextDriveId,
          loadout: nextLoadout,
          arenaKey: nextArenaKey ?? undefined,
          mode: nextMode,
          rivalId: nextRivalId ?? undefined,
          seed: `arena_${nextMode}_${nextRivalId ?? "open"}_${nextFrameId}_${nextDriveId}_${nextArenaId}_${Date.now()}`,
        }),
      );
    },
    [arenaId, currentArenaKey, driveId, frameId, makeLoadout, publishRuntime],
  );

  const resetCurrentRun = useCallback(() => {
    setRunning(false);
    resetArena();
  }, [resetArena]);

  const selectFrame = (nextFrameId: string) => {
    const action = { type: "selectFrame", frameId: nextFrameId } as const;
    const nextState = accountReducer(account, action);
    dispatchAccount(action);
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState));
  };

  const selectDrive = (nextDriveId: string) => {
    const action = { type: "selectDrive", driveId: nextDriveId } as const;
    const nextState = accountReducer(account, action);
    dispatchAccount(action);
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState));
  };

  const selectArena = (nextArenaId: string) => {
    const action = { type: "selectArena", arenaId: nextArenaId } as const;
    const nextState = accountReducer(account, action);
    dispatchAccount(action);
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState), null);
  };

  const inspectPart = (partId: string) => {
    setSelectedPartId(partId);
    setInspectorOpen(true);
  };

  const inspectRuneSocket = (socketIndex: number) => {
    setSelectedRuneSocket(socketIndex);
    setInspectorOpen(true);
  };

  const inspectTalent = (talentId: string) => {
    setSelectedTalentId(talentId);
    setInspectorOpen(true);
  };

  const inspectAtlasNode = (nodeId: string) => {
    setSelectedAtlasNodeId(nodeId);
    setInspectorOpen(true);
  };

  const inspectNetworkNode = (nodeId: string) => {
    if (!visibleNetworkNodeIds.has(nodeId)) {
      return;
    }
    setSelectedNetworkNodeId(nodeId);
  };

  const inspectArenaKey = (keyId: string) => {
    setSelectedArenaKeyId(keyId);
    setInspectorOpen(true);
  };

  const selectOfflineNode = (nodeId: string) => {
    const node = circuitNetworkNodes.find((entry) => entry.id === nodeId);
    if (!node) {
      return;
    }
    setSelectedOfflineNodeId(node.id);
    setSelectedNetworkNodeId(node.id);
    if (node.arenaId !== arenaId) {
      selectArena(node.arenaId);
    }
  };

  const updateLootPolicy = (patch: Partial<LootPolicy>) => {
    dispatchAccount({ type: "updateLootPolicy", policy: { ...lootPolicy, ...patch } });
  };

  const toggleLootPolicySlot = (slot: TopPartSlotId) => {
    const active = lootPolicy.targetSlots.includes(slot);
    const targetSlots = active ? lootPolicy.targetSlots.filter((entry) => entry !== slot) : [...lootPolicy.targetSlots, slot];
    if (targetSlots.length === 0) {
      return;
    }
    updateLootPolicy({ targetSlots });
  };

  const toggleLootPolicyTag = (tag: DriveTag) => {
    const active = lootPolicy.targetTags.includes(tag);
    const targetTags = active ? lootPolicy.targetTags.filter((entry) => entry !== tag) : [...lootPolicy.targetTags, tag];
    updateLootPolicy({ targetTags });
  };

  const continueOfflineRoute = () => {
    setOfflineReport(null);
    const node = offlineReportNode ?? (selectedOfflineNodeId ? circuitNetworkNodes.find((entry) => entry.id === selectedOfflineNodeId) ?? null : null) ?? recommendedOfflineNode;
    if (node) {
      selectOfflineNode(node.id);
    }
    openMap();
  };

  const switchToRecommendedOfflineRoute = () => {
    setOfflineReport(null);
    if (recommendedOfflineNode) {
      selectOfflineNode(recommendedOfflineNode.id);
    }
    openMap();
  };

  const inspectRecommendedProgressRoute = () => {
    setOfflineReport(null);
    if (recommendedProgressNode) {
      setSelectedNetworkNodeId(recommendedProgressNode.id);
      if (recommendedProgressNode.arenaId !== arenaId) {
        selectArena(recommendedProgressNode.arenaId);
      }
    }
    openMap();
  };

  const openOfflineWorkbench = () => {
    setOfflineReport(null);
    openPanel(offlineReport && offlineReport.parts.length > 0 ? "inventory" : "forge");
  };

  const equipPart = (part: TopPartInstance) => {
    const action = { type: "equipPart", part } as const;
    const nextState = accountReducer(account, action);
    dispatchAccount(action);
    setSelectedPartId(part.id);
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState));
  };

  const toggleLock = (partId: string) => {
    dispatchAccount({ type: "toggleLock", partId });
  };

  const salvagePart = (part: TopPartInstance) => {
    const action = { type: "salvagePart", partId: part.id } as const;
    const nextState = accountReducer(account, action);
    if (nextState === account) {
      return;
    }
    dispatchAccount(action);
    if (selectedPartId === part.id) {
      setSelectedPartId(nextState.inventory[0]?.id ?? nextState.equipment.core.id);
    }
  };

  const applyCraftResult = (sourcePart: TopPartInstance, result: TopCraftResult) => {
    const action = { type: "applyCraft", sourcePartId: sourcePart.id, result } as const;
    const nextState = accountReducer(account, action);
    if (nextState === account) {
      return;
    }
    dispatchAccount(action);
    setSelectedPartId(result.part.id);
    if (account.equipment[sourcePart.slot]?.id === sourcePart.id) {
      resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState), currentArenaKey);
    }
    setLootNotices((current) => [
      {
        id: `craft_${result.part.id}`,
        tone: "reward" as const,
        text: `已強化 ${displayPartName(result.part)}`,
      },
      ...current,
    ].slice(0, 8));
  };

  const craftSelectedPart = (action: TopCraftAction) => {
    if (!selectedPart) {
      return;
    }
    const seed = `${action}_${selectedPart.id}_${Date.now()}`;
    const result =
      action === "upgrade"
        ? upgradeTopPartRarity(selectedPart, seed)
        : action === "rerollAffixes"
          ? rerollTopPartAffixes(selectedPart, seed)
          : action === "rerollValues"
            ? rerollTopPartValues(selectedPart, seed)
            : action === "add"
              ? addRandomEngraving(selectedPart, seed)
              : removeRandomEngraving(selectedPart, seed);

    applyCraftResult(selectedPart, result);
  };

  const forgeArenaKey = () => {
    const key = generateArenaKey({
      arenaBaseId: arenaId,
      tier: arena.tier,
      rarity: "tuned",
      quality: Math.min(20, arena.tier * 4),
      seed: `manual_key_${arenaId}_${Date.now()}`,
      bossGateId: arena.tier >= 3 ? "boss_gate_brass_judicator" : undefined,
    });
    const action = { type: "forgeArenaKey", key, cost: keyForgeCost } as const;
    const nextState = accountReducer(account, action);
    if (nextState === account) {
      return;
    }
    dispatchAccount(action);
    setSelectedArenaKeyId(key.id);
    setLootNotices((current) => [{ id: `manual_key_${key.id}`, tone: "reward" as const, text: `已製作關卡鑰匙：${formatKeyTitle(key)}` }, ...current].slice(0, 8));
  };

  const runSelectedArenaKey = () => {
    if (!selectedArenaKey) {
      return;
    }
    const action = { type: "runArenaKey", keyId: selectedArenaKey.id } as const;
    const nextState = accountReducer(account, action);
    dispatchAccount(action);
    setSelectedArenaKeyId(nextState.arenaKeys[0]?.id ?? null);
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState), selectedArenaKey, "route");
  };

  const attemptBossGate = () => {
    setRunning(false);
    setActiveAnomalyId(null);
    setScreen("combat");
    resetArena(frameId, driveId, arenaId, loadout, currentArenaKey, "duel");
    setLootNotices((current) => [
        {
          id: `boss_duel_${Date.now()}`,
          tone: "reward" as const,
          text: `決鬥門已開啟：推估 ${formatPercent(bossProjection.successChance, 0)}`,
        },
      ...current,
    ].slice(0, 8));
  };

  const startRivalDuel = (rivalId: string) => {
    const rival = getNamedRivalDef(rivalId);
    const node = circuitNetworkNodes.find((entry) => entry.id === rival.circuitNodeId);
    const nextArenaId = node?.arenaId ?? arenaId;
    const action = { type: "selectArena", arenaId: nextArenaId } as const;
    const nextState = nextArenaId === arenaId ? account : accountReducer(account, action);
    if (nextArenaId !== arenaId) {
      dispatchAccount(action);
    }

    setRunning(false);
    setActiveAnomalyId(null);
    setScreen("combat");
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState), null, "duel", rival.id);
    setLootNotices((current) =>
      [
        {
          id: `rival_duel_${rival.id}_${Date.now()}`,
          tone: "reward" as const,
          text: `名宿決鬥已開啟：${dataName("rival", rival.id, rival.displayName)}`,
        },
        ...current,
      ].slice(0, 8),
    );
  };

  const startAnomalyRoute = (anomalyId: string, nextArenaId = arenaId) => {
    const anomaly = getArenaAnomalyDef(anomalyId);
    const action = { type: "selectArena", arenaId: nextArenaId } as const;
    const nextState = nextArenaId === arenaId ? account : accountReducer(account, action);
    if (nextArenaId !== arenaId) {
      dispatchAccount(action);
    }

    setRunning(false);
    setActiveAnomalyId(anomalyId);
    setScreen("combat");
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, { ...loadoutFromAccountState(nextState), anomalyId }, nextArenaId === arenaId ? currentArenaKey : null, "route");
    setLootNotices((current) =>
      [
        {
          id: `anomaly_${anomalyId}_${Date.now()}`,
          tone: "reward" as const,
          text: `${dataName("anomaly", anomaly.id, anomaly.displayName)}特殊關卡已開啟`,
        },
        ...current,
      ].slice(0, 8),
    );
  };

  const assignRuneToSocket = (runeId: string, socketIndex = selectedRuneSocket) => {
    const nextSocketIndex = Math.max(0, Math.min(2, socketIndex));
    const action = { type: "assignRune", runeId, socketIndex: nextSocketIndex } as const;
    const nextState = accountReducer(account, action);
    if (nextState === account) {
      return;
    }
    setSelectedRuneSocket(nextSocketIndex);
    dispatchAccount(action);
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState));
  };

  const clearRuneSocket = (socketIndex = selectedRuneSocket) => {
    const nextSocketIndex = Math.max(0, Math.min(2, socketIndex));
    const action = { type: "clearRuneSocket", socketIndex: nextSocketIndex } as const;
    const nextState = accountReducer(account, action);
    if (nextState === account) {
      setSelectedRuneSocket(nextSocketIndex);
      return;
    }
    setSelectedRuneSocket(nextSocketIndex);
    dispatchAccount(action);
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState));
  };

  const canRefundTalent = (talentId: string): boolean => accountReducer(account, { type: "refundTalent", talentId }).talentIds !== talentIds;

  const canAllocateTalent = (talentId: string): boolean => accountReducer(account, { type: "allocateTalent", talentId }).talentIds !== talentIds;

  const toggleTalent = (talentId: string) => {
    const action = talentIds.includes(talentId) ? ({ type: "refundTalent", talentId } as const) : ({ type: "allocateTalent", talentId } as const);
    const nextState = accountReducer(account, action);
    if (nextState === account) {
      return;
    }
    dispatchAccount(action);
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState));
  };

  const canRefundAtlasNode = (nodeId: string): boolean => accountReducer(account, { type: "refundAtlasNode", nodeId }).circuitAtlasNodeIds !== circuitAtlasNodeIds;

  const canAllocateAtlasNode = (nodeId: string): boolean => accountReducer(account, { type: "allocateAtlasNode", nodeId }).circuitAtlasNodeIds !== circuitAtlasNodeIds;

  const toggleAtlasNode = (nodeId: string) => {
    const action = circuitAtlasNodeIds.includes(nodeId) ? ({ type: "refundAtlasNode", nodeId } as const) : ({ type: "allocateAtlasNode", nodeId } as const);
    const nextState = accountReducer(account, action);
    if (nextState === account) {
      return;
    }
    dispatchAccount(action);
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState));
  };

  const selectDoctrine = (nextDoctrineId: string | null) => {
    const action = { type: "selectDoctrine", doctrineId: nextDoctrineId } as const;
    const nextState = accountReducer(account, action);
    if (nextState === account) {
      return;
    }
    dispatchAccount(action);
    resetArena(nextState.frameId, nextState.driveId, nextState.arenaId, loadoutFromAccountState(nextState));
  };

  const updateArenaTuning = (key: ArenaTuningKey, value: number) => {
    setArenaTuning((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    arenaTuningRef.current = arenaTuning;
  }, [arenaTuning]);

  useEffect(() => {
    if (!running) {
      runtimeRef.current = runtime;
    }
  }, [running, runtime]);

  useEffect(() => {
    if (!running) {
      return undefined;
    }

    let animationId = 0;
    let lastTime = performance.now();
    let lastUiPublish = lastTime;
    const tick = (now: number) => {
      try {
        const elapsed = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;
        const nextRuntime = stepTopArenaRuntime(runtimeRef.current, elapsed * speed, arenaTuningRef.current);
        runtimeRef.current = nextRuntime;
        if (nextRuntime.outcome !== "ongoing") {
          setRuntime(nextRuntime);
          setRunning(false);
          return;
        }
        if (now - lastUiPublish >= 100) {
          setRuntime(nextRuntime);
          lastUiPublish = now;
        }
      } catch (error) {
        console.error(error);
        setRuntimeError(error instanceof Error ? error.message : "戰鬥循環意外停止。");
        setRunning(false);
        setRuntime(runtimeRef.current);
        return;
      }
      animationId = window.requestAnimationFrame(tick);
    };

    animationId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(animationId);
      setRuntime(runtimeRef.current);
    };
  }, [running, speed]);

  useEffect(() => {
    const last = lastKillRef.current;
    if (last.seed !== runtime.seed) {
      lastKillRef.current = { seed: runtime.seed, kills: runtime.kills };
      return;
    }
    if (runtime.kills > last.kills) {
      dispatchAccount({ type: "addKills", amount: runtime.kills - last.kills });
      lastKillRef.current = { seed: runtime.seed, kills: runtime.kills };
    }
  }, [runtime.kills, runtime.seed]);

  useEffect(() => {
    const last = lastRouteClearRef.current;
    if (last.seed !== runtime.seed) {
      lastRouteClearRef.current = { seed: runtime.seed, routeClears: runtime.routeClears };
      return;
    }

    if (runtime.routeClears > last.routeClears) {
      const gained = runtime.routeClears - last.routeClears;
      const newKeys = Array.from({ length: gained }, (_, index) =>
        generateArenaKey({
          arenaBaseId: arenaId,
          tier: arena.tier,
          seed: `${runtime.seed}_route_key_${runtime.routeClears}_${index}`,
          rarity: arena.tier >= 3 ? "engraved" : "tuned",
          quality: Math.min(20, arena.tier * 4),
          bossGateId: arena.tier >= 3 ? "boss_gate_brass_judicator" : undefined,
        }),
      );
      const action = { type: "addRouteClear", arenaId, keys: newKeys } as const;
      dispatchAccount(action);
      setSelectedArenaKeyId(newKeys[0]?.id ?? selectedArenaKeyId);
      setLootNotices((current) => [
        ...newKeys.map((key) => ({ id: `key_${key.id}`, tone: "reward" as const, text: `已製作關卡鑰匙：${formatKeyTitle(key)}` })),
        ...current,
      ].slice(0, 8));
      lastRouteClearRef.current = { seed: runtime.seed, routeClears: runtime.routeClears };
    }
  }, [account, arena.tier, arenaId, runtime.routeClears, runtime.seed, selectedArenaKeyId]);

  useEffect(() => {
    if (runtime.mode !== "duel" || runtime.outcome !== "victory" || lastDuelVictoryRef.current === runtime.seed) {
      return;
    }
    lastDuelVictoryRef.current = runtime.seed;
    const rival = runtime.rivalId ? getNamedRivalDef(runtime.rivalId) : null;
    if (rival) {
      dispatchAccount({ type: "clearRival", rivalId: rival.id });
    } else {
      dispatchAccount({ type: "markBossGateCleared", gateId: bossProjection.gateId });
    }
    setLootNotices((current) =>
      [
        {
          id: `${rival ? "rival" : "boss"}_duel_clear_${runtime.seed}`,
          tone: "reward" as const,
          text: rival ? `${dataName("rival", rival.id, rival.displayName)}名宿門已通關` : "黃銅裁決者決鬥門已通關",
        },
        ...current,
      ].slice(0, 8),
    );
  }, [bossProjection.gateId, runtime.mode, runtime.outcome, runtime.rivalId, runtime.seed]);

  useEffect(() => {
    if (offlineSettlementAppliedRef.current) {
      return;
    }
    offlineSettlementAppliedRef.current = true;

    const nowMs = Date.now();
    const offlineElapsed = resolveOfflineElapsedSeconds(initialSave.top.lastSettledAt, nowMs);
    if (offlineElapsed.futureClockSkew) {
      const now = new Date(nowMs).toISOString();
      const nextSave = {
        ...saveShellRef.current,
        currencies: {
          ...saveShellRef.current.currencies,
          ash: account.wallet.ash,
          glass: account.wallet.glass,
          echo: account.wallet.echo,
        },
        top: accountStateToSaveTop(account, now),
        lastSavedAt: now,
      };
      saveShellRef.current = nextSave;
      writeLocalSave(nextSave);
      setLootNotices((current) =>
        [
          {
            id: `offline_clock_skew_${now}`,
            tone: "reward" as const,
            text: t("ui.offline.clockSkew"),
          },
          ...current,
        ].slice(0, 8),
      );
      return;
    }

    const elapsedSeconds = offlineElapsed.elapsedSeconds;
    if (elapsedSeconds < 60) {
      return;
    }

    const settlement = resolveOfflineSettlement({
      frameId,
      driveId,
      arenaId,
      circuitNodeId: selectedOfflineNodeId ?? undefined,
      loadout,
      elapsedSeconds,
      arenaTier: arena.tier,
      seed: `offline_${initialSave.top.lastSettledAt}_${initialSave.lastSavedAt}`,
      partQuantity: currentStats.partQuantity,
      partRarity: currentStats.partRarity,
    });
    const hasRewards = settlement.kills > 0 || settlement.parts.length > 0 || settlement.wallet.ash > 0 || settlement.wallet.glass > 0 || settlement.wallet.echo > 0;
    if (!hasRewards) {
      return;
    }

    let nextState = accountReducer(account, { type: "addKills", amount: settlement.kills });
    nextState = accountReducer(nextState, { type: "ingestDrops", parts: settlement.parts, capacity: inventoryCapacity });
    nextState = accountReducer(nextState, { type: "addWallet", wallet: settlement.wallet });
    const nextInventoryIds = new Set(nextState.inventory.map((part) => part.id));
    const keptOfflineParts = settlement.parts.filter((part) => nextInventoryIds.has(part.id));
    const salvagedOfflineParts = settlement.parts.filter((part) => !nextInventoryIds.has(part.id));
    const overflowedOfflineExisting = account.inventory.filter((part) => !nextInventoryIds.has(part.id));
    const firstKeptPart = keptOfflineParts[0] ?? null;
    dispatchAccount({ type: "addKills", amount: settlement.kills });
    dispatchAccount({ type: "ingestDrops", parts: settlement.parts, capacity: inventoryCapacity });
    dispatchAccount({ type: "addWallet", wallet: settlement.wallet });
    if (firstKeptPart) {
      setSelectedPartId(firstKeptPart.id);
    }
    setOfflineReport({ ...settlement, elapsedSeconds });
    setLootNotices((current) =>
      [
        {
          id: `offline_${initialSave.top.lastSettledAt}`,
          tone: "reward" as const,
          text: `離線戰鬥：${formatNumber(settlement.kills, 0)} 次擊破 / ${settlement.parts.length} 件掉落`,
        },
        ...keptOfflineParts.slice(0, 3).map((part) => ({
          id: `offline_part_${part.id}`,
          tone: "drop" as const,
          rarity: part.rarity,
          text: `保留 ${displayRarity(part.rarity)} ${displayPartName(part)}`,
        })),
        ...salvagedOfflineParts.slice(0, 3).map((part) => ({
          id: `offline_salvage_${part.id}`,
          tone: "salvage" as const,
          rarity: part.rarity,
          text: `自動拆解 ${displayRarity(part.rarity)} ${displayPartName(part)}`,
        })),
        ...overflowedOfflineExisting.slice(0, 2).map((part) => ({
          id: `offline_overflow_${part.id}`,
          tone: "salvage" as const,
          rarity: part.rarity,
          text: `容量回收 ${displayRarity(part.rarity)} ${displayPartName(part)}`,
        })),
        ...current,
      ].slice(0, 8),
    );
  }, [
    account,
    arena.tier,
    arenaId,
    currentStats.partQuantity,
    currentStats.partRarity,
    driveId,
    frameId,
    initialSave.lastSavedAt,
    initialSave.top.lastSettledAt,
    loadout,
    selectedOfflineNodeId,
  ]);

  useEffect(() => {
    const now = new Date().toISOString();
    const nextSave = {
      ...saveShellRef.current,
      schemaVersion: 7 as const,
      currencies: {
        ...saveShellRef.current.currencies,
        ash: account.wallet.ash,
        glass: account.wallet.glass,
        echo: account.wallet.echo,
      },
      top: accountStateToSaveTop(account, now),
      lastSavedAt: now,
    };
    saveShellRef.current = nextSave;
    writeLocalSave(nextSave);
  }, [account]);

  useEffect(() => {
    const newParts: TopPartInstance[] = [];
    for (const drop of runtime.drops) {
      const key = `${runtime.seed}_${drop.id}`;
      if (seenDropIdsRef.current.has(key)) {
        continue;
      }
      seenDropIdsRef.current.add(key);
      newParts.push(createPartFromArenaDrop({ ...drop, id: key }, arena.tier, runtime.wave));
    }

    if (newParts.length > 0) {
      const action = { type: "ingestDrops", parts: newParts, capacity: inventoryCapacity } as const;
      const nextState = accountReducer(account, action);
      const nextInventoryIds = new Set(nextState.inventory.map((part) => part.id));
      const keptDrops = newParts.filter((part) => nextInventoryIds.has(part.id));
      const salvagedDrops = newParts.filter((part) => !nextInventoryIds.has(part.id));
      const overflowedExisting = inventory.filter((part) => !nextInventoryIds.has(part.id));
      const keptDrop = keptDrops[0] ?? null;
      const notices: LootNotice[] = [
        ...keptDrops.map((part) => ({ id: `loot_${part.id}`, tone: "drop" as const, rarity: part.rarity, text: `取得 ${displayRarity(part.rarity)} ${displayPartName(part)}` })),
        ...salvagedDrops.map((part) => ({ id: `salvage_${part.id}`, tone: "salvage" as const, rarity: part.rarity, text: `自動拆解 ${displayRarity(part.rarity)} ${displayPartName(part)}` })),
        ...overflowedExisting.map((part) => ({ id: `overflow_${part.id}_${runtime.seed}`, tone: "salvage" as const, rarity: part.rarity, text: `容量回收 ${displayRarity(part.rarity)} ${displayPartName(part)}` })),
      ];
      dispatchAccount(action);
      if (keptDrop) {
        setSelectedPartId(keptDrop.id);
      }
      setLootNotices((current) => [...notices, ...current].slice(0, 8));
      if (!running) {
        openPanel("inventory");
      }
    }
  }, [account, arena.tier, inventory, openPanel, running, runtime.drops, runtime.seed, runtime.wave]);

  const selectedPartInInventory = selectedPart ? inventory.some((part) => part.id === selectedPart.id) : false;
  const selectedPartEquipped = selectedPart ? selectedCurrentPart?.id === selectedPart.id : false;
  const selectedPartVerdict = useMemo(
    () => (selectedPart ? formatPartVerdict(selectPartVerdict(selectedPart, currentStats, previewStats, selectedPartEquipped)) : null),
    [currentStats, previewStats, selectedPart, selectedPartEquipped],
  );
  const partRetentionById = useMemo(() => {
    const entries = allKnownParts.map((part) => {
      const equipped = equipment[part.slot]?.id === part.id;
      const partPreviewStats = equipped ? currentStats : resolveTopRuntimeStats(frameId, driveId, loadoutWithPart(loadout, part));
      const verdictProjection = selectPartVerdict(part, currentStats, partPreviewStats, equipped);
      const verdict = formatPartVerdict(verdictProjection);
      const decision = decideLootPolicy(part, verdictProjection, lootPolicy, equipped);
      return [part.id, formatPartRetention(decision, verdict)] as const;
    });
    return new Map(entries);
  }, [allKnownParts, currentStats, driveId, equipment, frameId, loadout, lootPolicy]);
  const selectedPartRetention = selectedPart ? partRetentionById.get(selectedPart.id) ?? null : null;
  const runReview = useMemo(() => {
    const bestDrop = runtime.drops.reduce<(typeof runtime.drops)[number] | null>(
      (best, drop) => (!best || rarityRank[drop.rarity] > rarityRank[best.rarity] ? drop : best),
      null,
    );
    const remainingToBoss = Math.max(0, runtime.mapKillTarget - runtime.mapKills);
    const clearRatio = runtime.mapKills / Math.max(1, runtime.mapKillTarget);
    const routeProgress = runtime.bossSpawned || remainingToBoss === 0 ? 8 : Math.max(1, Math.ceil(clearRatio * 8));
    const objectiveLabel = runtime.bossSpawned ? t("ui.objective.bossWave") : remainingToBoss === 0 ? t("ui.objective.bossReady") : remainingToBoss <= 10 ? t("ui.objective.finalPack") : t("ui.objective.clearBasin");
    const objectiveDetail =
      runtimeDefeated
        ? defeatCauseDetail
        : runtime.bossSpawned
        ? t("ui.objective.shatterBoss")
        : remainingToBoss === 0
          ? t("ui.objective.fieldClear")
          : t("ui.objective.rivalsBeforeBoss", { count: remainingToBoss });
    const actionPanel: ActivePanel | "map" =
      runtimeDefeated
        ? "map"
        : runtime.drops.length > 0
        ? "inventory"
        : selectedPartVerdict?.action === "forge"
          ? "forge"
          : selectedPartVerdict?.action === "equip"
            ? "inventory"
            : bossProjection.successChance >= 0.5
              ? "map"
              : "loadout";
    const tone: "neutral" | "good" | "warn" | "rare" =
      runtimeError || runtimeDefeated || dangerCue?.tone === "danger" ? "warn" : bestDrop?.rarity === "relic" || runtime.routeClears > 0 ? "rare" : runtime.drops.length > 0 ? "good" : "neutral";

    return {
      actionLabel: actionPanel === "inventory" ? t("ui.panel.inventory") : actionPanel === "forge" ? t("ui.panel.forge") : actionPanel === "map" ? t("ui.screen.map") : t("ui.panel.loadout"),
      actionPanel,
      bestDropText: bestDrop ? `${displayRarity(bestDrop.rarity)} ${displayDropLabel(bestDrop.label, bestDrop.baseId)}` : t("ui.drop.none"),
      detail: runtimeDefeated ? defeatCauseDetail : dangerCue ? dangerCue.label : selectedPartVerdict ? selectedPartVerdict.label : t("ui.build.stable"),
      objectiveDetail,
      objectiveLabel: runtimeDefeated ? defeatCauseLabel : objectiveLabel,
      routeProgress,
      status: runtimeError ? t("ui.status.stopped") : runtimeDefeated ? t("ui.state.defeated") : running ? t("ui.status.liveRun") : runtime.drops.length > 0 ? t("ui.status.lootReady") : t("ui.status.ready"),
      summary: runtimeDefeated ? `${defeatCauseLabel}，${formatNumber(runtime.kills, 0)} 次擊破後結束` : `清場 ${formatNumber(runtime.mapKills, 0)}/${formatNumber(runtime.mapKillTarget, 0)} / 總擊破 ${formatNumber(runtime.kills, 0)}`,
      tone,
    };
  }, [bossProjection.successChance, dangerCue, defeatCauseDetail, defeatCauseLabel, running, runtime.bossSpawned, runtime.drops, runtime.kills, runtime.mapKillTarget, runtime.mapKills, runtime.routeClears, runtimeDefeated, runtimeError, selectedPartVerdict]);
  const selectedNetworkNodeForTutorial = selectedNetworkNode;
  const hasUnlockedRivalGate = useMemo(
    () => circuitNetworkNodes.some((node) => Boolean(node.unlocksRivalId && unlockedCircuitNodeIds.has(node.id) && !clearedRivalIds.includes(node.unlocksRivalId))),
    [clearedRivalIds, unlockedCircuitNodeIds],
  );
  const hasUnlockedAnomaly = useMemo(
    () => circuitNetworkNodes.some((node) => Boolean(node.anomalyId && unlockedCircuitNodeIds.has(node.id))),
    [unlockedCircuitNodeIds],
  );
  const canForgeSelectedPart = Boolean(selectedPart && canApplyForgeAction("upgrade", selectedPart) && canSpend(wallet, forgeActionCost("upgrade", selectedPart)));
  const tutorialTriggers = useMemo<Record<TutorialTrigger, boolean>>(
    () => ({
      welcome: true,
      firstDrop: runtime.drops.length > 0 || lootNotices.some((notice) => notice.tone === "drop"),
      firstEquip: selectedPartVerdict?.action === "equip",
      firstTalent: totalKills >= 5 && availableTalentPoints > 0,
      firstForge: screen === "workbench" && canForgeSelectedPart && (activePanel === "forge" || (totalKills > 0 && selectedPartVerdict?.action === "forge")),
      firstRune: (screen === "workbench" && totalKills > 0) || activePanel === "skills" || runeSlots.some(Boolean),
      doctrine: activePanel === "talents" && doctrineId === null,
      mapUnlock: screen === "map" || chapterProgress.done > 1,
      rivalGate: hasUnlockedRivalGate || Boolean(selectedNetworkNodeForTutorial?.unlocksRivalId || selectedNetworkNodeForTutorial?.requiredRivalId),
      firstKey: arenaKeys.length > 0,
      firstAnomaly: hasUnlockedAnomaly || Boolean(selectedNetworkNodeForTutorial?.anomalyId),
      bossGate: bossProjection.successChance >= 0.5 || clearedBossGateIds.includes(chapterOne.bossGateId),
    }),
    [
      activePanel,
      arenaKeys.length,
      availableTalentPoints,
      bossProjection.successChance,
      chapterOne.bossGateId,
      chapterProgress.done,
      clearedBossGateIds,
      doctrineId,
      hasUnlockedAnomaly,
      hasUnlockedRivalGate,
      lootNotices,
      canForgeSelectedPart,
      runeSlots,
      runtime.drops.length,
      screen,
      selectedNetworkNodeForTutorial,
      selectedPartVerdict,
      totalKills,
    ],
  );
  const featureUnlocks = useMemo<Record<FeatureUnlockId, boolean>>(
    () => ({
      skills: isFeatureUnlocked("skills", { seenTutorialIds, activeTutorialTriggers: tutorialTriggers }),
      forge: isFeatureUnlocked("forge", { seenTutorialIds, activeTutorialTriggers: tutorialTriggers }),
      talents: isFeatureUnlocked("talents", { seenTutorialIds, activeTutorialTriggers: tutorialTriggers }),
      doctrine: isFeatureUnlocked("doctrine", { seenTutorialIds, activeTutorialTriggers: tutorialTriggers }),
      arenaKeys: isFeatureUnlocked("arenaKeys", { seenTutorialIds, activeTutorialTriggers: tutorialTriggers }),
      bossGate: isFeatureUnlocked("bossGate", { seenTutorialIds, activeTutorialTriggers: tutorialTriggers }),
      wallet: isFeatureUnlocked("wallet", { seenTutorialIds, activeTutorialTriggers: tutorialTriggers }),
      anomaly: isFeatureUnlocked("anomaly", { seenTutorialIds, activeTutorialTriggers: tutorialTriggers }),
    }),
    [seenTutorialIds, tutorialTriggers],
  );
  const activeTutorialStep = useMemo(() => {
    if (tutorialReplayStepId) {
      return tutorialSteps.find((step) => step.id === tutorialReplayStepId) ?? null;
    }
    return tutorialSteps.find((step) => tutorialTriggers[step.trigger] && !seenTutorialIds.includes(step.id)) ?? null;
  }, [seenTutorialIds, tutorialReplayStepId, tutorialTriggers]);
  const activeTutorialAnchor = activeTutorialStep?.anchor ?? null;

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-tutorial-anchor]");
    nodes.forEach((node) => {
      node.classList.toggle("tutorial-anchor-active", Boolean(activeTutorialAnchor) && node.dataset.tutorialAnchor === activeTutorialAnchor);
    });
    return () => {
      nodes.forEach((node) => node.classList.remove("tutorial-anchor-active"));
    };
  }, [activeTutorialAnchor]);

  const startTutorialReplay = () => {
    dispatchAccount({ type: "resetTutorialSeen" });
    setTutorialReplayStepId(tutorialSteps[0]?.id ?? null);
  };

  const dismissTutorial = () => {
    if (!activeTutorialStep) {
      return;
    }
    if (tutorialReplayStepId) {
      const currentIndex = tutorialSteps.findIndex((step) => step.id === activeTutorialStep.id);
      setTutorialReplayStepId(tutorialSteps[currentIndex + 1]?.id ?? null);
      return;
    }
    dispatchAccount({ type: "markTutorialSeen", tutorialId: activeTutorialStep.id });
  };

  const skipTutorial = () => {
    if (tutorialReplayStepId) {
      setTutorialReplayStepId(null);
      return;
    }
    if (activeTutorialStep) {
      dispatchAccount({ type: "markTutorialSeen", tutorialId: activeTutorialStep.id });
    }
  };

  const renderBuildSummaryPanel = () => (
    <section className="workbench-section build-summary-section">
      <div className="section-title">
        <Activity size={17} aria-hidden />
        <h2>{t("ui.section.buildSummary")}</h2>
        <span className="section-counter">{displayFrameName(frame.id, frame.displayName)}</span>
      </div>
      <div className="build-summary-grid">
        <StatPill icon={<Swords size={15} />} label={term("stat", "impact")} value={formatNumber(statFromRuntime(currentStats, "impact"), 0)} />
        <StatPill icon={<Shield size={15} />} label="有效耐久" value={formatNumber(statFromRuntime(currentStats, "spinIntegrity") + statFromRuntime(currentStats, "guard"), 0)} tone="good" />
        <StatPill icon={<Radar size={15} />} label={term("stat", "tracking")} value={formatNumber(statFromRuntime(currentStats, "tracking"), 0)} />
        <StatPill icon={<Gem size={15} />} label="獎勵" value={`${formatPercent(statFromRuntime(currentStats, "partQuantity"), 0)} / ${formatPercent(statFromRuntime(currentStats, "partRarity"), 0)}`} tone="rare" />
      </div>
    </section>
  );

  const renderSelectedPartInspector = ({ title = t("ui.section.selectedPart"), showForgeAction = true }: { title?: string; showForgeAction?: boolean } = {}) => (
    <section className="workbench-section part-inspector-section" data-tutorial-anchor="part-inspector">
      <div className="section-title">
        <Gem size={17} aria-hidden />
        <h2>{title}</h2>
        <span className="section-counter">{selectedPart ? displaySlot(selectedPart.slot) : t("ui.inventory.none")}</span>
      </div>
      {selectedPart ? (
        <div className={`part-detail part-detail-${selectedPart.rarity}`}>
          <div className="part-detail-title">
            <div>
              <small>{displaySlot(selectedPart.slot)} / 等級 {selectedPart.itemLevel}</small>
              <strong>{displayPartName(selectedPart)}</strong>
            </div>
            <span>{displayRarity(selectedPart.rarity)}</span>
          </div>
          {selectedPartVerdict ? (
            <div className={`part-verdict part-verdict-${selectedPartVerdict.tone}`}>
              <Sparkles size={16} aria-hidden />
              <div>
                <strong>{selectedPartVerdict.label}</strong>
                <span>{selectedPartVerdict.detail}</span>
              </div>
            </div>
          ) : null}
          {selectedPartRetention ? (
            <div className={`part-retention part-retention-${selectedPartRetention.tone}`}>
              {selectedPartRetention.tone === "salvage" ? <Recycle size={16} aria-hidden /> : <Shield size={16} aria-hidden />}
              <div>
                <strong>{selectedPartRetention.label}</strong>
                <span>{selectedPartRetention.detail}</span>
              </div>
            </div>
          ) : null}
          <div className="delta-list">
            {trackedStats.map((stat) => {
              const delta = statFromRuntime(previewStats, stat) - statFromRuntime(currentStats, stat);
              return (
                <div className={delta >= 0 ? "delta-line delta-good" : "delta-line delta-bad"} key={stat}>
                  <span>{statLabel(stat)}</span>
                  <strong>{delta >= 0 ? "+" : ""}{formatStatValue(stat, delta)}</strong>
                </div>
              );
            })}
          </div>
          <div className="threshold-lines">
            {equipCompare.thresholdCrossings.length > 0 ? (
              equipCompare.thresholdCrossings.map((crossing) => (
                <span className={crossing.previewTriggered ? "threshold-line threshold-good" : "threshold-line threshold-bad"} key={`${crossing.id}_${crossing.attr}`}>
                  {crossing.previewTriggered ? t("ui.compare.unlocks", { name: displaySourceName(crossing.sourceId) }) : t("ui.compare.loses", { name: displaySourceName(crossing.sourceId) })}
                </span>
              ))
            ) : (
              <span>{t("ui.compare.noThreshold")}</span>
            )}
          </div>
          <div className="modifier-lines">
            {formatPartLines(selectedPart).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div className="part-actions">
            <button className="arena-button" disabled={selectedPartEquipped} onClick={() => equipPart(selectedPart)} type="button">
              <CircleDot size={15} aria-hidden />
              {t("ui.control.equip")}
            </button>
            <button className="arena-button" disabled={!selectedPartInInventory} onClick={() => toggleLock(selectedPart.id)} type="button">
              <Shield size={15} aria-hidden />
              {selectedPart.locked ? t("ui.control.unlock") : t("ui.control.lock")}
            </button>
            <button className="arena-button arena-button-danger" disabled={selectedPart.locked || !selectedPartInInventory} onClick={() => salvagePart(selectedPart)} type="button">
              <Recycle size={15} aria-hidden />
              {t("ui.control.salvage")}
            </button>
            {showForgeAction ? (
              <button className="arena-button" onClick={() => openPanel("forge")} type="button">
                <Gem size={15} aria-hidden />
                {t("ui.control.forge")}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <span className="empty-drop">{t("ui.inventory.noPart")}</span>
      )}
    </section>
  );

  const renderLoadoutPanel = () => (
    <>
      <section className="workbench-section">
        <div className="section-title">
          <CircleDot size={17} aria-hidden />
          <h2>{t("ui.section.equipment")}</h2>
        </div>
        <div className="equipment-slots">
          {partSlotOrder.map((slot) => {
            const part = equipment[slot];
            return (
              <button
                className={`equip-slot equip-slot-${part.rarity}`}
                key={slot}
                onClick={() => inspectPart(part.id)}
                type="button"
              >
                <small>{displaySlot(slot)}</small>
                <strong>{displayPartName(part)}</strong>
                <span>{displayRarity(part.rarity)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="workbench-section">
        <div className="section-title">
          <Radar size={17} aria-hidden />
          <h2>{t("ui.section.frame")}</h2>
        </div>
        <div className="choice-stack">
          {topFrames.map((entry) => (
            <button className={entry.id === frameId ? "choice-card choice-card-active" : "choice-card"} key={entry.id} onClick={() => selectFrame(entry.id)} type="button">
              <strong>{displayFrameName(entry.id, entry.displayName)}</strong>
              <span>{t(`frame.${entry.id}.role`, undefined, entry.role)}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );

  const renderInventoryPanel = () => (
    <>
      <section className="workbench-section">
        <div className="section-title">
          <PackageOpen size={17} aria-hidden />
          <h2>{t("ui.section.inventory")}</h2>
          <span className="section-counter">{inventory.length}/{inventoryCapacity}</span>
        </div>
        <div className="inventory-filter" aria-label={t("ui.aria.inventoryFilter")}>
          <button className={inventoryFilter === "all" ? "filter-chip filter-chip-active" : "filter-chip"} onClick={() => setInventoryFilter("all")} type="button">
            {t("ui.inventory.all")}
          </button>
          {partSlotOrder.map((slot) => (
            <button className={inventoryFilter === slot ? "filter-chip filter-chip-active" : "filter-chip"} key={slot} onClick={() => setInventoryFilter(slot)} type="button">
              {displaySlot(slot)}
            </button>
          ))}
        </div>
        <div className="loot-policy-panel" aria-label="戰利品規則">
          <div className="loot-policy-head">
            <span>
              <small>戰利品規則</small>
              <strong>{lootPolicy.autoSalvage ? "自動拆解啟用" : "手動確認"}</strong>
            </span>
            <button
              aria-pressed={lootPolicy.autoSalvage}
              className={lootPolicy.autoSalvage ? "arena-button arena-button-live loot-policy-toggle" : "arena-button arena-button-secondary loot-policy-toggle"}
              onClick={() => updateLootPolicy({ autoSalvage: !lootPolicy.autoSalvage })}
              type="button"
            >
              <Recycle size={15} aria-hidden />
              {lootPolicy.autoSalvage ? "自動" : "手動"}
            </button>
          </div>
          <div className="loot-policy-preview">
            <span>
              <small>{lootPolicy.autoSalvage ? "保留" : "預估保留"}</small>
              <strong>{lootPolicyPreview.keptParts.length}</strong>
            </span>
            <span>
              <small>{lootPolicy.autoSalvage ? "拆解" : "預估拆解"}</small>
              <strong>{lootPolicyPreview.salvagedParts.length}</strong>
            </span>
            <span>
              <small>材料</small>
              <strong>{formatCost(lootPolicyPreview.wallet)}</strong>
            </span>
          </div>
          <div className="loot-policy-control">
            <small>最低稀有度</small>
            <div className="loot-policy-chip-row" role="group" aria-label="最低稀有度">
              {lootPolicyRarities.map((rarity) => (
                <button
                  aria-pressed={lootPolicy.minRarity === rarity}
                  className={lootPolicy.minRarity === rarity ? "loot-policy-chip loot-policy-chip-active" : "loot-policy-chip"}
                  key={rarity}
                  onClick={() => updateLootPolicy({ minRarity: rarity })}
                  type="button"
                >
                  {displayRarity(rarity)}
                </button>
              ))}
            </div>
          </div>
          <div className="loot-policy-control">
            <small>物品等級</small>
            <div className="loot-policy-chip-row" role="group" aria-label="物品等級">
              {lootPolicyItemLevelPresets.map((itemLevel) => (
                <button
                  aria-pressed={lootPolicy.minItemLevel === itemLevel}
                  className={lootPolicy.minItemLevel === itemLevel ? "loot-policy-chip loot-policy-chip-active" : "loot-policy-chip"}
                  key={itemLevel}
                  onClick={() => updateLootPolicy({ minItemLevel: itemLevel })}
                  type="button"
                >
                  {itemLevel}+
                </button>
              ))}
            </div>
          </div>
          <div className="loot-policy-control">
            <small>戰力分數</small>
            <div className="loot-policy-chip-row" role="group" aria-label="戰力分數">
              {lootPolicyScorePresets.map((score) => (
                <button
                  aria-pressed={lootPolicy.minScore === score}
                  className={lootPolicy.minScore === score ? "loot-policy-chip loot-policy-chip-active" : "loot-policy-chip"}
                  key={score}
                  onClick={() => updateLootPolicy({ minScore: score })}
                  type="button"
                >
                  {score >= 0 ? `+${score}` : score}
                </button>
              ))}
            </div>
          </div>
          <div className="loot-policy-control loot-policy-control-wide">
            <small>目標槽位</small>
            <div className="loot-policy-chip-row" role="group" aria-label="目標槽位">
              <button
                aria-pressed={lootPolicy.targetSlots.length === partSlotOrder.length}
                className={lootPolicy.targetSlots.length === partSlotOrder.length ? "loot-policy-chip loot-policy-chip-active" : "loot-policy-chip"}
                onClick={() => updateLootPolicy({ targetSlots: [...partSlotOrder] })}
                type="button"
              >
                全槽
              </button>
              {partSlotOrder.map((slot) => (
                <button
                  aria-pressed={lootPolicy.targetSlots.includes(slot)}
                  className={lootPolicy.targetSlots.includes(slot) ? "loot-policy-chip loot-policy-chip-active" : "loot-policy-chip"}
                  key={slot}
                  onClick={() => toggleLootPolicySlot(slot)}
                  type="button"
                >
                  {displaySlot(slot)}
                </button>
              ))}
            </div>
          </div>
          <div className="loot-policy-control loot-policy-control-wide">
            <small>追蹤標籤</small>
            <div className="loot-policy-chip-row" role="group" aria-label="追蹤標籤">
              <button
                aria-pressed={lootPolicy.targetTags.length === 0}
                className={lootPolicy.targetTags.length === 0 ? "loot-policy-chip loot-policy-chip-active" : "loot-policy-chip"}
                onClick={() => updateLootPolicy({ targetTags: [] })}
                type="button"
              >
                全部
              </button>
              {lootPolicyDriveTags.map((tag) => (
                <button
                  aria-pressed={lootPolicy.targetTags.includes(tag)}
                  className={lootPolicy.targetTags.includes(tag) ? "loot-policy-chip loot-policy-chip-active" : "loot-policy-chip"}
                  key={tag}
                  onClick={() => toggleLootPolicyTag(tag)}
                  type="button"
                >
                  {formatTags([tag])}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="inventory-grid" aria-label={t("ui.aria.inventoryGrid")}>
          {inventoryCells.map((part, index) => {
            if (!part) {
              return <div className="inventory-cell inventory-cell-empty" key={`empty-${inventoryFilter}-${index}`} aria-hidden />;
            }
            const retention = partRetentionById.get(part.id);
            return (
              <button
                className={part.id === selectedPartId ? `inventory-cell inventory-cell-${part.rarity} inventory-cell-active` : `inventory-cell inventory-cell-${part.rarity}`}
                key={part.id}
                onClick={() => inspectPart(part.id)}
                title={`${displayPartName(part)} / ${displaySlot(part.slot)} / ${retention?.label ?? displayRarity(part.rarity)}`}
                type="button"
              >
                <small>{displaySlot(part.slot)}</small>
                <strong>{displayPartName(part)}</strong>
                <span className={retention ? `inventory-retention inventory-retention-${retention.tone}` : undefined}>{retention?.label ?? (part.locked ? t("ui.inventory.locked") : displayRarity(part.rarity))}</span>
              </button>
            );
          })}
        </div>
      </section>

      {lootNotices.length > 0 ? (
        <section className="workbench-section loot-history-section" data-tutorial-anchor="loot-notice">
          <div className="section-title">
            <PackageOpen size={17} aria-hidden />
            <h2>{t("ui.section.recentLoot")}</h2>
          </div>
          <div className="loot-history-list">
            {lootNotices.slice(0, 5).map((notice) => (
              <div className={["loot-history-line", `loot-history-${notice.tone}`, notice.rarity ? `loot-history-rarity-${notice.rarity}` : ""].filter(Boolean).join(" ")} key={notice.id}>
                {notice.text}
              </div>
            ))}
          </div>
        </section>
      ) : null}

    </>
  );

  const renderSkillInspector = () => (
    <>
      <section className="workbench-section">
        <div className="section-title">
          <Zap size={17} aria-hidden />
          <h2>{t("ui.section.skillDetail")}</h2>
        </div>
        <div className="skill-detail">
          <strong>{displayDriveName(drive.id, drive.displayName)}</strong>
          <span>{term("trigger", drive.trigger, drive.trigger)} / {round(drive.baseCooldown, 2)}秒</span>
          <div className={driveGateStatus.unlocked ? "skill-gate skill-gate-ready" : "skill-gate skill-gate-locked"}>
            <small>{t("ui.skill.driveGate")}</small>
            <strong>{driveGateStatus.unlocked ? t("ui.skill.ready") : t("ui.skill.locked")}</strong>
            {driveGateStatus.missing.map((requirement) => (
              <span key={`${requirement.attr}_${requirement.op}_${requirement.value}`}>
                {term("stat", requirement.attr)} {round(requirement.currentValue, 2)} / {requirement.op} {requirement.value}
              </span>
            ))}
          </div>
          <div className="damage-tags">
            {Object.entries(drive.baseDamage)
              .filter(([, value]) => value > 0)
              .map(([type, value]) => (
                <em key={type}>{term("damage", type, type)} {value}</em>
              ))}
          </div>
          <div className="skill-physics">
            <small>{t("ui.skill.collisionHooks")}</small>
            {drivePhysicsLines(drive.id).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="workbench-section skill-link-section">
        <div className="section-title">
          <Boxes size={17} aria-hidden />
          <h2>{t("ui.section.linkedSockets")}</h2>
          <span className="section-counter">{runeIds.length}/3</span>
        </div>
        <div className="skill-link-board" aria-label={t("ui.aria.linkedSockets")}>
          <svg className="socket-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <line x1="50" y1="50" x2="19" y2="24" />
            <line x1="50" y1="50" x2="80" y2="24" />
            <line x1="50" y1="50" x2="50" y2="82" />
          </svg>
          <button className="socket-node socket-drive" onClick={() => openPanel("loadout")} type="button">
            <small>{t("ui.section.driveCore")}</small>
            <strong>{displayDriveName(drive.id, drive.displayName)}</strong>
            <span>{formatTags(drive.tags.slice(0, 3))}</span>
          </button>
          {[0, 1, 2].map((socketIndex) => {
            const socketRuneId = runeSlots[socketIndex];
            const rune = socketRuneId ? tuningRunes.find((entry) => entry.id === socketRuneId) : null;
            const socketClasses = [
              "socket-node",
              "socket-rune",
              rune ? "socket-rune-filled" : "socket-rune-empty",
              selectedRuneSocket === socketIndex ? "socket-rune-selected" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                className={socketClasses}
                key={`rune-socket-${socketIndex}`}
                onClick={() => inspectRuneSocket(socketIndex)}
                style={{ "--socket-x": socketIndex === 0 ? "19%" : socketIndex === 1 ? "80%" : "50%", "--socket-y": socketIndex === 2 ? "82%" : "24%" } as CSSProperties}
                type="button"
              >
                <small>{t("ui.socket.label", { index: socketIndex + 1 })}</small>
                <strong>{rune ? displayRuneName(rune) : t("ui.inventory.open")}</strong>
                <span>{rune ? formatTags(rune.requiredTags) : t("ui.inventory.empty")}</span>
              </button>
            );
          })}
        </div>
        <div className="socket-detail-panel">
          <div className="socket-detail-header">
            <div>
              <small>{t("ui.socket.label", { index: selectedRuneSocket + 1 })}</small>
              <strong>{selectedRune ? displayRuneName(selectedRune) : t("ui.socket.openLink")}</strong>
            </div>
            <button className="arena-button arena-button-danger" disabled={!selectedRune} onClick={() => clearRuneSocket()} type="button">
              <Recycle size={15} aria-hidden />
              {t("ui.control.clear")}
            </button>
          </div>
          {selectedRune ? (
            <div className="socket-detail-lines">
              {formatRuneLines(selectedRune).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          ) : (
            <span className="empty-drop">{t("ui.inventory.chooseRune")}</span>
          )}
        </div>
      </section>
    </>
  );

  const renderSkillsPanel = () => (
    <>
      <section className="workbench-section build-archetype-section">
        <div className="section-title">
          <Activity size={17} aria-hidden />
          <h2>Build Identity</h2>
          <span className="section-counter">{buildArchetypeLabel(buildArchetypeProjection.primary)}</span>
        </div>
        <div className="build-archetype-card">
          <div className="build-archetype-head">
            <span>
              <small>目前流派</small>
              <strong>{buildArchetypeLabel(buildArchetypeProjection.primary)}</strong>
            </span>
            <b>{formatPercent(buildArchetypeProjection.scores[0]?.score ?? 0, 0)}</b>
          </div>
          <div className="build-archetype-bars" aria-label="Build archetype scores">
            {buildArchetypeProjection.scores.slice(0, 4).map((score) => (
              <span key={score.id}>
                <small>{buildArchetypeLabel(score.id)}</small>
                <i>
                  <b style={{ width: `${score.score * 100}%` }} />
                </i>
              </span>
            ))}
          </div>
          <div className="build-archetype-gaps">
            {buildArchetypeProjection.gaps.length > 0 ? buildArchetypeProjection.gaps.map((gap) => <small key={gap}>{buildArchetypeGapLabel(gap)}</small>) : <small>戰力協同</small>}
          </div>
        </div>
      </section>

      <section className="workbench-section">
        <div className="section-title">
          <Sparkles size={17} aria-hidden />
          <h2>{t("ui.section.driveCore")}</h2>
        </div>
        <div className="drive-grid">
          {driveCores.map((entry) => (
            <button className={entry.id === driveId ? "drive-chip drive-chip-active" : "drive-chip"} key={entry.id} onClick={() => selectDrive(entry.id)} type="button">
              <strong>{displayDriveName(entry.id, entry.displayName)}</strong>
              <span>{formatTags(entry.tags.slice(0, 4))}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="workbench-section rune-library-section">
        <div className="section-title">
          <Boxes size={17} aria-hidden />
          <h2>{t("ui.section.runeLibrary")}</h2>
          <span className="section-counter">{runeCatalogExpanded ? `${t("ui.rune.catalog")} ${runeIds.length}/${tuningRunes.length}` : `${runeIds.length}/${tuningRunes.length}`}</span>
        </div>
        <div className="rune-library">
          {visibleRunes.length > 0 ? (
            visibleRunes.map((rune) => {
              const compatible = isRuneCompatible(rune, drive.tags);
              const active = runeIds.includes(rune.id);
              return (
                <button
                  aria-pressed={active}
                  className={active ? "rune-card rune-card-active" : "rune-card"}
                  disabled={!compatible}
                  key={rune.id}
                  onClick={() => assignRuneToSocket(rune.id)}
                  type="button"
                >
                  <strong>{displayRuneName(rune)}</strong>
                  <span>{formatTags(rune.requiredTags)}</span>
                </button>
              );
            })
          ) : (
            <span className="empty-drop rune-library-empty">{t("ui.rune.emptyOwned")}</span>
          )}
        </div>
        <div className="rune-catalog-footer">
          <button className="arena-button arena-button-secondary" onClick={() => setRuneCatalogExpanded((value) => !value)} type="button">
            <Boxes size={15} aria-hidden />
            {runeCatalogExpanded ? t("ui.rune.catalogCollapse", { count: tuningRunes.length }) : t("ui.rune.catalogExpand", { owned: runeIds.length, total: tuningRunes.length })}
          </button>
        </div>
      </section>
    </>
  );

  const renderForgePanel = () => (
    <>
      <section className="workbench-section">
        <div className="section-title">
          <Gem size={17} aria-hidden />
          <h2>{t("ui.section.actions")}</h2>
        </div>
        <div className="forge-action-grid">
          {[
            ["upgrade", t("ui.forge.upgrade"), t("ui.forge.upgradeDetail")],
            ["rerollAffixes", t("ui.forge.reroll"), t("ui.forge.rerollDetail")],
            ["rerollValues", t("ui.forge.values"), t("ui.forge.valuesDetail")],
            ["add", t("ui.forge.add"), t("ui.forge.addDetail")],
            ["remove", t("ui.forge.remove"), t("ui.forge.removeDetail")],
          ].map(([action, label, detail]) => {
            const key = action as TopCraftAction;
            const cost = forgeActionCost(key, selectedPart);
            const disabled = !canApplyForgeAction(key, selectedPart) || !canSpend(wallet, cost);
            return (
              <button className="forge-action" disabled={disabled} key={action} onClick={() => craftSelectedPart(key)} type="button">
                <strong>{label}</strong>
                <span>{detail}</span>
                <small>{formatCost(cost)}</small>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );

  const renderNetworkNodeDetail = (node: CircuitNetworkNodeDef) => {
    const unlocked = unlockedCircuitNodeIds.has(node.id);
    const routeArena = getArenaCircuitDef(node.arenaId);
    const anomaly = node.anomalyId ? getArenaAnomalyDef(node.anomalyId) : null;
    const unlocksRival = node.unlocksRivalId ? rivalById.get(node.unlocksRivalId) : null;
    const requiredRival = node.requiredRivalId ? rivalById.get(node.requiredRivalId) : null;
    const rivalCleared = unlocksRival ? clearedRivalIds.includes(unlocksRival.id) : false;
    const bossGateCleared = node.requiredBossGateId ? clearedBossGateIds.includes(node.requiredBossGateId) : false;

    return (
      <section className="workbench-section route-node-detail-section" data-tutorial-anchor="network-detail">
        <div className="section-title">
          <MapIcon size={17} aria-hidden />
          <h2>{dataName("network", node.id, node.displayName)}</h2>
          <span className="section-counter">{unlocked ? t("ui.route.open") : t("ui.route.locked")}</span>
        </div>
        <p>{dataDescription("network", node.id, node.description)}</p>
        <div className="route-node-meta">
          <span>
            {t("ui.section.circuit")} <strong>T{routeArena.tier} {dataName("arena", routeArena.id, routeArena.displayName)}</strong>
          </span>
          {anomaly ? (
            <span>
              {t("ui.anomaly.active")} <strong>{dataName("anomaly", anomaly.id, anomaly.displayName)}</strong>
              <small>{anomalyRuleLabel(anomaly.playerRule)} / {formatPercent(anomaly.rewardQuantity + anomaly.rewardRarity, 0)} {t("ui.route.reward")}</small>
            </span>
          ) : null}
          {unlocksRival ? (
            <span>
              {t("ui.route.rivals")} <strong>{dataName("rival", unlocksRival.id, unlocksRival.displayName)}</strong>
              <small>{rivalCleared ? t("ui.route.cleared") : t("ui.route.duel")}</small>
            </span>
          ) : null}
          {requiredRival ? (
            <span>
              {t("ui.talent.requirement")} <strong>{dataName("rival", requiredRival.id, requiredRival.displayName)}</strong>
            </span>
          ) : null}
          {node.requiredBossGateId ? (
            <span>
              {t("ui.section.bossGate")} <strong>{bossGateCleared ? t("ui.route.cleared") : t("ui.route.locked")}</strong>
            </span>
          ) : null}
        </div>
        <div className={`route-strategy-card route-strategy-${selectedRouteStrategy.action}`}>
          <div className="route-strategy-head">
            <span>
              <small>關卡建議</small>
              <strong>{routeStrategyActionLabel(selectedRouteStrategy.action)}</strong>
            </span>
            <b>{formatPercent(selectedRouteStrategy.idleScore, 0)} 離線</b>
          </div>
          <div className="route-strategy-bars" aria-hidden>
            {[
              ["風險", selectedRouteStrategy.riskScore],
              ["獎勵", selectedRouteStrategy.rewardScore],
              ["清場", selectedRouteStrategy.clearSpeedScore],
            ].map(([label, value]) => (
              <span key={label}>
                <small>{label}</small>
                <i>
                  <b style={{ width: `${Number(value) * 100}%` }} />
                </i>
              </span>
            ))}
          </div>
          <div className="route-strategy-tags">
            {selectedRouteStrategy.reasons.slice(0, 4).map((reason) => (
              <small key={reason}>{routeStrategyReasonLabel(reason)}</small>
            ))}
          </div>
          <div className="route-strategy-rates">
            <span>
              <small>每小時擊殺</small>
              <strong>{formatNumber(selectedRouteStrategy.offline.killsPerHour, 0)}</strong>
            </span>
            <span>
              <small>每小時掉落</small>
              <strong>{formatNumber(selectedRouteStrategy.offline.dropsPerHour, 1)}</strong>
            </span>
            <span>
              <small>溢出拆解</small>
              <strong>{formatNumber(selectedRouteStrategy.offline.overflowSalvagePerHour, 1)}</strong>
            </span>
          </div>
          <div className="route-strategy-targets" aria-label="收益目標">
            {selectedRouteStrategy.rewardTargets.map((target) => (
              <small key={target}>{routeRewardTargetLabel(target)}</small>
            ))}
          </div>
        </div>
        <div className="route-node-actions">
          <button className="arena-button" disabled={!unlocked || node.arenaId === arenaId} onClick={() => selectArena(node.arenaId)} type="button">
            <Radar size={15} aria-hidden />
            {t("ui.next.chooseRoute")}
          </button>
          {anomaly ? (
            <button className="arena-button" disabled={!unlocked} onClick={() => startAnomalyRoute(anomaly.id, node.arenaId)} type="button">
              <Zap size={15} aria-hidden />
              {dataName("anomaly", anomaly.id, anomaly.displayName)}
            </button>
          ) : null}
          {unlocksRival ? (
            <button className="arena-button" disabled={!unlocked || rivalCleared} onClick={() => startRivalDuel(unlocksRival.id)} type="button">
              <Swords size={15} aria-hidden />
              {rivalCleared ? t("ui.route.cleared") : t("ui.route.duel")}
            </button>
          ) : null}
          <button className="arena-button" disabled={!unlocked} onClick={() => selectOfflineNode(node.id)} type="button">
            <RotateCcw size={15} aria-hidden />
            {selectedOfflineNodeId === node.id ? t("ui.route.offlineSet") : t("ui.route.offline")}
          </button>
        </div>
      </section>
    );
  };

  const renderRouteObjectiveRail = () => (
    <div className="run-objective-rail route-objective-rail" aria-label={t("ui.aria.routeObjective")}>
      <div className="run-objective-copy">
        <small>{t("ui.hud.objective")}</small>
        <strong>{runReview.objectiveLabel}</strong>
        <span>{runReview.objectiveDetail}</span>
      </div>
      <div className="run-objective-track" aria-hidden>
        {Array.from({ length: 8 }, (_, index) => {
          const step = index + 1;
          const state = objectiveSegmentState(step, runReview.routeProgress);
          return (
            <i className={`run-objective-step run-objective-${state}`} key={step}>
              {step === 8 ? "B" : ""}
            </i>
          );
        })}
      </div>
    </div>
  );

  const renderNetworkMapLayer = () => (
    <>
      <svg className="network-map-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {circuitNetworkNodes.flatMap((node) =>
          (node.requiredNodeIds ?? []).map((requiredId) => {
            const from = networkNodePositions[requiredId];
            const to = networkNodePositions[node.id];
            const active = unlockedCircuitNodeIds.has(requiredId) && unlockedCircuitNodeIds.has(node.id);
            const visible = visibleNetworkNodeIds.has(requiredId) && visibleNetworkNodeIds.has(node.id);
            const linkClass = active ? "network-map-link network-map-link-active" : visible ? "network-map-link" : "network-map-link network-map-link-fog";
            return from && to ? <line className={linkClass} key={`${requiredId}-${node.id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null;
          }),
        )}
      </svg>
      {circuitNetworkNodes.map((node) => {
        const unlocked = unlockedCircuitNodeIds.has(node.id);
        const visible = visibleNetworkNodeIds.has(node.id);
        const selected = selectedNetworkNodeId === node.id;
        const anomaly = visible && node.anomalyId ? getArenaAnomalyDef(node.anomalyId) : null;
        const rival = visible && node.unlocksRivalId ? rivalById.get(node.unlocksRivalId) : null;
        const position = networkNodePositions[node.id] ?? { x: 50, y: 50 };
        const networkClass = [
          "network-map-node",
          visible ? (unlocked ? "network-map-node-unlocked" : "network-map-node-locked") : "network-map-node-fog",
          visible && selected ? "network-map-node-selected" : "",
          anomaly ? "network-map-node-anomaly" : "",
          rival ? "network-map-node-rival" : "",
          visible && node.requiredBossGateId ? "network-map-node-gate" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            aria-pressed={visible && selected}
            className={networkClass}
            disabled={!visible}
            key={node.id}
            onClick={() => inspectNetworkNode(node.id)}
            style={{ "--network-x": `${position.x}%`, "--network-y": `${position.y}%` } as CSSProperties}
            type="button"
          >
            {visible ? (
              <>
                <small>{unlocked ? t("ui.route.open") : t("ui.route.locked")}</small>
                <strong>{dataName("network", node.id, node.displayName)}</strong>
              </>
            ) : (
              <strong aria-label={t("ui.route.unknownNode")}>?</strong>
            )}
          </button>
        );
      })}
    </>
  );

  const renderRoutePanel = () => (
    <>
      <section className="workbench-section route-overview-section">
        <div className="section-title">
          <Flame size={17} aria-hidden />
          <h2>{t("ui.section.route")}</h2>
          <span className="section-counter">{currentArenaKey ? t("ui.route.keyed") : t("ui.route.open")}</span>
        </div>
        <div className="route-summary-grid">
          <StatPill icon={<Flame size={15} />} label={t("ui.section.circuit")} value={`T${arena.tier}`} tone="rare" />
          <StatPill icon={<Gem size={15} />} label="鑰匙" value={formatNumber(arenaKeys.length, 0)} tone="good" />
          <StatPill icon={<Swords size={15} />} label={term("stat", "partQuantity")} value={formatPercent(currentArenaKeySummary?.rewardQuantity ?? 0, 0)} />
          <StatPill icon={<Sparkles size={15} />} label={term("stat", "partRarity")} value={formatPercent(currentArenaKeySummary?.rewardRarity ?? 0, 0)} />
          <StatPill icon={<Zap size={15} />} label={t("ui.section.breachRail")} value={routeMechanic ? formatPercent(routeMechanicProgress, 0) : "關閉"} tone={routeMechanic?.stabilized ? "good" : routeMechanic?.active ? "rare" : "warn"} />
          <StatPill icon={<Network size={15} />} label={t("ui.section.circuitAtlas")} value={`${availableAtlasPoints}/${atlasPoints}`} tone="good" />
        </div>
        <div className={chapterProgress.complete ? "chapter-progress-strip chapter-progress-complete" : "chapter-progress-strip"}>
          <div>
            <small>{t("ui.chapter.objectives")}</small>
            <strong>{t("ui.chapter.cinder")}</strong>
          </div>
          <span>{t(chapterProgress.complete ? "ui.chapter.complete" : "ui.chapter.progress", { done: chapterProgress.done, total: chapterProgress.total })}</span>
          <i aria-hidden>
            <b style={{ width: `${chapterProgress.ratio * 100}%` }} />
          </i>
        </div>
        {renderRouteObjectiveRail()}
      </section>

      <div className="route-content-column route-main-column">
      <div className="route-quick-row">
      <section className="workbench-section route-circuit-section">
        <div className="section-title">
          <Radar size={17} aria-hidden />
          <h2>{t("ui.section.circuit")}</h2>
          <span className="section-counter">{dataName("arena", arena.id, arena.displayName)}</span>
        </div>
        <div className="circuit-grid">
          {arenaCircuits.map((entry) => (
            <button className={entry.id === arenaId ? "circuit-chip circuit-chip-active" : "circuit-chip"} key={entry.id} onClick={() => selectArena(entry.id)} type="button">
              <span>T{entry.tier}</span>
              <strong>{dataName("arena", entry.id, entry.displayName)}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="workbench-section route-breach-section">
        <div className="section-title">
          <Zap size={17} aria-hidden />
          <h2>{t("ui.section.breachRail")}</h2>
          <span className="section-counter">{routeMechanic?.stabilized ? t("ui.route.stable") : routeMechanic?.active ? `${round(routeMechanic.timeRemaining, 0)}秒` : t("ui.route.collapsed")}</span>
        </div>
        <div className="breach-rail-card">
          <div className="breach-rail-meter" aria-hidden>
            <i style={{ width: `${routeMechanicProgress * 100}%` }} />
          </div>
          <div className="route-clear-line">
            <span>{t("ui.route.progress")}</span>
            <strong>{routeMechanic ? `${formatNumber(routeMechanic.progress, 0)}/${formatNumber(routeMechanic.maxProgress, 0)}` : "0/0"}</strong>
          </div>
          <div className="route-clear-line">
            <span>{t("ui.route.reward")}</span>
            <strong>{routeMechanic ? `${formatPercent(routeMechanic.rewardQuantity, 0)} / ${formatPercent(routeMechanic.rewardRarity, 0)}` : "0% / 0%"}</strong>
          </div>
        </div>
      </section>
      </div>

      <section className="workbench-section route-atlas-section">
        <div className="section-title">
          <Network size={17} aria-hidden />
          <h2>{t("ui.section.circuitAtlas")}</h2>
          <span className="section-counter">{availableAtlasPoints}/{atlasPoints}</span>
        </div>
        {shouldShowAtlasSummary ? (
          <>
            <div className="atlas-board atlas-board-network-only" aria-label={t("ui.aria.atlasBoard")}>
              {renderNetworkMapLayer()}
            </div>
            <div className="atlas-empty-summary">
              <strong>{t("ui.route.atlasEmptyTitle")}</strong>
              <span>{t("ui.route.atlasEmptyDetail")}</span>
            </div>
          </>
        ) : (
          (() => {
            const selectedAtlasNode = getCircuitAtlasNodeDef(selectedAtlasNodeId);
            const selectedAtlasActive = circuitAtlasNodeIds.includes(selectedAtlasNode.id);
            const selectedAtlasAvailable = selectedAtlasActive ? canRefundAtlasNode(selectedAtlasNode.id) : canAllocateAtlasNode(selectedAtlasNode.id);
            const selectedAtlasStatus = selectedAtlasActive ? t("ui.route.active") : selectedAtlasAvailable ? t("ui.route.available") : t("ui.route.locked");
            const requirementText =
              selectedAtlasNode.requiredNodeIds && selectedAtlasNode.requiredNodeIds.length > 0
                ? selectedAtlasNode.requiredNodeIds.map((requiredId) => dataName("atlas", requiredId, getCircuitAtlasNodeDef(requiredId).displayName)).join(" / ")
                : t("ui.route.root");

            return (
              <>
                <div className="atlas-board" aria-label={t("ui.aria.atlasBoard")}>
                  <svg className="talent-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                    {circuitAtlasNodes.flatMap((node) =>
                      (node.requiredNodeIds ?? []).map((requiredId) => {
                        const from = atlasNodePositions[requiredId];
                        const to = atlasNodePositions[node.id];
                        const active = circuitAtlasNodeIds.includes(requiredId) && circuitAtlasNodeIds.includes(node.id);
                        return from && to ? <line className={active ? "talent-link talent-link-active" : "talent-link"} key={`${requiredId}-${node.id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null;
                      }),
                    )}
                  </svg>
                  {circuitAtlasNodes.map((node) => {
                    const active = circuitAtlasNodeIds.includes(node.id);
                    const available = active ? canRefundAtlasNode(node.id) : canAllocateAtlasNode(node.id);
                    const selected = selectedAtlasNodeId === node.id;
                    const position = atlasNodePositions[node.id] ?? { x: 50, y: 50 };
                    const atlasClass = ["atlas-node", active ? "atlas-node-active" : "", selected ? "atlas-node-selected" : "", !active && !available ? "atlas-node-locked" : ""]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <button
                        aria-pressed={selected}
                        className={atlasClass}
                        key={node.id}
                        onClick={() => inspectAtlasNode(node.id)}
                        style={{ "--atlas-x": `${position.x}%`, "--atlas-y": `${position.y}%` } as CSSProperties}
                        title={dataDescription("atlas", node.id, node.description)}
                        type="button"
                      >
                        <small>{node.cost} {t("ui.point.short")}</small>
                        <strong>{dataName("atlas", node.id, node.displayName)}</strong>
                      </button>
                    );
                  })}
                  {renderNetworkMapLayer()}
              </div>
              <div className="talent-detail-panel atlas-detail-panel">
                <div className="talent-detail-header">
                  <div>
                    <small>{selectedAtlasStatus} / {requirementText}</small>
                    <strong>{dataName("atlas", selectedAtlasNode.id, selectedAtlasNode.displayName)}</strong>
                  </div>
                  <span>{selectedAtlasNode.cost} {t("ui.point.short")}</span>
                </div>
                <p>{dataDescription("atlas", selectedAtlasNode.id, selectedAtlasNode.description)}</p>
                <div className="talent-detail-lines">
                  {formatAtlasLines(selectedAtlasNode).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
                <button className="arena-button" disabled={!selectedAtlasAvailable} onClick={() => toggleAtlasNode(selectedAtlasNode.id)} type="button">
                  <Network size={15} aria-hidden />
                  {selectedAtlasActive ? t("ui.control.refund") : t("ui.control.allocate")}
                </button>
              </div>
            </>
          );
        })()
        )}
      </section>
      </div>

      <div className="route-content-column route-side-column">
        {renderNetworkNodeDetail(selectedNetworkNode)}
        <section className="workbench-section route-keys-section" data-tutorial-anchor="arena-keys">
          <div className="section-title">
            <PackageOpen size={17} aria-hidden />
            <h2>{t("ui.section.arenaKeys")}</h2>
            <span className="section-counter">{arenaKeys.length}/24</span>
          </div>
          <div className="key-action-row">
            <button className="arena-button" disabled={!canSpend(wallet, keyForgeCost)} onClick={forgeArenaKey} type="button">
              <Gem size={15} aria-hidden />
              {t("ui.control.forgeKey")}
            </button>
            <button className="arena-button" disabled={!selectedArenaKey} onClick={runSelectedArenaKey} type="button">
              <Play size={15} aria-hidden />
              {t("ui.control.runKey")}
            </button>
          </div>
          <div className="key-list">
            {arenaKeys.length > 0 ? (
              arenaKeys.map((key) => {
                const summary = summarizeArenaKeyRiskReward(key);
                return (
                  <button className={key.id === selectedArenaKeyId ? "key-card key-card-active" : "key-card"} key={key.id} onClick={() => inspectArenaKey(key.id)} type="button">
                    <div>
                      <small>{displayRarity(key.rarity)} / 等級 {key.itemLevel}</small>
                      <strong>{formatKeyTitle(key)}</strong>
                    </div>
                    <span>數量 {formatPercent(summary.rewardQuantity, 0)} / 稀有 {formatPercent(summary.rewardRarity, 0)}</span>
                  </button>
                );
              })
            ) : (
              <span className="empty-drop">{t("ui.inventory.noKey")}</span>
            )}
          </div>
        {selectedArenaKey ? (
          <div className="key-detail">
            <div className="modifier-lines">
              {[...selectedArenaKey.prefixes, ...selectedArenaKey.suffixes].map((affix) => (
                <span key={`${selectedArenaKey.id}_${affix.affixId}`}>
                  {dataName("keyAffix", affix.affixId, affix.displayName)}：敵人 {round((affix.enemyIntegrityMultiplier - 1) * 100, 0)}% {term("stat", "spinIntegrity")} / 獎勵 {formatPercent(affix.rewardQuantity + affix.rewardRarity, 0)}
                </span>
              ))}
            </div>
            <div className="delta-list">
              <div className="delta-line delta-bad">
                <span>{term("stat", "spinIntegrity")}</span>
                <strong>{formatPercent((selectedArenaKeySummary?.enemyIntegrityMultiplier ?? 1) - 1, 0)}</strong>
              </div>
              <div className="delta-line delta-bad">
                <span>{term("stat", "impact")}</span>
                <strong>{formatPercent((selectedArenaKeySummary?.enemyImpactMultiplier ?? 1) - 1, 0)}</strong>
              </div>
              <div className="delta-line delta-good">
                <span>{t("ui.route.reward")}</span>
                <strong>{formatPercent((selectedArenaKeySummary?.rewardQuantity ?? 0) + (selectedArenaKeySummary?.rewardRarity ?? 0), 0)}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="workbench-section route-boss-section" data-tutorial-anchor="boss-gate">
        <div className="section-title">
          <Network size={17} aria-hidden />
          <h2>{t("ui.section.bossGate")}</h2>
          <span className="section-counter">{clearedBossGateIds.includes(bossProjection.gateId) ? t("ui.route.cleared") : t("ui.route.locked")}</span>
        </div>
        <div className="boss-projection">
          <StatPill icon={<Gauge size={15} />} label="機率" value={formatPercent(bossProjection.successChance, 0)} tone={bossProjection.successChance >= 0.5 ? "good" : "warn"} />
          <StatPill icon={<Activity size={15} />} label="擊殺時間" value={`${round(bossProjection.estimatedTtk, 1)}秒`} />
        </div>
        <div className="modifier-lines">
          {bossProjection.failureReasons.length > 0 ? (
            bossProjection.failureReasons.map((reason) => <span key={reason}>{bossFailureLabel(reason)}: 目標 {formatNumber(bossProjection.recommendedStats[reason] ?? 0, 1)}</span>)
          ) : (
            <span>{t("ui.route.bossGateStable")}</span>
          )}
        </div>
        <button className="arena-button" onClick={attemptBossGate} type="button">
          <Swords size={15} aria-hidden />
          {t("ui.control.startDuel")}
        </button>
      </section>

      <section className="workbench-section route-network-section">
        <div className="section-title">
          <MapIcon size={17} aria-hidden />
          <h2>{t("ui.section.circuitNetwork")}</h2>
          <span className="section-counter">{clearedRivalIds.length}/{namedRivals.length} {t("ui.route.rivals")}</span>
        </div>
        <div className="route-clear-list">
          {circuitNetworkNodes.map((node) => {
            const visible = visibleNetworkNodeIds.has(node.id);
            if (!visible) {
              return (
                <div className="route-clear-line route-clear-line-fog" key={node.id}>
                  <span>
                    {t("ui.route.unknownNode")}
                    <small>{t("ui.route.foggedNode")}</small>
                  </span>
                  <div className="route-line-actions">
                    <strong>?</strong>
                  </div>
                </div>
              );
            }
            const unlocked = unlockedCircuitNodeIds.has(node.id);
            const anomaly = node.anomalyId ? getArenaAnomalyDef(node.anomalyId) : null;
            const rival = node.unlocksRivalId ? rivalById.get(node.unlocksRivalId) : null;
            const rivalCleared = rival ? clearedRivalIds.includes(rival.id) : false;
            const strategy = routeStrategyByNodeId.get(node.id)!;
            const routeLineClass = [
              "route-clear-line",
              `route-clear-line-${strategy.action}`,
              unlocked ? "" : "route-clear-line-locked",
              selectedOfflineNodeId === node.id ? "route-clear-line-offline" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div className={routeLineClass} key={node.id}>
                <div className="route-line-copy">
                  <strong>{dataName("network", node.id, node.displayName)}</strong>
                  <small>
                    {routeStrategyActionLabel(strategy.action)} / {formatNumber(strategy.offline.killsPerHour, 0)} 擊殺/時 / {formatNumber(strategy.offline.dropsPerHour, 1)} 件/時
                  </small>
                  {rival ? <small>{dataName("rival", rival.id, rival.displayName)}</small> : null}
                  {anomaly ? <small>{anomalyRuleLabel(anomaly.playerRule)} / {formatPercent(anomaly.rewardQuantity + anomaly.rewardRarity, 0)} {t("ui.route.reward")}</small> : null}
                  <div className="route-line-targets">
                    {strategy.rewardTargets.slice(0, 4).map((target) => (
                      <small key={target}>{routeRewardTargetLabel(target)}</small>
                    ))}
                  </div>
                </div>
                <div className="route-line-actions">
                  {rival ? (
                    <button className="arena-button" disabled={!unlocked || rivalCleared} onClick={() => startRivalDuel(rival.id)} type="button">
                      {rivalCleared ? t("ui.route.cleared") : unlocked ? t("ui.route.duel") : t("ui.route.locked")}
                    </button>
                  ) : null}
                  {anomaly ? (
                    <button className="arena-button" disabled={!unlocked} onClick={() => startAnomalyRoute(anomaly.id, node.arenaId)} type="button">
                      {unlocked ? dataName("anomaly", anomaly.id, anomaly.displayName) : t("ui.route.locked")}
                    </button>
                  ) : null}
                  <button className="arena-button" disabled={!unlocked} onClick={() => selectOfflineNode(node.id)} type="button">
                    {selectedOfflineNodeId === node.id ? t("ui.route.offlineSet") : t("ui.route.offline")}
                  </button>
                  {!rival && !anomaly ? <strong>{unlocked ? t("ui.route.open") : t("ui.route.locked")}</strong> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="workbench-section route-clears-section">
        <div className="section-title">
          <Radar size={17} aria-hidden />
          <h2>{t("ui.section.clears")}</h2>
          <button className="section-counter section-counter-button" onClick={() => setClearsExpanded((value) => !value)} type="button">
            {clearsExpanded ? t("ui.control.collapse") : t("ui.control.expand")}
          </button>
        </div>
        {clearsExpanded ? (
          <div className="route-clear-list">
            {arenaCircuits.map((entry) => (
              <div className="route-clear-line" key={entry.id}>
                <span>{dataName("arena", entry.id, entry.displayName)}</span>
                <strong>{routeClears[entry.id] ?? 0}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="route-clear-list route-clear-list-collapsed">
            <span className="empty-drop">{arenaCircuits.length} {t("ui.section.circuit")} / {t("ui.control.expand")}</span>
          </div>
        )}
      </section>
      </div>
    </>
  );

  const renderTalentInspector = () => {
    const selectedTalent = getTalentNodeDef(selectedTalentId);
    const selectedTalentActive = talentIds.includes(selectedTalent.id);
    const selectedTalentAvailable = selectedTalentActive ? canRefundTalent(selectedTalent.id) : canAllocateTalent(selectedTalent.id);
    const selectedTalentStatus = selectedTalentActive ? t("ui.route.active") : selectedTalentAvailable ? t("ui.route.available") : t("ui.route.locked");
    const requiredIds = selectedTalent.requiredNodeIds ?? [];
    const missingRequiredIds = requiredIds.filter((requiredId) => !talentIds.includes(requiredId));
    const requirementText = requiredIds.length > 0 ? requiredIds.map((requiredId) => dataName("talent", requiredId, getTalentNodeDef(requiredId).displayName)).join(" / ") : t("ui.route.root");

    return (
      <section className="workbench-section talent-detail-panel talent-detail-panel-layered">
        <div className="talent-detail-layer talent-title-layer">
          <div>
            <small>{t(`talent.kind.${selectedTalent.kind}`)}</small>
            <strong>{dataName("talent", selectedTalent.id, selectedTalent.displayName)}</strong>
          </div>
          <span className={`talent-kind-badge talent-kind-${selectedTalent.kind}`}>{t(`talent.kind.${selectedTalent.kind}`)}</span>
        </div>
        <p>{dataDescription("talent", selectedTalent.id, selectedTalent.description)}</p>
        <div className="talent-detail-layer talent-status-layer">
          <span className={selectedTalentActive ? "talent-status-badge talent-status-active" : selectedTalentAvailable ? "talent-status-badge talent-status-ready" : "talent-status-badge talent-status-locked"}>{selectedTalentStatus}</span>
          <span className={missingRequiredIds.length > 0 ? "talent-requirement talent-requirement-missing" : "talent-requirement"}>
            {t("ui.talent.requirement")}: {missingRequiredIds.length > 0 ? missingRequiredIds.map((requiredId) => dataName("talent", requiredId, getTalentNodeDef(requiredId).displayName)).join(" / ") : requirementText}
          </span>
          <span>{t("ui.talent.cost")}: {selectedTalent.cost} {t("ui.point.short")}</span>
        </div>
        <div className="talent-detail-layer talent-value-layer">
          {formatTalentLines(selectedTalent).map((line) => (
            <span className={line.includes("-") ? "talent-value-line talent-value-cost" : "talent-value-line"} key={line}>{line}</span>
          ))}
        </div>
        <div className="talent-detail-layer talent-action-layer">
          <button className="arena-button" disabled={!selectedTalentAvailable} onClick={() => toggleTalent(selectedTalent.id)} type="button">
            <Network size={15} aria-hidden />
            {selectedTalentActive ? t("ui.control.refund") : t("ui.control.allocate")}
          </button>
          <span>{talentIds.length} / {talentPoints} {t("ui.talent.allocated")} · {availableTalentPoints} {t("ui.talent.availablePoints")}</span>
        </div>
      </section>
    );
  };

  const renderTalentsPanel = () => {
    const frameDoctrines = doctrineForFrame(frameId);
    const selectedDoctrine = doctrineId ? getDoctrineDef(doctrineId) : null;

    return (
      <section className="workbench-section talent-workbench-section">
        <div className="section-title">
          <Network size={17} aria-hidden />
          <h2>{t("ui.section.talents")}</h2>
          <span className="section-counter">{availableTalentPoints}/{talentPoints}</span>
        </div>
        {featureUnlocks.doctrine ? (
          <div className="talent-doctrine-strip" data-tutorial-anchor="doctrine-strip">
            <div>
              <small>{displayFrameName(frame.id, frame.displayName)}</small>
              <strong>{selectedDoctrine ? dataName("doctrine", selectedDoctrine.id, selectedDoctrine.displayName) : t("ui.talent.noDoctrine")}</strong>
            </div>
            <button className="arena-button" onClick={() => setDoctrineExpanded((value) => !value)} type="button">
              {doctrineExpanded ? t("ui.control.collapse") : t("ui.control.expand")}
            </button>
          </div>
        ) : null}
        {featureUnlocks.doctrine && doctrineExpanded ? (
          <div className="doctrine-grid doctrine-grid-compact" aria-label={t("ui.aria.doctrinePaths")}>
            {frameDoctrines.map((doctrine) => {
              const active = doctrine.id === doctrineId;
              return (
                <button className={active ? "doctrine-card doctrine-card-active" : "doctrine-card"} key={doctrine.id} onClick={() => selectDoctrine(active ? null : doctrine.id)} type="button">
                  <small>{active ? t("ui.talent.doctrineActive") : displayFrameName(frame.id, frame.displayName)}</small>
                  <strong>{dataName("doctrine", doctrine.id, doctrine.displayName)}</strong>
                  <span>{dataDescription("doctrine", doctrine.id, doctrine.description)}</span>
                </button>
              );
            })}
          </div>
        ) : featureUnlocks.doctrine && selectedDoctrine ? (
          <div className="doctrine-detail doctrine-detail-compact">
            <div className="talent-detail-lines">
              {formatDoctrineLines(selectedDoctrine).slice(0, 2).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          </div>
        ) : null}
        <TalentTreeView
          activeTalentIds={talentIds}
          canUseTalent={(talentId) => (talentIds.includes(talentId) ? canRefundTalent(talentId) : canAllocateTalent(talentId))}
          nodes={talentNodes}
          onSelectTalent={inspectTalent}
          selectedTalentId={selectedTalentId}
        />
        <div className="talent-note">
          {talentIds.length} 個已啟用節點 / {availableTalentPoints} 點可用
        </div>
      </section>
    );
  };

  const toggleRunning = () => {
    if (runtimeRef.current.outcome !== "ongoing") {
      setRuntime(runtimeRef.current);
      return;
    }
    if (running) {
      setRuntime(runtimeRef.current);
    }
    setRunning((value) => !value);
  };

  const startIdleFromHome = () => {
    setScreen("combat");
    if (!running && !runtimeDefeated) {
      toggleRunning();
    }
  };

  const renderHomePanel = () => {
    const recentDropCount = lootNotices.filter((notice) => notice.tone === "drop").length;
    const visibleDropCount = Math.max(runtime.drops.length, recentDropCount, offlineReport?.parts.length ?? 0);
    const idleNode = selectedOfflineNodeId ? circuitNetworkNodes.find((node) => node.id === selectedOfflineNodeId) ?? null : recommendedOfflineNode;
    const idleTargetName = idleNode ? dataName("network", idleNode.id, idleNode.displayName) : dataName("arena", arena.id, arena.displayName);
    const progressTargetName = recommendedProgressNode ? dataName("network", recommendedProgressNode.id, recommendedProgressNode.displayName) : dataName("arena", arena.id, arena.displayName);
    const nextRouteName = selectedArenaKey ? formatKeyTitle(selectedArenaKey) : bossProjection.successChance >= 0.5 ? "Boss 可以挑戰" : progressTargetName;
    const selectedPartSignal = selectedPartRetention?.label ?? selectedPartVerdict?.label ?? (selectedPart ? displayPartName(selectedPart) : "尚未選取裝備");
    const offlineText = offlineReport
      ? `${formatNumber(offlineReport.kills, 0)} 擊破 / ${offlineReport.parts.length} 件掉落`
      : `${formatNumber(selectedRouteStrategy.offline.killsPerHour, 0)} 擊殺/時 / ${formatNumber(selectedRouteStrategy.offline.dropsPerHour, 1)} 件/時`;
    const primaryScore = buildArchetypeProjection.scores.find((score) => score.id === buildArchetypeProjection.primary)?.score ?? 0;
    const currentMainObjective =
      chapterProgress.complete
        ? "第一章已完成，開始挑選長線刷裝關卡。"
        : `主線 ${chapterProgress.done}/${chapterProgress.total}，先把下一關打開。`;
    let primaryAction: {
      tone: DecisionCueTone;
      icon: ReactNode;
      title: string;
      detail: string;
      button: string;
      onClick: () => void;
    };

    if (offlineReport) {
      primaryAction = {
        tone: "rare",
        icon: <PackageOpen size={22} aria-hidden />,
        title: "收取離線收益",
        detail: offlineText,
        button: "收取",
        onClick: openOfflineWorkbench,
      };
    } else if (running) {
      primaryAction = {
        tone: "good",
        icon: <Pause size={22} aria-hidden />,
        title: "正在自動刷裝",
        detail: `${dataName("arena", arena.id, arena.displayName)}，目前 ${formatNumber(runtime.mapKills, 0)}/${formatNumber(runtime.mapKillTarget, 0)} 擊破。`,
        button: "查看戰鬥",
        onClick: () => setScreen("combat"),
      };
    } else if (visibleDropCount > 0) {
      primaryAction = {
        tone: "rare",
        icon: <PackageOpen size={22} aria-hidden />,
        title: `整理 ${visibleDropCount} 件戰利品`,
        detail: selectedPartSignal,
        button: "打開背包",
        onClick: () => openPanel("inventory"),
      };
    } else if (selectedPartVerdict?.action === "equip") {
      primaryAction = {
        tone: "good",
        icon: <PackageOpen size={22} aria-hidden />,
        title: "裝上推薦裝備",
        detail: selectedPartVerdict.detail,
        button: "打開背包",
        onClick: () => openPanel("inventory"),
      };
    } else if (selectedPartVerdict?.action === "forge" || canForgeSelectedPart) {
      primaryAction = {
        tone: "rare",
        icon: <Hammer size={22} aria-hidden />,
        title: "強化目前裝備",
        detail: selectedPartVerdict?.detail ?? "有裝備可以強化。",
        button: "去強化",
        onClick: () => openPanel("forge"),
      };
    } else if (selectedArenaKey || bossProjection.successChance >= 0.5) {
      primaryAction = {
        tone: "rare",
        icon: <MapIcon size={22} aria-hidden />,
        title: "挑戰下一關",
        detail: nextRouteName,
        button: "看關卡",
        onClick: openMap,
      };
    } else {
      primaryAction = {
        tone: "neutral",
        icon: <Play size={22} aria-hidden />,
        title: "開始刷裝",
        detail: `${idleTargetName} 會自動戰鬥、掉裝並推進主線。`,
        button: "開始",
        onClick: startIdleFromHome,
      };
    }

    return (
      <section className="screen-panel home-screen-panel">
        <div className="home-hub">
          <section className={`home-primary home-primary-${primaryAction.tone}`}>
            <div className="home-primary-head">
              <small>主畫面</small>
              <h1>戰鬥據點</h1>
              <span>回來收戰利品、強化裝備，然後挑戰下一關。</span>
            </div>
            <div className="home-primary-action">
              <span className="home-primary-icon">{primaryAction.icon}</span>
              <div>
                <strong>{primaryAction.title}</strong>
                <p>{primaryAction.detail}</p>
              </div>
              <button className="arena-button" onClick={primaryAction.onClick} type="button">
                {primaryAction.button}
              </button>
            </div>
            <div className="home-status-grid">
              <span>
                <small>刷裝關卡</small>
                <strong>{idleTargetName}</strong>
              </span>
              <span>
                <small>離線收益</small>
                <strong>{offlineText}</strong>
              </span>
              <span>
                <small>戰利品</small>
                <strong>{inventory.length}/{inventoryCapacity}</strong>
              </span>
              <span>
                <small>主線</small>
                <strong>{chapterProgress.done}/{chapterProgress.total}</strong>
              </span>
            </div>
          </section>

          <section className="home-panel home-goals">
            <div className="section-title">
              <Radar size={17} aria-hidden />
              <h2>下一步</h2>
              <span className="section-counter">{running ? "掛機中" : "待命"}</span>
            </div>
            <p>{currentMainObjective}</p>
            <div className="home-goal-list">
              <button className="home-goal-row" onClick={startIdleFromHome} type="button">
                <Play size={16} aria-hidden />
                <span>
                  <strong>{running ? "查看戰鬥" : "開始刷裝"}</strong>
                  <small>{dataName("arena", arena.id, arena.displayName)}</small>
                </span>
              </button>
              <button className="home-goal-row" onClick={() => openPanel("inventory")} type="button">
                <PackageOpen size={16} aria-hidden />
                <span>
                  <strong>整理背包</strong>
                  <small>{selectedPartSignal}</small>
                </span>
              </button>
              <button className="home-goal-row" onClick={() => openPanel("forge")} type="button">
                <Hammer size={16} aria-hidden />
                <span>
                  <strong>強化裝備</strong>
                  <small>{canForgeSelectedPart ? "目前有可用強化" : "查看材料與推薦裝備"}</small>
                </span>
              </button>
              <button className="home-goal-row" onClick={openMap} type="button">
                <MapIcon size={16} aria-hidden />
                <span>
                  <strong>挑戰下一關</strong>
                  <small>{progressTargetName}</small>
                </span>
              </button>
            </div>
          </section>

          <section className="home-panel home-build">
            <div className="section-title">
              <Activity size={17} aria-hidden />
              <h2>目前戰力</h2>
              <span className="section-counter">{buildArchetypeLabel(buildArchetypeProjection.primary)}</span>
            </div>
            <div className="home-build-main">
              <strong>{displayFrameName(frame.id, frame.displayName)}</strong>
              <span>{dataName("drive", drive.id, drive.displayName)} / {formatPercent(primaryScore, 0)} 成形</span>
            </div>
            <div className="home-stat-row">
              <span>
                <small>DPS</small>
                <strong>{formatNumber(dpsBreakdown.totalDps, 0)}</strong>
              </span>
              <span>
                <small>耐久</small>
                <strong>{formatNumber(currentStats.maxSpinIntegrity + currentStats.guard, 0)}</strong>
              </span>
              <span>
                <small>命中</small>
                <strong>{formatNumber(currentStats.tracking, 0)}</strong>
              </span>
            </div>
          </section>

          <section className="home-panel home-route">
            <div className="section-title">
              <MapIcon size={17} aria-hidden />
              <h2>下一關</h2>
              <span className="section-counter">{routeStrategyActionLabel(selectedRouteStrategy.action)}</span>
            </div>
            <p>{progressTargetName}</p>
            <div className="home-stat-row">
              <span>
                <small>風險</small>
                <strong>{formatPercent(selectedRouteStrategy.riskScore, 0)}</strong>
              </span>
              <span>
                <small>獎勵</small>
                <strong>{formatPercent(selectedRouteStrategy.rewardScore, 0)}</strong>
              </span>
              <span>
                <small>清場</small>
                <strong>{formatPercent(selectedRouteStrategy.clearSpeedScore, 0)}</strong>
              </span>
            </div>
          </section>
        </div>
      </section>
    );
  };

  const renderLoadoutWorkbench = () => (
    <>
      {renderBuildSummaryPanel()}
      {renderLoadoutPanel()}
    </>
  );

  const renderWorkbenchMainContent = () => (
    <div className="workbench-main">
      {activePanel === "loadout" && renderLoadoutWorkbench()}
      {activePanel === "inventory" && renderInventoryPanel()}
      {activePanel === "skills" && renderSkillsPanel()}
      {activePanel === "forge" && renderForgePanel()}
      {activePanel === "talents" && renderTalentsPanel()}
    </div>
  );

  const renderCombatDataPanel = () => (
    <section className="workbench-section combat-data-section">
      <div className="section-title">
        <Activity size={17} aria-hidden />
        <h2>{t("ui.section.combatData")}</h2>
        <button className="section-counter section-counter-button" onClick={() => setCombatDataExpanded((value) => !value)} type="button">
          {combatDataExpanded ? t("ui.control.collapse") : t("ui.control.expand")}
        </button>
      </div>
      {combatDataExpanded ? (
        <div className="inspection-grid inspection-grid-workbench">
          <section className="inspection-card">
            <div className="inspection-card-head">
              <div className="inspection-card-title">
                <strong>{t("ui.section.damageBreakdown")}</strong>
                <small>{t("ui.damage.target")}: {dpsBreakdown.targetName ? localizeEntityName(dpsBreakdown.targetName) : dataName("arena", arena.id, arena.displayName)}</small>
              </div>
              <span>{formatNumber(dpsBreakdown.totalDps, 1)} DPS</span>
            </div>
            <div className="damage-pipeline">
              <span>{t("ui.damage.base")} <strong>{formatNumber(dpsBreakdown.collisionSeed, 1)}</strong></span>
              <span>{t("ui.damage.flat")} <strong>{formatNumber(dpsBreakdown.flatTotal, 1)}</strong></span>
              <span>{t("ui.damage.increased")} <strong>{formatPercent(dpsBreakdown.increasedTotal - dpsBreakdown.reducedTotal, 0)}</strong></span>
              <span>{t("ui.damage.moreLess")} <strong>x{round(dpsBreakdown.moreProduct * dpsBreakdown.lessProduct, 2)}</strong></span>
              <span>{t("ui.damage.conversion")} <strong>{formatNumber(dpsBreakdown.rawDamage, 1)}</strong></span>
              <span>{t("ui.damage.mitigation")} <strong>x{round(dpsBreakdown.mitigationMultiplier, 2)}</strong></span>
              <span>{t("ui.damage.critEv")} <strong>x{round(dpsBreakdown.critExpectedMultiplier, 2)}</strong></span>
              <span>{t("ui.damage.frequency")} <strong>{round(dpsBreakdown.attackFrequency, 2)}/秒</strong></span>
            </div>
            <div className="damage-components">
              <span>{t("ui.damage.collisionDps")} <strong>{formatNumber(dpsBreakdown.collisionDps, 1)}</strong></span>
              <span>{t("ui.damage.driveDps")} <strong>{formatNumber(dpsBreakdown.driveDps, 1)}</strong></span>
              <span>{t("ui.damage.dotDps")} <strong>{formatNumber(dpsBreakdown.dotDps, 1)}</strong></span>
            </div>
            <div className="modifier-status-list">
              {damageModifierLines.length > 0 ? (
                <>
                  {damageModifierLines.length > 8 ? <span className="modifier-overflow-note">{t("ui.damage.moreModifiers", { count: damageModifierLines.length - 8 })}</span> : null}
                  {damageModifierLines.map((line) => (
                    <span className={line.active ? "modifier-status modifier-active" : "modifier-status modifier-standby"} key={line.id}>
                      <small>{line.active ? t("ui.damage.active") : t("ui.damage.standby")}</small>
                      <strong>{term("modifier", line.type, line.type)} {statLabel(line.stat ?? "damage")} {formatPercent(line.value, 0)}</strong>
                      <em>{t("ui.damage.source")}: {displaySourceName(line.sourceId)}</em>
                    </span>
                  ))}
                </>
              ) : (
                <span className="empty-drop">{t("ui.damage.noConditional")}</span>
              )}
            </div>
          </section>
          <section className="inspection-card">
            <div className="inspection-card-head">
              <strong>{t("ui.section.breakpoints")}</strong>
              <span>{breakpointStatuses.filter((status) => status.triggered).length}/{breakpointStatuses.length}</span>
            </div>
            <div className="breakpoint-list">
              {breakpointStatuses.length > 0 ? (
                breakpointStatuses.map((status) => (
                  <span className={[status.triggered ? "breakpoint-line breakpoint-active" : "breakpoint-line breakpoint-waiting", status.penalty ? "breakpoint-penalty" : ""].filter(Boolean).join(" ")} key={`${status.id}_${status.attr}_${status.op}`}>
                    <strong>{displaySourceName(status.sourceId)}</strong>
                    <small>
                      {term("stat", status.attr)} {formatNumber(status.currentValue, status.attr === "spinEnergyRatio" || status.attr === "fluxRatio" ? 2 : 1)} / {status.op} {formatNumber(status.value, status.attr === "spinEnergyRatio" || status.attr === "fluxRatio" ? 2 : 1)}
                    </small>
                    <em>{status.penalty ? `${t("ui.breakpoint.penaltyPrefix")} ${breakpointDeltaText(status)}` : breakpointDeltaText(status)}</em>
                  </span>
                ))
              ) : (
                <span className="empty-drop">{t("ui.breakpoint.none")}</span>
              )}
            </div>
          </section>
        </div>
      ) : (
        <span className="empty-drop combat-data-collapsed">{t("ui.combatData.collapsed")}</span>
      )}
    </section>
  );

  const renderWorkbenchInspectorContent = () => {
    if (activePanel === "skills") {
      return renderSkillInspector();
    }
    if (activePanel === "talents") {
      return renderTalentInspector();
    }
    if (activePanel === "forge") {
      return renderSelectedPartInspector({ title: t("ui.section.forgeTarget"), showForgeAction: false });
    }
    if (activePanel === "loadout") {
      return (
        <>
          {renderSelectedPartInspector({ title: t("ui.section.selectedPart") })}
          {renderCombatDataPanel()}
        </>
      );
    }
    if (activePanel === "inventory") {
      return renderSelectedPartInspector({ title: t("ui.section.selectedPart") });
    }
    return null;
  };

  const renderWorkbenchContent = () => {
    const inspectorContent = renderWorkbenchInspectorContent();
    return (
      <div className={`workbench-split workbench-split-${activePanel}`}>
        {renderWorkbenchMainContent()}
        {inspectorContent ? (
          <>
            <button className={inspectorOpen ? "inspector-backdrop inspector-backdrop-open" : "inspector-backdrop"} aria-label={t("ui.control.close")} onClick={() => setInspectorOpen(false)} type="button" />
            <aside className={inspectorOpen ? "workbench-inspector workbench-inspector-open" : "workbench-inspector"} aria-label={t("ui.section.inspector")}>
              <div className="inspector-drawer-head">
                <strong>{t("ui.section.inspector")}</strong>
                <button className="icon-button" aria-label={t("ui.control.close")} onClick={() => setInspectorOpen(false)} type="button">
                  <X size={15} aria-hidden />
                </button>
              </div>
              {inspectorContent}
            </aside>
          </>
        ) : null}
      </div>
    );
  };
  const renderTuningPanel = () => (
    <div className="arena-tuning-panel" aria-label={t("ui.aria.combatTuning")}>
      <div className="arena-tuning-head">
        <div>
          <small>{t("ui.tuning.dev")}</small>
          <strong>{t("ui.tuning.title")}</strong>
        </div>
        <button className="arena-button arena-tuning-reset" onClick={() => setArenaTuning(defaultArenaTuning)} type="button">
          {t("ui.control.reset")}
        </button>
      </div>
      <div className="arena-tuning-controls">
        {arenaTuningControls.map((control) => (
          <label className="arena-tuning-control" key={control.key}>
            <span>
              {t(`ui.tuning.${control.key}`)}
              <strong>{round(arenaTuning[control.key], 2)}x</strong>
            </span>
            <input
              max={control.max}
              min={control.min}
              onChange={(event) => updateArenaTuning(control.key, Number(event.target.value))}
              step={control.step}
              type="range"
              value={arenaTuning[control.key]}
            />
          </label>
        ))}
      </div>
    </div>
  );

  const renderNextActionStrip = () => {
    const recentDropCount = lootNotices.filter((notice) => notice.tone === "drop").length;
    const visibleDropCount = Math.max(runtime.drops.length, recentDropCount);
    const selectedPartSignal = selectedPartVerdict ? selectedPartVerdict.label : selectedPart ? displayPartName(selectedPart) : t("ui.inventory.noPart");
    const routeSignal = runtime.bossSpawned
      ? "Boss 啟動"
      : runtime.mapKills >= runtime.mapKillTarget
        ? t("ui.objective.bossReady")
        : `${formatNumber(runtime.mapKills, 0)}/${formatNumber(runtime.mapKillTarget, 0)} 清場`;
    let action: NextActionPrompt;

    if (runtimeError) {
      action = {
        tone: "warn",
        icon: <RotateCcw size={17} aria-hidden />,
        label: t("ui.next.resetLoop"),
        detail: runtimeError,
        button: t("ui.control.reset"),
        cues: [
          { label: t("ui.next.now"), value: t("ui.next.stopped"), tone: "warn" },
          { label: t("ui.next.signal"), value: t("ui.next.runtimeHalted"), tone: "warn" },
          { label: t("ui.next.then"), value: t("ui.next.restartRun") },
        ],
        onClick: resetCurrentRun,
      };
    } else if (runtimeDefeated) {
      action = {
        tone: "warn",
        icon: <AlertTriangle size={17} aria-hidden />,
        label: t("ui.next.runDefeated"),
        detail: `${defeatCauseLabel} / ${defeatCauseDetail}`,
        button: t("ui.screen.map"),
        cues: [
          { label: t("ui.next.now"), value: defeatCauseLabel, tone: "warn" },
          { label: t("ui.next.signal"), value: defeatCauseDetail, tone: "warn" },
          { label: t("ui.next.then"), value: t("ui.next.adjustBuild") },
        ],
        onClick: openMap,
      };
    } else if (running && dangerCue) {
      action = {
        tone: dangerCue.tone === "danger" ? "warn" : dangerCue.tone,
        icon: <AlertTriangle size={17} aria-hidden />,
        label: dangerCue.tone === "danger" ? t("ui.next.breakDanger") : dangerCue.label,
        detail: dangerCue.detail,
        button: t("ui.control.pause"),
        cues: [
          { label: t("ui.next.now"), value: dangerCue.label, tone: dangerCue.tone === "danger" ? "warn" : dangerCue.tone },
          { label: t("ui.next.signal"), value: formatPercent(clamp(dangerCue.progress, 0, 1), 0), tone: dangerCue.tone === "danger" ? "warn" : dangerCue.tone },
          { label: t("ui.next.then"), value: playerIntegrity < 0.35 ? t("ui.next.checkBuild") : routeSignal },
        ],
        onClick: toggleRunning,
      };
    } else if (running && runtime.drops.length > 0) {
      action = {
        tone: "rare",
        icon: <PackageOpen size={17} aria-hidden />,
        label: t("ui.next.lootOpen"),
        detail: `本場有 ${runtime.drops.length} 件掉落`,
        button: t("ui.control.pause"),
        cues: [
          { label: t("ui.next.now"), value: t("ui.next.secureDrops"), tone: "rare" },
          { label: t("ui.next.signal"), value: runReview.bestDropText, tone: runReview.tone },
          { label: t("ui.next.then"), value: t("ui.next.openLoot") },
        ],
        onClick: toggleRunning,
      };
    } else if (running && runtime.bossSpawned) {
      action = {
        tone: "rare",
        icon: <Flame size={17} aria-hidden />,
        label: t("ui.next.bossWave"),
        detail: t("ui.objective.shatterBoss"),
        button: t("ui.control.pause"),
        cues: [
          { label: t("ui.next.now"), value: t("ui.next.finishBoss"), tone: "rare" },
          { label: t("ui.next.signal"), value: routeSignal, tone: "rare" },
          { label: t("ui.next.then"), value: t("ui.next.checkRouteKey") },
        ],
        onClick: toggleRunning,
      };
    } else if (running && runtime.mapKills >= runtime.mapKillTarget) {
      action = {
        tone: "rare",
        icon: <Flame size={17} aria-hidden />,
        label: t("ui.next.bossDropping"),
        detail: t("ui.objective.fieldClear"),
        button: t("ui.control.pause"),
        cues: [
          { label: t("ui.next.now"), value: t("ui.next.holdCenter"), tone: "rare" },
          { label: t("ui.next.signal"), value: "150+ 已清場", tone: "rare" },
          { label: t("ui.next.then"), value: t("ui.next.fightBoss") },
        ],
        onClick: toggleRunning,
      };
    } else if (running) {
      action = {
        tone: "good",
        icon: <Pause size={17} aria-hidden />,
        label: t("ui.next.clearBasin"),
        detail: t("ui.objective.rivalsBeforeBoss", { count: formatNumber(Math.max(0, runtime.mapKillTarget - runtime.mapKills), 0) }),
        button: t("ui.control.pause"),
        cues: [
          { label: t("ui.next.now"), value: t("ui.next.keepFarming"), tone: "good" },
          { label: t("ui.next.signal"), value: routeSignal },
          { label: t("ui.next.then"), value: visibleDropCount > 0 ? "檢視戰利品" : t("ui.next.pushBoss") },
        ],
        onClick: toggleRunning,
      };
    } else if (visibleDropCount > 0) {
      action = {
        tone: "rare",
        icon: <PackageOpen size={17} aria-hidden />,
        label: t("ui.next.dropsReady", { count: visibleDropCount }),
        detail: selectedPart ? displayPartName(selectedPart) : "打開背包",
        button: t("ui.control.loot"),
        cues: [
          { label: t("ui.next.now"), value: t("ui.next.inspectLoot"), tone: "rare" },
          { label: t("ui.next.signal"), value: selectedPartSignal, tone: selectedPartVerdict?.tone },
          { label: t("ui.next.then"), value: selectedPartVerdict?.action === "forge" ? t("ui.next.forgeRoll") : t("ui.next.restart") },
        ],
        onClick: () => openPanel("inventory"),
      };
    } else if (selectedPartVerdict?.action === "forge") {
      action = {
        tone: "rare",
        icon: <Recycle size={17} aria-hidden />,
        label: t("ui.next.forgeCandidate"),
        detail: selectedPartVerdict.detail,
        button: t("ui.control.forge"),
        cues: [
          { label: t("ui.next.now"), value: t("ui.next.craftPart"), tone: "rare" },
          { label: t("ui.next.signal"), value: selectedPartVerdict.label, tone: selectedPartVerdict.tone },
          { label: t("ui.next.then"), value: t("ui.next.recheckBuild") },
        ],
        onClick: () => openPanel("forge"),
      };
    } else if (selectedPartVerdict?.action === "equip") {
      action = {
        tone: "good",
        icon: <PackageOpen size={17} aria-hidden />,
        label: t("ui.next.equipUpgrade"),
        detail: selectedPartVerdict.detail,
        button: t("ui.control.loot"),
        cues: [
          { label: t("ui.next.now"), value: t("ui.next.swapPart"), tone: "good" },
          { label: t("ui.next.signal"), value: selectedPartVerdict.label, tone: selectedPartVerdict.tone },
          { label: t("ui.next.then"), value: t("ui.next.startRun") },
        ],
        onClick: () => openPanel("inventory"),
      };
    } else if (selectedArenaKey) {
      const keySummary = selectedArenaKeySummary ?? summarizeArenaKeyRiskReward(selectedArenaKey);
      const keyEnemyPressure = Math.max(keySummary.enemyIntegrityMultiplier, keySummary.enemyImpactMultiplier, keySummary.enemyGuardMultiplier, keySummary.enemyRpmMultiplier) - 1;
      const keyReward = keySummary.rewardQuantity + keySummary.rewardRarity;
      action = {
        tone: "rare",
        icon: <Flame size={17} aria-hidden />,
        label: t("ui.next.keyReady"),
        detail: formatKeyTitle(selectedArenaKey),
        button: t("ui.screen.map"),
        cues: [
          { label: t("ui.next.now"), value: t("ui.next.chooseRoute"), tone: "rare" },
          { label: t("ui.next.signal"), value: `風險 ${formatPercent(keyEnemyPressure, 0)}`, tone: keyEnemyPressure > 0 ? "warn" : "neutral" },
          { label: t("ui.next.then"), value: `獎勵 ${formatPercent(keyReward, 0)}`, tone: "rare" },
        ],
        onClick: openMap,
      };
    } else if (bossProjection.successChance >= 0.5 && !clearedBossGateIds.includes(bossProjection.gateId)) {
      action = {
        tone: "rare",
        icon: <Network size={17} aria-hidden />,
        label: t("ui.next.bossViable"),
        detail: `推估 ${formatPercent(bossProjection.successChance, 0)}`,
        button: t("ui.screen.map"),
        cues: [
          { label: t("ui.next.now"), value: t("ui.next.attemptGate"), tone: "rare" },
          { label: t("ui.next.signal"), value: `${formatPercent(bossProjection.successChance, 0)} 機率`, tone: "rare" },
          { label: t("ui.next.then"), value: t("ui.next.unlockRoute") },
        ],
        onClick: openMap,
      };
    } else {
      action = {
        tone: "neutral",
        icon: <Play size={17} aria-hidden />,
        label: t("ui.next.ready"),
        detail: dataName("arena", arena.id, arena.displayName),
        button: t("ui.control.start"),
        cues: [
          { label: t("ui.next.now"), value: t("ui.next.startFarming") },
          { label: t("ui.next.signal"), value: `${formatPercent(bossProjection.successChance, 0)} 門` },
          { label: t("ui.next.then"), value: t("ui.next.improveBuild") },
        ],
        onClick: toggleRunning,
      };
    }

    return (
      <section className={`next-action-strip next-action-${action.tone}`} aria-label={t("ui.aria.nextAction")}>
        <span className="next-action-icon">{action.icon}</span>
        <div className="next-action-copy">
          <strong>{action.label}</strong>
          <span>{action.detail}</span>
        </div>
        <div className="next-action-cues" aria-label={t("ui.aria.decisionSignals")}>
          {action.cues.map((cue) => (
            <span className={`decision-chip decision-chip-${cue.tone ?? action.tone}`} key={cue.label}>
              <small>{cue.label}</small>
              <strong>{cue.value}</strong>
            </span>
          ))}
        </div>
        <button className="arena-button" onClick={action.onClick} type="button">
          {action.button}
        </button>
      </section>
    );
  };

  return (
    <main className={["top-arena-shell", `top-arena-screen-${screen}`, running ? "top-arena-running" : "", currentArenaKey ? "top-arena-keyed" : "", runtimeDefeated ? "top-arena-defeated" : ""].filter(Boolean).join(" ")}>
      <header className="arena-topbar">
        <div className="arena-brand">
          <div className="brand-sigil">
            <Swords size={22} aria-hidden />
          </div>
          <div>
            <strong>{t("ui.brand.name")}</strong>
            <span>{t("ui.brand.subtitle")}</span>
          </div>
        </div>
        <div className="wallet-strip">
          <span className={runtimeDefeated ? "run-state run-state-defeated" : running ? "run-state run-state-live" : "run-state"}>{runtimeDefeated ? t("ui.state.defeated") : running ? t("ui.state.live") : t("ui.state.ready")}</span>
          {currentArenaKey ? <span className="run-state run-state-keyed">{t("ui.state.keyed")}</span> : null}
          {featureUnlocks.wallet ? (
            <>
              <span>{t("ui.resource.ash")} {wallet.ash}</span>
              <span>{t("ui.resource.glass")} {wallet.glass}</span>
              <span>{t("ui.resource.echo")} {wallet.echo}</span>
            </>
          ) : null}
        </div>
        <div className="arena-controls" aria-label={t("ui.aria.arenaControls")}>
          <div className="screen-tabs" aria-label={t("ui.aria.mainScreens")}>
            <ScreenTab active={screen === "home"} icon={<Boxes size={15} aria-hidden />} label="主畫面" onClick={() => setScreen("home")} />
            <ScreenTab active={screen === "combat"} icon={<Swords size={15} aria-hidden />} label={t("ui.screen.combat")} onClick={() => setScreen("combat")} />
            <ScreenTab active={screen === "map"} icon={<MapIcon size={15} aria-hidden />} label={t("ui.screen.map")} onClick={openMap} tutorialAnchor="screen-map" />
            <ScreenTab active={screen === "workbench"} icon={<Hammer size={15} aria-hidden />} label={t("ui.screen.workbench")} onClick={() => setScreen("workbench")} />
          </div>
          <button className={running ? "arena-button arena-button-live" : "arena-button"} data-tutorial-anchor="start-button" disabled={runtimeDefeated} onClick={screen === "home" && !running ? startIdleFromHome : toggleRunning} type="button">
            {running ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {runtimeDefeated ? t("ui.state.defeated") : running ? t("ui.control.pause") : t("ui.control.start")}
          </button>
          <div className="arena-options">
            <button className={optionsOpen ? "arena-button arena-button-debug-active" : "arena-button"} aria-expanded={optionsOpen} onClick={() => setOptionsOpen((value) => !value)} type="button">
              <SlidersHorizontal size={16} aria-hidden />
              {t("ui.control.options")}
            </button>
            {optionsOpen ? (
              <div className="arena-options-menu">
                <button
                  className="arena-menu-item"
                  onClick={() => {
                    startTutorialReplay();
                    setOptionsOpen(false);
                  }}
                  type="button"
                >
                  <Sparkles size={15} aria-hidden />
                  {t("ui.tutorial.replay")}
                </button>
                <button
                  className="arena-menu-item"
                  onClick={() => {
                    resetCurrentRun();
                    setOptionsOpen(false);
                  }}
                  type="button"
                >
                  <RotateCcw size={15} aria-hidden />
                  {t("ui.control.reset")}
                </button>
                {devOptionsEnabled ? (
                  <>
                    <button
                      aria-pressed={showDebugHud}
                      className={showDebugHud ? "arena-menu-item arena-menu-item-active" : "arena-menu-item"}
                      onClick={() => setShowDebugHud((value) => !value)}
                      type="button"
                    >
                      <Gauge size={15} aria-hidden />
                      {t("ui.control.debug")}
                    </button>
                    <button
                      aria-pressed={showTuningHud}
                      className={showTuningHud ? "arena-menu-item arena-menu-item-active" : "arena-menu-item"}
                      onClick={() => setShowTuningHud((value) => !value)}
                      type="button"
                    >
                      <SlidersHorizontal size={15} aria-hidden />
                      {t("ui.control.tune")}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="speed-tabs" aria-label={t("ui.control.speed")}>
            {[1, 2, 4].map((value) => (
              <button className={speed === value ? "speed-tab speed-tab-active" : "speed-tab"} key={value} onClick={() => setSpeed(value)} type="button">
                {value}x
              </button>
            ))}
          </div>
        </div>
      </header>

      {renderNextActionStrip()}

      <section className={`arena-layout arena-layout-${screen}`}>
        {screen === "home" ? renderHomePanel() : null}

        {screen === "combat" ? (
        <section className={["arena-stage-panel", running ? "arena-stage-live" : "", currentArenaKey ? "arena-stage-keyed" : ""].filter(Boolean).join(" ")}>
          <div className="arena-stage-header">
            <div>
              <span className="arena-kicker">
                {[dataName("arena", arena.id, arena.displayName), runtime.activeEvent ? dataName("arenaEvent", runtime.activeEvent.eventId, runtime.activeEvent.displayName) : null, activeAnomaly ? dataName("anomaly", activeAnomaly.id, activeAnomaly.displayName) : null]
                  .filter(Boolean)
                  .join(" / ")}
              </span>
              <h1>{displayFrameName(frame.id, frame.displayName)}</h1>
            </div>
            <div className={target ? "target-strip target-strip-active" : "target-strip"}>
              <div>
                <span>{target ? localizeEntityName(target.name) : t("ui.target.none")}</span>
                <strong>{target ? `${formatPercent(targetIntegrity, 0)} ${t("ui.target.integrity")}` : t("ui.target.spooling")}</strong>
              </div>
              {target ? (
                <div className="target-meter" aria-hidden>
                  <i style={{ width: `${targetIntegrity * 100}%` }} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="canvas-wrap">
            <ArenaPhaserView onMetrics={showDebugHud ? setRendererMetrics : undefined} runtime={runtime} runtimeRef={runtimeRef} tuning={arenaTuning} />
            {offlineReport ? (
              <div className="offline-report-overlay" role="dialog" aria-label={t("ui.aria.offlineReport")}>
                <small>{t("ui.offline.title")}</small>
                <strong>{t("ui.offline.kills", { kills: formatNumber(offlineReport.kills, 0) })}</strong>
                <span>
                  {t("ui.offline.minutes", { minutes: formatNumber(offlineReport.effectiveSeconds / 60, 0) })}
                  {offlineReport.cappedByTime ? ` / ${t("ui.offline.capped")}` : ""}
                </span>
                <div className="offline-report-grid">
                  <span>
                    {t("ui.offline.drops")} <strong>{offlineReport.parts.length}</strong>
                  </span>
                  <span>
                    {t("ui.resource.ash")} <strong>{offlineReport.wallet.ash}</strong>
                  </span>
                  <span>
                    {t("ui.resource.glass")} <strong>{offlineReport.wallet.glass}</strong>
                  </span>
                  <span>
                    {t("ui.resource.echo")} <strong>{offlineReport.wallet.echo}</strong>
                  </span>
                </div>
                <div className="offline-report-next">
                  <span>
                    <small>目前掛點</small>
                    <strong>{offlineReportNode ? dataName("network", offlineReportNode.id, offlineReportNode.displayName) : dataName("arena", offlineReport.targetArenaId, getArenaCircuitDef(offlineReport.targetArenaId).displayName)}</strong>
                  </span>
                  <span>
                    <small>推薦掛點</small>
                    <strong>{recommendedOfflineNode ? dataName("network", recommendedOfflineNode.id, recommendedOfflineNode.displayName) : "-"}</strong>
                  </span>
                  <span>
                    <small>推進線</small>
                    <strong>{recommendedProgressNode ? dataName("network", recommendedProgressNode.id, recommendedProgressNode.displayName) : "-"}</strong>
                  </span>
                </div>
                <div className="offline-report-actions">
                  <button className="arena-button" onClick={continueOfflineRoute} type="button">
                    <RotateCcw size={15} aria-hidden />
                    繼續掛
                  </button>
                  <button className="arena-button" disabled={!recommendedOfflineNode} onClick={switchToRecommendedOfflineRoute} type="button">
                    <Radar size={15} aria-hidden />
                    改掛推薦
                  </button>
                  <button className="arena-button" disabled={!recommendedProgressNode} onClick={inspectRecommendedProgressRoute} type="button">
                    <MapIcon size={15} aria-hidden />
                    推進線
                  </button>
                  <button className="arena-button" onClick={openOfflineWorkbench} type="button">
                    <Hammer size={15} aria-hidden />
                    回裝備
                  </button>
                  <button className="arena-button arena-button-secondary" onClick={() => setOfflineReport(null)} type="button">
                    {t("ui.control.collect")}
                  </button>
                </div>
              </div>
            ) : null}
            {dangerCue ? (
              <div className={`danger-cue danger-cue-${dangerCue.tone} ${showDebugHud ? "danger-cue-debug-offset" : ""}`} aria-live="polite">
                <AlertTriangle size={15} aria-hidden />
                <div>
                  <strong>{dangerCue.label}</strong>
                  <span>{dangerCue.detail}</span>
                  <i style={{ width: `${clamp(dangerCue.progress, 0, 1) * 100}%` }} />
                </div>
              </div>
            ) : null}
            {featureUnlocks.anomaly && activeAnomaly ? (
              <div className="anomaly-hud-marker" aria-live="polite">
                <small>{t("ui.anomaly.active")}</small>
                <strong>{dataName("anomaly", activeAnomaly.id, activeAnomaly.displayName)}</strong>
                <span>{anomalyRuleLabel(activeAnomaly.playerRule)}</span>
              </div>
            ) : null}
            {showDebugHud ? (
              <div className="arena-renderer-debug" aria-label={t("ui.aria.renderer")}>
                <span>
                  FPS <strong>{round(rendererMetrics.fps, 0)}</strong>
                </span>
                <span>
                  渲染 <strong>{round(rendererMetrics.renderMs, 2)}ms</strong>
                </span>
                <span>
                  {t("ui.hud.objects")} <strong>{rendererMetrics.entities}</strong>
                </span>
                <span>
                  FX <strong>{rendererMetrics.effects}</strong>
                </span>
                <span>
                  {t("ui.hud.drops")} <strong>{rendererMetrics.drops}</strong>
                </span>
                <span>
                  Skip <strong>{rendererMetrics.skippedFrames}</strong>
                </span>
                <span>
                  命中 <strong>{rendererMetrics.lastHitKind ? term("event", rendererMetrics.lastHitKind, rendererMetrics.lastHitKind) : t("ui.hud.idle")}</strong>
                </span>
                <span>
                  {t("ui.hud.flash")} <strong>{rendererMetrics.impactFlash ? "開" : "關"}</strong>
                </span>
                <span className={`renderer-budget renderer-budget-${rendererMetrics.budget}`}>
                  {t("ui.hud.budget")} <strong>{rendererMetrics.budget}</strong>
                </span>
              </div>
            ) : null}
            {runtimeError ? (
              <div className="arena-runtime-error" role="alert">
                <strong>{t("ui.runtimeError.title")}</strong>
                <span>{runtimeError}</span>
                <button className="arena-button" onClick={resetCurrentRun} type="button">
                  <RotateCcw size={15} aria-hidden />
                  {t("ui.control.reset")}
                </button>
              </div>
            ) : null}
            {runtimeDefeated ? (
              <div className="arena-defeat-overlay" role="alert">
                <small>{t("ui.defeat.ended")}</small>
                <strong>{defeatCauseLabel}</strong>
                <span>{defeatCauseDetail}</span>
                <div>
                  <button className="arena-button" onClick={openMap} type="button">
                    <MapIcon size={15} aria-hidden />
                    {t("ui.control.routeMap")}
                  </button>
                  <button className="arena-button" onClick={resetCurrentRun} type="button">
                    <RotateCcw size={15} aria-hidden />
                    {t("ui.control.reset")}
                  </button>
                </div>
              </div>
            ) : null}
            {lootNotices.length > 0 ? (
              <div className="loot-toast-stack" data-tutorial-anchor="loot-notice" aria-live="polite">
                {lootNotices.slice(0, 4).map((notice) => (
                  <div className={["loot-toast", `loot-toast-${notice.tone}`, notice.rarity ? `loot-toast-rarity-${notice.rarity}` : ""].filter(Boolean).join(" ")} key={notice.id}>
                    {notice.text}
                  </div>
                ))}
              </div>
            ) : null}
            {bossEnemy ? (
              <div className="boss-hp-bar" aria-label={t("ui.aria.bossIntegrity")}>
                <span>{localizeEntityName(bossEnemy.name)}</span>
                <strong>{formatPercent(bossIntegrity, 0)}</strong>
                <i style={{ width: `${bossIntegrity * 100}%` }} />
              </div>
            ) : null}
            {eliteEnemies.length > 0 ? (
              <div className="elite-hp-stack" aria-label={t("ui.aria.eliteIntegrity")}>
                {eliteEnemies.map((enemy) => {
                  const ratio = selectLifeRatio(enemy);
                  return (
                    <div className="elite-hp-bar" key={enemy.id}>
                      <span>{localizeEntityName(enemy.name)}</span>
                      <strong>{formatPercent(ratio, 0)}</strong>
                      <i style={{ width: `${ratio * 100}%` }} />
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className={playerFluxLow ? "combat-orb-hud combat-orb-hud-flux-low" : "combat-orb-hud"} aria-label={t("ui.aria.playerOrbs")}>
              <div className="resource-orb resource-orb-life">
                <i style={{ height: `${playerIntegrity * 100}%` }} />
                <div>
                  <small>{t("ui.resource.energyShort")}</small>
                  <strong>{formatPercent(playerIntegrity, 0)}</strong>
                </div>
              </div>
              <div className="resource-orb resource-orb-flux">
                <i style={{ height: `${playerFluxRatio * 100}%` }} />
                <div>
                  <small>{term("stat", "flux")}</small>
                  <strong>{formatPercent(playerFluxRatio, 0)}</strong>
                </div>
              </div>
              <div className={driveGateStatus.unlocked ? "orb-cooldown-pill orb-cooldown-ready" : "orb-cooldown-pill orb-cooldown-locked"}>
                <Zap size={14} aria-hidden />
                <span>{t("ui.hud.drive")}</span>
                <strong>{driveGateStatus.unlocked ? formatPercent(cooldownRatio, 0) : t("ui.skill.locked")}</strong>
                {driveGateStatus.unlocked ? <i style={{ width: `${cooldownRatio * 100}%` }} aria-hidden /> : null}
              </div>
            </div>
          </div>

          {showDebugHud ? (
          <div className="combat-bottom combat-bottom-debug">
            <div className="combat-telemetry">
              <div className="telemetry-grid">
                <StatPill icon={<Gauge size={15} />} label={term("stat", "rpm")} value={round(runtime.player.stats.rpm, 1).toString()} />
                <StatPill icon={<Swords size={15} />} label={term("stat", "impact")} value={formatNumber(runtime.player.stats.impact, 0)} />
                <StatPill icon={<Radar size={15} />} label={term("stat", "tracking")} value={formatNumber(runtime.player.stats.tracking, 0)} />
                <StatPill icon={<Shield size={15} />} label={term("stat", "guard")} value={formatNumber(runtime.player.stats.guard, 0)} />
              </div>
              <div className={collisionDebugClass}>
                <div>
                  <small>{t("ui.hud.collision")}</small>
                  <strong>{lastCollision ? term("event", lastCollision.kind, lastCollision.kind) : t("ui.hud.idle")}</strong>
                </div>
                <span>N {lastCollision ? formatNumber(lastCollision.normalImpulse, 0) : "-"}</span>
                <span>T {lastCollision ? formatNumber(Math.abs(lastCollision.tangentImpulse), 0) : "-"}</span>
                <span>{t("ui.debug.shear")} {lastCollision ? formatNumber(lastCollision.surfaceShear, 0) : "-"}</span>
                <span>{t("ui.debug.spark")} {lastCollision ? round(lastCollision.sparkIntensity, 1) : "-"}</span>
                <span>{t("ui.debug.age")} {lastCollision ? `${round(lastCollision.contactAge, 2)}秒` : "-"}</span>
                <span>{t("ui.debug.spin")} {formatPercent(runtime.player.spinPower / 100, 0)}</span>
                <span>{t("ui.debug.wobble")} {formatPercent(runtime.player.wobble, 0)}</span>
              </div>
              <div className="physical-debug" aria-label={t("ui.aria.physicalTelemetry")}>
                <span>{t("ui.debug.dEqualsM")} {formatNumber(dpsBreakdown.collisionSeed, 1)}</span>
                <span>ω {round(playerOmega, 2)}</span>
                <span>{t("ui.debug.attackFrequency")} {round(playerAttackFrequency, 2)}</span>
                <span>{t("ui.debug.collisionDps")} {formatNumber(dpsBreakdown.collisionDps, 1)}</span>
                <span>{t("ui.damage.driveDps")} {formatNumber(dpsBreakdown.driveDps, 1)}</span>
                <span>{t("ui.damage.dotDps")} {formatNumber(dpsBreakdown.dotDps, 1)}</span>
                <span>{t("ui.debug.fluxToEnergy")} {formatNumber(eSustain.energyPerSecond, 1)}/秒</span>
                <span>{t("ui.debug.sustainFlux")} {formatNumber(eSustain.fluxPerSecond, 1)}/秒</span>
                <span>{t("ui.debug.gate")} {driveGateStatus.unlocked ? t("ui.skill.ready") : t("ui.skill.locked")}</span>
              </div>
            </div>
            <div className="event-feed compact-events">
              {runtime.combatEvents.slice(0, 5).map((event, index) => (
                <div className="event-line event-line-debug" key={`${event.kind}_${event.sourceId}_${event.targetId ?? "self"}_${index}`}>
                  {formatCombatEvent(event)}
                </div>
              ))}
              {runtime.events.map((event) => (
                <div className={`event-line event-line-${event.tone}`} key={event.id}>
                  {translateRuntimeText(event.text)}
                </div>
              ))}
            </div>
          </div>
          ) : null}
        </section>
        ) : null}

        {screen === "map" ? (
          <section className="screen-panel map-screen-panel">
            <div className="screen-panel-head">
              <div>
                <span className="arena-kicker">{currentArenaKey ? t("ui.map.deviceArmed") : t("ui.map.circuitMap")}</span>
                <h1>{t("ui.map.routeMap")}</h1>
              </div>
              <button className="arena-button" onClick={() => setScreen("combat")} type="button">
                <Play size={15} aria-hidden />
                {t("ui.control.combat")}
              </button>
            </div>
            <div className="workbench-content screen-content route-screen-content">
              {renderRoutePanel()}
            </div>
          </section>
        ) : null}

        {screen === "workbench" ? (
        <aside className={showTuningHud ? "workbench-panel workbench-panel-tuning workbench-panel-full" : "workbench-panel workbench-panel-full"}>
          <nav className="panel-tabs" aria-label={t("ui.aria.workbench")}>
            <PanelTab active={activePanel === "loadout"} icon={<CircleDot size={15} aria-hidden />} label={t("ui.panel.loadout")} onClick={() => openPanel("loadout")} />
            <PanelTab active={activePanel === "inventory"} icon={<PackageOpen size={15} aria-hidden />} label={t("ui.panel.inventory")} onClick={() => openPanel("inventory")} />
            {featureUnlocks.skills ? <PanelTab active={activePanel === "skills"} icon={<Sparkles size={15} aria-hidden />} label={t("ui.panel.skills")} onClick={() => openPanel("skills")} tutorialAnchor="tab-skills" /> : null}
            {featureUnlocks.forge ? <PanelTab active={activePanel === "forge"} icon={<Recycle size={15} aria-hidden />} label={t("ui.panel.forge")} onClick={() => openPanel("forge")} tutorialAnchor="tab-forge" /> : null}
            {featureUnlocks.talents ? <PanelTab active={activePanel === "talents"} icon={<Network size={15} aria-hidden />} label={t("ui.panel.talents")} onClick={() => openPanel("talents")} tutorialAnchor="tab-talents" /> : null}
          </nav>
          {showTuningHud ? renderTuningPanel() : null}
          <div className="workbench-content">
            {renderWorkbenchContent()}
          </div>
        </aside>
        ) : null}
      </section>
      {activeTutorialStep ? (
        <TutorialCard replaying={Boolean(tutorialReplayStepId)} step={activeTutorialStep} onDismiss={dismissTutorial} onSkip={skipTutorial} />
      ) : null}
    </main>
  );
}
