/**
 * Whether the credits-low state machine needs to move for these inputs: an un-notified
 * wallet sitting below a week of coverage needs the warning email; a notified wallet
 * that recovered or stopped spending needs its stamp cleared.
 *
 * Mirrors `WalletCreditsLowCheckHandler`'s decision (zero cost and sufficient balance
 * clear the stamp, a low un-notified wallet gets the email) so the hourly funding sweep
 * can skip enqueueing checks that the handler would no-op. Keep the two in lockstep:
 * a transition this misses is a warning the user never receives.
 *
 * Unit-agnostic: pass balance and weekly cost in the same unit (credits or USD).
 */
export function needsCreditsLowTransition(input: { balance: number; weeklyCost: number; isNotified: boolean }): boolean {
  const isLow = input.weeklyCost > 0 && input.balance < input.weeklyCost;

  return isLow !== input.isNotified;
}
