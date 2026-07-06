import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/game/ui/arena/CombatArena.css"), "utf8");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ruleFor(selector: string): string {
  const match = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`).exec(css);
  return match?.[1] ?? "";
}

describe("CombatArena route layout CSS", () => {
  it("keeps route plan above detailed route columns instead of overlapping them", () => {
    expect(css).toContain(".route-screen-content");
    expect(ruleFor(".route-screen-content")).toContain("grid-template-rows: auto auto minmax(0, 1fr)");
    expect(ruleFor(".workbench-content.route-screen-content")).toContain("grid-template-rows: auto auto minmax(0, 1fr)");
    expect(ruleFor(".route-overview-section")).toContain("grid-row: 1");
    expect(ruleFor(".route-plan-section")).toContain("grid-row: 2");
    expect(ruleFor(".route-main-column")).toContain("grid-row: 3");
    expect(ruleFor(".route-side-column")).toContain("grid-row: 3");
  });
});
