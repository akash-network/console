type ResourceUnit = {
  cpu: number;
  memory: number;
  gpu: number;
  ephemeralStorage: number;
  persistentStorage?: number;
  count: number;
};

export type MockQuoteBreakdownItem = {
  pricePerBlock: number;
  monthlyCostUsd: number;
};

export type MockQuote = {
  pricePerBlock: number;
  monthlyCostUsd: number;
  breakdown: {
    cpu: MockQuoteBreakdownItem;
    memory: MockQuoteBreakdownItem;
    ephemeral: MockQuoteBreakdownItem;
    gpu?: MockQuoteBreakdownItem;
    persistentStorage?: MockQuoteBreakdownItem;
  };
  expiresIn: number;
};

const GIB = 1073741824;
const BLOCKS_PER_MONTH = 438000;

export function generateMockQuote(resources: ResourceUnit[], actUsdPrice: number): MockQuote {
  let totalCpu = 0;
  let totalMemory = 0;
  let totalGpu = 0;
  let totalEphemeral = 0;
  let totalPersistent = 0;

  for (const r of resources) {
    totalCpu += (r.cpu / 1000) * r.count;
    totalMemory += (r.memory / GIB) * r.count;
    totalGpu += r.gpu * r.count;
    totalEphemeral += (r.ephemeralStorage / GIB) * r.count;
    totalPersistent += ((r.persistentStorage ?? 0) / GIB) * r.count;
  }

  const cpuCost = 0.012 * totalCpu;
  const memoryCost = 0.004 * totalMemory;
  const ephemeralCost = 0.0005 * totalEphemeral;
  const gpuCost = totalGpu > 0 ? 0.1 * totalGpu : 0;
  const persistentCost = totalPersistent > 0 ? 0.0005 * totalPersistent : 0;

  const pricePerBlock = cpuCost + memoryCost + ephemeralCost + gpuCost + persistentCost;
  const monthlyCostUsd = pricePerBlock * BLOCKS_PER_MONTH * actUsdPrice;

  const toItem = (cost: number): MockQuoteBreakdownItem => ({
    pricePerBlock: cost,
    monthlyCostUsd: cost * BLOCKS_PER_MONTH * actUsdPrice
  });

  const breakdown: MockQuote["breakdown"] = {
    cpu: toItem(cpuCost),
    memory: toItem(memoryCost),
    ephemeral: toItem(ephemeralCost)
  };
  if (gpuCost > 0) breakdown.gpu = toItem(gpuCost);
  if (persistentCost > 0) breakdown.persistentStorage = toItem(persistentCost);

  return { pricePerBlock, monthlyCostUsd, breakdown, expiresIn: 120 };
}
