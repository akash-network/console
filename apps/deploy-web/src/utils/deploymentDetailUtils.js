"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorageAmount = void 0;
exports.deploymentResourceSum = deploymentResourceSum;
exports.deploymentGroupResourceSum = deploymentGroupResourceSum;
exports.deploymentToDto = deploymentToDto;
exports.convertToArrayIfNeeded = convertToArrayIfNeeded;
exports.leaseToDto = leaseToDto;
var priceUtils_1 = require("./priceUtils");
function deploymentResourceSum(deployment, resourceMapper) {
    return deployment.groups.map(function (g) { return g.group_spec.resources.map(function (r) { return r.count * resourceMapper(r.resource); }).reduce(function (a, b) { return a + b; }); }).reduce(function (a, b) { return a + b; });
}
function deploymentGroupResourceSum(group, resourceMapper) {
    if (!group || !group.group_spec || !group.group_spec)
        return 0;
    return group.group_spec.resources.map(function (r) { return r.count * resourceMapper(r.resource); }).reduce(function (a, b) { return a + b; });
}
function deploymentToDto(d) {
    var escrowBalanceUAkt = 0;
    if (d.escrow_account.state.funds.length > 0) {
        escrowBalanceUAkt = d.escrow_account.state.funds.reduce(function (sum, fund) { return sum + (0, priceUtils_1.coinToUDenom)(fund); }, 0);
    }
    // Sum all transferred amounts
    var totalTransferred = { denom: "", amount: "0" };
    if (d.escrow_account.state.transferred.length > 0) {
        var totalAmount = d.escrow_account.state.transferred.reduce(function (sum, transfer) {
            return sum + (0, priceUtils_1.coinToUDenom)(transfer);
        }, 0);
        totalTransferred = {
            denom: d.escrow_account.state.transferred[0].denom,
            amount: totalAmount.toString()
        };
    }
    return {
        dseq: d.deployment.id.dseq,
        state: d.deployment.state,
        hash: d.deployment.hash,
        denom: d.escrow_account.state.funds.length > 0 ? d.escrow_account.state.funds[0].denom : "",
        createdAt: parseInt(d.deployment.created_at),
        escrowBalance: escrowBalanceUAkt,
        transferred: totalTransferred,
        cpuAmount: deploymentResourceSum(d, function (r) { return parseInt(r.cpu.units.val) / 1000; }),
        gpuAmount: deploymentResourceSum(d, function (r) { var _a, _b; return parseInt(((_b = (_a = r.gpu) === null || _a === void 0 ? void 0 : _a.units) === null || _b === void 0 ? void 0 : _b.val) || "0"); }),
        memoryAmount: deploymentResourceSum(d, function (r) { return parseInt(r.memory.quantity.val); }),
        storageAmount: deploymentResourceSum(d, function (r) {
            return convertToArrayIfNeeded(r.storage)
                .map(function (x) { return parseInt(x.quantity.val); })
                .reduce(function (a, b) { return a + b; }, 0);
        }),
        escrowAccount: __assign({}, d.escrow_account),
        groups: __spreadArray([], d.groups, true)
    };
}
function convertToArrayIfNeeded(arrayOrItem) {
    return Array.isArray(arrayOrItem) ? arrayOrItem : [arrayOrItem];
}
var getStorageAmount = function (resource) {
    var _a, _b;
    var storage;
    if (Array.isArray(resource.storage)) {
        storage = resource.storage.map(function (x) { return parseInt(x.quantity.val); }).reduce(function (a, b) { return a + b; }, 0);
    }
    else {
        storage = parseInt(((_b = (_a = resource.storage) === null || _a === void 0 ? void 0 : _a.quantity) === null || _b === void 0 ? void 0 : _b.val) || "0");
    }
    return storage;
};
exports.getStorageAmount = getStorageAmount;
function leaseToDto(lease, deployment) {
    var group = deployment ? deployment.groups.filter(function (g) { return g.id.gseq === lease.lease.id.gseq; })[0] : {};
    return {
        id: lease.lease.id.dseq + lease.lease.id.gseq + lease.lease.id.oseq,
        owner: lease.lease.id.owner,
        provider: lease.lease.id.provider,
        dseq: lease.lease.id.dseq,
        gseq: lease.lease.id.gseq,
        oseq: lease.lease.id.oseq,
        state: lease.lease.state,
        price: lease.lease.price,
        cpuAmount: deployment ? deploymentGroupResourceSum(group, function (r) { return parseInt(r.cpu.units.val) / 1000; }) : undefined,
        gpuAmount: deployment ? deploymentGroupResourceSum(group, function (r) { var _a, _b; return parseInt(((_b = (_a = r.gpu) === null || _a === void 0 ? void 0 : _a.units) === null || _b === void 0 ? void 0 : _b.val) || "0"); }) : undefined,
        memoryAmount: deployment ? deploymentGroupResourceSum(group, function (r) { return parseInt(r.memory.quantity.val); }) : undefined,
        storageAmount: deployment
            ? deploymentGroupResourceSum(group, function (r) {
                return convertToArrayIfNeeded(r.storage)
                    .map(function (x) { return parseInt(x.quantity.val); })
                    .reduce(function (a, b) { return a + b; }, 0);
            })
            : undefined,
        group: group
    };
}
