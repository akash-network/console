import { avgBlockPerMonth, avgBlockTime } from "./constants"

export function findTotalAmountSpentOnLeases(leases: any, latestBlock: number, isMonthlyCalculation: boolean = false) {
    let amountSpent = 0.0
    if (leases.length) {
        leases.forEach((item) => {
            const pricePerBlock: number = isMonthlyCalculation ? item.monthlyCostUDenom / avgBlockPerMonth : item.price
            const blocksPassed =
                item.status === 'active'
                    ? Math.abs(latestBlock - Number(item.createdHeight))
                    : Math.abs(Number(item.closedHeight) - Number(item.createdHeight))
            amountSpent += blocksPassed * pricePerBlock
        })
    }
    return amountSpent
}

export function totalDeploymentCost(leases) {
    let sum = 0.0
    if (leases.length) {
        leases.forEach((item) => {
            sum += item.price
        })
    }
    return sum * avgBlockPerMonth
}

export function timeLeftDeployment(leases, latestBlock, balance) {
    let time
    if (leases[0].status === 'active') {
        const blocksPassed = Math.abs(leases[0].createdHeight - latestBlock)
        const blocksLeft = balance / leases[0].price - blocksPassed
        const secondsLeft = blocksLeft * avgBlockTime

        // Calculate time in hours
        time = secondsLeft / 3600
    } else {
        const noOfBlocks = Math.abs(leases[0].createdHeight - leases[0].closedHeight)
        time = (noOfBlocks * avgBlockTime) / 3600
    }
    return time
}