import { describe, expect, it } from "vitest";
import { createStarterBuild } from "./character";
import { compareItemForBuild, buildWithEquippedItem } from "./itemScoring";
import { generateItemForArea, getItemSlot } from "./items";
import { runSimulation } from "./simulation";

describe("item scoring", () => {
  it("previews an equipped item without mutating the original build", () => {
    const build = createStarterBuild("veilrunner");
    const item = generateItemForArea("area_cinder_road", "preview-bow", {
      baseId: "base_splinter_bow",
      rarity: "rare",
    });
    const preview = buildWithEquippedItem(build, item);

    expect(build.equipment[getItemSlot(item)]).toBeUndefined();
    expect(preview.equipment[getItemSlot(item)]?.id).toBe(item.id);
  });

  it("changes simulation output when an offensive weapon is equipped", () => {
    const build = createStarterBuild("veilrunner");
    const item = generateItemForArea("area_cinder_road", "strong-bow", {
      baseId: "base_splinter_bow",
      rarity: "rare",
    });
    const before = runSimulation(build, "area_cinder_road");
    const after = runSimulation(buildWithEquippedItem(build, item), "area_cinder_road");
    const delta = compareItemForBuild(build, "area_cinder_road", item);

    expect(after.combat.dps).toBeGreaterThan(before.combat.dps);
    expect(delta.dps).toBeCloseTo(after.combat.dps - before.combat.dps);
  });
});
