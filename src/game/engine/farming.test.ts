import { describe, expect, it } from "vitest";
import { createStarterBuild } from "./character";
import { applyInventoryCapacity, getSalvageResult, runFarmingTick } from "./farming";
import { generateItemForArea, generateLootSample } from "./items";
import { runSimulation } from "./simulation";

describe("farming engine", () => {
  it("creates deterministic tick rewards for a seed", () => {
    const build = createStarterBuild("veilrunner");
    const simulation = runSimulation(build, "area_cinder_road");
    const first = runFarmingTick({ areaId: "area_cinder_road", simulation, seed: "tick-1", seconds: 30 });
    const second = runFarmingTick({ areaId: "area_cinder_road", simulation, seed: "tick-1", seconds: 30 });

    expect(first).toEqual(second);
    expect(first.kills).toBeGreaterThan(0);
    expect(first.currencies.ash).toBeGreaterThan(0);
  });

  it("auto-salvages overflow while keeping locked items", () => {
    const inventory = generateLootSample("area_cinder_road", "capacity", 8);
    const locked = { ...inventory[0], locked: true };
    const result = applyInventoryCapacity([locked, ...inventory.slice(1)], 4);

    expect(result.inventory).toHaveLength(4);
    expect(result.inventory.some((item) => item.id === locked.id)).toBe(true);
    expect(result.salvagedItems.length).toBeGreaterThan(0);
    expect(result.currencies.ash).toBeGreaterThan(0);
  });

  it("returns stronger salvage rewards for rarer items", () => {
    const rare = generateItemForArea("area_cinder_road", "salvage_rare", { rarity: "rare" });
    const normal = generateItemForArea("area_cinder_road", "salvage_normal", { rarity: "normal" });

    expect(getSalvageResult(rare).itemValue).toBeGreaterThan(getSalvageResult(normal).itemValue);
  });
});
