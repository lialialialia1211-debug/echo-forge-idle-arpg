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
