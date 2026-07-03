export type TutorialTrigger =
  | "welcome"
  | "firstDrop"
  | "firstEquip"
  | "firstTalent"
  | "firstForge"
  | "firstRune"
  | "doctrine"
  | "mapUnlock"
  | "rivalGate"
  | "firstKey"
  | "firstAnomaly"
  | "bossGate";

export type TutorialStepDef = {
  id: string;
  titleKey: string;
  bodyKey: string;
  anchor?: string;
  trigger: TutorialTrigger;
};

export const tutorialSteps: TutorialStepDef[] = [
  { id: "tut_welcome", titleKey: "tutorial.welcome.title", bodyKey: "tutorial.welcome.body", anchor: "start-button", trigger: "welcome" },
  { id: "tut_first_drop", titleKey: "tutorial.firstDrop.title", bodyKey: "tutorial.firstDrop.body", anchor: "loot-notice", trigger: "firstDrop" },
  { id: "tut_first_equip", titleKey: "tutorial.firstEquip.title", bodyKey: "tutorial.firstEquip.body", anchor: "part-inspector", trigger: "firstEquip" },
  { id: "tut_first_talent", titleKey: "tutorial.firstTalent.title", bodyKey: "tutorial.firstTalent.body", anchor: "tab-talents", trigger: "firstTalent" },
  { id: "tut_first_forge", titleKey: "tutorial.firstForge.title", bodyKey: "tutorial.firstForge.body", anchor: "tab-forge", trigger: "firstForge" },
  { id: "tut_first_rune", titleKey: "tutorial.firstRune.title", bodyKey: "tutorial.firstRune.body", anchor: "tab-skills", trigger: "firstRune" },
  { id: "tut_doctrine", titleKey: "tutorial.doctrine.title", bodyKey: "tutorial.doctrine.body", anchor: "doctrine-strip", trigger: "doctrine" },
  { id: "tut_map_unlock", titleKey: "tutorial.mapUnlock.title", bodyKey: "tutorial.mapUnlock.body", anchor: "screen-map", trigger: "mapUnlock" },
  { id: "tut_rival_gate", titleKey: "tutorial.rivalGate.title", bodyKey: "tutorial.rivalGate.body", anchor: "network-detail", trigger: "rivalGate" },
  { id: "tut_first_key", titleKey: "tutorial.firstKey.title", bodyKey: "tutorial.firstKey.body", anchor: "arena-keys", trigger: "firstKey" },
  { id: "tut_first_anomaly", titleKey: "tutorial.firstAnomaly.title", bodyKey: "tutorial.firstAnomaly.body", anchor: "network-detail", trigger: "firstAnomaly" },
  { id: "tut_boss_gate", titleKey: "tutorial.bossGate.title", bodyKey: "tutorial.bossGate.body", anchor: "boss-gate", trigger: "bossGate" },
];

export const tutorialStepIds = tutorialSteps.map((step) => step.id);
