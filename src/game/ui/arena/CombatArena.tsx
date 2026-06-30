import {
  Activity,
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
import { createTopArenaRuntime, stepTopArenaRuntime } from "../../engine/arenaRuntime";
import { clamp, formatNumber, formatPercent, round } from "../../engine/math";
import { resolveTopRuntimeStats } from "../../engine/topAssembly";
import type {
  ArenaCircuitDef,
  ArenaDrop,
  ArenaEffect,
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
import "./CombatArena.css";

type Palette = {
  core: string;
  rim: string;
  glow: string;
  text: string;
};

type ActivePanel = "loadout" | "inventory" | "skills" | "talents";

type CurrencyWallet = {
  ash: number;
  glass: number;
  echo: number;
};

type LootNotice = {
  id: string;
  tone: "drop" | "salvage";
  text: string;
};

type RuneSlotState = [string | null, string | null, string | null];

const framePalette: Record<string, Palette> = {
  frame_swift_razor: {
    core: "#cfd7d8",
    rim: "#df624c",
    glow: "rgba(223, 98, 76, 0.46)",
    text: "#f0c7b6",
  },
  frame_ember_crucible: {
    core: "#f0a35c",
    rim: "#d9a554",
    glow: "rgba(217, 100, 54, 0.55)",
    text: "#f6d399",
  },
  frame_storm_needle: {
    core: "#90e2ff",
    rim: "#65c6b0",
    glow: "rgba(101, 198, 176, 0.5)",
    text: "#b9f2f0",
  },
};

const enemyPalette: Record<TopRuntimeEntity["rank"], Palette> = {
  player: framePalette.frame_swift_razor,
  pack: {
    core: "#b8aba0",
    rim: "#6f7470",
    glow: "rgba(191, 116, 78, 0.3)",
    text: "#d8c6b7",
  },
  elite: {
    core: "#f1c36d",
    rim: "#df624c",
    glow: "rgba(217, 165, 84, 0.46)",
    text: "#f6dca4",
  },
  boss: {
    core: "#d2bdff",
    rim: "#b68cff",
    glow: "rgba(182, 140, 255, 0.5)",
    text: "#eadfff",
  },
};

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
  partQuantity: "Quantity",
  partRarity: "Rarity",
};

const trackedStats: Array<keyof TopStatBlock> = ["spinIntegrity", "impact", "rpm", "guard", "tracking", "edge", "resonance", "partQuantity", "partRarity"];

const inventoryCapacity = 48;

const talentNodePositions: Record<string, { x: number; y: number }> = {
  talent_iron_rotation: { x: 50, y: 52 },
  talent_razor_geometry: { x: 30, y: 39 },
  talent_live_bearing: { x: 70, y: 39 },
  talent_furnace_scoring: { x: 68, y: 16 },
  talent_storm_lattice: { x: 82, y: 59 },
  talent_salvage_rites: { x: 18, y: 59 },
  talent_last_rotation: { x: 50, y: 11 },
};

function getCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number; dpr: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  const scaledWidth = Math.floor(width * dpr);
  const scaledHeight = Math.floor(height * dpr);

  if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
  }

  return { width, height, dpr };
}

function createWorldMapper(width: number, height: number, arena: ArenaCircuitDef) {
  const centerX = width / 2;
  const centerY = height / 2 + Math.min(28, height * 0.035);
  const scale = Math.min((width * 0.9) / (arena.radius * 2), (height * 0.82) / (arena.radius * 2));

  return {
    centerX,
    centerY,
    scale,
    point(x: number, y: number) {
      return {
        x: centerX + x * scale,
        y: centerY + y * scale,
      };
    },
    radius(value: number) {
      return value * scale;
    },
  };
}

function drawArenaFloor(ctx: CanvasRenderingContext2D, width: number, height: number, arena: ArenaCircuitDef, runtime: TopArenaRuntime) {
  const map = createWorldMapper(width, height, arena);
  const radius = map.radius(arena.radius);
  const background = ctx.createRadialGradient(map.centerX, map.centerY, radius * 0.05, map.centerX, map.centerY, radius * 1.18);
  background.addColorStop(0, "#1d2222");
  background.addColorStop(0.42, "#101414");
  background.addColorStop(0.78, "#080a0b");
  background.addColorStop(1, "#050607");

  ctx.fillStyle = "#070809";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const sweep = (runtime.time * 0.22) % (Math.PI * 2);
  const halo = ctx.createRadialGradient(map.centerX, map.centerY, radius * 0.55, map.centerX, map.centerY, radius * 1.1);
  halo.addColorStop(0, "rgba(101, 198, 176, 0.02)");
  halo.addColorStop(0.8, "rgba(217, 165, 84, 0.16)");
  halo.addColorStop(1, "rgba(223, 98, 76, 0.2)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(map.centerX, map.centerY, radius * 1.07, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(map.centerX, map.centerY, radius, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = "rgba(230, 215, 181, 0.025)";
  for (let y = map.centerY - radius; y < map.centerY + radius; y += 28) {
    ctx.fillRect(map.centerX - radius, y, radius * 2, 1);
  }
  for (let x = map.centerX - radius; x < map.centerX + radius; x += 34) {
    ctx.fillRect(x, map.centerY - radius, 1, radius * 2);
  }

  ctx.strokeStyle = "rgba(217, 165, 84, 0.18)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i += 1) {
    ctx.beginPath();
    ctx.arc(map.centerX, map.centerY, (radius / 6) * i, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(101, 198, 176, 0.16)";
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12 + sweep * 0.08;
    ctx.beginPath();
    ctx.moveTo(map.centerX, map.centerY);
    ctx.lineTo(map.centerX + Math.cos(angle) * radius, map.centerY + Math.sin(angle) * radius);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(223, 98, 76, 0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(map.centerX, map.centerY, radius * 0.82, sweep, sweep + Math.PI * 0.42);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(230, 215, 181, 0.34)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(map.centerX, map.centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.74)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(map.centerX, map.centerY, radius + 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, ageRatio: number, intensity: number) {
  const alpha = 1 - ageRatio;
  const spokes = 8;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#f4c56d";
  ctx.lineWidth = Math.max(1, 2 * intensity);
  for (let i = 0; i < spokes; i += 1) {
    const angle = (Math.PI * 2 * i) / spokes + ageRatio * 1.8;
    const inner = 4 * intensity;
    const outer = (18 + 20 * ageRatio) * intensity;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEffect(ctx: CanvasRenderingContext2D, effect: ArenaEffect, map: ReturnType<typeof createWorldMapper>) {
  const point = map.point(effect.x, effect.y);
  const ratio = clamp(effect.age / effect.lifetime, 0, 1);
  const alpha = 1 - ratio;

  if (effect.kind === "spark") {
    drawSpark(ctx, point.x, point.y, ratio, effect.intensity);
    return;
  }

  if (effect.kind === "emberTrail") {
    const radius = (20 + ratio * 42) * effect.intensity;
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
    glow.addColorStop(0, `rgba(255, 168, 75, ${0.45 * alpha})`);
    glow.addColorStop(0.42, `rgba(223, 98, 76, ${0.24 * alpha})`);
    glow.addColorStop(1, "rgba(223, 98, 76, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (effect.kind === "stormArc") {
    const target = map.point(effect.x2 ?? effect.x, effect.y2 ?? effect.y);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#9ff8ff";
    ctx.lineWidth = 2.2 * effect.intensity;
    ctx.shadowColor = "#65c6b0";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    const midX = (point.x + target.x) / 2 + Math.sin(effect.age * 30) * 16;
    const midY = (point.y + target.y) / 2 + Math.cos(effect.age * 22) * 12;
    ctx.quadraticCurveTo(midX, midY, target.x, target.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const ringRadius = (18 + ratio * 34) * effect.intensity;
  ctx.strokeStyle = effect.kind === "drop" ? `rgba(182, 140, 255, ${alpha})` : `rgba(217, 165, 84, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTop(ctx: CanvasRenderingContext2D, entity: TopRuntimeEntity, map: ReturnType<typeof createWorldMapper>, palette: Palette) {
  const point = map.point(entity.x, entity.y);
  const radius = map.radius(entity.radius);
  const integrityRatio = clamp(entity.spinIntegrity / entity.stats.maxSpinIntegrity, 0, 1);

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(entity.angle);
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = entity.team === "player" ? 22 : 14;
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.beginPath();
  ctx.ellipse(radius * 0.16, radius * 0.22, radius * 1.1, radius * 0.74, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.rim;
  for (let i = 0; i < 4; i += 1) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -radius * 1.18);
    ctx.lineTo(radius * 0.34, -radius * 0.24);
    ctx.lineTo(0, -radius * 0.03);
    ctx.lineTo(-radius * 0.34, -radius * 0.24);
    ctx.closePath();
    ctx.fill();
  }

  const body = ctx.createRadialGradient(-radius * 0.28, -radius * 0.34, radius * 0.08, 0, 0, radius);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.18, palette.core);
  body.addColorStop(0.58, "#303638");
  body.addColorStop(1, "#08090a");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.58)";
  ctx.lineWidth = Math.max(2, radius * 0.11);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.66, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = palette.rim;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius + 7, -Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();

  ctx.strokeStyle = integrityRatio > 0.33 ? palette.rim : "#df624c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * integrityRatio);
  ctx.stroke();

  ctx.font = "600 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = palette.text;
  ctx.fillText(entity.name, point.x, point.y + radius + 24);

  const barWidth = Math.max(42, radius * 2.2);
  const barY = point.y + radius + 30;
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(point.x - barWidth / 2, barY, barWidth, 4);
  ctx.fillStyle = integrityRatio > 0.45 ? palette.rim : "#df624c";
  ctx.fillRect(point.x - barWidth / 2, barY, barWidth * integrityRatio, 4);
}

function drawDrops(ctx: CanvasRenderingContext2D, drops: ArenaDrop[], map: ReturnType<typeof createWorldMapper>) {
  for (const drop of drops) {
    const point = map.point(drop.x, drop.y);
    const bob = Math.sin(drop.age * 4) * 2;
    ctx.save();
    ctx.translate(point.x, point.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle =
      drop.rarity === "relic"
        ? "#b68cff"
        : drop.rarity === "engraved"
          ? "#d9a554"
          : drop.rarity === "tuned"
            ? "#65c6b0"
            : "#cbbf9d";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
}

function drawScene(canvas: HTMLCanvasElement, runtime: TopArenaRuntime) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const arena = getArenaCircuitDef(runtime.arenaId);
  const { width, height, dpr } = getCanvasSize(canvas);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawArenaFloor(ctx, width, height, arena, runtime);

  const map = createWorldMapper(width, height, arena);
  for (const effect of [...runtime.effects].reverse()) {
    drawEffect(ctx, effect, map);
  }
  drawDrops(ctx, runtime.drops, map);

  for (const enemy of runtime.enemies) {
    drawTop(ctx, enemy, map, enemyPalette[enemy.rank]);
  }
  drawTop(ctx, runtime.player, map, framePalette[runtime.frameId] ?? framePalette.frame_swift_razor);
}

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
  return stats[stat];
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

function StatPill({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn" | "rare";
}) {
  return (
    <div className={`arena-stat arena-stat-${tone}`}>
      <span aria-hidden>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function PanelTab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={active ? "panel-tab panel-tab-active" : "panel-tab"} onClick={onClick} type="button">
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function CombatArena() {
  const starterEquipment = useMemo(() => createStarterEquipment(), []);
  const starterInventory = useMemo(() => createStarterInventory(), []);
  const [frameId, setFrameId] = useState(topFrames[0].id);
  const [driveId, setDriveId] = useState(topFrames[0].startingDriveId);
  const [arenaId, setArenaId] = useState(arenaCircuits[0].id);
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>("loadout");
  const [inventoryFilter, setInventoryFilter] = useState<TopPartSlotId | "all">("all");
  const [equipment, setEquipment] = useState<Record<TopPartSlotId, TopPartInstance>>(starterEquipment);
  const [inventory, setInventory] = useState<TopPartInstance[]>(starterInventory);
  const [selectedPartId, setSelectedPartId] = useState(starterInventory[0]?.id ?? starterEquipment.core.id);
  const [runeSlots, setRuneSlots] = useState<RuneSlotState>(["rune_splintered_edge", null, null]);
  const [selectedRuneSocket, setSelectedRuneSocket] = useState(0);
  const [talentIds, setTalentIds] = useState<string[]>(["talent_iron_rotation"]);
  const [selectedTalentId, setSelectedTalentId] = useState(talentNodes[0].id);
  const [wallet, setWallet] = useState<CurrencyWallet>({ ash: 0, glass: 0, echo: 0 });
  const [totalKills, setTotalKills] = useState(0);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [lootNotices, setLootNotices] = useState<LootNotice[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const seenDropIdsRef = useRef(new Set<string>());
  const lastKillRef = useRef({ seed: "", kills: 0 });
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
      arenaId: arenaCircuits[0].id,
      frameId: topFrames[0].id,
      driveId: topFrames[0].startingDriveId,
      loadout: { equipment: starterEquipment, runeIds: ["rune_splintered_edge"], talentIds: ["talent_iron_rotation"] },
      seed: `arena_${Date.now()}`,
    }),
  );
  const runtimeRef = useRef(runtime);

  const publishRuntime = useCallback((nextRuntime: TopArenaRuntime) => {
    runtimeRef.current = nextRuntime;
    setRuntime(nextRuntime);
  }, []);

  const frame = useMemo(() => getTopFrameDef(frameId), [frameId]);
  const drive = useMemo(() => getDriveCoreDef(driveId), [driveId]);
  const arena = useMemo(() => getArenaCircuitDef(arenaId), [arenaId]);
  const loadout = useMemo(() => makeLoadout(), [makeLoadout]);
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
  const spentTalentPoints = useMemo(() => talentIds.reduce((total, id) => total + getTalentNodeDef(id).cost, 0), [talentIds]);
  const talentPoints = 3 + Math.floor(totalKills / 5);
  const availableTalentPoints = talentPoints - spentTalentPoints;

  const resetArena = useCallback(
    (nextFrameId = frameId, nextDriveId = driveId, nextArenaId = arenaId, nextLoadout = makeLoadout()) => {
      setRuntimeError(null);
      publishRuntime(
        createTopArenaRuntime({
          arenaId: nextArenaId,
          frameId: nextFrameId,
          driveId: nextDriveId,
          loadout: nextLoadout,
          seed: `arena_${nextFrameId}_${nextDriveId}_${nextArenaId}_${Date.now()}`,
        }),
      );
    },
    [arenaId, driveId, frameId, makeLoadout, publishRuntime],
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
    resetArena(frameId, driveId, nextArenaId);
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
    const value = salvageValue(part);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && !running) {
      runtimeRef.current = runtime;
      drawScene(canvas, runtime);
    }
  }, [running, runtime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const redraw = () => drawScene(canvas, runtimeRef.current);
    window.addEventListener("resize", redraw);
    redraw();
    return () => window.removeEventListener("resize", redraw);
  }, []);

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
        const nextRuntime = stepTopArenaRuntime(runtimeRef.current, elapsed * speed);
        runtimeRef.current = nextRuntime;
        const canvas = canvasRef.current;
        if (canvas) {
          drawScene(canvas, nextRuntime);
        }
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
        ...newParts.map((part) => ({ id: `loot_${part.id}`, tone: "drop" as const, text: `Picked ${part.rarity} ${part.displayName}` })),
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
        setActivePanel("inventory");
      }
    }
  }, [arena.tier, inventory, running, runtime.drops, runtime.seed, runtime.wave]);

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

      <section className="workbench-section">
        <div className="section-title">
          <Flame size={17} aria-hidden />
          <h2>Circuit</h2>
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
              <div className={`loot-history-line loot-history-${notice.tone}`} key={notice.id}>
                {notice.text}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="workbench-section">
        <div className="section-title">
          <Gem size={17} aria-hidden />
          <h2>Compare</h2>
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
              <button className="arena-button" disabled={selectedCurrentPart?.id === selectedPart.id} onClick={() => equipPart(selectedPart)} type="button">
                <CircleDot size={15} aria-hidden />
                Equip
              </button>
              <button className="arena-button" disabled={!inventory.some((part) => part.id === selectedPart.id)} onClick={() => toggleLock(selectedPart.id)} type="button">
                <Shield size={15} aria-hidden />
                {selectedPart.locked ? "Unlock" : "Lock"}
              </button>
              <button className="arena-button arena-button-danger" disabled={selectedPart.locked || !inventory.some((part) => part.id === selectedPart.id)} onClick={() => salvagePart(selectedPart)} type="button">
                <Recycle size={15} aria-hidden />
                Salvage
              </button>
            </div>
          </div>
        ) : (
          <span className="empty-drop">No part selected</span>
        )}
      </section>
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
            <button className="socket-node socket-drive" onClick={() => setActivePanel("skills")} type="button">
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

  return (
    <main className="top-arena-shell">
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
          <div className="speed-tabs" aria-label="Speed">
            {[1, 2, 4].map((value) => (
              <button className={speed === value ? "speed-tab speed-tab-active" : "speed-tab"} key={value} onClick={() => setSpeed(value)} type="button">
                {value}x
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="arena-layout">
        <section className="arena-stage-panel">
          <div className="arena-stage-header">
            <div>
              <span className="arena-kicker">{arena.displayName}</span>
              <h1>{frame.displayName}</h1>
            </div>
            <div className="target-strip">
              <span>{target ? target.name : "No target"}</span>
              <strong>{target ? `${formatPercent(targetIntegrity, 0)} integrity` : "spooling"}</strong>
            </div>
          </div>

          <div className="canvas-wrap">
            <canvas aria-label="Live battle top arena" data-testid="arena-canvas" ref={canvasRef} />
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
                  <div className={`loot-toast loot-toast-${notice.tone}`} key={notice.id}>
                    {notice.text}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="arena-hud-grid">
              <StatPill icon={<Activity size={16} />} label="Wave" value={formatNumber(runtime.wave, 0)} tone="rare" />
              <StatPill icon={<Gauge size={16} />} label="Integrity" value={formatPercent(playerIntegrity, 0)} tone={playerIntegrity > 0.35 ? "good" : "warn"} />
              <StatPill icon={<Zap size={16} />} label="Drive" value={formatPercent(cooldownRatio, 0)} tone="good" />
              <StatPill icon={<Gem size={16} />} label="Kills" value={formatNumber(totalKills, 0)} tone="rare" />
            </div>
          </div>

          <div className="combat-bottom">
            <div className="telemetry-grid">
              <StatPill icon={<Gauge size={15} />} label="RPM" value={round(runtime.player.stats.rpm, 1).toString()} />
              <StatPill icon={<Swords size={15} />} label="Impact" value={formatNumber(runtime.player.stats.impact, 0)} />
              <StatPill icon={<Radar size={15} />} label="Tracking" value={formatNumber(runtime.player.stats.tracking, 0)} />
              <StatPill icon={<Shield size={15} />} label="Guard" value={formatNumber(runtime.player.stats.guard, 0)} />
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

        <aside className="workbench-panel">
          <nav className="panel-tabs" aria-label="Workbench">
            <PanelTab active={activePanel === "loadout"} icon={<CircleDot size={15} aria-hidden />} label="Loadout" onClick={() => setActivePanel("loadout")} />
            <PanelTab active={activePanel === "inventory"} icon={<PackageOpen size={15} aria-hidden />} label="Inventory" onClick={() => setActivePanel("inventory")} />
            <PanelTab active={activePanel === "skills"} icon={<Sparkles size={15} aria-hidden />} label="Skills" onClick={() => setActivePanel("skills")} />
            <PanelTab active={activePanel === "talents"} icon={<Network size={15} aria-hidden />} label="Talents" onClick={() => setActivePanel("talents")} />
          </nav>
          <div className="workbench-content">
            {activePanel === "loadout" && renderLoadoutPanel()}
            {activePanel === "inventory" && renderInventoryPanel()}
            {activePanel === "skills" && renderSkillsPanel()}
            {activePanel === "talents" && renderTalentsPanel()}
          </div>
        </aside>
      </section>
    </main>
  );
}
