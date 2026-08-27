/** Mirrors `WalletCreditsLowCheckHandler`'s verdict and must stay in lockstep with it; balance and weeklyCost must be in the same unit. */
export function needsCreditsLowTransition(input: { balance: number; weeklyCost: number; isNotified: boolean }): boolean {
  const isLow = input.weeklyCost > 0 && input.balance < input.weeklyCost;

  return isLow !== input.isNotified;
}
