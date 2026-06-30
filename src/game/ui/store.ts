import { create } from "zustand";
import { areas, getAreaDef } from "../data/areas";
import { classes } from "../data/classes";
import { getSkillDef } from "../data/skills";
import { supports, isSupportCompatible } from "../data/supports";
import { createStarterBuild } from "../engine/character";
import { createEncounter, damageEncounter, getRouteProgress, getRouteStep } from "../engine/encounter";
import { addWallets, applyInventoryCapacity, emptyWallet, getSalvageResult, runFarmingTick } from "../engine/farming";
import { equipItem, generateItemForArea, generateLootSample } from "../engine/items";
import { createRng } from "../engine/rng";
import { runSimulation } from "../engine/simulation";
import type { CharacterBuild, CombatEvent, CurrencyWallet, EncounterRank, EncounterState, ItemInstance } from "../engine/types";

type FarmReport = {
  seconds: number;
  kills: number;
  itemsFound: number;
  salvaged: number;
  currencies: CurrencyWallet;
};

type GameStore = {
  classId: string;
  areaId: string;
  build: CharacterBuild;
  inventory: ItemInstance[];
  inventoryCapacity: number;
  currencies: CurrencyWallet;
  isFarming: boolean;
  farmTickIndex: number;
  eventIndex: number;
  encounter: EncounterState;
  routeProgress: number;
  skillCharge: number;
  runKills: number;
  routeClears: number;
  combatEvents: CombatEvent[];
  lastFarmReport: FarmReport | null;
  selectedItemId: string | null;
  setClass: (classId: string) => void;
  setArea: (areaId: string) => void;
  selectItem: (itemId: string) => void;
  equipInventoryItem: (itemId: string) => void;
  generateSampleLoot: () => void;
  runFarmTick: (seconds?: number) => void;
  advanceEncounter: (elapsedSeconds?: number) => void;
  castSkill: () => void;
  toggleFarming: () => void;
  toggleItemLock: (itemId: string) => void;
  salvageInventoryItem: (itemId: string) => void;
  toggleSupport: (supportId: string) => void;
};

const firstClass = classes[0];
const firstArea = areas[0];
const initialInventory = generateLootSample(firstArea.id, "starter_loot", 8);
const defaultInventoryCapacity = 24;
const maxCombatEvents = 7;

function createInitialEncounter(classId: string, areaId: string, wave = 1, index = 0): EncounterState {
  return createEncounter(areaId, `${classId}_${areaId}_encounter_${index}`, wave);
}

function getEquippedItemIds(build: CharacterBuild): Set<string> {
  return new Set(Object.values(build.equipment).flatMap((item) => (item ? [item.id] : [])));
}

function pickSelectedItemId(currentId: string | null, inventory: ItemInstance[]): string | null {
  if (currentId && inventory.some((item) => item.id === currentId)) {
    return currentId;
  }

  return inventory[0]?.id ?? null;
}

function syncEquippedItem(build: CharacterBuild, itemId: string, nextItem: ItemInstance): CharacterBuild {
  const equipment = Object.fromEntries(
    Object.entries(build.equipment).map(([slot, item]) => [slot, item?.id === itemId ? nextItem : item]),
  ) as CharacterBuild["equipment"];

  return {
    ...build,
    equipment,
  };
}

function makeEvent(index: number, tone: CombatEvent["tone"], text: string): CombatEvent {
  return {
    id: `event_${index}`,
    tone,
    text,
  };
}

function prependEvents(current: CombatEvent[], incoming: CombatEvent[]): CombatEvent[] {
  return [...incoming, ...current].slice(0, maxCombatEvents);
}

function rankLabel(rank: EncounterRank): string {
  if (rank === "boss") {
    return "boss";
  }
  if (rank === "elite") {
    return "elite";
  }
  return "pack";
}

function walletForKill(rank: EncounterRank, areaId: string, seed: string): CurrencyWallet {
  const area = getAreaDef(areaId);
  const rng = createRng(seed);
  const ash = area.tier + (rank === "boss" ? 8 : rank === "elite" ? 3 : 1);
  const glassChance = rank === "boss" ? 0.85 : rank === "elite" ? 0.28 : 0.06 + area.tier * 0.01;
  const echoChance = rank === "boss" ? 0.18 + area.tier * 0.015 : 0.002 * area.tier;

  return {
    ash,
    glass: rng.next() < glassChance ? 1 : 0,
    echo: rng.next() < echoChance ? 1 : 0,
  };
}

function resolveEncounterHit(
  state: GameStore,
  damage: number,
  tone: "hit" | "burst",
  elapsedSeconds: number,
): Partial<GameStore> {
  const simulation = runSimulation(state.build, state.areaId);
  const hit = damageEncounter(state.encounter, damage);
  const eventStart = state.eventIndex + 1;
  const events: CombatEvent[] = [
    makeEvent(eventStart, tone, `${tone === "burst" ? "Burst" : "Hit"} ${Math.round(hit.damageDealt).toLocaleString()}`),
  ];
  const skillCharge = Math.min(100, state.skillCharge + elapsedSeconds * 22);

  if (!hit.killed) {
    return {
      encounter: hit.encounter,
      skillCharge,
      eventIndex: eventStart,
      combatEvents: prependEvents(state.combatEvents, events),
    };
  }

  const area = getAreaDef(state.areaId);
  const seed = `${state.classId}_${state.areaId}_${state.farmTickIndex}_${state.encounter.wave}`;
  const rng = createRng(seed);
  const rankBias = state.encounter.rewardBias;
  const dropChance = Math.min(0.9, area.baseDropChance * (1.05 + rankBias) + simulation.loot.farmEfficiency * 0.08);
  const foundItem =
    rng.next() < dropChance
      ? generateItemForArea(state.areaId, `${seed}_encounter_drop`, {
          itemRarityBonus: area.areaRarity + rankBias + simulation.loot.rareItemsPerHour / Math.max(1, simulation.loot.itemsPerHour),
        })
      : null;
  const killWallet = walletForKill(state.encounter.rank, state.areaId, `${seed}_wallet`);
  const nextWave = state.encounter.wave + 1;
  const routeCleared = getRouteStep(nextWave) === 1;
  const routeBonus = routeCleared ? ({ ash: area.tier * 2, glass: 1, echo: state.encounter.rank === "boss" ? 1 : 0 } satisfies CurrencyWallet) : emptyWallet();
  const protectedIds = getEquippedItemIds(state.build);
  const incomingInventory = foundItem ? [foundItem, ...state.inventory] : state.inventory;
  const capacityResult = applyInventoryCapacity(incomingInventory, state.inventoryCapacity, protectedIds);
  const gainedCurrencies = addWallets(killWallet, routeBonus, capacityResult.currencies);
  const nextEncounter = createEncounter(state.areaId, `${seed}_next`, nextWave);
  const killEvent = makeEvent(eventStart + 1, "kill", `Killed ${rankLabel(state.encounter.rank)} wave ${state.encounter.wave}`);
  const dropEvent = foundItem ? makeEvent(eventStart + 2, "drop", `Dropped ${foundItem.rarity} item`) : null;
  const routeEvent = routeCleared ? makeEvent(eventStart + (dropEvent ? 3 : 2), "reward", "Route cleared") : null;

  events.push(killEvent);
  if (dropEvent) {
    events.push(dropEvent);
  }
  if (routeEvent) {
    events.push(routeEvent);
  }

  return {
    encounter: nextEncounter,
    routeProgress: getRouteProgress(nextWave),
    skillCharge,
    runKills: state.runKills + 1,
    routeClears: state.routeClears + (routeCleared ? 1 : 0),
    inventory: capacityResult.inventory,
    currencies: addWallets(state.currencies, gainedCurrencies),
    farmTickIndex: state.farmTickIndex + 1,
    eventIndex: eventStart + events.length - 1,
    combatEvents: prependEvents(state.combatEvents, events),
    lastFarmReport: {
      seconds: elapsedSeconds,
      kills: 1,
      itemsFound: foundItem ? 1 : 0,
      salvaged: capacityResult.salvagedItems.length,
      currencies: gainedCurrencies,
    },
    selectedItemId: foundItem ? foundItem.id : pickSelectedItemId(state.selectedItemId, capacityResult.inventory),
  };
}

export const useGameStore = create<GameStore>((set) => ({
  classId: firstClass.id,
  areaId: firstArea.id,
  build: createStarterBuild(firstClass.id),
  inventory: initialInventory,
  inventoryCapacity: defaultInventoryCapacity,
  currencies: emptyWallet(),
  isFarming: false,
  farmTickIndex: 0,
  eventIndex: 0,
  encounter: createInitialEncounter(firstClass.id, firstArea.id),
  routeProgress: 0,
  skillCharge: 100,
  runKills: 0,
  routeClears: 0,
  combatEvents: [makeEvent(0, "reward", "Choose a route and start the run")],
  lastFarmReport: null,
  selectedItemId: initialInventory[0]?.id ?? null,
  setClass: (classId) =>
    set((state) => {
      const inventory = generateLootSample(state.areaId, `${classId}_${state.areaId}_starter`, 8);

      return {
        classId,
        build: createStarterBuild(classId),
        inventory,
        currencies: emptyWallet(),
        isFarming: false,
        farmTickIndex: 0,
        eventIndex: 0,
        encounter: createInitialEncounter(classId, state.areaId),
        routeProgress: 0,
        skillCharge: 100,
        runKills: 0,
        routeClears: 0,
        combatEvents: [makeEvent(0, "reward", "New loadout ready")],
        lastFarmReport: null,
        selectedItemId: inventory[0]?.id ?? null,
      };
    }),
  setArea: (areaId) =>
    set((state) => ({
      areaId,
      isFarming: false,
      encounter: createInitialEncounter(state.classId, areaId, 1, state.farmTickIndex),
      routeProgress: 0,
      skillCharge: 100,
      combatEvents: [makeEvent(state.eventIndex + 1, "reward", `Entered ${getAreaDef(areaId).displayName}`), ...state.combatEvents].slice(
        0,
        maxCombatEvents,
      ),
      eventIndex: state.eventIndex + 1,
      lastFarmReport: null,
    })),
  selectItem: (itemId) => set({ selectedItemId: itemId }),
  equipInventoryItem: (itemId) =>
    set((state) => {
      const item = state.inventory.find((entry) => entry.id === itemId);
      if (!item) {
        return state;
      }

      return {
        build: {
          ...state.build,
          equipment: equipItem(state.build.equipment, item),
        },
        combatEvents: prependEvents(state.combatEvents, [makeEvent(state.eventIndex + 1, "reward", `Equipped ${item.rarity} gear`)]),
        eventIndex: state.eventIndex + 1,
      };
    }),
  generateSampleLoot: () =>
    set((state) => {
      const incoming = generateLootSample(state.areaId, `${state.classId}_${state.areaId}_${state.farmTickIndex}`, 8);
      const protectedIds = getEquippedItemIds(state.build);
      const capacityResult = applyInventoryCapacity(
        [...incoming, ...state.inventory],
        state.inventoryCapacity,
        protectedIds,
      );

      return {
        inventory: capacityResult.inventory,
        currencies: addWallets(state.currencies, capacityResult.currencies),
        farmTickIndex: state.farmTickIndex + 1,
        eventIndex: state.eventIndex + 1,
        combatEvents: prependEvents(state.combatEvents, [makeEvent(state.eventIndex + 1, "drop", "Loot cache opened")]),
        lastFarmReport: {
          seconds: 0,
          kills: 0,
          itemsFound: incoming.length,
          salvaged: capacityResult.salvagedItems.length,
          currencies: capacityResult.currencies,
        },
        selectedItemId: pickSelectedItemId(state.selectedItemId, capacityResult.inventory),
      };
    }),
  runFarmTick: (seconds = 30) =>
    set((state) => {
      const simulation = runSimulation(state.build, state.areaId);
      const tick = runFarmingTick({
        areaId: state.areaId,
        simulation,
        seed: `${state.classId}_${state.areaId}_${state.farmTickIndex}`,
        seconds,
      });
      const protectedIds = getEquippedItemIds(state.build);
      const capacityResult = applyInventoryCapacity(
        [...tick.items, ...state.inventory],
        state.inventoryCapacity,
        protectedIds,
      );
      const gainedCurrencies = addWallets(tick.currencies, capacityResult.currencies);
      const nextWave = state.encounter.wave + Math.max(1, Math.floor(tick.kills / 4));

      return {
        inventory: capacityResult.inventory,
        currencies: addWallets(state.currencies, gainedCurrencies),
        farmTickIndex: state.farmTickIndex + 1,
        encounter: createEncounter(state.areaId, `${state.classId}_${state.areaId}_rush_${state.farmTickIndex}`, nextWave),
        routeProgress: getRouteProgress(nextWave),
        runKills: state.runKills + tick.kills,
        eventIndex: state.eventIndex + 1,
        combatEvents: prependEvents(state.combatEvents, [makeEvent(state.eventIndex + 1, "reward", `Rushed ${tick.kills} kills`)]),
        lastFarmReport: {
          seconds: tick.seconds,
          kills: tick.kills,
          itemsFound: tick.items.length,
          salvaged: capacityResult.salvagedItems.length,
          currencies: gainedCurrencies,
        },
        selectedItemId: pickSelectedItemId(state.selectedItemId, capacityResult.inventory),
      };
    }),
  advanceEncounter: (elapsedSeconds = 0.8) =>
    set((state) => {
      if (!state.isFarming) {
        return state;
      }

      const simulation = runSimulation(state.build, state.areaId);
      const damage = Math.max(1, simulation.combat.dps * elapsedSeconds * (0.75 + simulation.combat.hitChance * 0.25));
      return resolveEncounterHit(state, damage, "hit", elapsedSeconds);
    }),
  castSkill: () =>
    set((state) => {
      if (state.skillCharge < 100) {
        return state;
      }

      const simulation = runSimulation(state.build, state.areaId);
      const burstDamage = Math.max(simulation.combat.averageHit * 3.25, simulation.combat.dps * 1.45) * (1 + state.build.supportIds.length * 0.12);
      return {
        ...resolveEncounterHit({ ...state, skillCharge: 0, isFarming: true }, burstDamage, "burst", 0),
        isFarming: true,
      };
    }),
  toggleFarming: () => set((state) => ({ isFarming: !state.isFarming })),
  toggleItemLock: (itemId) =>
    set((state) => {
      const currentItem = state.inventory.find((item) => item.id === itemId);
      if (!currentItem) {
        return state;
      }

      const nextItem = {
        ...currentItem,
        locked: !currentItem.locked,
      };

      return {
        inventory: state.inventory.map((item) => (item.id === itemId ? nextItem : item)),
        build: syncEquippedItem(state.build, itemId, nextItem),
      };
    }),
  salvageInventoryItem: (itemId) =>
    set((state) => {
      const item = state.inventory.find((entry) => entry.id === itemId);
      const equippedItemIds = getEquippedItemIds(state.build);
      if (!item || item.locked || equippedItemIds.has(item.id)) {
        return state;
      }

      const inventory = state.inventory.filter((entry) => entry.id !== itemId);
      const salvage = getSalvageResult(item);

      return {
        inventory,
        currencies: addWallets(state.currencies, salvage.currencies),
        eventIndex: state.eventIndex + 1,
        combatEvents: prependEvents(state.combatEvents, [makeEvent(state.eventIndex + 1, "reward", `Salvaged ${item.rarity} item`)]),
        selectedItemId: pickSelectedItemId(state.selectedItemId === itemId ? null : state.selectedItemId, inventory),
      };
    }),
  toggleSupport: (supportId) =>
    set((state) => {
      const skill = getSkillDef(state.build.skillId);
      const support = supports.find((entry) => entry.id === supportId);
      if (!support || !isSupportCompatible(support, skill.tags)) {
        return state;
      }

      const exists = state.build.supportIds.includes(supportId);
      const supportIds = exists
        ? state.build.supportIds.filter((id) => id !== supportId)
        : [...state.build.supportIds, supportId].slice(0, 3);

      return {
        build: {
          ...state.build,
          supportIds,
        },
        eventIndex: state.eventIndex + 1,
        combatEvents: prependEvents(state.combatEvents, [
          makeEvent(state.eventIndex + 1, exists ? "danger" : "reward", exists ? "Rune unlinked" : "Rune linked"),
        ]),
      };
    }),
}));
