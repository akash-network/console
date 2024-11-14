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

export function totalDeploymentTimeLeft(createdHeight: number, totalMonthlyDeploymentCost: number, latestBlock: number, balance: number, closedHeight: number | null,) {
  let time
  if (!closedHeight) {
    const blocksPassed = Math.abs(createdHeight - latestBlock)
    const pricePerBlock = totalMonthlyDeploymentCost / avgBlockPerMonth
    const blocksLeft = balance / pricePerBlock - blocksPassed
    const secondsLeft = blocksLeft * avgBlockTime
    time = secondsLeft
  } else {
    const noOfBlocks = Math.abs(createdHeight - closedHeight)
    time = (noOfBlocks * avgBlockTime)
  }
  return time
}