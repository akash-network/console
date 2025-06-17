import address from "./addresses/address";
import addressTransactions from "./addresses/transactions";
import proposalById from "./proposals/byId";
import proposals from "./proposals/list";
import gpu from "./gpu";
import gpuBreakdown from "./gpuBreakdown";
import gpuModels from "./gpuModels";
import gpuPrices from "./gpuPrices";
import predictedBlockDate from "./predictedBlockDate";
import predictedDateHeight from "./predictedDateHeight";
import trialProviders from "./trialProviders";

export default [
  predictedBlockDate,
  predictedDateHeight,
  address,
  addressTransactions,
  proposals,
  proposalById,
  trialProviders,
  gpu,
  gpuModels,
  gpuPrices,
  gpuBreakdown
];
