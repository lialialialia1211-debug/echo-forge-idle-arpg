import { getAreaDef } from "../data/areas";
import { clamp } from "./math";
import { createRng } from "./rng";
import type { EncounterRank, EncounterState } from "./types";

const enemyNames: Record<string, string[]> = {
  area_cinder_road: ["Ash Vagrant", "Coal Hound", "Cinder Strider", "Road Husk"],
  area_salt_catacomb: ["Saltbound Warden", "Crypt Leech", "Whitebone Acolyte", "Brine Husk"],
  area_glass_mire: ["Glass Moth", "Mire Wretch", "Prism Leaper", "Shard Bloom"],
  area_red_chancel: ["Red Cantor", "Votive Butcher", "Chancel Knight", "Bloodglass Wisp"],
  area_moon_furnace: ["Lunar Smith", "Furnace Wight", "Moonclad Brute", "Starved Kiln"],
  area_echo_vault: ["Echo Warden", "Vault Remnant", "Null Choir", "Memory Eater"],
};

const bossNames: Record<string, string[]> = {
  area_cinder_road: ["Brassjaw, Road Tyrant", "The Ember Tollkeeper"],
  area_salt_catacomb: ["Matron of Salt", "Ossuary Bellringer"],
  area_glass_mire: ["The Shivering Prism", "Mireglass Regent"],
  area_red_chancel: ["Cardinal Veyr", "The Red Witness"],
  area_moon_furnace: ["Moon-Furnace Praetor", "The Cold Kiln"],
  area_echo_vault: ["Archivist of Last Words", "The Hollow Replay"],
};

const rankProfiles: Record<EncounterRank, { life: number; threat: number; rewardBias: number }> = {
  pack: { life: 1, threat: 0.12, rewardBias: 0 },
  elite: { life: 2.35, threat: 0.28, rewardBias: 0.45 },
  boss: { life: 6.2, threat: 0.58, rewardBias: 1.15 },
};

export function getEncounterRank(wave: number): EncounterRank {
  if (wave % 8 === 0) {
    return "boss";
  }
  if (wave % 4 === 0) {
    return "elite";
  }
  return "pack";
}

export function getRouteStep(wave: number): number {
  return ((Math.max(1, wave) - 1) % 8) + 1;
}

export function getRouteProgress(wave: number): number {
  return ((getRouteStep(wave) - 1) / 8) * 100;
}

export function createEncounter(areaId: string, seed: string, wave: number): EncounterState {
  const area = getAreaDef(areaId);
  const rng = createRng(seed);
  const rank = getEncounterRank(wave);
  const profile = rankProfiles[rank];
  const names = rank === "boss" ? bossNames[areaId] ?? ["Echo-Bound Horror"] : enemyNames[areaId] ?? ["Waylaid Horror"];
  const waveScaling = 1 + Math.max(0, wave - 1) * 0.075;
  const variance = 0.92 + rng.next() * 0.16;
  const maxLife = Math.max(1, Math.round(area.monsterLife * profile.life * waveScaling * variance));
  const threat = clamp(area.monsterDamage / 1400 + area.tier * 0.045 + profile.threat, 0.05, 0.95);

  return {
    id: `encounter_${areaId}_${seed}_${wave}`,
    areaId,
    wave,
    rank,
    enemyName: rng.pick(names),
    maxLife,
    life: maxLife,
    threat,
    rewardBias: profile.rewardBias,
  };
}

export function damageEncounter(
  encounter: EncounterState,
  damage: number,
): { encounter: EncounterState; killed: boolean; damageDealt: number; overkill: number } {
  const damageDealt = Math.max(0, Math.min(encounter.life, damage));
  const nextLife = Math.max(0, encounter.life - damage);

  return {
    encounter: {
      ...encounter,
      life: nextLife,
    },
    killed: nextLife <= 0,
    damageDealt,
    overkill: Math.max(0, damage - encounter.life),
  };
}
