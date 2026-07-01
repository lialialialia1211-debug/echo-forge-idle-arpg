import { describe, expect, it } from "vitest";
import { arenaKeyAffixes } from "./arenaKeyAffixes";
import { arenaCircuits } from "./arenaCircuits";
import { arenaEvents } from "./arenaEvents";
import { bossGates } from "./bossGates";
import { circuitAtlasNodes } from "./circuitAtlasNodes";
import { driveCores } from "./driveCores";
import { enemyModifiers } from "./enemyModifiers";
import { topEngravings } from "./engravings";
import { talentNodes } from "./talentNodes";
import { topPartBases } from "./topPartBases";
import { topFrames } from "./topFrames";
import { tuningRunes } from "./tuningRunes";
import { generateArenaKey, isArenaKeyLegal } from "../engine/arenaKeys";
import { validateRuneLoadout } from "../engine/driveRuneValidation";
import { generateTopPart } from "../engine/topPartGeneration";
import { isTopPartLegal } from "../engine/topCrafting";
import type { DriveTag } from "../engine/topTypes";

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

describe("top ARPG data integrity", () => {
  it("has unique IDs across data tables", () => {
    expectUnique(topFrames.map((entry) => entry.id));
    expectUnique(driveCores.map((entry) => entry.id));
    expectUnique(tuningRunes.map((entry) => entry.id));
    expectUnique(topPartBases.map((entry) => entry.id));
    expectUnique(topEngravings.map((entry) => entry.id));
    expectUnique(arenaCircuits.map((entry) => entry.id));
    expectUnique(arenaKeyAffixes.map((entry) => entry.id));
    expectUnique(arenaEvents.map((entry) => entry.id));
    expectUnique(enemyModifiers.map((entry) => entry.id));
    expectUnique(bossGates.map((entry) => entry.id));
    expectUnique(talentNodes.map((entry) => entry.id));
    expectUnique(circuitAtlasNodes.map((entry) => entry.id));
  });

  it("has enough content for the first vertical slice", () => {
    expect(driveCores.length).toBeGreaterThanOrEqual(6);
    expect(tuningRunes.length).toBeGreaterThanOrEqual(15);
    expect(topPartBases.length).toBeGreaterThanOrEqual(30);
    expect(topEngravings.length).toBeGreaterThanOrEqual(40);
    expect(enemyModifiers.length).toBeGreaterThanOrEqual(5);
    expect(arenaEvents.length).toBeGreaterThanOrEqual(3);
    expect(circuitAtlasNodes.length).toBeGreaterThanOrEqual(12);
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

    for (const modifier of enemyModifiers) {
      expect(modifier.minTier).toBeGreaterThan(0);
      expect(modifier.weight).toBeGreaterThan(0);
      expect((modifier.tags ?? []).every((tag) => validTags.has(tag))).toBe(true);
    }
  });

  it("keeps talent prerequisites resolvable", () => {
    const talentIds = new Set(talentNodes.map((entry) => entry.id));

    for (const talent of talentNodes) {
      for (const requiredId of talent.requiredNodeIds ?? []) {
        expect(talentIds.has(requiredId)).toBe(true);
      }
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
