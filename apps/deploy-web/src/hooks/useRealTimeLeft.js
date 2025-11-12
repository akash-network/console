"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useRealTimeLeft = useRealTimeLeft;
var add_1 = require("date-fns/add");
var useBlocksQuery_1 = require("@src/queries/useBlocksQuery");
var priceUtils_1 = require("@src/utils/priceUtils");
function useRealTimeLeft(pricePerBlock, balance, settledAt, createdAt) {
    var latestBlock = (0, useBlocksQuery_1.useBlock)("latest", {
        refetchInterval: 30000
    }).data;
    if (!latestBlock)
        return;
    var latestBlockHeight = latestBlock.block.header.height;
    var blocksPassed = Math.abs(settledAt - latestBlockHeight);
    var blocksSinceCreation = Math.abs(createdAt - latestBlockHeight);
    var blocksLeft = balance / pricePerBlock - blocksPassed;
    var timestamp = new Date().getTime();
    return {
        timeLeft: (0, add_1.default)(new Date(timestamp), { seconds: blocksLeft * priceUtils_1.averageBlockTime }),
        escrow: Math.max(blocksLeft * pricePerBlock, 0),
        amountSpent: Math.min(blocksSinceCreation * pricePerBlock, balance)
    };
}
