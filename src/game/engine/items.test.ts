import { describe, expect, it } from "vitest";
import { generateItemForArea, getItemBaseDef, getItemSlot } from "./items";

describe("item generation", () => {
  it("is deterministic for the same area and seed", () => {
    const first = generateItemForArea("area_glass_mire", "repeatable-seed", { rarity: "rare" });
    const second = generateItemForArea("area_glass_mire", "repeatable-seed", { rarity: "rare" });

    expect(first).toEqual(second);
  });

  it("respects affix group and prefix/suffix limits", () => {
    const item = generateItemForArea("area_echo_vault", "limit-check", { rarity: "relic" });
    const groups = new Set(item.affixes.map((affix) => affix.group));
    const prefixCount = item.affixes.filter((affix) => affix.slot === "prefix").length;
    const suffixCount = item.affixes.filter((affix) => affix.slot === "suffix").length;

    expect(groups.size).toBe(item.affixes.length);
    expect(prefixCount).toBeLessThanOrEqual(3);
    expect(suffixCount).toBeLessThanOrEqual(3);
  });

  it("generates equipment for the base item's declared slot", () => {
    const item = generateItemForArea("area_cinder_road", "slot-check", {
      baseId: "base_cinder_belt",
      rarity: "magic",
    });

    expect(getItemSlot(item)).toBe(getItemBaseDef(item.baseId).equipmentSlot);
  });
});
