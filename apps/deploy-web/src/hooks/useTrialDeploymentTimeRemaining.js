"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPENDENCIES = void 0;
exports.useTrialDeploymentTimeRemaining = useTrialDeploymentTimeRemaining;
var React = require("react");
var date_fns_1 = require("date-fns");
var useBlocksQuery_1 = require("@src/queries/useBlocksQuery");
exports.DEPENDENCIES = {
    useBlock: useBlocksQuery_1.useBlock
};
/**
 * Calculates the time remaining for a trial deployment based on block heights
 */
function calculateTrialTimeRemaining(createdHeight, currentHeight, trialDurationHours, averageBlockTime) {
    var blocksPerHour = (60 * 60) / averageBlockTime;
    var totalTrialBlocks = trialDurationHours * blocksPerHour;
    var blocksElapsed = currentHeight - createdHeight;
    var blocksRemaining = totalTrialBlocks - blocksElapsed;
    if (blocksRemaining <= 0) {
        return {
            timeLeft: null,
            isExpired: true,
            blocksRemaining: 0
        };
    }
    var secondsRemaining = blocksRemaining * averageBlockTime;
    var timeLeft = new Date(Date.now() + secondsRemaining * 1000);
    return {
        timeLeft: timeLeft,
        isExpired: false,
        blocksRemaining: Math.floor(blocksRemaining)
    };
}
/**
 * Formats the time remaining in a human-readable format
 */
function formatTrialTimeRemaining(timeLeft, isExpired) {
    if (isExpired) {
        return "Trial expired";
    }
    if (!timeLeft) {
        return "Calculating...";
    }
    return (0, date_fns_1.formatDistanceToNow)(timeLeft, { addSuffix: true });
}
function useTrialDeploymentTimeRemaining(_a) {
    var createdHeight = _a.createdHeight, trialDurationHours = _a.trialDurationHours, _b = _a.averageBlockTime, averageBlockTime = _b === void 0 ? 6 : _b, _c = _a.dependencies, d = _c === void 0 ? exports.DEPENDENCIES : _c;
    var latestBlock = d.useBlock("latest", {
        refetchInterval: 30000
    }).data;
    var _d = React.useMemo(function () {
        if (!latestBlock || !createdHeight || !trialDurationHours) {
            return { timeLeft: null, isExpired: false };
        }
        var currentHeight = latestBlock.block.header.height;
        var result = calculateTrialTimeRemaining(createdHeight, currentHeight, trialDurationHours, averageBlockTime);
        return { timeLeft: result.timeLeft, isExpired: result.isExpired };
    }, [createdHeight, latestBlock, trialDurationHours, averageBlockTime]), timeLeft = _d.timeLeft, isExpired = _d.isExpired;
    var timeRemainingText = React.useMemo(function () {
        if (!createdHeight)
            return null;
        return formatTrialTimeRemaining(timeLeft, isExpired);
    }, [timeLeft, isExpired, createdHeight]);
    return { timeLeft: timeLeft, isExpired: isExpired, latestBlock: latestBlock, timeRemainingText: timeRemainingText };
}
