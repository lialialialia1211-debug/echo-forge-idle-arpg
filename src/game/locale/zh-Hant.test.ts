import { describe, expect, it } from "vitest";
import { t } from "./zh-Hant";

describe("Traditional Chinese locale", () => {
  it("contains route plan guidance strings", () => {
    const keys = [
      "ui.routePlan.kicker",
      "ui.routePlan.title",
      "ui.routePlan.detail",
      "ui.routePlan.expand",
      "ui.routePlan.collapse",
      "ui.routePlan.continueFarm",
      "ui.routePlan.running",
      "ui.routePlan.start",
      "ui.routePlan.challengeNext",
      "ui.routePlan.selectRoute",
      "ui.routePlan.completed",
      "ui.routePlan.keyFallback",
      "ui.routePlan.keyDetail",
      "ui.routePlan.chapterProgress",
      "ui.routePlan.nextRoute",
      "ui.routePlan.kills",
      "ui.home.firstRunKicker",
      "ui.home.mainKicker",
      "ui.home.firstRunTitle",
      "ui.home.hubTitle",
      "ui.home.hubDetail",
      "ui.home.uniqueNext",
      "ui.home.supportTitle",
      "ui.home.chapterComplete",
      "ui.home.chapterProgress",
      "ui.home.progressLabel",
    ];

    for (const key of keys) {
      expect(t(key, { reward: "10%", pressure: "5%", done: 1, total: 6, name: "測試關卡", count: 12 })).not.toBe(key);
    }
  });
});
