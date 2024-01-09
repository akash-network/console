import packageJson from "../../package.json";
import express from "express";
import { getBlock, getBlocks, getPredictedBlockDate, getPredictedDateHeight } from "@src/db/blocksProvider";
import { getTemplateGallery } from "@src/providers/templateReposProvider";
import { getTransaction, getTransactionByAddress, getTransactions } from "@src/db/transactionsProvider";
import {
  getAddressBalance,
  getAddressDeployments,
  getChainStats,
  getDeployment,
  getProposal,
  getProposals,
  getValidator,
  getValidators
} from "@src/providers/apiNodeProvider";
import { getNetworkCapacity, getProviderDetail, getProviderList } from "@src/providers/providerStatusProvider";
import { getDashboardData, getGraphData, getProviderActiveLeasesGraphData, getProviderGraphData } from "@src/db/statsProvider";
import { round } from "@src/utils/math";
import { isValidBech32Address } from "@src/utils/addresses";
import { getAkashPricing, getAWSPricing, getAzurePricing, getGCPPricing } from "@src/utils/pricing";
import asyncHandler from "express-async-handler";
import { ProviderStatsKey } from "@src/types/graph";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import axios from "axios";
import { getMarketData } from "@src/providers/marketDataProvider";
import { getAuditors, getProviderAttributesSchema } from "@src/providers/githubProvider";
import { getProviderRegions } from "@src/db/providerDataProvider";
import { getProviderDeployments } from "@src/db/deploymentProvider";
import { OpenAPIHono } from "@hono/zod-openapi";

import { swaggerUI } from "@hono/swagger-ui";
import routesV1 from "../routes/v1";
import routesV2 from "../routes/v2";

export const apiRouter = express.Router();

apiRouter.get(
  "/templates",
  asyncHandler(async (req, res) => {
    const response = await cacheResponse(60 * 5, cacheKeys.getTemplates, async () => await getTemplateGallery());
    res.send(response);
  })
);

apiRouter.get(
  "/blocks",
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit?.toString());
    const blocks = await getBlocks(limit || 20);

    res.send(blocks);
  })
);

apiRouter.get(
  "/blocks/:height",
  asyncHandler(async (req, res) => {
    const heightInt = parseInt(req.params.height);

    if (isNaN(heightInt)) {
      res.status(400).send("Invalid height.");
      return;
    }

    const blockInfo = await getBlock(heightInt);

    if (blockInfo) {
      res.send(blockInfo);
    } else {
      res.status(404).send("Block not found");
    }
  })
);

export const apiRouterHono = new OpenAPIHono();

function registerApiVersion(version: string, baseRouter: OpenAPIHono, versionRoutes: OpenAPIHono[]) {
  const versionRouter = new OpenAPIHono();
  versionRouter.doc(`/doc`, {
    openapi: "3.0.0",
    servers: [{ url: `http://localhost:8787/api/${version}`, description: "Localhost" }], // TODO
    info: {
      title: "Cloudmos API",
      description: "Access Akash data from our indexer",
      version: version
    }
  });
  const swaggerInstance = swaggerUI({ url: `/api/${version}/doc` });

  versionRouter.get(`/swagger`, swaggerInstance);
  versionRouter.get(`/swagger/`, swaggerInstance);
console.log(versionRoutes[0]);
  versionRoutes.forEach((route) => versionRouter.route(`/`, route));
  baseRouter.route(`/${version}`, versionRouter);
}

registerApiVersion("v1", apiRouterHono, routesV1);
registerApiVersion("v2", apiRouterHono, routesV2);

// routesV1.forEach((route) => {
//   apiRouterHono.doc("/v1/doc", {
//     openapi: "3.0.0",
//     servers: [{ url: "http://localhost:8787/api/v1", description: "Local" }],
//     info: {
//       title: "Cloudmos API",
//       description: "Access Akash data from our indexer",
//       version: packageJson.version
//     }
//   });
//   apiRouterHono.get("/v1/swagger", swaggerUI({ url: "/api/v1/doc" }));
//   apiRouterHono.route("/v1", route);
// });

// function parseNumberParam(val, ctx) {
//   const parsed = parseInt(val);
//   if (isNaN(parsed)) {
//     ctx.addIssue({
//       code: z.ZodIssueCode.custom,
//       message: "Not a number"
//     });
//     return z.NEVER;
//   }
//   return parsed;
// }

apiRouter.get(
  "/addresses/:address/transactions/:skip/:limit",
  asyncHandler(async (req, res) => {
    if (!isValidBech32Address(req.params.address, "akash")) {
      res.status(400).send("Invalid address");
      return;
    }

    const skip = parseInt(req.params.skip);
    const limit = Math.min(100, parseInt(req.params.limit));

    if (isNaN(skip)) {
      res.status(400).send("Invalid skip.");
      return;
    }

    if (isNaN(limit)) {
      res.status(400).send("Invalid limit.");
      return;
    }

    const txs = await getTransactionByAddress(req.params.address, skip, limit);
    res.send(txs);
  })
);

apiRouter.get(
  "/addresses/:address/deployments/:skip/:limit",
  asyncHandler(async (req, res) => {
    const skip = parseInt(req.params.skip);
    const limit = Math.min(100, parseInt(req.params.limit));
    const deployments = await getAddressDeployments(req.params.address, skip, limit, req.query?.reverseSorting === "true", {
      status: req.query?.status as string
    });
    res.send(deployments);
  })
);

apiRouter.get(
  "/providers/:provider/deployments/:skip/:limit/:status?",
  asyncHandler(async (req, res) => {
    const skip = parseInt(req.params.skip);
    const limit = Math.min(100, parseInt(req.params.limit));
    const statusParam = req.params.status as "active" | "closed" | undefined;

    if (statusParam && statusParam !== "active" && statusParam !== "closed") {
      res.status(400).send(`Invalid status filter: "${statusParam}". Valid values are "active" and "closed".`);
      return;
    }

    const deployments = await getProviderDeployments(req.params.provider, skip, limit, statusParam);

    res.send(deployments);
  })
);

apiRouter.get(
  "/validators",
  asyncHandler(async (req, res) => {
    const validators = await getValidators();
    res.send(validators);
  })
);

apiRouter.get(
  "/validators/:address",
  asyncHandler(async (req, res) => {
    if (!isValidBech32Address(req.params.address, "akashvaloper")) {
      res.status(400).send("Invalid address");
      return;
    }

    const validator = await getValidator(req.params.address);

    if (!validator) {
      res.status(404).send("Validator not found");
      return;
    }

    res.send(validator);
  })
);

apiRouter.get(
  "/proposals",
  asyncHandler(async (req, res) => {
    const proposals = await getProposals();
    res.send(proposals);
  })
);

apiRouter.get(
  "/proposals/:id",
  asyncHandler(async (req, res) => {
    const proposalId = parseInt(req.params.id);

    if (isNaN(proposalId)) {
      res.status(400).send("Invalid proposal id.");
      return;
    }

    const proposal = await getProposal(proposalId);

    if (!proposal) {
      res.status(404).send("Proposal not found");
      return;
    }

    res.send(proposal);
  })
);

apiRouter.get(
  "/deployment/:owner/:dseq",
  asyncHandler(async (req, res) => {
    if (isNaN(parseInt(req.params.dseq))) {
      res.status(400).send("Invalid dseq.");
      return;
    }

    if (!isValidBech32Address(req.params.owner, "akash")) {
      res.status(400).send("Invalid address");
      return;
    }

    const deployment = await getDeployment(req.params.owner, req.params.dseq);

    if (deployment) {
      res.send(deployment);
    } else {
      res.status(404).send("Deployment not found");
    }
  })
);

apiRouter.get(
  "/getNetworkCapacity",
  asyncHandler(async (req, res) => {
    const networkCapacity = await getNetworkCapacity();
    res.send(networkCapacity);
  })
);

apiRouter.get(
  "/providers",
  asyncHandler(async (req, res) => {
    const providers = await cacheResponse(60, cacheKeys.getProviderList, getProviderList);
    res.send(providers);
  })
);

apiRouter.get(
  "/providers/:address",
  asyncHandler(async (req, res) => {
    if (!req.params.address) {
      res.status(400).send("Address is undefined.");
      return;
    }

    const provider = await getProviderDetail(req.params.address);
    res.send(provider);
  })
);

apiRouter.get("/marketData", async (req, res) => {
  const response = await cacheResponse(60 * 5, cacheKeys.getMarketData, getMarketData);
  res.send(response);
});

apiRouter.get(
  "/dashboardData",
  asyncHandler(async (req, res) => {
    const chainStatsQuery = await getChainStats();
    const dashboardData = await getDashboardData();
    const networkCapacity = await getNetworkCapacity();
    const networkCapacityStats = await getProviderGraphData("count");
    const latestBlocks = await getBlocks(5);
    const latestTransactions = await getTransactions(5);

    const chainStats = {
      height: latestBlocks[0].height,
      transactionCount: latestBlocks[0].totalTransactionCount,
      ...chainStatsQuery
    };

    res.send({
      chainStats,
      ...dashboardData,
      networkCapacity,
      networkCapacityStats,
      latestBlocks,
      latestTransactions
    });
  })
);

apiRouter.get(
  "/getGraphData/:dataName",
  asyncHandler(async (req, res) => {
    const dataName = req.params.dataName;
    const authorizedDataNames = [
      "dailyUAktSpent",
      "dailyUUsdcSpent",
      "dailyUUsdSpent",
      "dailyLeaseCount",
      "totalUAktSpent",
      "totalUUsdcSpent",
      "totalUUsdSpent",
      "activeLeaseCount",
      "totalLeaseCount",
      "activeCPU",
      "activeGPU",
      "activeMemory",
      "activeStorage"
    ];

    if (!authorizedDataNames.includes(dataName)) {
      console.log("Rejected graph request: " + dataName);
      res.sendStatus(404);
      return;
    }

    const graphData = await getGraphData(dataName);
    res.send(graphData);
  })
);

apiRouter.get(
  "/getProviderGraphData/:dataName",
  asyncHandler(async (req, res) => {
    const dataName = req.params.dataName;
    const authorizedDataNames = ["count", "cpu", "gpu", "memory", "storage"];

    if (!authorizedDataNames.includes(dataName)) {
      console.log("Rejected graph request: " + dataName);
      res.sendStatus(404);
      return;
    }

    const graphData = await getProviderGraphData(dataName as ProviderStatsKey);
    res.send(graphData);
  })
);

apiRouter.get(
  "/getProviderActiveLeasesGraphData/:providerAddress",
  asyncHandler(async (req, res) => {
    const providerAddress = req.params.providerAddress;

    const graphData = await getProviderActiveLeasesGraphData(providerAddress);
    res.send(graphData);
  })
);

apiRouter.get(
  "/provider-regions",
  asyncHandler(async (req, res) => {
    const response = await cacheResponse(60 * 5, cacheKeys.getProviderRegions, getProviderRegions);
    res.send(response);
  })
);

apiRouter.post(
  "/pricing",
  express.json(),
  asyncHandler(async (req, res) => {
    const isArray = Array.isArray(req.body);
    const specs = isArray ? req.body : [req.body];

    let pricing = [];

    for (const spec of specs) {
      const cpu = parseInt(spec.cpu);
      const memory = parseInt(spec.memory);
      const storage = parseInt(spec.storage);

      if (isNaN(cpu) || isNaN(memory) || isNaN(storage)) {
        res.status(400).send("Invalid parameters.");
        return;
      }

      const akashPricing = getAkashPricing(cpu, memory, storage);
      const awsPricing = getAWSPricing(cpu, memory, storage);
      const gcpPricing = getGCPPricing(cpu, memory, storage);
      const azurePricing = getAzurePricing(cpu, memory, storage);

      pricing.push({
        spec: spec,
        akash: round(akashPricing, 2),
        aws: round(awsPricing, 2),
        gcp: round(gcpPricing, 2),
        azure: round(azurePricing, 2)
      });
    }

    res.send(isArray ? pricing : pricing[0]);
  })
);

apiRouter.get(
  "/getProviderAttributesSchema",
  asyncHandler(async (req, res) => {
    const providerAttributesSchema = await getProviderAttributesSchema();
    res.send(providerAttributesSchema);
  })
);

apiRouter.get(
  "/getAuditors",
  asyncHandler(async (req, res) => {
    const response = await getAuditors();
    res.send(response);
  })
);

apiRouter.get(
  "/getMainnetNodes",
  asyncHandler(async (req, res) => {
    const response = await cacheResponse(60 * 2, cacheKeys.getMainnetNodes, async () => {
      const res = await axios.get("https://raw.githubusercontent.com/akash-network/cloudmos/main/config/mainnet-nodes.json");
      return res.data;
    });
    res.send(response);
  })
);

apiRouter.get(
  "/getTestnetNodes",
  asyncHandler(async (req, res) => {
    const response = await cacheResponse(60 * 2, cacheKeys.getTestnetNodes, async () => {
      const res = await axios.get("https://raw.githubusercontent.com/akash-network/cloudmos/main/config/testnet-nodes.json");
      return res.data;
    });
    res.send(response);
  })
);

apiRouter.get(
  "/getSandboxNodes",
  asyncHandler(async (req, res) => {
    const response = await cacheResponse(60 * 2, cacheKeys.getSandboxNodes, async () => {
      const res = await axios.get("https://raw.githubusercontent.com/akash-network/cloudmos/main/config/sandbox-nodes.json");
      return res.data;
    });
    res.send(response);
  })
);

apiRouter.get(
  "/getMainnetVersion",
  asyncHandler(async (req, res) => {
    const response = await cacheResponse(60 * 5, cacheKeys.getMainnetVersion, async () => {
      const res = await axios.get("https://raw.githubusercontent.com/akash-network/net/master/mainnet/version.txt");
      return res.data;
    });
    res.send(response);
  })
);

apiRouter.get(
  "/getTestnetVersion",
  asyncHandler(async (req, res) => {
    const response = await cacheResponse(60 * 5, cacheKeys.getTestnetVersion, async () => {
      const res = await axios.get("https://raw.githubusercontent.com/akash-network/net/master/testnet-02/version.txt");
      return res.data;
    });
    res.send(response);
  })
);

apiRouter.get(
  "/getSandboxVersion",
  asyncHandler(async (req, res) => {
    const response = await cacheResponse(60 * 5, cacheKeys.getSandboxVersion, async () => {
      const res = await axios.get("https://raw.githubusercontent.com/akash-network/net/master/sandbox/version.txt");
      return res.data;
    });
    res.send(response);
  })
);
