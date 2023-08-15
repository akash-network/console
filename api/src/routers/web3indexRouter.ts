import express from "express";
import { getWeb3IndexRevenue } from "@src/db/networkRevenueProvider";
import asyncHandler from "express-async-handler";
import { cacheKeys, cacheResponse } from "@src/caching/helpers";

export const web3IndexRouter = express.Router();

web3IndexRouter.get(
  "/revenue",
  asyncHandler(async (req, res) => {
    console.log("calculating revenue");

    const isDebug = req.query.debug === "true";

    const revenueData = isDebug
      ? await getWeb3IndexRevenue(true)
      : await cacheResponse(60 * 30, cacheKeys.web3IndexRevenue, getWeb3IndexRevenue);

    res.send(revenueData);
  })
);
