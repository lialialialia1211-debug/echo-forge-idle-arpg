export const balanceConfig = {
  topPhysics: {
    // Current data uses mass around 1.0; the foundation spec uses 5 as a
    // middle-weight design value. Keep the bridge explicit while data migrates.
    legacyMassToDesignMass: 5,
    defaultVolume: 5,
    fallbackForce: 5,
    massDamageKappa: 30,
    energyPerForce: 200,
    frequencyLambda: 0.085,
    omegaReference: 11.7,
    minOmega: 0.1,
  },
  flux: {
    baseMax: 100,
    maxPerResonance: 8,
    naturalRegenPerSecond: 12,
    hitRegen: 4,
    killRegen: 25,
    fluxToEnergyRate: 8,
    energySustainConversionPerSecond: 6,
    lowThresholdRatio: 0.15,
  },
  offline: {
    efficiency: 0.4,
    capSeconds: 8 * 3600,
    dropCap: 30,
    anomalyRuleRewardScalar: 0.5,
  },
  combat: {
    heavyEnergyBleed: 0.35,
  },
  drops: {
    rarityWeightsByTier: {
      1: { common: 70, tuned: 25, engraved: 4.7, relic: 0.3 },
      2: { common: 58, tuned: 31, engraved: 9.7, relic: 1.3 },
      3: { common: 46, tuned: 34, engraved: 16, relic: 4 },
      4: { common: 38, tuned: 34, engraved: 21, relic: 7 },
      5: { common: 30, tuned: 33, engraved: 26, relic: 11 },
    },
    rarityExponent: 0.7,
    pity: {
      tunedAfterKills: 12,
      engravedAfterKills: 50,
    },
    firstClear: {
      rival: {
        wallet: { ash: 0, glass: 0, echo: 1 },
        rarity: "engraved",
        itemLevel: 8,
      },
      bossGate: {
        wallet: { ash: 0, glass: 5, echo: 1 },
        rarity: "engraved",
        itemLevel: 12,
        baseId: "part_disk_judicator_plate",
      },
    },
  },
  rival: {
    reflectRatio: 0.3,
  },
  anomaly: {
    shrinkingArenaRadiusScalar: 0.7,
    heavyResonanceThresholdScalar: 0.75,
  },
  energy: {
    frictionLossPerMassPerSecond: 8,
    collisionLossScalar: 0.6,
  },
  defeat: {
    spinEnergyEpsilon: 0,
    spinIntegrityEpsilon: 0,
    ringoutMinImpact: 900,
    ringoutGripMassScalar: 300,
    defenseStanceTelegraphSeconds: 0.9,
  },
  progression: {
    towerRequirementBase: 50,
    towerRequirementGrowth: 1.15,
    levelPowerBase: 10,
    levelPowerExponent: 0.7,
    armorStartFloor: 25,
    armorBase: 40,
    armorGrowth: 1.06,
    respecCostBase: 30,
    respecCostExponent: 1.2,
    mapKillTargetByTier: {
      1: { min: 60, max: 80 },
      2: { min: 90, max: 120 },
      3: { min: 120, max: 160 },
      4: { min: 150, max: 200 },
    },
    mapClearReward: {
      ashPerTier: 10,
      glassPerTier: 2,
    },
  },
  thresholds: {
    specializedDriveAttribute: 6,
    keystoneAttribute: 8,
    heavyDiskBase: 4,
  },
  runeSlots: {
    start: 2,
    firstUpgradeLevel: 12,
    secondUpgradeLevel: 28,
    finalUpgradeLevel: 45,
  },
} as const;
