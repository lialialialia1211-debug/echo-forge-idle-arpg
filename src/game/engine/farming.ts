import { generateItemForArea } from "./items";
import { createRng } from "./rng";
import type {
  CurrencyId,
  CurrencyWallet,
  FarmTickResult,
  InventoryCapacityResult,
  ItemInstance,
  SalvageResult,
  SimulationSummary,
} from "./types";

export const emptyWallet = (): CurrencyWallet => ({
  ash: 0,
  glass: 0,
  echo: 0,
});

export function addWallets(...wallets: CurrencyWallet[]): CurrencyWallet {
  return wallets.reduce<CurrencyWallet>(
    (total, wallet) => ({
      ash: total.ash + wallet.ash,
      glass: total.glass + wallet.glass,
      echo: total.echo + wallet.echo,
    }),
    emptyWallet(),
  );
}

function walletFromEntries(entries: Partial<Record<CurrencyId, number>>): CurrencyWallet {
  return {
    ...emptyWallet(),
    ...entries,
  };
}

export function getSalvageResult(item: ItemInstance): SalvageResult {
  const affixBonus = item.affixes.length;
  const itemLevelBonus = Math.floor(item.itemLevel / 5);

  if (item.rarity === "relic") {
    return {
      currencies: walletFromEntries({ ash: 10 + affixBonus + itemLevelBonus, glass: 4, echo: 1 }),
      itemValue: 80,
    };
  }

  if (item.rarity === "rare") {
    return {
      currencies: walletFromEntries({ ash: 5 + affixBonus + itemLevelBonus, glass: 1 }),
      itemValue: 24,
    };
  }

  if (item.rarity === "magic") {
    return {
      currencies: walletFromEntries({ ash: 2 + affixBonus + itemLevelBonus }),
      itemValue: 7,
    };
  }

  return {
    currencies: walletFromEntries({ ash: 1 + itemLevelBonus }),
    itemValue: 2,
  };
}

function itemRetentionScore(item: ItemInstance): number {
  const rarityScore = {
    normal: 0,
    magic: 10,
    rare: 30,
    relic: 80,
  }[item.rarity];

  return rarityScore + item.affixes.length * 3 + item.itemLevel;
}

export function applyInventoryCapacity(
  inventory: ItemInstance[],
  capacity: number,
  protectedItemIds = new Set<string>(),
): InventoryCapacityResult {
  if (inventory.length <= capacity) {
    return {
      inventory,
      salvagedItems: [],
      currencies: emptyWallet(),
    };
  }

  const sortedCandidates = [...inventory]
    .filter((item) => !item.locked && !protectedItemIds.has(item.id))
    .sort((a, b) => itemRetentionScore(a) - itemRetentionScore(b));
  const toSalvage = new Set<string>();
  const overflowCount = inventory.length - capacity;

  for (const item of sortedCandidates.slice(0, overflowCount)) {
    toSalvage.add(item.id);
  }

  const salvagedItems = inventory.filter((item) => toSalvage.has(item.id));
  const currencies = addWallets(...salvagedItems.map((item) => getSalvageResult(item).currencies));

  return {
    inventory: inventory.filter((item) => !toSalvage.has(item.id)),
    salvagedItems,
    currencies,
  };
}

export function runFarmingTick({
  areaId,
  simulation,
  seed,
  seconds,
}: {
  areaId: string;
  simulation: SimulationSummary;
  seed: string;
  seconds: number;
}): FarmTickResult {
  const rng = createRng(seed);
  const expectedItems = (simulation.loot.itemsPerHour * seconds) / 3600;
  const guaranteedItems = Math.floor(expectedItems);
  const itemCount = guaranteedItems + (rng.next() < expectedItems - guaranteedItems ? 1 : 0);
  const boundedItemCount = Math.min(12, Math.max(0, itemCount));
  const items = Array.from({ length: boundedItemCount }, (_, index) =>
    generateItemForArea(areaId, `${seed}_drop_${index}`, {
      itemRarityBonus: simulation.loot.rareItemsPerHour / Math.max(1, simulation.loot.itemsPerHour),
    }),
  );
  const currencyScalar = seconds / 3600;
  const ash = Math.max(1, Math.floor(simulation.loot.currencyPerHour * currencyScalar));
  const glass = rng.next() < simulation.loot.rareItemsPerHour * currencyScalar ? 1 : 0;
  const echo = rng.next() < simulation.loot.chaseItemsPerHour * currencyScalar ? 1 : 0;

  return {
    seconds,
    kills: Math.floor((simulation.loot.killsPerHour * seconds) / 3600),
    items,
    currencies: { ash, glass, echo },
  };
}
