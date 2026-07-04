import { describe, expect, it } from "vitest";
import arenaRuntimeSource from "../engine/arenaRuntime.ts?raw";
import { arenaKeyAffixes } from "./arenaKeyAffixes";
import { arenaCircuits } from "./arenaCircuits";
import { arenaAnomalies } from "./arenaAnomalies";
import { arenaEvents } from "./arenaEvents";
import { bossGates } from "./bossGates";
import { chapters } from "./chapters";
import { circuitAtlasNodes } from "./circuitAtlasNodes";
import { circuitNetworkNodes } from "./circuitNetwork";
import { doctrines } from "./doctrines";
import { driveCores } from "./driveCores";
import { enemyModifiers } from "./enemyModifiers";
import { endgameMasters, endgameMasterRewardTargets, endgameMasterSignals } from "./endgameMasters";
import { topEngravings } from "./engravings";
import { namedRivals, rivalMechanicIds } from "./namedRivals";
import { talentNodes } from "./talentNodes";
import { partSlotOrder, topPartBases } from "./topPartBases";
import { topFrames } from "./topFrames";
import { tutorialSteps } from "./tutorialSteps";
import { tuningRunes } from "./tuningRunes";
import { generateArenaKey, isArenaKeyLegal } from "../engine/arenaKeys";
import { validateRuneLoadout } from "../engine/driveRuneValidation";
import { resolveTopRuntimeStats } from "../engine/topAssembly";
import { dropLabelOptions } from "../engine/topDropRolls";
import { generateTopPart } from "../engine/topPartGeneration";
import { isTopPartLegal } from "../engine/topCrafting";
import type { DriveTag } from "../engine/topTypes";
import { TALENT_NODE_SIZES, TALENT_WORLD_WIDTH, TALENT_WORLD_HEIGHT } from "../ui/arena/talentLayout";

function expectUnique(ids: string[]) {
  expect(new Set(ids).size).toBe(ids.length);
}

const validDriveTags: DriveTag[] = [
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
];
const validDamageTypes = ["impact", "heat", "glass", "static", "void"];
const validCollisionKinds = ["scrape", "clash", "smash", "grind"];
const validArenaAnomalyRules = ["noFluxSustain", "shrinkingArena", "heavyResonance"];

describe("top ARPG data integrity", () => {
  it("keeps drive collision behavior data-driven in arena runtime", () => {
    expect(arenaRuntimeSource).not.toMatch(/drive\.id\s*[!=]==/);
  });

  it("has unique IDs across data tables", () => {
    expectUnique(topFrames.map((entry) => entry.id));
    expectUnique(driveCores.map((entry) => entry.id));
    expectUnique(tuningRunes.map((entry) => entry.id));
    expectUnique(topPartBases.map((entry) => entry.id));
    expectUnique(topEngravings.map((entry) => entry.id));
    expectUnique(arenaCircuits.map((entry) => entry.id));
    expectUnique(arenaAnomalies.map((entry) => entry.id));
    expectUnique(arenaKeyAffixes.map((entry) => entry.id));
    expectUnique(arenaEvents.map((entry) => entry.id));
    expectUnique(enemyModifiers.map((entry) => entry.id));
    expectUnique(bossGates.map((entry) => entry.id));
    expectUnique(talentNodes.map((entry) => entry.id));
    expectUnique(circuitAtlasNodes.map((entry) => entry.id));
    expectUnique(doctrines.map((entry) => entry.id));
    expectUnique(doctrines.flatMap((entry) => entry.nodes.map((node) => node.id)));
    expectUnique(circuitNetworkNodes.map((entry) => entry.id));
    expectUnique(namedRivals.map((entry) => entry.id));
    expectUnique(chapters.map((entry) => entry.id));
    expectUnique(tutorialSteps.map((entry) => entry.id));
  });

  it("has enough content for the first vertical slice", () => {
    expect(driveCores.length).toBeGreaterThanOrEqual(6);
    expect(tuningRunes.length).toBeGreaterThanOrEqual(15);
    expect(topPartBases.length).toBeGreaterThanOrEqual(30);
    expect(topEngravings.length).toBeGreaterThanOrEqual(40);
    expect(enemyModifiers.length).toBeGreaterThanOrEqual(5);
    expect(arenaEvents.length).toBeGreaterThanOrEqual(3);
    expect(circuitAtlasNodes.length).toBeGreaterThanOrEqual(12);
    expect(talentNodes.length).toBeGreaterThanOrEqual(90);
    expect(doctrines.length).toBeGreaterThanOrEqual(6);
    expect(arenaAnomalies.length).toBeGreaterThanOrEqual(8);
    expect(namedRivals.length).toBeGreaterThanOrEqual(rivalMechanicIds.length);
    expect(circuitNetworkNodes.length).toBeGreaterThanOrEqual(12);
    expect(circuitNetworkNodes.length).toBeLessThanOrEqual(16);
  });

  it("keeps frame, drive, rune, and tag references valid", () => {
    const driveIds = new Set(driveCores.map((entry) => entry.id));
    const validTags = new Set(validDriveTags);

    for (const frame of topFrames) {
      expect(driveIds.has(frame.startingDriveId)).toBe(true);
      expect(frame.preferredTags.every((tag) => validTags.has(tag))).toBe(true);
    }

    for (const drive of driveCores) {
      expect(drive.tags.every((tag) => validTags.has(tag))).toBe(true);
      expect(drive.damageTypes.length).toBeGreaterThan(0);
      expect(drive.cost?.amount ?? 1).toBeGreaterThan(0);
      expect(drive.cooldown?.baseSeconds ?? drive.baseCooldown).toBeGreaterThan(0);
      if (drive.collisionBonus) {
        expect(validDamageTypes).toContain(drive.collisionBonus.damageType);
        expect(drive.damageTypes).toContain(drive.collisionBonus.damageType);
      }
      expect((drive.collisionTrigger?.requireKinds ?? []).every((kind) => validCollisionKinds.includes(kind))).toBe(true);
      expect((drive.collisionHazard?.requireKinds ?? []).every((kind) => validCollisionKinds.includes(kind))).toBe(true);
      expect(drive.collisionHazard?.lifetime ?? 1).toBeGreaterThan(0);
    }

    for (const rune of tuningRunes) {
      expect(rune.requiredTags.every((tag) => validTags.has(tag))).toBe(true);
      expect((rune.excludedTags ?? []).every((tag) => validTags.has(tag))).toBe(true);
      expect(driveCores.some((drive) => validateRuneLoadout(drive.id, [rune.id]).validRuneIds.includes(rune.id))).toBe(true);
    }
  });

  it("validates starter rune loadouts for every top frame", () => {
    for (const frame of topFrames) {
      const validation = validateRuneLoadout(frame.startingDriveId, tuningRunes.map((rune) => rune.id));
      expect(validation.validRuneIds.length).toBeGreaterThan(0);
      expect(validation.costMultiplier).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps part bases and engravings legal through generation", () => {
    for (const base of topPartBases) {
      if (base.slot === "launcher") {
        expect(base.launcherProfile?.initialSpeedScalar).toBeGreaterThan(0);
        expect(base.launcherProfile?.initialEnergyBonus ?? 0).toBeGreaterThanOrEqual(0);
      }
      const part = generateTopPart({
        baseId: base.id,
        rarity: "relic",
        itemLevel: 18,
        seed: `integrity_${base.id}`,
        arenaId: "arena_red_chancel_disk",
        enemyLevel: 18,
        source: "debug",
      });

      expect(part.slot).toBe(base.slot);
      expect(isTopPartLegal(part)).toBe(true);
    }
  });

  it("keeps equipment modifiers out of more and less multiplier layers", () => {
    const equipmentModifiers = [
      ...topPartBases.flatMap((base) => base.implicitModifiers ?? []),
      ...topEngravings.flatMap((engraving) => engraving.modifiers ?? []),
    ];

    expect(equipmentModifiers.filter((modifier) => modifier.type === "more" || modifier.type === "less")).toEqual([]);
  });

  it("keeps arena key and boss gate references valid", () => {
    const arenaIds = new Set(arenaCircuits.map((entry) => entry.id));
    const validRewardBiasTargets = new Set([...topPartBases.map((entry) => entry.slot), "forgeMedia", "bossFragment", "any"]);
    const validTags = new Set(validDriveTags);

    for (const gate of bossGates) {
      expect(arenaIds.has(gate.arenaId)).toBe(true);
      expect(gate.requiredDps).toBeGreaterThan(0);
      expect(gate.bossIntegrity).toBeGreaterThan(0);
    }

    for (const arena of arenaCircuits) {
      const key = generateArenaKey({
        arenaBaseId: arena.id,
        tier: arena.tier,
        rarity: "relic",
        seed: `integrity_key_${arena.id}`,
      });

      expect(isArenaKeyLegal(key)).toBe(true);
      expect(key.itemLevel).toBeGreaterThanOrEqual(arena.enemyLevel);
    }

    for (const affix of arenaKeyAffixes) {
      expect(affix.minTier).toBeGreaterThan(0);
      expect(affix.weight).toBeGreaterThan(0);
      expect((affix.rewardBias ?? []).every((bias) => validRewardBiasTargets.has(bias.target))).toBe(true);
    }

    for (const event of arenaEvents) {
      expect(event.minTier).toBeGreaterThan(0);
      expect(event.weight).toBeGreaterThan(0);
      expect((event.rewardBias ?? []).every((bias) => validRewardBiasTargets.has(bias.target))).toBe(true);
    }

    for (const anomaly of arenaAnomalies) {
      expect(anomaly.minTier).toBeGreaterThan(0);
      expect(anomaly.enemyIntegrityMultiplier).toBeGreaterThanOrEqual(1);
      expect(anomaly.enemyImpactMultiplier).toBeGreaterThanOrEqual(1);
      expect(anomaly.rewardQuantity + anomaly.rewardRarity).toBeGreaterThan(0);
      if (anomaly.playerRule) {
        expect(validArenaAnomalyRules).toContain(anomaly.playerRule);
      }
    }

    for (const modifier of enemyModifiers) {
      expect(modifier.minTier).toBeGreaterThan(0);
      expect(modifier.weight).toBeGreaterThan(0);
      expect((modifier.tags ?? []).every((tag) => validTags.has(tag))).toBe(true);
    }
  });

  it("keeps talent prerequisites, layout, and modifiers legal", () => {
    const talentIds = new Set(talentNodes.map((entry) => entry.id));
    const roots = talentNodes.filter((node) => !node.requiredNodeIds || node.requiredNodeIds.length === 0).map((node) => node.id);
    const childrenByRequiredId = new Map<string, string[]>();
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (nodeId: string): boolean => {
      if (visited.has(nodeId)) {
        return false;
      }
      if (visiting.has(nodeId)) {
        return true;
      }
      visiting.add(nodeId);
      const node = talentNodes.find((entry) => entry.id === nodeId);
      const hasCycle = (node?.requiredNodeIds ?? []).some(visit);
      visiting.delete(nodeId);
      visited.add(nodeId);
      return hasCycle;
    };
    for (const node of talentNodes) {
      for (const requiredId of node.requiredNodeIds ?? []) {
        childrenByRequiredId.set(requiredId, [...(childrenByRequiredId.get(requiredId) ?? []), node.id]);
      }
    }
    const reachable = new Set<string>(roots);
    const queue = [...roots];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      for (const childId of childrenByRequiredId.get(nodeId) ?? []) {
        if (!reachable.has(childId)) {
          reachable.add(childId);
          queue.push(childId);
        }
      }
    }

    for (const talent of talentNodes) {
      expect(["minor", "notable", "keystone"]).toContain(talent.kind);
      expect(talent.position.x).toBeGreaterThanOrEqual(0);
      expect(talent.position.x).toBeLessThanOrEqual(100);
      expect(talent.position.y).toBeGreaterThanOrEqual(0);
      expect(talent.position.y).toBeLessThanOrEqual(100);
      if (talent.kind === "keystone") {
        expect(talent.position.x).toBeGreaterThanOrEqual(6);
        expect(talent.position.x).toBeLessThanOrEqual(94);
        expect(talent.position.y).toBeGreaterThanOrEqual(6);
        expect(talent.position.y).toBeLessThanOrEqual(94);
      }
      for (const requiredId of talent.requiredNodeIds ?? []) {
        expect(talentIds.has(requiredId)).toBe(true);
      }
      expect((talent.modifiers ?? []).every((modifier) => !modifier.tags || modifier.tags.every((tag) => validDriveTags.includes(tag)))).toBe(true);
      if (talent.kind === "notable" || talent.kind === "keystone") {
        expect(talent.modifiers ?? []).not.toHaveLength(0);
      }
    }
    expect(roots).toContain("talent_iron_rotation");
    expect(reachable.size).toBe(talentNodes.length);
    expect(new Set(talentNodes.map((node) => node.clusterId).filter(Boolean)).size).toBeGreaterThanOrEqual(14);
    expect(talentNodes.filter((node) => node.kind === "keystone").length).toBeGreaterThanOrEqual(6);
    expect(talentNodes.filter((node) => node.kind === "keystone").length).toBeLessThanOrEqual(8);
    expect(talentNodes.some((node) => visit(node.id))).toBe(false);
  });

  it("keeps drop label slot weights normalized", () => {
    for (const slot of partSlotOrder) {
      const total = dropLabelOptions.filter((option) => option.target === slot).reduce((sum, option) => sum + option.weight, 0);
      expect(total).toBeGreaterThanOrEqual(1.9);
      expect(total).toBeLessThanOrEqual(2.1);
    }
  });

  it("keeps talent node centers far enough apart on the fixed world canvas", () => {
    const overlaps: string[] = [];
    for (let leftIndex = 0; leftIndex < talentNodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < talentNodes.length; rightIndex += 1) {
        const left = talentNodes[leftIndex];
        const right = talentNodes[rightIndex];
        const leftSize = TALENT_NODE_SIZES[left.kind];
        const rightSize = TALENT_NODE_SIZES[right.kind];
        const dx = ((left.position.x - right.position.x) / 100) * TALENT_WORLD_WIDTH;
        const dy = ((left.position.y - right.position.y) / 100) * TALENT_WORLD_HEIGHT;
        const distance = Math.hypot(dx, dy);
        const minDistance = (leftSize.width + rightSize.width) / 2 + 8;
        if (distance < minDistance) {
          overlaps.push(`${left.id} <-> ${right.id}: ${distance.toFixed(1)} < ${minDistance}`);
        }
      }
    }

    expect(overlaps).toEqual([]);
  });

  it("keeps doctrines tied to valid frames with legal nodes", () => {
    const frameIds = new Set(topFrames.map((entry) => entry.id));

    for (const frame of topFrames) {
      expect(doctrines.filter((doctrine) => doctrine.frameId === frame.id)).toHaveLength(2);
    }

    for (const doctrine of doctrines) {
      expect(frameIds.has(doctrine.frameId)).toBe(true);
      expect(doctrine.nodes.length).toBeGreaterThanOrEqual(3);
      expect(doctrine.nodes.length).toBeLessThanOrEqual(4);
      for (const node of doctrine.nodes) {
        expect((node.modifiers ?? []).every((modifier) => !modifier.tags || modifier.tags.every((tag) => validDriveTags.includes(tag)))).toBe(true);
      }
    }
  });

  it("keeps endgame master preview data legal", () => {
    const validSignals = new Set(endgameMasterSignals);
    const validRewardTargets = new Set(endgameMasterRewardTargets);

    expect(endgameMasters).toHaveLength(3);
    expectUnique(endgameMasters.map((master) => master.id));
    expectUnique(endgameMasters.flatMap((master) => master.nodes.map((node) => node.id)));

    for (const master of endgameMasters) {
      const nodeIds = new Set(master.nodes.map((node) => node.id));
      const masterSignals = new Set(master.signalWeights.map((entry) => entry.signal));

      expect(master.maxActiveNodes).toBe(4);
      expect(master.nodes).toHaveLength(12);
      expect(master.signalWeights.length).toBeGreaterThan(0);
      expect(master.rewardTargets.length).toBeGreaterThan(0);
      expect(master.rewardTargets.every((target) => validRewardTargets.has(target))).toBe(true);
      expect(master.signalWeights.every((entry) => validSignals.has(entry.signal) && entry.weight > 0 && entry.target > 0)).toBe(true);

      for (const tier of [1, 2, 3, 4] as const) {
        expect(master.nodes.filter((node) => node.tier === tier)).toHaveLength(3);
      }

      for (const node of master.nodes) {
        expect(node.id.startsWith(`${master.id}_`)).toBe(true);
        expect(validSignals.has(node.signal)).toBe(true);
        expect(masterSignals.has(node.signal)).toBe(true);
        expect(validRewardTargets.has(node.rewardTarget)).toBe(true);
        expect(master.rewardTargets).toContain(node.rewardTarget);
        expect(node.weight).toBeGreaterThan(0);
        for (const requiredId of node.requiredNodeIds ?? []) {
          expect(requiredId).not.toBe(node.id);
          expect(nodeIds.has(requiredId)).toBe(true);
        }
      }
    }
  });

  it("keeps circuit network and anomaly references valid", () => {
    const arenaIds = new Set(arenaCircuits.map((entry) => entry.id));
    const arenaById = new Map(arenaCircuits.map((entry) => [entry.id, entry]));
    const bossGateIds = new Set(bossGates.map((entry) => entry.id));
    const anomalyIds = new Set(arenaAnomalies.map((entry) => entry.id));
    const anomalyById = new Map(arenaAnomalies.map((entry) => [entry.id, entry]));
    const networkIds = new Set(circuitNetworkNodes.map((entry) => entry.id));
    const rivalIds = new Set(namedRivals.map((entry) => entry.id));
    const roots = circuitNetworkNodes.filter((node) => !node.requiredNodeIds || node.requiredNodeIds.length === 0).map((node) => node.id);
    const childrenByRequiredId = new Map<string, string[]>();
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (nodeId: string): boolean => {
      if (visited.has(nodeId)) {
        return false;
      }
      if (visiting.has(nodeId)) {
        return true;
      }
      visiting.add(nodeId);
      const node = circuitNetworkNodes.find((entry) => entry.id === nodeId);
      const hasCycle = (node?.requiredNodeIds ?? []).some(visit);
      visiting.delete(nodeId);
      visited.add(nodeId);
      return hasCycle;
    };
    for (const node of circuitNetworkNodes) {
      for (const requiredId of node.requiredNodeIds ?? []) {
        childrenByRequiredId.set(requiredId, [...(childrenByRequiredId.get(requiredId) ?? []), node.id]);
      }
    }
    const reachable = new Set<string>(roots);
    const queue = [...roots];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      for (const childId of childrenByRequiredId.get(nodeId) ?? []) {
        if (!reachable.has(childId)) {
          reachable.add(childId);
          queue.push(childId);
        }
      }
    }

    for (const anomaly of arenaAnomalies) {
      expect(anomaly.enemyIntegrityMultiplier).toBeGreaterThan(0);
      expect(anomaly.enemyImpactMultiplier).toBeGreaterThan(0);
      expect(anomaly.rewardQuantity).toBeGreaterThanOrEqual(0);
      expect(anomaly.rewardRarity).toBeGreaterThanOrEqual(0);
      if (anomaly.requiredBossGateId) {
        expect(bossGateIds.has(anomaly.requiredBossGateId)).toBe(true);
      }
    }

    for (const node of circuitNetworkNodes) {
      expect(arenaIds.has(node.arenaId)).toBe(true);
      if (node.requiredBossGateId) {
        expect(bossGateIds.has(node.requiredBossGateId)).toBe(true);
      }
      if (node.requiredRivalId) {
        expect(rivalIds.has(node.requiredRivalId)).toBe(true);
      }
      if (node.unlocksRivalId) {
        expect(rivalIds.has(node.unlocksRivalId)).toBe(true);
      }
      if (node.anomalyId) {
        expect(anomalyIds.has(node.anomalyId)).toBe(true);
        expect(arenaById.get(node.arenaId)?.tier).toBeGreaterThanOrEqual(anomalyById.get(node.anomalyId)?.minTier ?? 0);
      }
      for (const requiredId of node.requiredNodeIds ?? []) {
        expect(networkIds.has(requiredId)).toBe(true);
      }
    }
    expect(roots).toContain("network_cinder_gate");
    expect(reachable.size).toBe(circuitNetworkNodes.length);
    expect(circuitNetworkNodes.filter((node) => node.anomalyId).length).toBeGreaterThanOrEqual(8);
    expect(circuitNetworkNodes.some((node) => visit(node.id))).toBe(false);
  });

  it("keeps chapter one references valid", () => {
    const networkIds = new Set(circuitNetworkNodes.map((entry) => entry.id));
    const rivalIds = new Set(namedRivals.map((entry) => entry.id));
    const bossGateIds = new Set(bossGates.map((entry) => entry.id));

    expect(chapters).toHaveLength(1);
    for (const chapter of chapters) {
      expect(chapter.displayNameKey).toBeTruthy();
      expect(chapter.nodeIds.every((nodeId) => networkIds.has(nodeId))).toBe(true);
      expect(chapter.rivalIds.every((rivalId) => rivalIds.has(rivalId))).toBe(true);
      expect(bossGateIds.has(chapter.bossGateId)).toBe(true);
    }
  });

  it("keeps tutorial steps data-driven and keyed", () => {
    const validTriggers = new Set(["welcome", "firstDrop", "firstEquip", "firstTalent", "firstForge", "firstRune", "doctrine", "mapUnlock", "rivalGate", "firstKey", "firstAnomaly", "bossGate"]);
    const validAnchors = new Set(["start-button", "loot-notice", "part-inspector", "tab-talents", "tab-forge", "tab-skills", "doctrine-strip", "screen-map", "network-detail", "arena-keys", "boss-gate"]);

    expect(tutorialSteps).toHaveLength(12);
    for (const step of tutorialSteps) {
      expect(step.titleKey).toMatch(/^tutorial\./);
      expect(step.bodyKey).toMatch(/^tutorial\./);
      expect(validTriggers.has(step.trigger)).toBe(true);
      if (step.anchor) {
        expect(validAnchors.has(step.anchor)).toBe(true);
      }
    }
  });

  it("keeps named rivals as legal data-driven builds", () => {
    const frameIds = new Set(topFrames.map((entry) => entry.id));
    const driveIds = new Set(driveCores.map((entry) => entry.id));
    const talentIds = new Set(talentNodes.map((entry) => entry.id));
    const circuitNodeIds = new Set(circuitNetworkNodes.map((entry) => entry.id));
    const partBaseIds = new Set(topPartBases.map((entry) => entry.id));
    const doctrineById = new Map(doctrines.map((entry) => [entry.id, entry]));
    const validMechanicIds = new Set(rivalMechanicIds);

    for (const rival of namedRivals) {
      expect(frameIds.has(rival.frameId)).toBe(true);
      expect(driveIds.has(rival.driveId)).toBe(true);
      expect(validMechanicIds.has(rival.mechanicId)).toBe(true);
      expect(circuitNodeIds.has(rival.circuitNodeId)).toBe(true);
      expect(circuitNetworkNodes.find((node) => node.id === rival.circuitNodeId)?.unlocksRivalId).toBe(rival.id);
      expect(rival.uniqueDropBaseIds.length).toBeGreaterThan(0);
      expect(rival.uniqueDropBaseIds.every((baseId) => partBaseIds.has(baseId))).toBe(true);
      expect(rival.integrityScalar ?? 1).toBeGreaterThan(0);
      expect(validateRuneLoadout(rival.driveId, rival.loadout.runeIds ?? []).issues).toEqual([]);
      expect((rival.loadout.talentIds ?? []).every((talentId) => talentIds.has(talentId))).toBe(true);
      if (rival.loadout.doctrineId) {
        expect(doctrineById.get(rival.loadout.doctrineId)?.frameId).toBe(rival.frameId);
      }

      const stats = resolveTopRuntimeStats(rival.frameId, rival.driveId, rival.loadout);
      expect(stats.maxSpinIntegrity).toBeGreaterThan(0);
      expect(stats.impact).toBeGreaterThan(0);
      expect(stats.rpm).toBeGreaterThan(0);
    }
  });

  it("keeps circuit atlas prerequisites and bonuses legal", () => {
    const nodeIds = new Set(circuitAtlasNodes.map((entry) => entry.id));

    for (const node of circuitAtlasNodes) {
      expect(node.cost).toBeGreaterThan(0);
      for (const requiredId of node.requiredNodeIds ?? []) {
        expect(nodeIds.has(requiredId)).toBe(true);
      }
      expect(node.bonuses.enemyIntegrityMultiplier ?? 1).toBeGreaterThan(0);
      expect(node.bonuses.enemyImpactMultiplier ?? 1).toBeGreaterThan(0);
      expect(node.bonuses.rewardQuantity ?? 0).toBeGreaterThanOrEqual(0);
      expect(node.bonuses.rewardRarity ?? 0).toBeGreaterThanOrEqual(0);
      expect((node.bonuses.modifiers ?? []).every((modifier) => !modifier.tags || modifier.tags.every((tag) => validDriveTags.includes(tag)))).toBe(true);
    }
  });
});
