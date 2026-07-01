import Phaser from "phaser";
import { useEffect, useRef, type RefObject } from "react";
import { getArenaCircuitDef } from "../../data/arenaCircuits";
import { clamp } from "../../engine/math";
import type { ArenaCircuitDef, ArenaDrop, ArenaEffect, EnemyBehaviorId, TopArenaRuntime, TopCollisionKind, TopRuntimeEntity } from "../../engine/topTypes";

type Palette = {
  core: number;
  rim: number;
  glow: number;
  text: string;
};

type WorldMapper = ReturnType<typeof createWorldMapper>;

export type ArenaRendererMetrics = {
  fps: number;
  renderMs: number;
  entities: number;
  effects: number;
  drops: number;
  skippedFrames: number;
  lastHitKind?: TopCollisionKind;
  hitStop: boolean;
  budget: "stable" | "busy" | "over";
};

type ArenaPhaserViewProps = {
  runtime: TopArenaRuntime;
  runtimeRef: RefObject<TopArenaRuntime>;
  onMetrics?: (metrics: ArenaRendererMetrics) => void;
};

type HitFlash = {
  id: string;
  kind: TopCollisionKind;
  x: number;
  y: number;
  normalX: number;
  normalY: number;
  tangentX: number;
  tangentY: number;
  intensity: number;
  heavy: boolean;
  startedAt: number;
  until: number;
};

type TelegraphConfig = {
  window: number;
  color: number;
  accent: number;
};

const framePalette: Record<string, Palette> = {
  frame_swift_razor: {
    core: 0xcfd7d8,
    rim: 0xdf624c,
    glow: 0xdf624c,
    text: "#f0c7b6",
  },
  frame_ember_crucible: {
    core: 0xf0a35c,
    rim: 0xd9a554,
    glow: 0xd96436,
    text: "#f6d399",
  },
  frame_storm_needle: {
    core: 0x90e2ff,
    rim: 0x65c6b0,
    glow: 0x65c6b0,
    text: "#b9f2f0",
  },
};

const enemyPalette: Record<TopRuntimeEntity["rank"], Palette> = {
  player: framePalette.frame_swift_razor,
  pack: {
    core: 0xb8aba0,
    rim: 0x6f7470,
    glow: 0xbf744e,
    text: "#d8c6b7",
  },
  elite: {
    core: 0xf1c36d,
    rim: 0xdf624c,
    glow: 0xd9a554,
    text: "#f6dca4",
  },
  boss: {
    core: 0xd2bdff,
    rim: 0xb68cff,
    glow: 0xb68cff,
    text: "#eadfff",
  },
};

const telegraphConfig: Partial<Record<EnemyBehaviorId, TelegraphConfig>> = {
  charger: {
    window: 0.82,
    color: 0xdf624c,
    accent: 0xfff4c7,
  },
  mineLayer: {
    window: 0.95,
    color: 0xffa84b,
    accent: 0xd9a554,
  },
  bossJudicator: {
    window: 1.18,
    color: 0xb68cff,
    accent: 0xfff4c7,
  },
};

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

function drawArc(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, start: number, end: number) {
  graphics.beginPath();
  graphics.arc(x, y, radius, start, end, false, 0.01);
  graphics.strokePath();
}

function rotatedPoint(cx: number, cy: number, x: number, y: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return new Phaser.Math.Vector2(cx + x * cos - y * sin, cy + x * sin + y * cos);
}

function drawArenaFloor(graphics: Phaser.GameObjects.Graphics, width: number, height: number, arena: ArenaCircuitDef, runtime: TopArenaRuntime) {
  const map = createWorldMapper(width, height, arena);
  const radius = map.radius(arena.radius);
  const sweep = (runtime.time * 0.22) % (Math.PI * 2);

  graphics.fillStyle(0x070809, 1);
  graphics.fillRect(0, 0, width, height);

  graphics.fillStyle(0x222827, 0.98);
  graphics.fillCircle(map.centerX, map.centerY, radius * 1.08);
  graphics.fillStyle(0x171b1a, 0.96);
  graphics.fillCircle(map.centerX, map.centerY, radius * 0.93);
  graphics.fillStyle(0x0f1212, 0.9);
  graphics.fillCircle(map.centerX, map.centerY, radius * 0.7);
  graphics.fillStyle(0x050607, 0.82);
  graphics.fillCircle(map.centerX, map.centerY, radius * 0.38);

  graphics.fillStyle(0xd9a554, 0.045);
  graphics.fillCircle(map.centerX, map.centerY, radius * 1.06);
  graphics.fillStyle(0xdf624c, 0.06);
  graphics.fillCircle(map.centerX, map.centerY, radius * 0.95);
  graphics.fillStyle(0x000000, 0.34);
  graphics.fillEllipse(map.centerX, map.centerY + radius * 0.05, radius * 0.72, radius * 0.46, 48);

  graphics.lineStyle(1, 0xe6d7b5, 0.045);
  for (let y = map.centerY - radius; y <= map.centerY + radius; y += 28) {
    const dy = y - map.centerY;
    const extent = Math.sqrt(Math.max(0, radius * radius - dy * dy));
    graphics.lineBetween(map.centerX - extent, y, map.centerX + extent, y);
  }
  for (let x = map.centerX - radius; x <= map.centerX + radius; x += 34) {
    const dx = x - map.centerX;
    const extent = Math.sqrt(Math.max(0, radius * radius - dx * dx));
    graphics.lineBetween(x, map.centerY - extent, x, map.centerY + extent);
  }

  graphics.lineStyle(1, 0xd9a554, 0.18);
  for (let i = 1; i <= 5; i += 1) {
    graphics.strokeCircle(map.centerX, map.centerY, (radius / 6) * i);
  }

  graphics.lineStyle(2, 0x000000, 0.22);
  for (let i = 1; i <= 4; i += 1) {
    graphics.strokeCircle(map.centerX, map.centerY + i * 0.7, radius * (0.16 + i * 0.105));
  }
  graphics.lineStyle(2, 0x65c6b0, 0.18);
  graphics.strokeCircle(map.centerX, map.centerY, radius * 0.34);
  graphics.lineStyle(1.5, 0xd9a554, 0.24);
  graphics.strokeCircle(map.centerX, map.centerY, radius * 0.52);

  graphics.lineStyle(1, 0x65c6b0, 0.16);
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12 + sweep * 0.08;
    graphics.lineBetween(map.centerX, map.centerY, map.centerX + Math.cos(angle) * radius, map.centerY + Math.sin(angle) * radius);
  }

  graphics.lineStyle(2, 0x65c6b0, 0.12);
  for (let i = 0; i < 8; i += 1) {
    const start = (Math.PI * 2 * i) / 8 - sweep * 0.1;
    drawArc(graphics, map.centerX, map.centerY, radius * 0.74, start, start + Math.PI * 0.32);
    drawArc(graphics, map.centerX, map.centerY, radius * 0.5, start + Math.PI * 0.1, start + Math.PI * 0.34);
  }

  graphics.lineStyle(2, 0xdf624c, 0.32);
  drawArc(graphics, map.centerX, map.centerY, radius * 0.82, sweep, sweep + Math.PI * 0.42);

  graphics.lineStyle(2, 0xe6d7b5, 0.34);
  graphics.strokeCircle(map.centerX, map.centerY, radius);
  graphics.lineStyle(8, 0x000000, 0.74);
  graphics.strokeCircle(map.centerX, map.centerY, radius + 4);
}

function drawSpark(graphics: Phaser.GameObjects.Graphics, x: number, y: number, ageRatio: number, intensity: number) {
  const alpha = 1 - ageRatio;
  const spokes = 8;
  graphics.lineStyle(Math.max(1, 2 * intensity), 0xf4c56d, alpha);
  for (let i = 0; i < spokes; i += 1) {
    const angle = (Math.PI * 2 * i) / spokes + ageRatio * 1.8;
    const inner = 4 * intensity;
    const outer = (18 + 20 * ageRatio) * intensity;
    graphics.lineBetween(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner, x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
  }
}

function drawEffect(graphics: Phaser.GameObjects.Graphics, effect: ArenaEffect, map: WorldMapper) {
  const point = map.point(effect.x, effect.y);
  const ratio = clamp(effect.age / effect.lifetime, 0, 1);
  const alpha = 1 - ratio;

  if (effect.kind === "spark") {
    drawSpark(graphics, point.x, point.y, ratio, effect.intensity);
    return;
  }

  if (effect.kind === "emberTrail") {
    const radius = (20 + ratio * 42) * effect.intensity;
    graphics.fillStyle(0xffa84b, 0.18 * alpha);
    graphics.fillCircle(point.x, point.y, radius * 0.52);
    graphics.fillStyle(0xdf624c, 0.14 * alpha);
    graphics.fillCircle(point.x, point.y, radius);
    return;
  }

  if (effect.kind === "stormArc") {
    const target = map.point(effect.x2 ?? effect.x, effect.y2 ?? effect.y);
    const midX = (point.x + target.x) / 2 + Math.sin(effect.age * 30) * 16;
    const midY = (point.y + target.y) / 2 + Math.cos(effect.age * 22) * 12;
    graphics.lineStyle(2.2 * effect.intensity, 0x9ff8ff, alpha);
    let previous = point;
    for (let i = 1; i <= 8; i += 1) {
      const t = i / 8;
      const inverse = 1 - t;
      const x = inverse * inverse * point.x + 2 * inverse * t * midX + t * t * target.x;
      const y = inverse * inverse * point.y + 2 * inverse * t * midY + t * t * target.y;
      graphics.lineBetween(previous.x, previous.y, x, y);
      previous = { x, y };
    }
    graphics.lineStyle(6 * effect.intensity, 0x65c6b0, 0.08 * alpha);
    graphics.lineBetween(point.x, point.y, target.x, target.y);
    return;
  }

  if (effect.kind === "chargeLine") {
    const target = map.point(effect.x2 ?? effect.x, effect.y2 ?? effect.y);
    graphics.lineStyle(2.6 * effect.intensity, 0xdf624c, alpha);
    graphics.lineBetween(point.x, point.y, target.x, target.y);
    graphics.lineStyle(8 * effect.intensity, 0xdf624c, 0.06 * alpha);
    graphics.lineBetween(point.x, point.y, target.x, target.y);
    return;
  }

  if (effect.kind === "frictionSpark") {
    const target = map.point(effect.x2 ?? effect.x, effect.y2 ?? effect.y);
    const dx = target.x - point.x;
    const dy = target.y - point.y;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / length;
    const ny = dy / length;
    const branchCount = Math.min(7, Math.max(3, Math.ceil(effect.intensity * 2.2)));

    graphics.lineStyle(3.2 + effect.intensity * 1.05, 0xfff4c7, alpha);
    graphics.lineBetween(point.x, point.y, target.x, target.y);
    graphics.lineStyle(1.8 + effect.intensity * 0.55, 0xff7a2d, 0.9 * alpha);
    for (let i = 0; i < branchCount; i += 1) {
      const offset = (i - (branchCount - 1) / 2) * 0.42;
      const branchLength = length * (0.28 + 0.07 * i) * Math.min(1.45, effect.intensity);
      const side = i % 2 === 0 ? 1 : -1;
      const start = 0.18 + i * 0.1;
      const sx = point.x + dx * start;
      const sy = point.y + dy * start;
      graphics.lineBetween(sx, sy, sx + (nx * 0.72 - ny * side * (0.42 + offset * 0.2)) * branchLength, sy + (ny * 0.72 + nx * side * (0.42 + offset * 0.2)) * branchLength);
    }
    graphics.fillStyle(0xfff4c7, alpha);
    graphics.fillCircle(point.x, point.y, 3 + effect.intensity * 2.2);
    return;
  }

  if (effect.kind === "hazard") {
    const armRatio = clamp(effect.age / 0.45, 0, 1);
    const radius = (52 + ratio * 16) * effect.intensity;
    const color = armRatio < 1 ? 0xffa84b : 0xdf624c;
    graphics.fillStyle(color, (armRatio < 1 ? 0.065 : 0.12) * alpha);
    graphics.fillCircle(point.x, point.y, radius);
    graphics.lineStyle(2.4, color, (0.38 + armRatio * 0.24) * alpha);
    graphics.strokeCircle(point.x, point.y, radius * (0.66 + armRatio * 0.18));
    graphics.lineStyle(1.5, 0xfff4c7, (0.22 + armRatio * 0.2) * alpha);
    drawArc(graphics, point.x, point.y, radius * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * armRatio);
    for (let i = 0; i < 4; i += 1) {
      const start = effect.age * 1.8 + (Math.PI * 2 * i) / 4;
      graphics.lineStyle(1.4, color, (0.26 + armRatio * 0.18) * alpha);
      drawArc(graphics, point.x, point.y, radius * 0.9, start, start + Math.PI * 0.24);
    }
    return;
  }

  const ringRadius = (18 + ratio * 34) * effect.intensity;
  const color = effect.kind === "drop" ? 0xb68cff : effect.kind === "shockwave" ? 0xdf624c : 0xd9a554;
  graphics.lineStyle(effect.kind === "shockwave" ? 3 : 2, color, alpha);
  graphics.strokeCircle(point.x, point.y, effect.kind === "shockwave" ? ringRadius * 2.4 : ringRadius);
}

function collisionColor(kind: TopCollisionKind, heavy: boolean) {
  if (heavy || kind === "smash") {
    return 0xdf624c;
  }
  if (kind === "grind") {
    return 0x65c6b0;
  }
  if (kind === "scrape") {
    return 0xffa84b;
  }
  return 0xd9a554;
}

function drawHitFlash(graphics: Phaser.GameObjects.Graphics, flash: HitFlash, map: WorldMapper, now: number) {
  const lifetime = Math.max(1, flash.until - flash.startedAt);
  const ratio = clamp((now - flash.startedAt) / lifetime, 0, 1);
  const alpha = Math.pow(1 - ratio, 0.72);
  const point = map.point(flash.x, flash.y);
  const color = collisionColor(flash.kind, flash.heavy);
  const radius = (22 + ratio * (flash.heavy ? 78 : 42)) * flash.intensity;
  const normalLength = (32 + flash.intensity * 42) * (flash.heavy ? 1.65 : 1);
  const tangentLength = (26 + flash.intensity * 28) * (flash.kind === "grind" || flash.kind === "scrape" ? 1.36 : 0.96);

  graphics.fillStyle(color, 0.13 * alpha);
  graphics.fillCircle(point.x, point.y, radius * 0.72);
  graphics.lineStyle(flash.heavy ? 4 : 2.5, color, 0.86 * alpha);
  graphics.strokeCircle(point.x, point.y, radius);
  graphics.lineStyle(1.5, 0xfff4c7, 0.7 * alpha);
  graphics.strokeCircle(point.x, point.y, radius * 0.52);

  graphics.lineStyle(flash.heavy ? 5.2 : 3, 0xfff4c7, alpha);
  graphics.lineBetween(point.x - flash.normalX * normalLength, point.y - flash.normalY * normalLength, point.x + flash.normalX * normalLength, point.y + flash.normalY * normalLength);

  graphics.lineStyle(2.2, color, 0.74 * alpha);
  graphics.lineBetween(point.x - flash.tangentX * tangentLength, point.y - flash.tangentY * tangentLength, point.x + flash.tangentX * tangentLength, point.y + flash.tangentY * tangentLength);

  if (flash.heavy) {
    graphics.lineStyle(2, 0xffffff, 0.42 * alpha);
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8 + ratio * 1.2;
      graphics.lineBetween(point.x + Math.cos(angle) * radius * 0.22, point.y + Math.sin(angle) * radius * 0.22, point.x + Math.cos(angle) * radius * 0.88, point.y + Math.sin(angle) * radius * 0.88);
    }
  }

  graphics.fillStyle(0xfff4c7, alpha);
  graphics.fillCircle(point.x, point.y, 3 + flash.intensity * 2.2);
}

function drawDangerArc(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, progress: number, color: number, alpha: number) {
  graphics.lineStyle(3, color, alpha);
  drawArc(graphics, x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(progress, 0, 1));
}

function drawEnemyTelegraphs(graphics: Phaser.GameObjects.Graphics, runtime: TopArenaRuntime, map: WorldMapper) {
  const player = runtime.player;
  const playerPoint = map.point(player.x, player.y);

  for (const enemy of runtime.enemies) {
    if (!enemy.behaviorId) {
      continue;
    }

    const config = telegraphConfig[enemy.behaviorId];
    if (!config || enemy.cooldownRemaining > config.window) {
      continue;
    }

    const progress = 1 - clamp(enemy.cooldownRemaining / config.window, 0, 1);
    const pulse = (Math.sin(runtime.time * 18) + 1) / 2;
    const alpha = 0.2 + progress * 0.45 + pulse * 0.12;
    const enemyPoint = map.point(enemy.x, enemy.y);
    const enemyRadius = map.radius(enemy.radius);
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;

    graphics.lineStyle(1.8 + progress * 2.2, config.color, alpha);
    graphics.strokeCircle(enemyPoint.x, enemyPoint.y, enemyRadius * (1.65 + progress * 0.48));
    drawDangerArc(graphics, enemyPoint.x, enemyPoint.y, enemyRadius * (2.05 + progress * 0.32), progress, config.accent, 0.42 + progress * 0.42);

    if (enemy.behaviorId === "charger") {
      graphics.lineStyle(2.4 + progress * 2.6, config.color, 0.16 + progress * 0.48);
      graphics.lineBetween(enemyPoint.x, enemyPoint.y, playerPoint.x, playerPoint.y);
      graphics.lineStyle(1.4, config.accent, 0.32 + progress * 0.4);
      graphics.strokeCircle(playerPoint.x, playerPoint.y, map.radius(player.radius) + 15 + progress * 10);
      graphics.lineBetween(playerPoint.x - ny * 12 - nx * 8, playerPoint.y + nx * 12 - ny * 8, playerPoint.x + nx * 18, playerPoint.y + ny * 18);
      graphics.lineBetween(playerPoint.x + ny * 12 - nx * 8, playerPoint.y - nx * 12 - ny * 8, playerPoint.x + nx * 18, playerPoint.y + ny * 18);
      continue;
    }

    if (enemy.behaviorId === "mineLayer") {
      const target = map.point(player.x - nx * 18, player.y - ny * 18);
      const radius = map.radius(58);
      graphics.fillStyle(config.color, 0.05 + progress * 0.08);
      graphics.fillCircle(target.x, target.y, radius);
      graphics.lineStyle(2.2, config.color, 0.28 + progress * 0.42);
      graphics.strokeCircle(target.x, target.y, radius * (0.72 + progress * 0.18));
      drawDangerArc(graphics, target.x, target.y, radius * 0.48, progress, config.accent, 0.48 + progress * 0.36);
      continue;
    }

    if (enemy.behaviorId === "bossJudicator") {
      const radius = map.radius(190);
      graphics.fillStyle(config.color, 0.025 + progress * 0.045);
      graphics.fillCircle(enemyPoint.x, enemyPoint.y, radius);
      graphics.lineStyle(3.2, config.color, 0.24 + progress * 0.36);
      graphics.strokeCircle(enemyPoint.x, enemyPoint.y, radius * (0.68 + progress * 0.16));
      graphics.lineStyle(1.6, config.accent, 0.28 + progress * 0.34);
      for (let i = 0; i < 5; i += 1) {
        const start = runtime.time * 0.8 + (Math.PI * 2 * i) / 5;
        drawArc(graphics, enemyPoint.x, enemyPoint.y, radius * 0.9, start, start + Math.PI * 0.24);
      }
    }
  }
}

function drawDrops(graphics: Phaser.GameObjects.Graphics, drops: ArenaDrop[], map: WorldMapper) {
  for (const drop of drops) {
    const point = map.point(drop.x, drop.y);
    const bob = Math.sin(drop.age * 4) * 2;
    const pulse = (Math.sin(drop.age * 5.2) + 1) / 2;
    const color =
      drop.rarity === "relic"
        ? 0xb68cff
        : drop.rarity === "engraved"
          ? 0xd9a554
          : drop.rarity === "tuned"
            ? 0x65c6b0
            : 0xcbbf9d;
    const glow = drop.rarity === "relic" ? 0.35 : drop.rarity === "engraved" ? 0.27 : drop.rarity === "tuned" ? 0.22 : 0.12;
    const beamHeight = drop.rarity === "relic" ? 52 : drop.rarity === "engraved" ? 42 : drop.rarity === "tuned" ? 34 : 0;
    const cx = point.x;
    const cy = point.y + bob;

    graphics.fillStyle(0x000000, 0.28);
    graphics.fillEllipse(cx, cy + 12, 28, 9, 24);
    graphics.fillStyle(color, glow * (0.65 + pulse * 0.35));
    graphics.fillCircle(cx, cy, 18 + pulse * 8);
    if (beamHeight > 0) {
      graphics.lineStyle(drop.rarity === "relic" ? 3 : 2, color, 0.2 + pulse * 0.18);
      graphics.lineBetween(cx, cy - beamHeight, cx, cy + 14);
      graphics.lineStyle(1, 0xfff4c7, 0.28 + pulse * 0.18);
      graphics.lineBetween(cx, cy - beamHeight * 0.72, cx, cy + 8);
    }

    graphics.fillStyle(color, 0.95);
    graphics.fillPoints(
      [
        new Phaser.Math.Vector2(cx, cy - 7),
        new Phaser.Math.Vector2(cx + 7, cy),
        new Phaser.Math.Vector2(cx, cy + 7),
        new Phaser.Math.Vector2(cx - 7, cy),
      ],
      true,
      true,
    );
    graphics.lineStyle(2, color, 0.3 + pulse * 0.18);
    graphics.strokeCircle(cx, cy, 13 + pulse * 2);
    graphics.lineStyle(1, 0xfff4c7, drop.rarity === "common" ? 0.24 : 0.48);
    graphics.strokeCircle(cx, cy, 6);
  }
}

function drawTop(graphics: Phaser.GameObjects.Graphics, entity: TopRuntimeEntity, map: WorldMapper, palette: Palette) {
  const point = map.point(entity.x, entity.y);
  const radius = map.radius(entity.radius);
  const integrityRatio = clamp(entity.spinIntegrity / entity.stats.maxSpinIntegrity, 0, 1);
  const spinRatio = clamp(entity.spinPower / 100, 0.04, 1);
  const wobble = clamp(entity.wobble ?? 0, 0, 1);
  const wobbleX = Math.cos(entity.angle * 1.7) * radius * wobble * 0.16;
  const wobbleY = Math.sin(entity.angle * 1.35) * radius * wobble * 0.12;
  const cx = point.x + wobbleX;
  const cy = point.y + wobbleY;

  graphics.fillStyle(0x000000, 0.38);
  graphics.fillEllipse(cx + radius * 0.16, cy + radius * 0.22, radius * 2.2, radius * 1.48, 32);

  graphics.fillStyle(palette.rim, 0.95);
  for (let i = 0; i < 4; i += 1) {
    const angle = entity.angle + (Math.PI / 2) * i;
    graphics.fillPoints(
      [
        rotatedPoint(cx, cy, 0, -radius * 1.18, angle),
        rotatedPoint(cx, cy, radius * 0.34, -radius * 0.24, angle),
        rotatedPoint(cx, cy, 0, -radius * 0.03, angle),
        rotatedPoint(cx, cy, -radius * 0.34, -radius * 0.24, angle),
      ],
      true,
      true,
    );
  }

  graphics.fillStyle(palette.glow, entity.team === "player" ? 0.16 : 0.1);
  graphics.fillCircle(cx, cy, radius * (1.2 + spinRatio * 0.22));
  graphics.fillStyle(0xffffff, 0.92);
  graphics.fillCircle(cx - radius * 0.18, cy - radius * 0.2, radius * 0.58);
  graphics.fillStyle(palette.core, 0.92);
  graphics.fillCircle(cx, cy, radius * 0.94);
  graphics.fillStyle(0x303638, 0.92);
  graphics.fillCircle(cx + radius * 0.12, cy + radius * 0.1, radius * 0.72);
  graphics.fillStyle(0x08090a, 0.72);
  graphics.fillCircle(cx, cy, radius * 0.52);

  graphics.lineStyle(Math.max(2, radius * 0.11), 0x000000, 0.58);
  graphics.strokeCircle(cx, cy, radius * 0.66);
  graphics.fillStyle(palette.rim, 1);
  graphics.fillCircle(cx, cy, radius * 0.28);

  if (wobble > 0.05) {
    graphics.lineStyle(2, 0xdf624c, Math.min(0.42, wobble * 0.65));
    graphics.strokeEllipse(point.x + wobbleX * 1.8, point.y + wobbleY * 1.8, radius * (2.24 + wobble * 0.44), radius * (1.6 - wobble * 0.24), 32);
  }

  graphics.lineStyle(5, 0x000000, 0.72);
  graphics.strokeCircle(point.x, point.y, radius + 7);
  graphics.lineStyle(3, integrityRatio > 0.33 ? palette.rim : 0xdf624c, 1);
  drawArc(graphics, point.x, point.y, radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * integrityRatio);
  graphics.lineStyle(2, 0x65c6b0, 0.22 + spinRatio * 0.42);
  drawArc(graphics, point.x, point.y, radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * spinRatio);

  const barWidth = Math.max(42, radius * 2.2);
  const barY = point.y + radius + 30;
  graphics.fillStyle(0x000000, 0.72);
  graphics.fillRect(point.x - barWidth / 2, barY, barWidth, 4);
  graphics.fillStyle(integrityRatio > 0.45 ? palette.rim : 0xdf624c, 1);
  graphics.fillRect(point.x - barWidth / 2, barY, barWidth * integrityRatio, 4);
}

class ArenaPhaserScene extends Phaser.Scene {
  private runtime: TopArenaRuntime | null = null;
  private readonly getRuntime: () => TopArenaRuntime;
  private readonly getOnMetrics: () => ((metrics: ArenaRendererMetrics) => void) | undefined;
  private floor!: Phaser.GameObjects.Graphics;
  private effectsBack!: Phaser.GameObjects.Graphics;
  private drops!: Phaser.GameObjects.Graphics;
  private tops!: Phaser.GameObjects.Graphics;
  private effectsFront!: Phaser.GameObjects.Graphics;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private lastCollisionId: string | null = null;
  private lastHitKind: TopCollisionKind | undefined;
  private lastHitFlash: HitFlash | null = null;
  private hitStopUntil = 0;
  private frozenRuntime: TopArenaRuntime | null = null;
  private lastRenderSignature = "";
  private frameCount = 0;
  private fpsWindowStarted = 0;
  private currentFps = 0;
  private skippedFrames = 0;
  private lastMetricsAt = 0;
  private lastRenderMs = 0;

  constructor(getRuntime: () => TopArenaRuntime, getOnMetrics: () => ((metrics: ArenaRendererMetrics) => void) | undefined) {
    super("ArenaPhaserScene");
    this.getRuntime = getRuntime;
    this.getOnMetrics = getOnMetrics;
  }

  create() {
    this.floor = this.add.graphics();
    this.effectsBack = this.add.graphics();
    this.drops = this.add.graphics();
    this.tops = this.add.graphics();
    this.effectsFront = this.add.graphics();
    this.cameras.main.setBackgroundColor("#070809");
  }

  setRuntime(runtime: TopArenaRuntime) {
    this.runtime = runtime;
    if (this.floor) {
      const now = performance.now();
      this.registerCollision(runtime, now);
      this.renderRuntime(this.resolveVisualRuntime(runtime, now), now);
    }
  }

  update(_time: number, _delta: number) {
    const now = performance.now();
    const runtime = this.getRuntime() ?? this.runtime;
    if (runtime) {
      this.registerCollision(runtime, now);
    }
    this.renderRuntime(this.resolveVisualRuntime(runtime, now), now);
  }

  private resolveVisualRuntime(runtime: TopArenaRuntime | null, now: number) {
    if (this.lastHitFlash && now > this.lastHitFlash.until) {
      this.lastHitFlash = null;
    }
    if (this.hitStopUntil > now && this.frozenRuntime) {
      return this.frozenRuntime;
    }
    this.frozenRuntime = null;
    return runtime;
  }

  private registerCollision(runtime: TopArenaRuntime, now: number) {
    const collision = runtime.lastCollision;
    if (!collision || collision.id === this.lastCollisionId) {
      return;
    }

    this.lastCollisionId = collision.id;
    this.lastHitKind = collision.kind;
    const intensity = clamp(collision.sparkIntensity * 0.5 + collision.normalImpulse / 95, 0.9, collision.heavy ? 3.6 : 2.1);
    const freezeMs = collision.heavy ? clamp(62 + collision.normalImpulse * 0.32 + collision.sparkIntensity * 7, 72, 150) : 0;

    this.lastHitFlash = {
      id: collision.id,
      kind: collision.kind,
      x: collision.x,
      y: collision.y,
      normalX: collision.normalX,
      normalY: collision.normalY,
      tangentX: collision.tangentX,
      tangentY: collision.tangentY,
      intensity,
      heavy: collision.heavy,
      startedAt: now,
      until: now + (collision.heavy ? 280 : 180),
    };

    if (freezeMs > 0) {
      this.hitStopUntil = Math.max(this.hitStopUntil, now + freezeMs);
      this.frozenRuntime = runtime;
      this.cameras.main.shake(105, clamp(collision.normalImpulse / 1800 + collision.sparkIntensity / 1200, 0.008, 0.034));
      return;
    }

    this.cameras.main.shake(45, clamp(collision.sparkIntensity / 2400, 0.0015, 0.005));
  }

  private renderRuntime(runtime: TopArenaRuntime | null, now: number) {
    const renderStartedAt = performance.now();
    if (!runtime || !this.floor) {
      return;
    }

    const width = Math.max(1, this.scale.gameSize.width);
    const height = Math.max(1, this.scale.gameSize.height);
    const flashClock = this.lastHitFlash ? `${this.lastHitFlash.id}:${Math.floor((now - this.lastHitFlash.startedAt) / 16)}` : "";
    const stopClock = this.hitStopUntil > now ? `stop:${Math.floor((this.hitStopUntil - now) / 16)}` : "";
    const signature = [
      runtime.seed,
      width,
      height,
      runtime.time.toFixed(3),
      runtime.wave,
      runtime.kills,
      runtime.player.x.toFixed(2),
      runtime.player.y.toFixed(2),
      runtime.player.spinIntegrity.toFixed(2),
      runtime.player.spinPower.toFixed(2),
      runtime.enemies.map((enemy) => `${enemy.id}:${enemy.behaviorId ?? ""}:${enemy.x.toFixed(1)}:${enemy.y.toFixed(1)}:${enemy.spinIntegrity.toFixed(1)}:${enemy.cooldownRemaining.toFixed(2)}`).join(","),
      runtime.effects.map((effect) => `${effect.kind}:${effect.age.toFixed(2)}`).join(","),
      runtime.drops.map((drop) => `${drop.id}:${drop.age.toFixed(2)}`).join(","),
      runtime.lastCollision?.id ?? "",
      flashClock,
      stopClock,
    ].join("|");
    if (signature === this.lastRenderSignature) {
      this.skippedFrames += 1;
      this.publishMetrics(runtime, now);
      return;
    }
    this.lastRenderSignature = signature;

    const arena = getArenaCircuitDef(runtime.arenaId);
    const map = createWorldMapper(width, height, arena);
    const effects = [...runtime.effects].reverse();

    this.floor.clear();
    this.effectsBack.clear();
    this.drops.clear();
    this.tops.clear();
    this.effectsFront.clear();

    drawArenaFloor(this.floor, width, height, arena, runtime);
    drawEnemyTelegraphs(this.effectsBack, runtime, map);
    for (const effect of effects.filter((entry) => entry.kind !== "frictionSpark")) {
      drawEffect(this.effectsBack, effect, map);
    }
    drawDrops(this.drops, runtime.drops, map);

    const visibleLabels = new Set<string>();
    for (const enemy of runtime.enemies) {
      drawTop(this.tops, enemy, map, enemyPalette[enemy.rank]);
      this.syncLabel(enemy, map, enemyPalette[enemy.rank], visibleLabels);
    }

    drawTop(this.tops, runtime.player, map, framePalette[runtime.frameId] ?? framePalette.frame_swift_razor);
    this.syncLabel(runtime.player, map, framePalette[runtime.frameId] ?? framePalette.frame_swift_razor, visibleLabels);

    for (const effect of effects.filter((entry) => entry.kind === "frictionSpark")) {
      drawEffect(this.effectsFront, effect, map);
    }
    if (this.lastHitFlash) {
      drawHitFlash(this.effectsFront, this.lastHitFlash, map, now);
    }

    for (const [id, label] of this.labels.entries()) {
      label.setVisible(visibleLabels.has(id));
    }

    this.lastRenderMs = performance.now() - renderStartedAt;
    this.publishMetrics(runtime, now);
  }

  private publishMetrics(runtime: TopArenaRuntime, now: number) {
    this.frameCount += 1;
    if (this.fpsWindowStarted === 0) {
      this.fpsWindowStarted = now;
    }
    if (now - this.fpsWindowStarted >= 500) {
      this.currentFps = (this.frameCount * 1000) / Math.max(1, now - this.fpsWindowStarted);
      this.frameCount = 0;
      this.fpsWindowStarted = now;
    }
    if (now - this.lastMetricsAt < 250) {
      return;
    }

    this.lastMetricsAt = now;
    this.getOnMetrics()?.({
      fps: this.currentFps,
      renderMs: this.lastRenderMs,
      entities: 1 + runtime.enemies.length,
      effects: runtime.effects.length,
      drops: runtime.drops.length,
      skippedFrames: this.skippedFrames,
      lastHitKind: this.lastHitKind,
      hitStop: this.hitStopUntil > now,
      budget: this.currentFps > 0 && this.currentFps < 45 ? "over" : this.lastRenderMs > 5 ? "busy" : "stable",
    });
  }

  private syncLabel(entity: TopRuntimeEntity, map: WorldMapper, palette: Palette, visibleLabels: Set<string>) {
    const point = map.point(entity.x, entity.y);
    const radius = map.radius(entity.radius);
    let label = this.labels.get(entity.id);
    if (!label) {
      label = this.add.text(0, 0, entity.name, {
        color: palette.text,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "11px",
        fontStyle: "600",
      });
      label.setOrigin(0.5, 0.5);
      label.setDepth(10);
      this.labels.set(entity.id, label);
    }

    label.setText(entity.name);
    label.setColor(palette.text);
    label.setPosition(point.x, point.y + radius + 24);
    label.setVisible(true);
    visibleLabels.add(entity.id);
  }
}

export function ArenaPhaserView({ runtime, runtimeRef, onMetrics }: ArenaPhaserViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ArenaPhaserScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const latestRuntimeRef = useRef(runtime);
  const metricsCallbackRef = useRef(onMetrics);

  useEffect(() => {
    latestRuntimeRef.current = runtime;
  }, [runtime]);

  useEffect(() => {
    metricsCallbackRef.current = onMetrics;
  }, [onMetrics]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const scene = new ArenaPhaserScene(
      () => runtimeRef.current ?? latestRuntimeRef.current,
      () => metricsCallbackRef.current,
    );
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      backgroundColor: "#070809",
      audio: {
        noAudio: true,
      },
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: Math.max(1, host.clientWidth || 800),
        height: Math.max(1, host.clientHeight || 500),
      },
      scene,
    });

    sceneRef.current = scene;
    gameRef.current = game;

    return () => {
      sceneRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [runtimeRef]);

  useEffect(() => {
    sceneRef.current?.setRuntime(runtime);
  }, [runtime]);

  return <div aria-label="Live battle top arena" className="arena-phaser-view" data-testid="arena-phaser-view" ref={hostRef} role="img" />;
}
