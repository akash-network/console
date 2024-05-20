"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountSettle = void 0;
// This copies the logic of the akash node
// Port of https://github.com/akash-network/akash/blob/c2be64614f7417cf99447185f9d13b49bf33dadb/x/escrow/keeper/keeper.go#L353
function accountSettle(deployment, height, blockGroupTransaction) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!deployment)
            throw new Error("Deployment is missing");
        if (!deployment.leases)
            throw new Error("Deployment.leases is missing");
        const activeLeases = deployment.leases.filter((x) => !x.closedHeight);
        const blockRate = activeLeases.map((x) => x.price).reduce((a, b) => a + b, 0);
        if (height === deployment.lastWithdrawHeight)
            return { blockRate };
        const heightDelta = height - deployment.lastWithdrawHeight;
        deployment.lastWithdrawHeight = height;
        if (activeLeases.length === 0) {
            yield deployment.save({ transaction: blockGroupTransaction });
            return { blockRate: 0 };
        }
        const { overdrawn, remaining } = accountSettleFullBlocks(deployment, activeLeases, heightDelta, blockRate);
        if (!overdrawn) {
            yield deployment.save({ transaction: blockGroupTransaction });
            for (const lease of activeLeases) {
                yield lease.save({ transaction: blockGroupTransaction });
            }
            return { blockRate };
        }
        // Overdrawn
        const newRemaining = accountSettleDistributeWeighted(deployment, activeLeases, blockRate, remaining);
        if (newRemaining > 1) {
            throw new Error(`Invalid settlement: ${newRemaining} remains`);
        }
        deployment.closedHeight = height;
        yield deployment.save({ transaction: blockGroupTransaction });
        for (const lease of activeLeases) {
            lease.closedHeight = height;
            yield lease.save({ transaction: blockGroupTransaction });
        }
        return { blockRate };
    });
}
exports.accountSettle = accountSettle;
// Port of https://github.com/akash-network/akash/blob/c2be64614f7417cf99447185f9d13b49bf33dadb/x/escrow/keeper/keeper.go#L543
function accountSettleFullBlocks(deployment, activeLeases, heightDelta, blockRate) {
    let numFullBlocks = Math.min(Math.floor(deployment.balance / blockRate), heightDelta);
    for (const lease of activeLeases) {
        lease.withdrawnAmount += numFullBlocks * lease.price;
    }
    const transferred = blockRate * numFullBlocks;
    deployment.withdrawnAmount += transferred;
    deployment.balance -= transferred;
    let remaining = deployment.balance;
    let overdrawn = true;
    if (numFullBlocks === heightDelta) {
        remaining = 0;
        overdrawn = false;
    }
    if (overdrawn) {
        deployment.balance = remaining;
    }
    return { overdrawn, remaining };
}
// Port of https://github.com/akash-network/akash/blob/c2be64614f7417cf99447185f9d13b49bf33dadb/x/escrow/keeper/keeper.go#L594
function accountSettleDistributeWeighted(deployment, activeLeases, blockRate, remaining) {
    let transferred = 0;
    for (const lease of activeLeases) {
        const amount = (remaining * lease.price) / blockRate;
        lease.withdrawnAmount += amount;
        transferred += amount;
    }
    deployment.withdrawnAmount += transferred;
    deployment.balance -= transferred;
    return remaining - transferred;
}
//# sourceMappingURL=akashPaymentSettle.js.map