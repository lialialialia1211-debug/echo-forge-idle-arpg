import type { NamedRivalDef, RivalMechanicId } from "../engine/topTypes";

export const rivalMechanicIds: RivalMechanicId[] = ["reflectProjectiles", "gravityWell", "heavyCrash", "phaseShift", "ringWard"];

export const namedRivals: NamedRivalDef[] = [
  {
    id: "rival_sable_reflector",
    displayName: "Sable Reflector",
    frameId: "frame_swift_razor",
    driveId: "drive_shard_barrage",
    loadout: {
      runeIds: ["rune_splintered_edge", "rune_bloodless_line", "rune_deep_bearing"],
      talentIds: ["talent_iron_rotation", "talent_razor_geometry", "talent_glass_entry", "talent_glass_notable"],
      doctrineId: "doctrine_swift_razor_edge",
    },
    mechanicId: "reflectProjectiles",
    circuitNodeId: "network_brass_judicator",
    uniqueDropBaseIds: ["part_tip_glass_rebound", "part_ring_glass_splinter"],
    integrityScalar: 1.08,
  },
  {
    id: "rival_magnet_oracle",
    displayName: "Magnet Oracle",
    frameId: "frame_storm_needle",
    driveId: "drive_storm_lattice",
    loadout: {
      runeIds: ["rune_shock_fork", "rune_ion_pulse", "rune_echo_coil", "rune_null_ward"],
      talentIds: ["talent_iron_rotation", "talent_live_bearing", "talent_storm_lattice", "talent_static_entry", "talent_static_notable"],
      doctrineId: "doctrine_storm_chain_savant",
    },
    mechanicId: "gravityWell",
    circuitNodeId: "network_magnet_well",
    uniqueDropBaseIds: ["part_core_magnet_heart", "part_launcher_tempest_yoke"],
    integrityScalar: 1.04,
  },
  {
    id: "rival_brass_crasher",
    displayName: "Brass Crasher",
    frameId: "frame_ember_crucible",
    driveId: "drive_molten_groove",
    loadout: {
      runeIds: ["rune_red_heat", "rune_echo_coil", "rune_wide_scoring", "rune_furnace_wall"],
      talentIds: ["talent_iron_rotation", "talent_live_bearing", "talent_furnace_scoring", "talent_thermal_mass_entry", "talent_thermal_mass_notable"],
      doctrineId: "doctrine_ember_rail_monk",
    },
    mechanicId: "heavyCrash",
    circuitNodeId: "network_molten_bastion",
    uniqueDropBaseIds: ["part_disk_judicator_plate", "part_tip_molten_anchor"],
    integrityScalar: 1.18,
  },
  {
    id: "rival_lattice_apparition",
    displayName: "Lattice Apparition",
    frameId: "frame_storm_needle",
    driveId: "drive_chain_tempest",
    loadout: {
      runeIds: ["rune_ion_pulse", "rune_echo_coil", "rune_wide_scoring", "rune_greedy_teeth"],
      talentIds: ["talent_iron_rotation", "talent_live_bearing", "talent_storm_lattice", "talent_arc_velocity_entry", "talent_arc_velocity_notable"],
      doctrineId: "doctrine_storm_overload_axis",
    },
    mechanicId: "phaseShift",
    circuitNodeId: "network_phase_lattice",
    uniqueDropBaseIds: ["part_ring_storm_orbit", "part_core_void_pin"],
    integrityScalar: 0.96,
  },
  {
    id: "rival_rim_warden",
    displayName: "Rim Warden",
    frameId: "frame_swift_razor",
    driveId: "drive_razor_rebound",
    loadout: {
      runeIds: ["rune_bite_return", "rune_deep_bearing"],
      talentIds: ["talent_iron_rotation", "talent_razor_geometry", "talent_impact_entry"],
    },
    mechanicId: "ringWard",
    circuitNodeId: "network_glass_branch",
    uniqueDropBaseIds: ["part_chip_mapwright_contract", "part_disk_orbit_weight"],
    integrityScalar: 1.12,
  },
];

export function getNamedRivalDef(rivalId: string): NamedRivalDef {
  const rival = namedRivals.find((entry) => entry.id === rivalId);
  if (!rival) {
    throw new Error(`Unknown named rival: ${rivalId}`);
  }
  return rival;
}
