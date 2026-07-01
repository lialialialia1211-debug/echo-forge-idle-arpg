import {
  Activity,
  AlertTriangle,
  Boxes,
  CircleDot,
  Flame,
  Gauge,
  Gem,
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
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { arenaCircuits, getArenaCircuitDef } from "../../data/arenaCircuits";
import { driveCores, getDriveCoreDef } from "../../data/driveCores";
import { talentNodes, getTalentNodeDef } from "../../data/talentNodes";
import { getTopFrameDef, topFrames } from "../../data/topFrames";
import {
  createPartFromArenaDrop,
  createStarterEquipment,
  createStarterInventory,
  partSlotLabels,
  partSlotOrder,
} from "../../data/topParts";
import { isRuneCompatible, tuningRunes } from "../../data/tuningRunes";
import { createTopArenaRuntime, defaultArenaTuning, stepTopArenaRuntime } from "../../engine/arenaRuntime";
import { generateArenaKey, summarizeArenaKeyRiskReward } from "../../engine/arenaKeys";
import { projectBossGateAttempt } from "../../engine/bossGate";
import { validateRuneLoadout } from "../../engine/driveRuneValidation";
import { clamp, formatNumber, formatPercent, round } from "../../engine/math";
import { resolveTopRuntimeStats } from "../../engine/topAssembly";
import {
  addRandomEngraving,
  removeRandomEngraving,
  rerollTopPartAffixes,
  rerollTopPartValues,
  salvageTopPart,
  upgradeTopPartRarity,
  type TopCraftResult,
} from "../../engine/topCrafting";
import { loadLocalSave, writeLocalSave } from "../../save/localStore";
import type {
  ArenaEffect,
  ArenaKey,
  ArenaTuningConfig,
  TalentNodeDef,
  TopArenaRuntime,
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
import "./CombatArena.css";

type ActivePanel = "build" | "loot" | "forge" | "route";

type CurrencyWallet = {
  ash: number;
  glass: number;
  echo: number;
};

type LootNotice = {
  id: string;
  tone: "drop" | "salvage" | "reward";
  text: string;
  rarity?: TopPartRarity;
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

type DecisionCueTone = "neutral" | "good" | "warn" | "rare";

type DecisionCue = {
  label: string;
  value: string;
  tone?: DecisionCueTone;
};

type ArenaTuningKey = keyof ArenaTuningConfig;

type ArenaTuningControl = {
  key: ArenaTuningKey;
  label: string;
  min: number;
  max: number;
  step: number;
};

const arenaTuningControls: ArenaTuningControl[] = [
  { key: "basinPullMultiplier", label: "Basin pull", min: 0.6, max: 2.4, step: 0.05 },
  { key: "collisionLaunchMultiplier", label: "Launch", min: 0.6, max: 2.4, step: 0.05 },
  { key: "sparkMultiplier", label: "Spark", min: 0.5, max: 2.1, step: 0.05 },
  { key: "activeEnemyPressure", label: "Rivals", min: 0.55, max: 1.65, step: 0.05 },
  { key: "bossWeightMultiplier", label: "Boss mass", min: 0.75, max: 1.55, step: 0.05 },
  { key: "hitStopMultiplier", label: "Impact FX", min: 0.35, max: 1.8, step: 0.05 },
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

type RuneSlotState = [string | null, string | null, string | null];

const rarityTone: Record<TopPartRarity, "neutral" | "good" | "rare" | "warn"> = {
  common: "neutral",
  tuned: "good",
  engraved: "warn",
  relic: "rare",
};

const statLabels: Record<keyof TopStatBlock, string> = {
  spinIntegrity: "Integrity",
  fluxGuard: "Flux Guard",
  guard: "Guard",
  drift: "Drift",
  tracking: "Tracking",
  impact: "Impact",
  rpm: "RPM",
  mass: "Mass",
  grip: "Grip",
  edge: "Edge",
  fracture: "Fracture",
  resonance: "Resonance",
  fluxCost: "Flux Cost",
  cooldownRecovery: "Cooldown",
  reservationEfficiency: "Reserve",
  stagger: "Stagger",
  ringOutPressure: "Ring-Out",
  partQuantity: "Quantity",
  partRarity: "Rarity",
};

const trackedStats: Array<keyof TopStatBlock> = ["spinIntegrity", "impact", "rpm", "guard", "tracking", "edge", "resonance", "partQuantity", "partRarity"];

const inventoryCapacity = 48;
const keyForgeCost: CurrencyWallet = { ash: 6, glass: 1, echo: 0 };
const forgeActionCosts: Record<"upgrade" | "rerollAffixes" | "rerollValues" | "add" | "remove", CurrencyWallet> = {
  upgrade: { ash: 6, glass: 1, echo: 0 },
  rerollAffixes: { ash: 3, glass: 2, echo: 0 },
  rerollValues: { ash: 0, glass: 2, echo: 0 },
  add: { ash: 8, glass: 0, echo: 0 },
  remove: { ash: 0, glass: 0, echo: 1 },
};

const talentNodePositions: Record<string, { x: number; y: number }> = {
  talent_iron_rotation: { x: 50, y: 52 },
  talent_razor_geometry: { x: 30, y: 39 },
  talent_live_bearing: { x: 70, y: 39 },
  talent_furnace_scoring: { x: 68, y: 16 },
  talent_storm_lattice: { x: 82, y: 59 },
  talent_salvage_rites: { x: 18, y: 59 },
  talent_last_rotation: { x: 50, y: 11 },
};

const rarityRank: Record<TopPartRarity, number> = {
  common: 0,
  tuned: 1,
  engraved: 2,
  relic: 3,
};

const enemyDangerWindows = {
  charger: 0.82,
  mineLayer: 0.95,
  bossJudicator: 1.18,
} as const;

function isPart(part: TopPartInstance | null | undefined): part is TopPartInstance {
  return Boolean(part);
}

function formatStatValue(stat: keyof TopStatBlock, value: number): string {
  if (["edge", "grip", "resonance", "partQuantity", "partRarity"].includes(stat)) {
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

function buildPartVerdict(part: TopPartInstance, currentStats: TopRuntimeStats, previewStats: TopRuntimeStats, equipped: boolean): PartVerdict {
  const impactDelta = statFromRuntime(previewStats, "impact") - statFromRuntime(currentStats, "impact");
  const ehpDelta =
    statFromRuntime(previewStats, "spinIntegrity") +
    statFromRuntime(previewStats, "guard") -
    (statFromRuntime(currentStats, "spinIntegrity") + statFromRuntime(currentStats, "guard"));
  const controlDelta = statFromRuntime(previewStats, "tracking") - statFromRuntime(currentStats, "tracking") + (statFromRuntime(previewStats, "rpm") - statFromRuntime(currentStats, "rpm")) * 34;
  const rewardDelta = statFromRuntime(previewStats, "partQuantity") - statFromRuntime(currentStats, "partQuantity") + statFromRuntime(previewStats, "partRarity") - statFromRuntime(currentStats, "partRarity");
  const score = impactDelta * 0.8 + ehpDelta * 0.08 + controlDelta * 0.08 + rewardDelta * 260;

  if (equipped) {
    return {
      label: "Equipped",
      detail: "This part is already in the loadout.",
      tone: "good",
      action: "equipped",
      score,
    };
  }

  if (score >= 55 || impactDelta > 45 || ehpDelta > 180 || rewardDelta > 0.08) {
    return {
      label: "Equip upgrade",
      detail: `Score ${score >= 0 ? "+" : ""}${round(score, 0)} / Impact ${impactDelta >= 0 ? "+" : ""}${formatNumber(impactDelta, 0)} / EHP ${ehpDelta >= 0 ? "+" : ""}${formatNumber(ehpDelta, 0)}`,
      tone: "good",
      action: "equip",
      score,
    };
  }

  if (rarityRank[part.rarity] >= rarityRank.engraved || score >= -20) {
    return {
      label: "Forge candidate",
      detail: `Score ${score >= 0 ? "+" : ""}${round(score, 0)} / rarity leaves room for tuning.`,
      tone: part.rarity === "relic" ? "rare" : "warn",
      action: "forge",
      score,
    };
  }

  return {
    label: "Salvage candidate",
    detail: `Score ${round(score, 0)} / current slot looks stronger.`,
    tone: "neutral",
    action: "salvage",
    score,
  };
}

function formatStatLines(stats: TopStatBlock | undefined): string[] {
  return Object.entries(stats ?? {}).map(
    ([stat, value]) => `+${formatStatValue(stat as keyof TopStatBlock, value ?? 0)} ${statLabels[stat as keyof TopStatBlock]}`,
  );
}

function formatResistanceLines(resistances: TopResistanceBlock | undefined): string[] {
  return Object.entries(resistances ?? {}).map(([type, value]) => `+${formatPercent(value ?? 0, 0)} ${type} res`);
}

function formatModifierLine(modifier: TopModifierDef): string {
  if (modifier.type === "flat") {
    const stat = modifier.stat as keyof TopStatBlock;
    const label = statLabels[stat] ?? modifier.stat;
    return `+${statLabels[stat] ? formatStatValue(stat, modifier.value) : formatNumber(modifier.value, 2)} ${label}`;
  }
  if (modifier.type === "more") {
    return `${formatPercent(modifier.value, 0)} more ${modifier.stat}`;
  }
  if (modifier.type === "less") {
    return `${formatPercent(modifier.value, 0)} less ${modifier.stat}`;
  }
  if (modifier.type === "increased") {
    return `+${formatPercent(modifier.value, 0)} increased ${modifier.stat}`;
  }
  if (modifier.type === "reduced") {
    return `${formatPercent(modifier.value, 0)} reduced ${modifier.stat}`;
  }
  if (modifier.type === "penetration") {
    return `+${formatPercent(modifier.value, 0)} ${modifier.stat} penetration`;
  }
  if (modifier.type === "extraAs" && modifier.fromDamageType && modifier.toDamageType) {
    return `Gain ${formatPercent(modifier.value, 0)} ${modifier.fromDamageType} as ${modifier.toDamageType}`;
  }
  if (modifier.type === "conversion" && modifier.fromDamageType && modifier.toDamageType) {
    return `Convert ${formatPercent(modifier.value, 0)} ${modifier.fromDamageType} to ${modifier.toDamageType}`;
  }
  return `${modifier.type} ${modifier.stat}`;
}

function formatPartLines(part: TopPartInstance): string[] {
  return [...formatStatLines(part.statBonuses), ...formatResistanceLines(part.resistanceBonuses), ...part.modifiers.map(formatModifierLine)];
}

function formatRuneLines(rune: TuningRuneDef): string[] {
  return [...formatStatLines(rune.statBonuses), ...formatResistanceLines(rune.resistanceBonuses), ...rune.modifiers.map(formatModifierLine)];
}

function formatTalentLines(talent: TalentNodeDef): string[] {
  return [...formatStatLines(talent.statBonuses), ...formatResistanceLines(talent.resistanceBonuses), ...(talent.modifiers ?? []).map(formatModifierLine)];
}

function salvageValue(part: TopPartInstance): CurrencyWallet {
  if (part.rarity === "relic") {
    return { ash: 16, glass: 4, echo: 1 };
  }
  if (part.rarity === "engraved") {
    return { ash: 8, glass: 2, echo: 0 };
  }
  if (part.rarity === "tuned") {
    return { ash: 4, glass: 1, echo: 0 };
  }
  return { ash: 2, glass: 0, echo: 0 };
}

function addWallet(left: CurrencyWallet, right: CurrencyWallet): CurrencyWallet {
  return {
    ash: left.ash + right.ash,
    glass: left.glass + right.glass,
    echo: left.echo + right.echo,
  };
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
  const label = behaviorId === "bossJudicator" ? "Judicator wave" : behaviorId === "mineLayer" ? "Furnace groove" : "Redline charge";
  const tone = behaviorId === "bossJudicator" ? "rare" : progress > 0.72 || distance < enemy.radius + player.radius + 54 ? "danger" : "warn";

  return {
    id: `enemy_${enemy.id}_${behaviorId}`,
    label,
    detail: `${enemy.name} / ${seconds.toFixed(1)}s`,
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
      label: "Groove arming",
      detail: `${(armSeconds - effect.age).toFixed(1)}s to heat field`,
      progress: armProgress,
      tone: "warn",
      priority: 2.5 + armProgress,
    };
  }

  if (distance <= radius * 1.12) {
    return {
      id: `hazard_live_${effect.id}`,
      label: "Heat field",
      detail: "Move out of the groove",
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

function salvageParts(parts: TopPartInstance[]): CurrencyWallet {
  return parts.reduce((wallet, part) => addWallet(wallet, salvageValue(part)), { ash: 0, glass: 0, echo: 0 });
}

function mergeInventoryParts(incoming: TopPartInstance[], current: TopPartInstance[], capacity: number): { items: TopPartInstance[]; overflow: TopPartInstance[] } {
  const items = [...incoming, ...current];
  const overflow: TopPartInstance[] = [];

  while (items.length > capacity) {
    let overflowIndex = -1;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (!items[index].locked) {
        overflowIndex = index;
        break;
      }
    }

    const [removed] = items.splice(overflowIndex >= 0 ? overflowIndex : items.length - 1, 1);
    overflow.push(removed);
  }

  return { items, overflow };
}

function compactRuneSlots(slots: RuneSlotState): string[] {
  return slots.filter((runeId): runeId is string => Boolean(runeId));
}

function toRuneSlots(runeIds: string[]): RuneSlotState {
  return [runeIds[0] ?? null, runeIds[1] ?? null, runeIds[2] ?? null];
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

function canSpend(wallet: CurrencyWallet, cost: CurrencyWallet): boolean {
  return wallet.ash >= cost.ash && wallet.glass >= cost.glass && wallet.echo >= cost.echo;
}

function spendWallet(wallet: CurrencyWallet, cost: CurrencyWallet): CurrencyWallet {
  return {
    ash: wallet.ash - cost.ash,
    glass: wallet.glass - cost.glass,
    echo: wallet.echo - cost.echo,
  };
}

function formatCost(cost: CurrencyWallet): string {
  return [`Ash ${cost.ash}`, `Glass ${cost.glass}`, `Echo ${cost.echo}`].join(" / ");
}

function formatKeyTitle(key: ArenaKey): string {
  const arena = getArenaCircuitDef(key.arenaBaseId);
  return `T${key.tier} ${arena.displayName}`;
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

function PanelTab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button aria-label={label} className={active ? "panel-tab panel-tab-active" : "panel-tab"} onClick={onClick} title={label} type="button">
      {icon}
      <span aria-hidden>{label}</span>
    </button>
  );
}

function drivePhysicsLines(driveId: string): string[] {
  switch (driveId) {
    case "drive_shard_barrage":
      return ["Scrape / Clash: surface shear and tangent impulse add impact shards.", "High RPM raises shear, making contact-fired shards more reliable."];
    case "drive_razor_rebound":
      return ["Scrape: tangent impulse adds cutting damage.", "Smash: normal impulse adds rebound burst damage."];
    case "drive_ember_scour":
      return ["Scrape / Grind: surface shear adds heat.", "Grind: contact age increases burn pressure."];
    case "drive_molten_groove":
      return ["Grind: sustained high-shear contact drops a molten hazard.", "Grip and RPM make the contact easier to hold."];
    case "drive_storm_lattice":
      return ["High Spark: spark intensity over the threshold redirects static discharge into the contact target.", "RPM increases spark intensity through surface shear."];
    case "drive_chain_tempest":
      return ["Smash / Heavy Clash: collision impulse amplifies chain lightning.", "High spark intensity can convert heavy contact into a burst window."];
    default:
      return ["Collision data can scale this drive when its trigger supports contact."];
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
    }),
    [initialEquipment, initialRuneSlots, initialSave.top.talentIds],
  );
  const saveShellRef = useRef(initialSave);
  const [frameId, setFrameId] = useState(initialSave.top.selectedFrameId);
  const [driveId, setDriveId] = useState(initialSave.top.selectedDriveId);
  const [arenaId, setArenaId] = useState(initialSave.top.selectedArenaId);
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(false);
  const [showDebugHud, setShowDebugHud] = useState(false);
  const [showTuningHud, setShowTuningHud] = useState(false);
  const [arenaTuning, setArenaTuning] = useState<ArenaTuningConfig>(defaultArenaTuning);
  const [rendererMetrics, setRendererMetrics] = useState<ArenaRendererMetrics>(initialRendererMetrics);
  const [activePanel, setActivePanel] = useState<ActivePanel>("build");
  const [inventoryFilter, setInventoryFilter] = useState<TopPartSlotId | "all">("all");
  const [equipment, setEquipment] = useState<Record<TopPartSlotId, TopPartInstance>>(initialEquipment);
  const [inventory, setInventory] = useState<TopPartInstance[]>(initialInventory);
  const [selectedPartId, setSelectedPartId] = useState(initialInventory[0]?.id ?? initialEquipment.core.id);
  const [runeSlots, setRuneSlots] = useState<RuneSlotState>(initialRuneSlots);
  const [selectedRuneSocket, setSelectedRuneSocket] = useState(0);
  const [talentIds, setTalentIds] = useState<string[]>(initialSave.top.talentIds);
  const [selectedTalentId, setSelectedTalentId] = useState(talentNodes[0].id);
  const [wallet, setWallet] = useState<CurrencyWallet>(initialSave.top.wallet);
  const [arenaKeys, setArenaKeys] = useState<ArenaKey[]>(initialSave.top.arenaKeys as ArenaKey[]);
  const [selectedArenaKeyId, setSelectedArenaKeyId] = useState<string | null>((initialSave.top.arenaKeys as ArenaKey[])[0]?.id ?? null);
  const [currentArenaKey, setCurrentArenaKey] = useState<ArenaKey | null>(null);
  const [clearedBossGateIds, setClearedBossGateIds] = useState<string[]>(initialSave.top.clearedBossGateIds);
  const [routeClears, setRouteClears] = useState<Record<string, number>>(initialSave.top.routeClears);
  const [totalKills, setTotalKills] = useState(0);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [lootNotices, setLootNotices] = useState<LootNotice[]>([]);
  const seenDropIdsRef = useRef(new Set<string>());
  const lastKillRef = useRef({ seed: "", kills: 0 });
  const lastRouteClearRef = useRef({ seed: "", routeClears: 0 });
  const runeIds = useMemo(() => compactRuneSlots(runeSlots), [runeSlots]);

  const makeLoadout = useCallback(
    (nextEquipment: TopEquipment = equipment, nextRuneIds = runeIds, nextTalentIds = talentIds): TopLoadoutConfig => ({
      equipment: nextEquipment,
      runeIds: nextRuneIds,
      talentIds: nextTalentIds,
    }),
    [equipment, runeIds, talentIds],
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
  const selectedPart = allKnownParts.find((part) => part.id === selectedPartId) ?? inventory[0] ?? equipment.core;
  const selectedCurrentPart = selectedPart ? equipment[selectedPart.slot] : null;
  const currentStats = useMemo(() => resolveTopRuntimeStats(frameId, driveId, loadout), [driveId, frameId, loadout]);
  const previewStats = useMemo(() => {
    if (!selectedPart) {
      return currentStats;
    }
    return resolveTopRuntimeStats(frameId, driveId, makeLoadout({ ...equipment, [selectedPart.slot]: selectedPart }));
  }, [currentStats, driveId, equipment, frameId, makeLoadout, selectedPart]);
  const playerIntegrity = clamp(runtime.player.spinIntegrity / runtime.player.stats.maxSpinIntegrity, 0, 1);
  const cooldownRatio = drive.baseCooldown > 0 ? 1 - clamp(runtime.player.cooldownRemaining / drive.baseCooldown, 0, 1) : 1;
  const target = runtime.enemies[0] ?? null;
  const targetIntegrity = target ? clamp(target.spinIntegrity / target.stats.maxSpinIntegrity, 0, 1) : 0;
  const dangerCue = useMemo(() => {
    const cues = [
      ...runtime.enemies.map((enemy) => buildEnemyDangerCue(enemy, runtime.player)),
      ...runtime.effects.map((effect) => buildHazardDangerCue(effect, runtime.player)),
      playerIntegrity < 0.24
        ? {
            id: "player_integrity_low",
            label: "Integrity critical",
            detail: `${formatPercent(playerIntegrity, 0)} remaining`,
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
  const spentTalentPoints = useMemo(() => talentIds.reduce((total, id) => total + getTalentNodeDef(id).cost, 0), [talentIds]);
  const talentPoints = 3 + Math.floor(totalKills / 5);
  const availableTalentPoints = talentPoints - spentTalentPoints;

  const resetArena = useCallback(
    (nextFrameId = frameId, nextDriveId = driveId, nextArenaId = arenaId, nextLoadout = makeLoadout(), nextArenaKey: ArenaKey | null = currentArenaKey) => {
      setRuntimeError(null);
      setCurrentArenaKey(nextArenaKey);
      publishRuntime(
        createTopArenaRuntime({
          arenaId: nextArenaId,
          frameId: nextFrameId,
          driveId: nextDriveId,
          loadout: nextLoadout,
          arenaKey: nextArenaKey ?? undefined,
          seed: `arena_${nextFrameId}_${nextDriveId}_${nextArenaId}_${Date.now()}`,
        }),
      );
    },
    [arenaId, currentArenaKey, driveId, frameId, makeLoadout, publishRuntime],
  );

  const selectFrame = (nextFrameId: string) => {
    const nextFrame = getTopFrameDef(nextFrameId);
    const nextDriveTags = getDriveCoreDef(nextFrame.startingDriveId).tags;
    const nextRuneSlots = runeSlots.map((runeId) => {
      if (!runeId) {
        return null;
      }
      const rune = tuningRunes.find((entry) => entry.id === runeId);
      return rune && isRuneCompatible(rune, nextDriveTags) ? runeId : null;
    }) as RuneSlotState;
    const compatibleRunes = compactRuneSlots(nextRuneSlots);
    setFrameId(nextFrameId);
    setDriveId(nextFrame.startingDriveId);
    setRuneSlots(nextRuneSlots);
    resetArena(nextFrameId, nextFrame.startingDriveId, arenaId, makeLoadout(equipment, compatibleRunes, talentIds));
  };

  const selectDrive = (nextDriveId: string) => {
    const nextDrive = getDriveCoreDef(nextDriveId);
    const nextRuneSlots = runeSlots.map((runeId) => {
      if (!runeId) {
        return null;
      }
      const rune = tuningRunes.find((entry) => entry.id === runeId);
      return rune && isRuneCompatible(rune, nextDrive.tags) ? runeId : null;
    }) as RuneSlotState;
    const compatibleRunes = compactRuneSlots(nextRuneSlots);
    setDriveId(nextDriveId);
    setRuneSlots(nextRuneSlots);
    resetArena(frameId, nextDriveId, arenaId, makeLoadout(equipment, compatibleRunes, talentIds));
  };

  const selectArena = (nextArenaId: string) => {
    setArenaId(nextArenaId);
    resetArena(frameId, driveId, nextArenaId, makeLoadout(), null);
  };

  const equipPart = (part: TopPartInstance) => {
    const replaced = equipment[part.slot];
    const nextEquipment = { ...equipment, [part.slot]: part };
    setEquipment(nextEquipment);
    setInventory((items) => {
      const withoutEquipped = items.filter((item) => item.id !== part.id);
      return replaced && replaced.id !== part.id ? [replaced, ...withoutEquipped].slice(0, inventoryCapacity) : withoutEquipped;
    });
    setSelectedPartId(part.id);
    resetArena(frameId, driveId, arenaId, makeLoadout(nextEquipment, runeIds, talentIds));
  };

  const toggleLock = (partId: string) => {
    setInventory((items) => items.map((item) => (item.id === partId ? { ...item, locked: !item.locked } : item)));
  };

  const salvagePart = (part: TopPartInstance) => {
    if (part.locked) {
      return;
    }
    const value = salvageTopPart(part);
    setWallet((current) => ({
      ash: current.ash + value.ash,
      glass: current.glass + value.glass,
      echo: current.echo + value.echo,
    }));
    setInventory((items) => items.filter((item) => item.id !== part.id));
    if (selectedPartId === part.id) {
      setSelectedPartId(inventory.find((item) => item.id !== part.id)?.id ?? equipment.core.id);
    }
  };

  const replacePartEverywhere = (previous: TopPartInstance, next: TopPartInstance) => {
    const equipped = equipment[previous.slot]?.id === previous.id;
    const nextEquipment = equipped ? { ...equipment, [previous.slot]: next } : equipment;
    setEquipment(nextEquipment);
    setInventory((items) => items.map((item) => (item.id === previous.id ? next : item)));
    setSelectedPartId(next.id);
    if (equipped) {
      resetArena(frameId, driveId, arenaId, makeLoadout(nextEquipment, runeIds, talentIds), currentArenaKey);
    }
  };

  const applyCraftResult = (sourcePart: TopPartInstance, result: TopCraftResult) => {
    if (!canSpend(wallet, result.spent)) {
      return;
    }
    setWallet((current) => spendWallet(current, result.spent));
    replacePartEverywhere(sourcePart, result.part);
    setLootNotices((current) => [
      {
        id: `craft_${result.part.id}`,
        tone: "reward" as const,
        text: `Forged ${result.part.displayName}`,
      },
      ...current,
    ].slice(0, 8));
  };

  const craftSelectedPart = (action: "upgrade" | "rerollAffixes" | "rerollValues" | "add" | "remove") => {
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
    if (!canSpend(wallet, keyForgeCost)) {
      return;
    }
    const key = generateArenaKey({
      arenaBaseId: arenaId,
      tier: arena.tier,
      rarity: "tuned",
      quality: Math.min(20, arena.tier * 4),
      seed: `manual_key_${arenaId}_${Date.now()}`,
      bossGateId: arena.tier >= 3 ? "boss_gate_brass_judicator" : undefined,
    });
    setWallet((current) => spendWallet(current, keyForgeCost));
    setArenaKeys((keys) => [key, ...keys].slice(0, 24));
    setSelectedArenaKeyId(key.id);
    setLootNotices((current) => [{ id: `manual_key_${key.id}`, tone: "reward" as const, text: `Forged route key: ${formatKeyTitle(key)}` }, ...current].slice(0, 8));
  };

  const runSelectedArenaKey = () => {
    if (!selectedArenaKey) {
      return;
    }
    const remainingKeys = arenaKeys.filter((key) => key.id !== selectedArenaKey.id);
    setArenaKeys(remainingKeys);
    setSelectedArenaKeyId(remainingKeys[0]?.id ?? null);
    setArenaId(selectedArenaKey.arenaBaseId);
    resetArena(frameId, driveId, selectedArenaKey.arenaBaseId, makeLoadout(), selectedArenaKey);
  };

  const attemptBossGate = () => {
    const passed = bossProjection.successChance >= 0.5;
    const tone: LootNotice["tone"] = passed ? "reward" : "salvage";
    if (passed) {
      setClearedBossGateIds((ids) => (ids.includes(bossProjection.gateId) ? ids : [...ids, bossProjection.gateId]));
    }
    setLootNotices((current) => [
      {
        id: `boss_attempt_${Date.now()}`,
        tone,
        text: passed ? "Brass Judicator gate cleared" : `Boss gate failed: ${bossProjection.failureReasons.join(" / ") || "unstable build"}`,
      },
      ...current,
    ].slice(0, 8));
  };

  const assignRuneToSocket = (runeId: string, socketIndex = selectedRuneSocket) => {
    const rune = tuningRunes.find((entry) => entry.id === runeId);
    if (!rune || !isRuneCompatible(rune, drive.tags)) {
      return;
    }
    const nextSocketIndex = Math.max(0, Math.min(2, socketIndex));
    const nextRuneSlots = runeSlots.map((currentRuneId) => (currentRuneId === runeId ? null : currentRuneId)) as RuneSlotState;
    nextRuneSlots[nextSocketIndex] = runeId;
    const nextRuneIds = compactRuneSlots(nextRuneSlots);
    setSelectedRuneSocket(nextSocketIndex);
    setRuneSlots(nextRuneSlots);
    resetArena(frameId, driveId, arenaId, makeLoadout(equipment, nextRuneIds, talentIds));
  };

  const clearRuneSocket = (socketIndex = selectedRuneSocket) => {
    const nextSocketIndex = Math.max(0, Math.min(2, socketIndex));
    const nextRuneSlots = [...runeSlots] as RuneSlotState;
    if (!nextRuneSlots[nextSocketIndex]) {
      setSelectedRuneSocket(nextSocketIndex);
      return;
    }
    nextRuneSlots[nextSocketIndex] = null;
    const nextRuneIds = compactRuneSlots(nextRuneSlots);
    setSelectedRuneSocket(nextSocketIndex);
    setRuneSlots(nextRuneSlots);
    resetArena(frameId, driveId, arenaId, makeLoadout(equipment, nextRuneIds, talentIds));
  };

  const canRefundTalent = (talentId: string): boolean =>
    !talentNodes.some((node) => talentIds.includes(node.id) && (node.requiredNodeIds ?? []).includes(talentId));

  const canAllocateTalent = (talentId: string): boolean => {
    const node = getTalentNodeDef(talentId);
    const requirementsMet = (node.requiredNodeIds ?? []).every((requiredId) => talentIds.includes(requiredId));
    return requirementsMet && availableTalentPoints >= node.cost;
  };

  const toggleTalent = (talentId: string) => {
    const nextTalentIds = talentIds.includes(talentId)
      ? canRefundTalent(talentId)
        ? talentIds.filter((id) => id !== talentId)
        : talentIds
      : canAllocateTalent(talentId)
        ? [...talentIds, talentId]
        : talentIds;
    if (nextTalentIds === talentIds) {
      return;
    }
    setTalentIds(nextTalentIds);
    resetArena(frameId, driveId, arenaId, makeLoadout(equipment, runeIds, nextTalentIds));
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
        if (now - lastUiPublish >= 100) {
          setRuntime(nextRuntime);
          lastUiPublish = now;
        }
      } catch (error) {
        console.error(error);
        setRuntimeError(error instanceof Error ? error.message : "The combat loop stopped unexpectedly.");
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
      setTotalKills((value) => value + runtime.kills - last.kills);
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
      setArenaKeys((keys) => [...newKeys, ...keys].slice(0, 24));
      setSelectedArenaKeyId(newKeys[0]?.id ?? selectedArenaKeyId);
      setRouteClears((current) => ({ ...current, [arenaId]: (current[arenaId] ?? 0) + gained }));
      setLootNotices((current) => [
        ...newKeys.map((key) => ({ id: `key_${key.id}`, tone: "reward" as const, text: `Forged route key: ${formatKeyTitle(key)}` })),
        ...current,
      ].slice(0, 8));
      lastRouteClearRef.current = { seed: runtime.seed, routeClears: runtime.routeClears };
    }
  }, [arena.tier, arenaId, runtime.routeClears, runtime.seed, selectedArenaKeyId]);

  useEffect(() => {
    const now = new Date().toISOString();
    const nextSave = {
      ...saveShellRef.current,
      schemaVersion: 2 as const,
      currencies: {
        ...saveShellRef.current.currencies,
        ash: wallet.ash,
        glass: wallet.glass,
        echo: wallet.echo,
      },
      top: {
        selectedFrameId: frameId,
        selectedDriveId: driveId,
        selectedArenaId: arenaId,
        equipment,
        inventory,
        runeIds,
        talentIds,
        wallet,
        arenaKeys,
        clearedBossGateIds,
        routeClears,
        lastSettledAt: now,
      },
      lastSavedAt: now,
    };
    saveShellRef.current = nextSave;
    writeLocalSave(nextSave);
  }, [arenaId, arenaKeys, clearedBossGateIds, driveId, equipment, frameId, inventory, routeClears, runeIds, talentIds, wallet]);

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
      const merged = mergeInventoryParts(newParts, inventory, inventoryCapacity);
      const keptDrop = newParts.find((part) => merged.items.some((item) => item.id === part.id));
      const notices: LootNotice[] = [
        ...newParts.map((part) => ({ id: `loot_${part.id}`, tone: "drop" as const, rarity: part.rarity, text: `Picked ${part.rarity} ${part.displayName}` })),
        ...merged.overflow.map((part) => ({ id: `salvage_${part.id}`, tone: "salvage" as const, text: `Auto-salvaged ${part.displayName}` })),
      ];
      const overflowValue = salvageParts(merged.overflow);
      setInventory(merged.items);
      if (keptDrop) {
        setSelectedPartId(keptDrop.id);
      }
      if (merged.overflow.length > 0) {
        setWallet((current) => addWallet(current, overflowValue));
      }
      setLootNotices((current) => [...notices, ...current].slice(0, 8));
      if (!running) {
        setActivePanel("loot");
      }
    }
  }, [arena.tier, inventory, running, runtime.drops, runtime.seed, runtime.wave]);

  const selectedPartInInventory = selectedPart ? inventory.some((part) => part.id === selectedPart.id) : false;
  const selectedPartEquipped = selectedPart ? selectedCurrentPart?.id === selectedPart.id : false;
  const selectedPartVerdict = useMemo(
    () => (selectedPart ? buildPartVerdict(selectedPart, currentStats, previewStats, selectedPartEquipped) : null),
    [currentStats, previewStats, selectedPart, selectedPartEquipped],
  );
  const runReview = useMemo(() => {
    const bestDrop = runtime.drops.reduce<(typeof runtime.drops)[number] | null>(
      (best, drop) => (!best || rarityRank[drop.rarity] > rarityRank[best.rarity] ? drop : best),
      null,
    );
    const remainingToBoss = Math.max(0, runtime.mapKillTarget - runtime.mapKills);
    const clearRatio = runtime.mapKills / Math.max(1, runtime.mapKillTarget);
    const routeProgress = runtime.bossSpawned || remainingToBoss === 0 ? 8 : Math.max(1, Math.ceil(clearRatio * 8));
    const objectiveLabel = runtime.bossSpawned ? "Boss wave" : remainingToBoss === 0 ? "Boss ready" : remainingToBoss <= 10 ? "Final pack" : "Clear basin";
    const objectiveDetail =
      runtime.bossSpawned
        ? "Shatter boss to forge route key"
        : remainingToBoss === 0
          ? "Field clear; boss drops next"
          : `${remainingToBoss} rivals before boss`;
    const actionPanel: ActivePanel =
      runtime.drops.length > 0
        ? "loot"
        : selectedPartVerdict?.action === "forge"
          ? "forge"
          : selectedPartVerdict?.action === "equip"
            ? "loot"
            : bossProjection.successChance >= 0.5
              ? "route"
              : "build";
    const tone: "neutral" | "good" | "warn" | "rare" =
      runtimeError || dangerCue?.tone === "danger" ? "warn" : bestDrop?.rarity === "relic" || runtime.routeClears > 0 ? "rare" : runtime.drops.length > 0 ? "good" : "neutral";

    return {
      actionLabel: actionPanel === "loot" ? "Loot" : actionPanel === "forge" ? "Forge" : actionPanel === "route" ? "Route" : "Build",
      actionPanel,
      bestDropText: bestDrop ? `${bestDrop.rarity} ${bestDrop.label}` : "No drops yet",
      detail: dangerCue ? dangerCue.label : selectedPartVerdict ? selectedPartVerdict.label : "Stabilize build",
      objectiveDetail,
      objectiveLabel,
      routeProgress,
      status: runtimeError ? "Stopped" : running ? "Live run" : runtime.drops.length > 0 ? "Loot ready" : "Ready",
      summary: `Clear ${formatNumber(runtime.mapKills, 0)}/${formatNumber(runtime.mapKillTarget, 0)} / ${formatNumber(runtime.kills, 0)} total kills`,
      tone,
    };
  }, [bossProjection.successChance, dangerCue, running, runtime.bossSpawned, runtime.drops, runtime.kills, runtime.mapKillTarget, runtime.mapKills, runtime.routeClears, runtimeError, selectedPartVerdict]);

  const renderBuildSummaryPanel = () => (
    <section className="workbench-section build-summary-section">
      <div className="section-title">
        <Activity size={17} aria-hidden />
        <h2>Build Summary</h2>
        <span className="section-counter">{frame.displayName}</span>
      </div>
      <div className="build-summary-grid">
        <StatPill icon={<Swords size={15} />} label="Impact" value={formatNumber(statFromRuntime(currentStats, "impact"), 0)} />
        <StatPill icon={<Shield size={15} />} label="EHP" value={formatNumber(statFromRuntime(currentStats, "spinIntegrity") + statFromRuntime(currentStats, "guard"), 0)} tone="good" />
        <StatPill icon={<Radar size={15} />} label="Tracking" value={formatNumber(statFromRuntime(currentStats, "tracking"), 0)} />
        <StatPill icon={<Gem size={15} />} label="Rewards" value={`${formatPercent(statFromRuntime(currentStats, "partQuantity"), 0)} / ${formatPercent(statFromRuntime(currentStats, "partRarity"), 0)}`} tone="rare" />
      </div>
    </section>
  );

  const renderSelectedPartInspector = ({ title = "Selected Part", showForgeAction = true }: { title?: string; showForgeAction?: boolean } = {}) => (
    <section className="workbench-section part-inspector-section">
      <div className="section-title">
        <Gem size={17} aria-hidden />
        <h2>{title}</h2>
        <span className="section-counter">{selectedPart ? partSlotLabels[selectedPart.slot] : "none"}</span>
      </div>
      {selectedPart ? (
        <div className={`part-detail part-detail-${selectedPart.rarity}`}>
          <div className="part-detail-title">
            <div>
              <small>{partSlotLabels[selectedPart.slot]} / ilvl {selectedPart.itemLevel}</small>
              <strong>{selectedPart.displayName}</strong>
            </div>
            <span>{selectedPart.rarity}</span>
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
          <div className="delta-list">
            {trackedStats.map((stat) => {
              const delta = statFromRuntime(previewStats, stat) - statFromRuntime(currentStats, stat);
              return (
                <div className={delta >= 0 ? "delta-line delta-good" : "delta-line delta-bad"} key={stat}>
                  <span>{statLabels[stat]}</span>
                  <strong>{delta >= 0 ? "+" : ""}{formatStatValue(stat, delta)}</strong>
                </div>
              );
            })}
          </div>
          <div className="modifier-lines">
            {formatPartLines(selectedPart).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div className="part-actions">
            <button className="arena-button" disabled={selectedPartEquipped} onClick={() => equipPart(selectedPart)} type="button">
              <CircleDot size={15} aria-hidden />
              Equip
            </button>
            <button className="arena-button" disabled={!selectedPartInInventory} onClick={() => toggleLock(selectedPart.id)} type="button">
              <Shield size={15} aria-hidden />
              {selectedPart.locked ? "Unlock" : "Lock"}
            </button>
            <button className="arena-button arena-button-danger" disabled={selectedPart.locked || !selectedPartInInventory} onClick={() => salvagePart(selectedPart)} type="button">
              <Recycle size={15} aria-hidden />
              Salvage
            </button>
            {showForgeAction ? (
              <button className="arena-button" onClick={() => setActivePanel("forge")} type="button">
                <Gem size={15} aria-hidden />
                Forge
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <span className="empty-drop">No part selected</span>
      )}
    </section>
  );

  const renderLoadoutPanel = () => (
    <>
      <section className="workbench-section">
        <div className="section-title">
          <CircleDot size={17} aria-hidden />
          <h2>Equipment</h2>
        </div>
        <div className="equipment-slots">
          {partSlotOrder.map((slot) => {
            const part = equipment[slot];
            return (
              <button
                className={`equip-slot equip-slot-${part.rarity}`}
                key={slot}
                onClick={() => setSelectedPartId(part.id)}
                type="button"
              >
                <small>{partSlotLabels[slot]}</small>
                <strong>{part.displayName}</strong>
                <span>{part.rarity}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="workbench-section">
        <div className="section-title">
          <Radar size={17} aria-hidden />
          <h2>Frame</h2>
        </div>
        <div className="choice-stack">
          {topFrames.map((entry) => (
            <button className={entry.id === frameId ? "choice-card choice-card-active" : "choice-card"} key={entry.id} onClick={() => selectFrame(entry.id)} type="button">
              <strong>{entry.displayName}</strong>
              <span>{entry.role}</span>
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
          <h2>Inventory</h2>
          <span className="section-counter">{inventory.length}/{inventoryCapacity}</span>
        </div>
        <div className="inventory-filter" aria-label="Inventory filter">
          <button className={inventoryFilter === "all" ? "filter-chip filter-chip-active" : "filter-chip"} onClick={() => setInventoryFilter("all")} type="button">
            All
          </button>
          {partSlotOrder.map((slot) => (
            <button className={inventoryFilter === slot ? "filter-chip filter-chip-active" : "filter-chip"} key={slot} onClick={() => setInventoryFilter(slot)} type="button">
              {partSlotLabels[slot]}
            </button>
          ))}
        </div>
        <div className="inventory-grid" aria-label="Inventory grid">
          {inventoryCells.map((part, index) =>
            part ? (
              <button
                className={part.id === selectedPartId ? `inventory-cell inventory-cell-${part.rarity} inventory-cell-active` : `inventory-cell inventory-cell-${part.rarity}`}
                key={part.id}
                onClick={() => setSelectedPartId(part.id)}
                title={`${part.displayName} / ${partSlotLabels[part.slot]}`}
                type="button"
              >
                <small>{partSlotLabels[part.slot]}</small>
                <strong>{part.displayName}</strong>
                <span>{part.locked ? "Locked" : part.rarity}</span>
              </button>
            ) : (
              <div className="inventory-cell inventory-cell-empty" key={`empty-${inventoryFilter}-${index}`} aria-hidden />
            ),
          )}
        </div>
      </section>

      {lootNotices.length > 0 ? (
        <section className="workbench-section loot-history-section">
          <div className="section-title">
            <PackageOpen size={17} aria-hidden />
            <h2>Recent Loot</h2>
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

      {renderSelectedPartInspector({ title: "Selected Part" })}
    </>
  );

  const renderSkillsPanel = () => {
    const selectedRuneId = runeSlots[selectedRuneSocket];
    const selectedRune = selectedRuneId ? tuningRunes.find((entry) => entry.id === selectedRuneId) : null;

    return (
      <>
        <section className="workbench-section">
          <div className="section-title">
            <Sparkles size={17} aria-hidden />
            <h2>Drive Core</h2>
          </div>
          <div className="drive-grid">
            {driveCores.map((entry) => (
              <button className={entry.id === driveId ? "drive-chip drive-chip-active" : "drive-chip"} key={entry.id} onClick={() => selectDrive(entry.id)} type="button">
                <strong>{entry.displayName}</strong>
                <span>{entry.tags.slice(0, 4).join(" / ")}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="workbench-section">
          <div className="section-title">
            <Zap size={17} aria-hidden />
            <h2>Skill Detail</h2>
          </div>
          <div className="skill-detail">
            <strong>{drive.displayName}</strong>
            <span>{drive.trigger} / {round(drive.baseCooldown, 2)}s</span>
            <div className="damage-tags">
              {Object.entries(drive.baseDamage)
                .filter(([, value]) => value > 0)
                .map(([type, value]) => (
                  <em key={type}>{type} {value}</em>
                ))}
            </div>
            <div className="skill-physics">
              <small>Collision hooks</small>
              {drivePhysicsLines(drive.id).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="workbench-section skill-link-section">
          <div className="section-title">
            <Boxes size={17} aria-hidden />
            <h2>Linked Sockets</h2>
            <span className="section-counter">{runeIds.length}/3</span>
          </div>
          <div className="skill-link-board" aria-label="Linked skill sockets">
            <svg className="socket-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <line x1="50" y1="50" x2="19" y2="24" />
              <line x1="50" y1="50" x2="80" y2="24" />
              <line x1="50" y1="50" x2="50" y2="82" />
            </svg>
            <button className="socket-node socket-drive" onClick={() => setActivePanel("build")} type="button">
              <small>Drive</small>
              <strong>{drive.displayName}</strong>
              <span>{drive.tags.slice(0, 3).join(" / ")}</span>
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
                  onClick={() => setSelectedRuneSocket(socketIndex)}
                  style={{ "--socket-x": socketIndex === 0 ? "19%" : socketIndex === 1 ? "80%" : "50%", "--socket-y": socketIndex === 2 ? "82%" : "24%" } as CSSProperties}
                  type="button"
                >
                  <small>Socket {socketIndex + 1}</small>
                  <strong>{rune ? rune.displayName : "Open"}</strong>
                  <span>{rune ? rune.requiredTags.join(" / ") : "Empty link"}</span>
                </button>
              );
            })}
          </div>
          <div className="socket-detail-panel">
            <div className="socket-detail-header">
              <div>
                <small>Socket {selectedRuneSocket + 1}</small>
                <strong>{selectedRune ? selectedRune.displayName : "Open Link"}</strong>
              </div>
              <button className="arena-button arena-button-danger" disabled={!selectedRune} onClick={() => clearRuneSocket()} type="button">
                <Recycle size={15} aria-hidden />
                Clear
              </button>
            </div>
            {selectedRune ? (
              <div className="socket-detail-lines">
                {formatRuneLines(selectedRune).map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            ) : (
              <span className="empty-drop">Choose a compatible rune from the library.</span>
            )}
          </div>
        </section>

        <section className="workbench-section">
          <div className="section-title">
            <Boxes size={17} aria-hidden />
            <h2>Rune Library</h2>
          </div>
          <div className="rune-library">
            {tuningRunes.map((rune) => {
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
                  <strong>{rune.displayName}</strong>
                  <span>{rune.requiredTags.join(" / ")}</span>
                </button>
              );
            })}
          </div>
        </section>
      </>
    );
  };

  const renderForgePanel = () => (
    <>
      {renderSelectedPartInspector({ title: "Forge Target", showForgeAction: false })}

      <section className="workbench-section">
        <div className="section-title">
          <Gem size={17} aria-hidden />
          <h2>Actions</h2>
        </div>
        <div className="forge-action-grid">
          {[
            ["upgrade", "Upgrade", "Raise rarity"],
            ["rerollAffixes", "Reroll", "New engravings"],
            ["rerollValues", "Values", "Same lines"],
            ["add", "Add", "One engraving"],
            ["remove", "Remove", "One engraving"],
          ].map(([action, label, detail]) => {
            const key = action as keyof typeof forgeActionCosts;
            const cost = forgeActionCosts[key];
            const disabled = !selectedPart || !canSpend(wallet, cost) || (key === "remove" && (selectedPart.affixes ?? []).length === 0);
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

  const renderRoutePanel = () => (
    <>
      <section className="workbench-section">
        <div className="section-title">
          <Flame size={17} aria-hidden />
          <h2>Route</h2>
          <span className="section-counter">{currentArenaKey ? "keyed" : "open"}</span>
        </div>
        <div className="route-summary-grid">
          <StatPill icon={<Flame size={15} />} label="Circuit" value={`T${arena.tier}`} tone="rare" />
          <StatPill icon={<Gem size={15} />} label="Keys" value={formatNumber(arenaKeys.length, 0)} tone="good" />
          <StatPill icon={<Swords size={15} />} label="Quantity" value={formatPercent(currentArenaKeySummary?.rewardQuantity ?? 0, 0)} />
          <StatPill icon={<Sparkles size={15} />} label="Rarity" value={formatPercent(currentArenaKeySummary?.rewardRarity ?? 0, 0)} />
        </div>
      </section>

      <section className="workbench-section">
        <div className="section-title">
          <Radar size={17} aria-hidden />
          <h2>Circuit</h2>
          <span className="section-counter">{arena.displayName}</span>
        </div>
        <div className="circuit-grid">
          {arenaCircuits.map((entry) => (
            <button className={entry.id === arenaId ? "circuit-chip circuit-chip-active" : "circuit-chip"} key={entry.id} onClick={() => selectArena(entry.id)} type="button">
              <span>T{entry.tier}</span>
              <strong>{entry.displayName}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="workbench-section">
        <div className="section-title">
          <PackageOpen size={17} aria-hidden />
          <h2>Arena Keys</h2>
          <span className="section-counter">{arenaKeys.length}/24</span>
        </div>
        <div className="key-action-row">
          <button className="arena-button" disabled={!canSpend(wallet, keyForgeCost)} onClick={forgeArenaKey} type="button">
            <Gem size={15} aria-hidden />
            Forge Key
          </button>
          <button className="arena-button" disabled={!selectedArenaKey} onClick={runSelectedArenaKey} type="button">
            <Play size={15} aria-hidden />
            Run Key
          </button>
        </div>
        <div className="key-list">
          {arenaKeys.length > 0 ? (
            arenaKeys.map((key) => {
              const summary = summarizeArenaKeyRiskReward(key);
              return (
                <button className={key.id === selectedArenaKeyId ? "key-card key-card-active" : "key-card"} key={key.id} onClick={() => setSelectedArenaKeyId(key.id)} type="button">
                  <div>
                    <small>{key.rarity} / ilvl {key.itemLevel}</small>
                    <strong>{formatKeyTitle(key)}</strong>
                  </div>
                  <span>Q {formatPercent(summary.rewardQuantity, 0)} / R {formatPercent(summary.rewardRarity, 0)}</span>
                </button>
              );
            })
          ) : (
            <span className="empty-drop">No arena key</span>
          )}
        </div>
        {selectedArenaKey ? (
          <div className="key-detail">
            <div className="modifier-lines">
              {[...selectedArenaKey.prefixes, ...selectedArenaKey.suffixes].map((affix) => (
                <span key={`${selectedArenaKey.id}_${affix.affixId}`}>
                  {affix.displayName}: enemies {round((affix.enemyIntegrityMultiplier - 1) * 100, 0)}% integrity / rewards {formatPercent(affix.rewardQuantity + affix.rewardRarity, 0)}
                </span>
              ))}
            </div>
            <div className="delta-list">
              <div className="delta-line delta-bad">
                <span>Integrity</span>
                <strong>{formatPercent((selectedArenaKeySummary?.enemyIntegrityMultiplier ?? 1) - 1, 0)}</strong>
              </div>
              <div className="delta-line delta-bad">
                <span>Impact</span>
                <strong>{formatPercent((selectedArenaKeySummary?.enemyImpactMultiplier ?? 1) - 1, 0)}</strong>
              </div>
              <div className="delta-line delta-good">
                <span>Reward</span>
                <strong>{formatPercent((selectedArenaKeySummary?.rewardQuantity ?? 0) + (selectedArenaKeySummary?.rewardRarity ?? 0), 0)}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="workbench-section">
        <div className="section-title">
          <Network size={17} aria-hidden />
          <h2>Boss Gate</h2>
          <span className="section-counter">{clearedBossGateIds.includes(bossProjection.gateId) ? "cleared" : "locked"}</span>
        </div>
        <div className="boss-projection">
          <StatPill icon={<Gauge size={15} />} label="Chance" value={formatPercent(bossProjection.successChance, 0)} tone={bossProjection.successChance >= 0.5 ? "good" : "warn"} />
          <StatPill icon={<Activity size={15} />} label="TTK" value={`${round(bossProjection.estimatedTtk, 1)}s`} />
        </div>
        <div className="modifier-lines">
          {bossProjection.failureReasons.length > 0 ? (
            bossProjection.failureReasons.map((reason) => <span key={reason}>{reason}: target {formatNumber(bossProjection.recommendedStats[reason] ?? 0, 1)}</span>)
          ) : (
            <span>Gate pressure stable</span>
          )}
        </div>
        <button className="arena-button" onClick={attemptBossGate} type="button">
          <Swords size={15} aria-hidden />
          Attempt Gate
        </button>
      </section>

      <section className="workbench-section">
        <div className="section-title">
          <Radar size={17} aria-hidden />
          <h2>Clears</h2>
        </div>
        <div className="route-clear-list">
          {arenaCircuits.map((entry) => (
            <div className="route-clear-line" key={entry.id}>
              <span>{entry.displayName}</span>
              <strong>{routeClears[entry.id] ?? 0}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  const renderTalentsPanel = () => {
    const selectedTalent = getTalentNodeDef(selectedTalentId);
    const selectedTalentActive = talentIds.includes(selectedTalent.id);
    const selectedTalentAvailable = selectedTalentActive ? canRefundTalent(selectedTalent.id) : canAllocateTalent(selectedTalent.id);
    const selectedTalentStatus = selectedTalentActive ? "Active" : selectedTalentAvailable ? "Available" : "Locked";
    const requirementText =
      selectedTalent.requiredNodeIds && selectedTalent.requiredNodeIds.length > 0
        ? selectedTalent.requiredNodeIds.map((requiredId) => getTalentNodeDef(requiredId).displayName).join(" / ")
        : "Root";

    return (
      <section className="workbench-section">
        <div className="section-title">
          <Network size={17} aria-hidden />
          <h2>Talents</h2>
          <span className="section-counter">{availableTalentPoints}/{talentPoints}</span>
        </div>
        <div className="talent-board" aria-label="Talent board">
          <svg className="talent-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {talentNodes.flatMap((node) =>
              (node.requiredNodeIds ?? []).map((requiredId) => {
                const from = talentNodePositions[requiredId];
                const to = talentNodePositions[node.id];
                const active = talentIds.includes(requiredId) && talentIds.includes(node.id);
                return from && to ? <line className={active ? "talent-link talent-link-active" : "talent-link"} key={`${requiredId}-${node.id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null;
              }),
            )}
          </svg>
          {talentNodes.map((node) => {
            const active = talentIds.includes(node.id);
            const available = active ? canRefundTalent(node.id) : canAllocateTalent(node.id);
            const selected = selectedTalentId === node.id;
            const position = talentNodePositions[node.id] ?? { x: 50, y: 50 };
            const talentClass = ["talent-node", active ? "talent-node-active" : "", selected ? "talent-node-selected" : "", !active && !available ? "talent-node-locked" : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                aria-pressed={selected}
                className={talentClass}
                key={node.id}
                onClick={() => setSelectedTalentId(node.id)}
                style={{ "--talent-x": `${position.x}%`, "--talent-y": `${position.y}%` } as CSSProperties}
                title={node.description}
                type="button"
              >
                <small>{node.cost} pt</small>
                <strong>{node.displayName}</strong>
              </button>
            );
          })}
        </div>
        <div className="talent-detail-panel">
          <div className="talent-detail-header">
            <div>
              <small>{selectedTalentStatus} / {requirementText}</small>
              <strong>{selectedTalent.displayName}</strong>
            </div>
            <span>{selectedTalent.cost} pt</span>
          </div>
          <p>{selectedTalent.description}</p>
          <div className="talent-detail-lines">
            {formatTalentLines(selectedTalent).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <button className="arena-button" disabled={!selectedTalentAvailable} onClick={() => toggleTalent(selectedTalent.id)} type="button">
            <Network size={15} aria-hidden />
            {selectedTalentActive ? "Refund" : "Allocate"}
          </button>
        </div>
        <div className="talent-note">
          {talentIds.length} active nodes / {availableTalentPoints} points ready
        </div>
      </section>
    );
  };

  const toggleRunning = () => {
    if (running) {
      setRuntime(runtimeRef.current);
    }
    setRunning((value) => !value);
  };

  const renderBuildPanel = () => (
    <>
      {renderBuildSummaryPanel()}
      {renderLoadoutPanel()}
      {renderSkillsPanel()}
      {renderTalentsPanel()}
    </>
  );

  const renderTuningPanel = () => (
    <div className="arena-tuning-panel" aria-label="Combat tuning">
      <div className="arena-tuning-head">
        <div>
          <small>Dev tuning</small>
          <strong>Combat feel</strong>
        </div>
        <button className="arena-button arena-tuning-reset" onClick={() => setArenaTuning(defaultArenaTuning)} type="button">
          Reset
        </button>
      </div>
      <div className="arena-tuning-controls">
        {arenaTuningControls.map((control) => (
          <label className="arena-tuning-control" key={control.key}>
            <span>
              {control.label}
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
    const selectedPartSignal = selectedPartVerdict ? selectedPartVerdict.label : selectedPart ? selectedPart.displayName : "No part selected";
    const routeSignal = runtime.bossSpawned
      ? "Boss active"
      : runtime.mapKills >= runtime.mapKillTarget
        ? "Boss ready"
        : `${formatNumber(runtime.mapKills, 0)}/${formatNumber(runtime.mapKillTarget, 0)} clear`;
    let action: NextActionPrompt;

    if (runtimeError) {
      action = {
        tone: "warn",
        icon: <RotateCcw size={17} aria-hidden />,
        label: "Reset combat loop",
        detail: runtimeError,
        button: "Reset",
        cues: [
          { label: "Now", value: "Stopped", tone: "warn" },
          { label: "Signal", value: "Runtime halted", tone: "warn" },
          { label: "Then", value: "Restart run" },
        ],
        onClick: () => resetArena(),
      };
    } else if (running && dangerCue) {
      action = {
        tone: dangerCue.tone === "danger" ? "warn" : dangerCue.tone,
        icon: <AlertTriangle size={17} aria-hidden />,
        label: dangerCue.tone === "danger" ? "Break danger pattern" : dangerCue.label,
        detail: dangerCue.detail,
        button: "Pause",
        cues: [
          { label: "Now", value: dangerCue.label, tone: dangerCue.tone === "danger" ? "warn" : dangerCue.tone },
          { label: "Signal", value: formatPercent(clamp(dangerCue.progress, 0, 1), 0), tone: dangerCue.tone === "danger" ? "warn" : dangerCue.tone },
          { label: "Then", value: playerIntegrity < 0.35 ? "Check build" : routeSignal },
        ],
        onClick: toggleRunning,
      };
    } else if (running && runtime.drops.length > 0) {
      action = {
        tone: "rare",
        icon: <PackageOpen size={17} aria-hidden />,
        label: "Loot window open",
        detail: `${runtime.drops.length} drops in this run`,
        button: "Pause",
        cues: [
          { label: "Now", value: "Secure drops", tone: "rare" },
          { label: "Signal", value: runReview.bestDropText, tone: runReview.tone },
          { label: "Then", value: "Open Loot" },
        ],
        onClick: toggleRunning,
      };
    } else if (running && runtime.bossSpawned) {
      action = {
        tone: "rare",
        icon: <Flame size={17} aria-hidden />,
        label: "Boss wave active",
        detail: "Shatter boss to forge route key",
        button: "Pause",
        cues: [
          { label: "Now", value: "Finish boss", tone: "rare" },
          { label: "Signal", value: routeSignal, tone: "rare" },
          { label: "Then", value: "Check route key" },
        ],
        onClick: toggleRunning,
      };
    } else if (running && runtime.mapKills >= runtime.mapKillTarget) {
      action = {
        tone: "rare",
        icon: <Flame size={17} aria-hidden />,
        label: "Boss is dropping in",
        detail: "Clear field; final rival is next",
        button: "Pause",
        cues: [
          { label: "Now", value: "Hold center", tone: "rare" },
          { label: "Signal", value: "150+ cleared", tone: "rare" },
          { label: "Then", value: "Fight boss" },
        ],
        onClick: toggleRunning,
      };
    } else if (running) {
      action = {
        tone: "good",
        icon: <Pause size={17} aria-hidden />,
        label: "Clear the basin",
        detail: `${formatNumber(Math.max(0, runtime.mapKillTarget - runtime.mapKills), 0)} rivals before boss`,
        button: "Pause",
        cues: [
          { label: "Now", value: "Keep farming", tone: "good" },
          { label: "Signal", value: routeSignal },
          { label: "Then", value: visibleDropCount > 0 ? "Review loot" : "Push boss" },
        ],
        onClick: toggleRunning,
      };
    } else if (visibleDropCount > 0) {
      action = {
        tone: "rare",
        icon: <PackageOpen size={17} aria-hidden />,
        label: `${visibleDropCount} drops ready`,
        detail: selectedPart ? selectedPart.displayName : "Review inventory",
        button: "Loot",
        cues: [
          { label: "Now", value: "Inspect loot", tone: "rare" },
          { label: "Signal", value: selectedPartSignal, tone: selectedPartVerdict?.tone },
          { label: "Then", value: selectedPartVerdict?.action === "forge" ? "Forge roll" : "Restart run" },
        ],
        onClick: () => setActivePanel("loot"),
      };
    } else if (selectedPartVerdict?.action === "forge") {
      action = {
        tone: "rare",
        icon: <Recycle size={17} aria-hidden />,
        label: "Forge candidate",
        detail: selectedPartVerdict.detail,
        button: "Forge",
        cues: [
          { label: "Now", value: "Craft part", tone: "rare" },
          { label: "Signal", value: selectedPartVerdict.label, tone: selectedPartVerdict.tone },
          { label: "Then", value: "Recheck build" },
        ],
        onClick: () => setActivePanel("forge"),
      };
    } else if (selectedPartVerdict?.action === "equip") {
      action = {
        tone: "good",
        icon: <PackageOpen size={17} aria-hidden />,
        label: "Equip upgrade",
        detail: selectedPartVerdict.detail,
        button: "Loot",
        cues: [
          { label: "Now", value: "Swap part", tone: "good" },
          { label: "Signal", value: selectedPartVerdict.label, tone: selectedPartVerdict.tone },
          { label: "Then", value: "Start run" },
        ],
        onClick: () => setActivePanel("loot"),
      };
    } else if (selectedArenaKey) {
      const keySummary = selectedArenaKeySummary ?? summarizeArenaKeyRiskReward(selectedArenaKey);
      const keyEnemyPressure = Math.max(keySummary.enemyIntegrityMultiplier, keySummary.enemyImpactMultiplier, keySummary.enemyGuardMultiplier, keySummary.enemyRpmMultiplier) - 1;
      const keyReward = keySummary.rewardQuantity + keySummary.rewardRarity;
      action = {
        tone: "rare",
        icon: <Flame size={17} aria-hidden />,
        label: "Arena key ready",
        detail: formatKeyTitle(selectedArenaKey),
        button: "Route",
        cues: [
          { label: "Now", value: "Choose route", tone: "rare" },
          { label: "Signal", value: `Risk ${formatPercent(keyEnemyPressure, 0)}`, tone: keyEnemyPressure > 0 ? "warn" : "neutral" },
          { label: "Then", value: `Reward ${formatPercent(keyReward, 0)}`, tone: "rare" },
        ],
        onClick: () => setActivePanel("route"),
      };
    } else if (bossProjection.successChance >= 0.5 && !clearedBossGateIds.includes(bossProjection.gateId)) {
      action = {
        tone: "rare",
        icon: <Network size={17} aria-hidden />,
        label: "Boss gate viable",
        detail: `${formatPercent(bossProjection.successChance, 0)} projected`,
        button: "Route",
        cues: [
          { label: "Now", value: "Attempt gate", tone: "rare" },
          { label: "Signal", value: `${formatPercent(bossProjection.successChance, 0)} chance`, tone: "rare" },
          { label: "Then", value: "Unlock route" },
        ],
        onClick: () => setActivePanel("route"),
      };
    } else {
      action = {
        tone: "neutral",
        icon: <Play size={17} aria-hidden />,
        label: "Ready to run",
        detail: arena.displayName,
        button: "Start",
        cues: [
          { label: "Now", value: "Start farming" },
          { label: "Signal", value: `${formatPercent(bossProjection.successChance, 0)} gate` },
          { label: "Then", value: "Build power" },
        ],
        onClick: toggleRunning,
      };
    }

    return (
      <section className={`next-action-strip next-action-${action.tone}`} aria-label="Next action">
        <span className="next-action-icon">{action.icon}</span>
        <div className="next-action-copy">
          <strong>{action.label}</strong>
          <span>{action.detail}</span>
        </div>
        <div className="next-action-cues" aria-label="Decision signals">
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
    <main className={["top-arena-shell", running ? "top-arena-running" : "", currentArenaKey ? "top-arena-keyed" : ""].filter(Boolean).join(" ")}>
      <header className="arena-topbar">
        <div className="arena-brand">
          <div className="brand-sigil">
            <Swords size={22} aria-hidden />
          </div>
          <div>
            <strong>Iron Vortex</strong>
            <span>Dark metal auto arena</span>
          </div>
        </div>
        <div className="wallet-strip">
          <span className={running ? "run-state run-state-live" : "run-state"}>{running ? "Live" : "Ready"}</span>
          {currentArenaKey ? <span className="run-state run-state-keyed">Keyed</span> : null}
          <span>Ash {wallet.ash}</span>
          <span>Glass {wallet.glass}</span>
          <span>Echo {wallet.echo}</span>
        </div>
        <div className="arena-controls" aria-label="Arena controls">
          <button className={running ? "arena-button arena-button-live" : "arena-button"} onClick={toggleRunning} type="button">
            {running ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {running ? "Pause" : "Start"}
          </button>
          <button className="arena-button" onClick={() => resetArena()} type="button">
            <RotateCcw size={16} aria-hidden />
            Reset
          </button>
          <button
            aria-pressed={showDebugHud}
            className={showDebugHud ? "arena-button arena-button-debug-active" : "arena-button"}
            onClick={() => setShowDebugHud((value) => !value)}
            title="Toggle collision telemetry"
            type="button"
          >
            <Gauge size={16} aria-hidden />
            Debug
          </button>
          <button
            aria-pressed={showTuningHud}
            className={showTuningHud ? "arena-button arena-button-debug-active" : "arena-button"}
            onClick={() => setShowTuningHud((value) => !value)}
            title="Toggle combat tuning"
            type="button"
          >
            <SlidersHorizontal size={16} aria-hidden />
            Tune
          </button>
          <div className="speed-tabs" aria-label="Speed">
            {[1, 2, 4].map((value) => (
              <button className={speed === value ? "speed-tab speed-tab-active" : "speed-tab"} key={value} onClick={() => setSpeed(value)} type="button">
                {value}x
              </button>
            ))}
          </div>
        </div>
      </header>

      {renderNextActionStrip()}

      <section className="arena-layout">
        <section className={["arena-stage-panel", running ? "arena-stage-live" : "", currentArenaKey ? "arena-stage-keyed" : ""].filter(Boolean).join(" ")}>
          <div className="arena-stage-header">
            <div>
              <span className="arena-kicker">{runtime.activeEvent ? `${arena.displayName} / ${runtime.activeEvent.displayName}` : arena.displayName}</span>
              <h1>{frame.displayName}</h1>
            </div>
            <div className={target ? "target-strip target-strip-active" : "target-strip"}>
              <div>
                <span>{target ? target.name : "No target"}</span>
                <strong>{target ? `${formatPercent(targetIntegrity, 0)} integrity` : "spooling"}</strong>
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
            {showDebugHud ? (
              <div className="arena-renderer-debug" aria-label="Renderer telemetry">
                <span>
                  FPS <strong>{round(rendererMetrics.fps, 0)}</strong>
                </span>
                <span>
                  Render <strong>{round(rendererMetrics.renderMs, 2)}ms</strong>
                </span>
                <span>
                  Objects <strong>{rendererMetrics.entities}</strong>
                </span>
                <span>
                  FX <strong>{rendererMetrics.effects}</strong>
                </span>
                <span>
                  Drops <strong>{rendererMetrics.drops}</strong>
                </span>
                <span>
                  Skip <strong>{rendererMetrics.skippedFrames}</strong>
                </span>
                <span>
                  Hit <strong>{rendererMetrics.lastHitKind ? rendererMetrics.lastHitKind.toUpperCase() : "IDLE"}</strong>
                </span>
                <span>
                  Flash <strong>{rendererMetrics.impactFlash ? "ON" : "OFF"}</strong>
                </span>
                <span className={`renderer-budget renderer-budget-${rendererMetrics.budget}`}>
                  Budget <strong>{rendererMetrics.budget.toUpperCase()}</strong>
                </span>
              </div>
            ) : null}
            {runtimeError ? (
              <div className="arena-runtime-error" role="alert">
                <strong>Combat loop stopped</strong>
                <span>{runtimeError}</span>
                <button className="arena-button" onClick={() => resetArena()} type="button">
                  <RotateCcw size={15} aria-hidden />
                  Reset
                </button>
              </div>
            ) : null}
            {lootNotices.length > 0 ? (
              <div className="loot-toast-stack" aria-live="polite">
                {lootNotices.slice(0, 4).map((notice) => (
                  <div className={["loot-toast", `loot-toast-${notice.tone}`, notice.rarity ? `loot-toast-rarity-${notice.rarity}` : ""].filter(Boolean).join(" ")} key={notice.id}>
                    {notice.text}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="arena-hud-grid">
              <StatPill icon={<Activity size={16} />} label="Clear" value={`${formatNumber(runtime.mapKills, 0)}/${formatNumber(runtime.mapKillTarget, 0)}`} tone="rare" />
              <StatPill icon={<Gauge size={16} />} label="Integrity" value={formatPercent(playerIntegrity, 0)} tone={playerIntegrity > 0.35 ? "good" : "warn"} meter={playerIntegrity} />
              <StatPill icon={<Zap size={16} />} label="Drive" value={formatPercent(cooldownRatio, 0)} tone="good" meter={cooldownRatio} />
              <StatPill icon={<Gem size={16} />} label="Kills" value={formatNumber(totalKills, 0)} tone="rare" />
            </div>
          </div>

          <div className="combat-bottom">
            <div className="combat-telemetry">
              <div className="telemetry-grid">
                <StatPill icon={<Gauge size={15} />} label="RPM" value={round(runtime.player.stats.rpm, 1).toString()} />
                <StatPill icon={<Swords size={15} />} label="Impact" value={formatNumber(runtime.player.stats.impact, 0)} />
                <StatPill icon={<Radar size={15} />} label="Tracking" value={formatNumber(runtime.player.stats.tracking, 0)} />
                <StatPill icon={<Shield size={15} />} label="Guard" value={formatNumber(runtime.player.stats.guard, 0)} />
              </div>
              <div className={`run-review-strip run-review-${runReview.tone}`}>
                <div className="run-review-main">
                  <small>{runReview.status}</small>
                  <strong>{runReview.summary}</strong>
                  <span>{runReview.detail}</span>
                </div>
                <div className="run-objective-rail" aria-label="Route objective">
                  <div className="run-objective-copy">
                    <small>Objective</small>
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
                <div className="run-review-metrics">
                  <span>
                    Drops <strong>{runtime.drops.length}</strong>
                  </span>
                  <span>
                    Best <strong>{runReview.bestDropText}</strong>
                  </span>
                  <span>
                    Map <strong>{runtime.mapKills}/{runtime.mapKillTarget}</strong>
                  </span>
                </div>
                <button className="arena-button" onClick={() => setActivePanel(runReview.actionPanel)} type="button">
                  {runReview.actionLabel}
                </button>
              </div>
              {showDebugHud ? (
                <div className={collisionDebugClass}>
                  <div>
                    <small>Collision</small>
                    <strong>{lastCollision ? lastCollision.kind.toUpperCase() : "IDLE"}</strong>
                  </div>
                  <span>N {lastCollision ? formatNumber(lastCollision.normalImpulse, 0) : "-"}</span>
                  <span>T {lastCollision ? formatNumber(Math.abs(lastCollision.tangentImpulse), 0) : "-"}</span>
                  <span>Shear {lastCollision ? formatNumber(lastCollision.surfaceShear, 0) : "-"}</span>
                  <span>Spark {lastCollision ? round(lastCollision.sparkIntensity, 1) : "-"}</span>
                  <span>Age {lastCollision ? `${round(lastCollision.contactAge, 2)}s` : "-"}</span>
                  <span>Spin {formatPercent(runtime.player.spinPower / 100, 0)}</span>
                  <span>Wobble {formatPercent(runtime.player.wobble, 0)}</span>
                </div>
              ) : null}
            </div>
            <div className="event-feed compact-events">
              {runtime.events.map((event) => (
                <div className={`event-line event-line-${event.tone}`} key={event.id}>
                  {event.text}
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className={showTuningHud ? "workbench-panel workbench-panel-tuning" : "workbench-panel"}>
          <nav className="panel-tabs" aria-label="Workbench">
            <PanelTab active={activePanel === "build"} icon={<CircleDot size={15} aria-hidden />} label="Build" onClick={() => setActivePanel("build")} />
            <PanelTab active={activePanel === "loot"} icon={<PackageOpen size={15} aria-hidden />} label="Loot" onClick={() => setActivePanel("loot")} />
            <PanelTab active={activePanel === "forge"} icon={<Recycle size={15} aria-hidden />} label="Forge" onClick={() => setActivePanel("forge")} />
            <PanelTab active={activePanel === "route"} icon={<Flame size={15} aria-hidden />} label="Route" onClick={() => setActivePanel("route")} />
          </nav>
          {showTuningHud ? renderTuningPanel() : null}
          <div className="workbench-content">
            {activePanel === "build" && renderBuildPanel()}
            {activePanel === "loot" && renderInventoryPanel()}
            {activePanel === "forge" && renderForgePanel()}
            {activePanel === "route" && renderRoutePanel()}
          </div>
        </aside>
      </section>
    </main>
  );
}
