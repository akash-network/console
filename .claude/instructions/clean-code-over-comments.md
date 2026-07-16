## Clean Code Over Comments

## Description
- **Clarity is the default; a comment is the last resort.** Before writing any comment, make the code say it — rename to reveal intent, or extract a named function. A comment you *had* to write is a signal the code failed to be clear: fix the code, don't annotate it.
- **No inline comments.** Never write `//` or `/* */` comments inside function bodies, JSX, or tests — not even to label a section or restate a line. The only allowed comment is a `/** ... */` JSDoc block on a declaration, and only for the *why* (a non-obvious constraint, gotcha, or tradeoff) — never the *what*.
- **Names replace comments.** Prefer a verbose, intention-revealing name over a short name plus a comment: `secondsUntilBidExpiry`, not `t` with a `// seconds until bid expires`. Name functions by behavior, not by trigger: `redirectToSocialLogin`, not `onOAuthClick`. A name that needs a comment to be understood is the wrong name.
- **Structure replaces comments.** A function that needs internal section-comments to navigate wants to be several named functions. Separate concerns at every level — orchestration vs. detail, one reason to change per unit — so each piece is small enough to need no narration. Don't over-fragment though: single-statement operations stay inline; extract only multi-line sequences that earn a name.
- **JSDoc the non-obvious.** Module-level helper functions and "magic" constants (colors, fallbacks, multipliers, timeouts) get a 1–2 line JSDoc stating what/why. Skip it when the name is already fully self-describing.

## Examples

### Good
```typescript
/** Bids expire 5 min 20 s after the deployment is created. */
const BID_EXPIRY_SECONDS = 320;

function getSecondsUntilBidExpiry(createdAt: Date) {
  return BID_EXPIRY_SECONDS - differenceInSeconds(new Date(), createdAt);
}
```

```typescript
async function activateDeployment(deploymentId: string) {
  const bids = await fetchBids(deploymentId);
  const cheapest = selectCheapestBid(bids);
  await createLease(deploymentId, cheapest);
}
```

### Bad
```typescript
// bids are valid for 5 minutes and 20 seconds
const t = 320;

function getTime(createdAt: Date) {
  // work out how much time is left before the bid expires
  const elapsed = differenceInSeconds(new Date(), createdAt); // seconds since creation
  return t - elapsed;
}
```

```typescript
async function activateDeployment(deploymentId: string) {
  // 1. get the bids
  const bids = await fetchBids(deploymentId);

  // 2. pick the cheapest one
  let cheapest = bids[0];
  for (const b of bids) {
    if (b.price < cheapest.price) cheapest = b;
  }

  // 3. create the lease
  await createLease(deploymentId, cheapest);
}
```
