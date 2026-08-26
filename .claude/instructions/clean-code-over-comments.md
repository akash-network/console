## Clean Code Over Comments

## Description
- **Clarity is the default; a comment is the last resort.** Before writing any comment, make the code say it — rename to reveal intent, or extract a named function. A comment you *had* to write is a signal the code failed to be clear: fix the code, don't annotate it.
- **No inline comments.** Never write `//` or `/* */` comments inside function bodies, JSX, or tests — not even to label a section or restate a line. The only allowed comment is a `/** ... */` JSDoc block on a declaration, and only for the *why* (a non-obvious constraint, gotcha, or tradeoff) — never the *what*.
- **Names replace comments.** Prefer a verbose, intention-revealing name over a short name plus a comment: `secondsUntilBidExpiry`, not `t` with a `// seconds until bid expires`. Name functions by behavior, not by trigger: `redirectToSocialLogin`, not `onOAuthClick`. A name that needs a comment to be understood is the wrong name.
- **One name per callback.** When a callback is bound to a named `const` (a `useCallback`, `useMemo`, event handler, or any assignment), the `const` carries the behavior name and the body stays an anonymous arrow — don't *also* name the function expression, and don't name the `const` after its trigger or the prop it feeds. One name is enough, and it names the *behavior*. Keep a named function expression only for a callback that has no binding name of its own: `useEffect(function redirectWhenSignedOut() {…})`, a `return function teardown() {…}` cleanup, or an inline `items.map(function renderRow() {…})`.
- **Structure replaces comments.** A function that needs internal section-comments to navigate wants to be several named functions. Separate concerns at every level — orchestration vs. detail, one reason to change per unit — so each piece is small enough to need no narration. Don't over-fragment though: single-statement operations stay inline; extract only multi-line sequences that earn a name.
- **Default to no JSDoc.** A JSDoc block is an exception you have to justify, not a box to fill in. A magic constant earns one only when a reader who might change the value would otherwise get it wrong *and* no name can carry the point — reach for `MIN_`/`MAX_` prefixes, a named type, or a `satisfies` clause before reaching for prose. Skip it whenever the name already says it.
- **One line, hard cap.** A JSDoc block is a single sentence on one line. A second sentence needs a reason; a third is never right. No paragraphs, no blank lines inside the block, no bullet lists. If the *why* doesn't fit on one line, it isn't a comment — it's a PR description or a refactor that makes the constraint structural.
- **The constraint, not the derivation.** State only the fact a future editor would break — what the value must stay above, what upstream bug the workaround exists for. How you got there is not part of it: drop the alternatives you rejected, what you verified it against, how the numbers multiply out, which test covers it, and what happens in every other scenario. That belongs in the PR description or nowhere.
- **Tests get no JSDoc at all.** No block on a `describe`, an `it`, a fixture, or a `setup` function. A test whose purpose needs explaining wants a better test name or a smaller test.

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
/** pg-boss defaults its backoff multiplier to 0, which would collapse every retry gap after the first to zero. */
const MIN_RECHECK_BACKOFF_SECONDS = 30;
```

```typescript
async function activateDeployment(deploymentId: string) {
  const bids = await fetchBids(deploymentId);
  const cheapest = selectCheapestBid(bids);
  await createLease(deploymentId, cheapest);
}
```

```typescript
const clearPersistedFlow = useCallback(() => {
  sessionStorage.removeItem(FLOW_KEY);
}, []);

useEffect(function redirectWhenSignedOut() {
  if (!user) redirectToLogin();
}, [user]);
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
/**
 * First gap between chain re-checks, doubling from there. pg-boss multiplies its backoff by this value and
 * defaults it to 0, which collapses every later gap to zero however high the cap is set — so it must be
 * positive for the horizon below to exist at all.
 *
 * With 48 attempts and the cap below, this spans about 21.5 to 22 hours depending on jitter, sized to outlast
 * a chain-node outage rather than a blip. Checking too early costs retries rather than rows, since the
 * presence check enforces its own margin on top.
 */
const MIN_RECHECK_BACKOFF_SECONDS = 30;
```

```typescript
/**
 * Covers the compensation against a real database and a real chain response, because both halves of its
 * decision are about things a mock cannot get wrong on its behalf.
 */
describe("deployment setting compensation", () => {
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

```typescript
const onReset = useCallback(function clearPersistedFlow() {
  sessionStorage.removeItem(FLOW_KEY);
}, []);
```
