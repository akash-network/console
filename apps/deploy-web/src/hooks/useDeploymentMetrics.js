"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useDeploymentMetrics = void 0;
var useRealTimeLeft_1 = require("./useRealTimeLeft");
var useDeploymentMetrics = function (_a) {
    var deployment = _a.deployment, leases = _a.leases;
    var hasLeases = !!leases && leases.length > 0;
    var deploymentCost = hasLeases ? leases.reduce(function (prev, current) { return prev + parseFloat(current.price.amount); }, 0) : 0;
    var realTimeLeft = (0, useRealTimeLeft_1.useRealTimeLeft)(deploymentCost, deployment.escrowBalance, parseFloat(deployment.escrowAccount.state.settled_at), deployment.createdAt);
    return {
        realTimeLeft: realTimeLeft,
        deploymentCost: deploymentCost
    };
};
exports.useDeploymentMetrics = useDeploymentMetrics;
