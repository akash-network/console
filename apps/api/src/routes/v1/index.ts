import proposalById from "./proposals/byId";
import proposals from "./proposals/list";
import templateById from "./templates/byId";
import templateList from "./templates/list";
import templateListFull from "./templates/list-full";
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
  proposals,
  proposalById,
  templateListFull,
  templateList,
  templateById,
  trialProviders,
  gpu,
  gpuModels,
  gpuPrices,
  gpuBreakdown
];
