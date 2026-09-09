# Provider builds disabled in Provider Console

Since 2026-09-09, Provider Console no longer lets users create or build a provider. Providers are built with the [Provider Playbook](https://akash.network/docs/providers/setup-and-installation/provider-playbook/) instead. Provider Console remains fully available for dashboards and management of existing providers.

Tracked in Linear as AKHN-441 and shipped in [PR #3891](https://github.com/akash-network/console/pull/3891).

## What changed

- The `/become-provider` route was removed. The wizard still exists as `src/components/become-provider/BecomeProvider.tsx` but nothing mounts it.
- The "Create Provider" button was removed from the sidebar (`src/components/layout/Sidebar.tsx`).
- The "Create Provider" link was removed from the final step of the Get Started stepper (`src/components/get-started/GetStartedStepper.tsx`). The step text now says provider creation is unavailable.
- The "Restart Provider Build" button was removed from the remedies page (`src/pages/remedies/index.tsx`), together with the provider-process reset it triggered.
- A warning banner (`src/components/layout/ProviderBuildDisabledBanner.tsx`) is rendered by `Layout` above the fixed header on every page and links to the Provider Playbook. It publishes its measured height as the `--top-banner-height` CSS variable, and the header, sidebar drawer, and global body height add that variable to their existing 57px header offset.

No feature flag guards this. The removal is a plain code change so that there is no configuration that could accidentally re-enable builds.

## What did not change

- All wizard step components under `src/components/become-provider/` are untouched. `pages/attributes` and `pages/pricing` still reuse `ProviderAttributes` and `ProviderPricing` from there.
- `provider-console-api` is a separate repository and was not modified. Its `/build-provider` endpoint is not blocked server-side.
- Dashboard, nodes, deployments, settings, API keys, and every other management page work as before.

## How to re-enable provider builds

1. Add `src/pages/become-provider/index.tsx` containing:

   ```tsx
   import { BecomeProvider } from "@src/components/become-provider/BecomeProvider";
   import { withAuth } from "@src/components/shared/withAuth";

   export default withAuth({ WrappedComponent: BecomeProvider, authLevel: "wallet" });
   ```

2. Restore the three entry points removed in PR #3891: the sidebar button, the Get Started stepper link, and the remedies "Restart Provider Build" button. The PR diff is the reference.
3. Remove `ProviderBuildDisabledBanner` from `Layout.tsx` and delete the component and its spec. The `--top-banner-height` offsets in `Nav.tsx`, `Sidebar.tsx`, `Layout.tsx`, and `src/styles/index.css` can stay (they resolve to 0px) or be reverted to the plain 57px values.
