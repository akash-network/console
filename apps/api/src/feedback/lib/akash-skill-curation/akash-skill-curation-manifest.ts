import type { SkillCurationManifest } from "./akash-skill-curation";

const SDL = "skills/akash/rules/sdl";
const REFERENCE = "skills/akash/rules/reference";

/** Keeps three retrieved chunks inside the 8,000 character tool result limit of `search_docs`. */
const MAX_CHUNK_LENGTH = 1_800;

export const AKASH_SKILL_CURATION_MANIFEST: SkillCurationManifest = {
  repository: "akash-network/akash-skill",
  version: "v3.8.0",
  commit: "7bc7e5aa11edccbe285a95bab2dd5dbb5f6cccac",
  license: "MIT",
  maxChunkLength: MAX_CHUNK_LENGTH,
  files: [
    {
      path: `${SDL}/schema-overview.md`,
      id: "akash-sdl-overview",
      title: "Akash SDL overview",
      sections: [
        { heading: "## Version Requirement", title: "SDL version 2.0 and 2.1" },
        { heading: "## Basic Structure", title: "SDL structure" },
        { heading: "## Section Dependencies", title: "How SDL sections reference each other" }
      ]
    },
    {
      path: `${SDL}/examples/web-app.md`,
      id: "akash-sdl-example-web",
      title: "Akash SDL example: web app",
      sections: [{ heading: "## SDL Configuration", title: "Complete SDL for a web app" }]
    },
    {
      path: `${SDL}/services.md`,
      id: "akash-sdl-services",
      title: "Akash SDL services",
      sections: [
        { heading: "### image (required)", title: "Image and tag" },
        { heading: "### command (optional)", title: "Command" },
        { heading: "### args (optional)", title: "Args" },
        {
          heading: "### env (optional)",
          title: "Environment variables",
          consoleNote: "store passwords, tokens and keys as secrets (`NAME=ac-secret://NAME`) so their values are encrypted and never shown again."
        },
        { heading: "### expose (required for accessible services)", title: "Exposing ports", omit: ["#### HTTP Options"] },
        { heading: "#### HTTP Options", title: "HTTP options: body size, timeouts and retries", omit: ["##### Proxy Tuning"] },
        {
          heading: "### credentials (optional)",
          title: "Private registry credentials",
          consoleNote: "the registry password is stored like a secret and can be set on a running deployment."
        },
        { heading: "### dependencies (optional)", title: "Service dependencies and startup order" },
        { heading: "## Service-to-Service Communication", title: "Service-to-service communication" }
      ]
    },
    {
      path: `${SDL}/compute-resources.md`,
      id: "akash-sdl-compute",
      title: "Akash SDL compute resources",
      sections: [
        { heading: "## CPU Configuration", title: "CPU units", omit: ["### CPU Architecture", "### CPU Constraints"] },
        { heading: "### CPU Architecture", title: "CPU architecture: amd64 or arm64" },
        { heading: "### CPU Constraints", title: "CPU architecture rules" },
        { heading: "## Memory Configuration", title: "Memory size units" },
        { heading: "### Simple Storage", title: "Ephemeral storage" },
        { heading: "### Named Storage Volumes", title: "Named storage volumes" },
        { heading: "### Storage Attributes", title: "Storage attributes: persistent and class" },
        { heading: "### Storage Constraints", title: "Storage class rules" },
        { heading: "### GPU Attributes", title: "Request a GPU in the SDL: model, VRAM and interface" },
        { heading: "### GPU Constraints", title: "GPU vendor rules" }
      ]
    },
    {
      path: `${SDL}/examples/gpu-workload.md`,
      id: "akash-sdl-example-gpu",
      title: "Akash SDL example: GPU workload",
      sections: [
        { heading: "## Basic GPU SDL", title: "Complete SDL for a GPU workload" },
        { heading: "## Best Practices", title: "GPU workload best practices" }
      ]
    },
    {
      path: `${REFERENCE}/gpu-models.md`,
      id: "akash-gpu-models",
      title: "Akash GPU models",
      sections: [
        { heading: "### Data Center GPUs", title: "Data center GPU models" },
        { heading: "### Consumer/Prosumer GPUs", title: "Consumer GPU models" },
        { heading: "### Interface Options", title: "GPU interface: pcie or sxm" },
        { heading: "### GPU Requirements", title: "Multi-GPU requirements" }
      ]
    },
    {
      path: `${REFERENCE}/storage-classes.md`,
      id: "akash-storage",
      title: "Akash persistent storage",
      sections: [
        {
          heading: "## Available Storage Classes",
          title: "Storage classes: beta1, beta2, beta3 and ram",
          consoleNote:
            "persistent storage survives container restarts on the same lease. It is deleted when the deployment closes or moves to another provider, so back up data you need to keep."
        },
        { heading: "### Mounting Volumes", title: "Mounting a persistent volume" },
        { heading: "## Provider Availability", title: "Providers that offer a storage class" }
      ]
    },
    {
      path: `${SDL}/examples/wordpress-db.md`,
      id: "akash-sdl-example-database",
      title: "Akash SDL example: app with a database",
      sections: [
        { heading: "### Service Communication", title: "Connecting an app to its database" },
        { heading: "### Persistent Storage", title: "Database storage that survives restarts" },
        { heading: "### Storage Mounting", title: "Mounting database storage" }
      ]
    },
    {
      path: `${SDL}/placement-pricing.md`,
      id: "akash-placement",
      title: "Akash SDL placement",
      sections: [
        {
          heading: "### attributes (optional)",
          title: "Placement attributes",
          consoleNote:
            "every attribute narrows the providers that can bid, and with `signedBy` an auditor must also have signed it. Remove attributes the workload does not need when nobody bids."
        },
        {
          heading: "### signedBy (optional)",
          title: "Auditors and signedBy",
          consoleNote:
            "Console only leases from providers audited by the Akash auditor `akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63`, so a placement that only allows other auditors gets no bids Console can accept."
        },
        { heading: "### pricing (required)", title: "Pricing per block" },
        { heading: "### Price Calculation", title: "How the price is calculated" }
      ]
    },
    {
      path: `${SDL}/deployment.md`,
      id: "akash-sdl-deployment",
      title: "Akash SDL deployment section",
      sections: [
        { heading: "### count (required)", title: "Replica count" },
        { heading: "## Matching Rules", title: "Deployment section rules" },
        { heading: "## Scaling Considerations", title: "Scaling replicas" }
      ]
    },
    {
      path: `${SDL}/endpoints.md`,
      id: "akash-ip-endpoints",
      title: "Akash IP endpoints",
      sections: [
        { heading: "## Basic Structure", title: "Leasing a dedicated IP" },
        { heading: "## Endpoint Rules", title: "IP endpoint rules" },
        { heading: "## Cost Considerations", title: "IP endpoint cost" }
      ]
    },
    {
      path: `${SDL}/reclamation.md`,
      id: "akash-reclamation",
      title: "Akash resource reclamation",
      sections: [
        { heading: "## The block", title: "Reclamation window in the SDL" },
        { heading: "## When to use", title: "When to set a reclamation window" }
      ]
    },
    {
      path: "skills/akash/rules/bid-matching/adaptation-rules.md",
      id: "akash-no-bids",
      title: "Akash: widening the bid pool",
      sections: [
        { heading: "## What to leave alone — pricing and denom", title: "Pricing is not a lever for bids" },
        { heading: "## What to leave alone — CPU architecture", title: "Keep the CPU architecture" },
        { heading: "### 1. Reduce GPU count, keep the requested model", title: "First reduce the GPU count" },
        { heading: "### 2. Add fallback GPU models *of similar or larger memory*", title: "Then add GPU models with enough memory" },
        { heading: "### 3. Drop the model constraint entirely", title: "Last, accept any GPU model" },
        { heading: "### 4. Storage class", title: "Storage class and bids" },
        { heading: "### 5. Persistent storage", title: "Persistent storage and bids" },
        { heading: "### 6. IP endpoints", title: "IP endpoints and bids" },
        { heading: "### 7. CPU/memory size", title: "CPU and memory size and bids" },
        { heading: "## When changes are exhausted", title: "When nothing more can be relaxed" }
      ]
    },
    {
      path: "skills/akash/rules/terminology.md",
      id: "akash-terms",
      title: "Akash terms",
      sections: [
        { heading: "### DSEQ (Deployment Sequence)", title: "DSEQ" },
        { heading: "### Manifest", title: "Manifest" },
        { heading: "### Bid", title: "Bid" },
        { heading: "### Lease", title: "Lease" },
        { heading: "### Auditor", title: "Auditor" },
        {
          heading: "### Lease States",
          title: "Lease states",
          consoleNote: "Console refills escrow from the account's credits, so a lease only runs out of funds when the credits do."
        }
      ]
    }
  ],
  corrections: [
    { find: "denom: uakt", replace: "denom: uact" },
    { find: " (resource reclamation, see below)", replace: " (resource reclamation)" },
    {
      find: "**Must include an explicit tag** - the `latest` tag is not allowed.",
      replace:
        "**Use an explicit tag.** Console accepts `latest` or no tag, but the provider then runs whatever the tag points to when it pulls the image, so updates and redeploys are not reproducible."
    },
    {
      find: "**Important:** Do not use `:latest` or omit the tag. Akash requires explicit tags for reproducible deployments.",
      replace: "**Important:** Pin a version tag rather than `:latest` or no tag, so every redeploy runs the same image."
    },
    { find: " See `rules/bid-matching/adaptation-rules.md`.", replace: "" },
    { find: "- Higher counts require more resources and higher pricing budget", replace: "- Higher counts need more resources and spend more credits" },
    {
      find: " The matcher's job is to align compute requirements (CPU/memory/storage/GPU/feature flags) with provider supply.",
      replace: " Bids come from aligning compute requirements (CPU, memory, storage, GPU and features) with provider supply."
    },
    { find: " Always re-run the matcher after a class change.", replace: " Check provider availability again after a class change." },
    { find: "The providers endpoint does **not** expose which denoms a provider accepts", replace: "Providers do not publish which denoms they accept" },
    { find: " Class support is read from `attributes[]` keys `capabilities/storage/<N>/class` (paired with `.../persistent`).", replace: "" },
    {
      find: "Verify the provider has `featPersistentStorage=true` (or attribute `feat-persistent-storage=true`) before assuming a persistent volume will land.",
      replace: "Fewer providers offer persistent storage, so a persistent volume narrows the pool."
    },
    { find: "`featEndpointIp` is relatively rare; avoid if not essential.", replace: "Few providers offer IP endpoints; avoid them if not essential." },
    { find: "aren't visible in the providers endpoint and aren't fixable", replace: "aren't visible before deploying and aren't fixable" },
    { find: "A `cpu_arch` plateau", replace: "A CPU architecture plateau" },
    {
      find: "this lever is unavailable — say so explicitly and skip to step 2.",
      replace: "this lever is unavailable — say so explicitly and add GPU models instead."
    },
    { find: "Only after step 1.", replace: "Only after reducing the GPU count." },
    { find: "Only if step 2 still yields nothing", replace: "Only if adding models still yields nothing" },
    {
      find: "The value maps to `DeploymentReclamation` (field 5 on `MsgCreateDeployment`). When the\nblock is omitted the field is nil and the deployment carries no reclamation\nrequirement.",
      replace: "Without the block, the deployment carries no reclamation requirement."
    },
    { find: "`Reclaiming` and the paused-group state below only appear on v2.1.0+ leases; pre-2.1\nleases never enter them.", replace: "" },
    {
      find: "Require providers to be audited:",
      replace:
        "Require the placement attributes to be signed by an auditor. A provider only matches when one of the listed auditors has signed every attribute the placement asks for, so an attribute or auditor that no provider with free capacity has gets no bids:"
    }
  ],
  guards: [
    { pattern: /uakt/, reason: "mentions uakt: SDL pricing is always uact" },
    { pattern: /deposit/i, reason: "mentions a deposit: Console funds escrow from credits, users never deposit" },
    { pattern: /bid-screening|"resources"\s*:\s*\[\s*\{\s*"resources"/, reason: "documents the bid screening request, whose shape in the skill was outdated" },
    { pattern: /latest` tag is not allowed|tag not allowed|requires explicit tags/i, reason: "claims a latest tag is rejected: Console accepts it" },
    { pattern: /higher pric|pric\w*.{0,20}too low|raise the price|increase the price/i, reason: "suggests changing the price to get bids" },
    { pattern: /provider-services|\bakt [a-z]|--from\b|keys add|mnemonic|keyring|MsgStartGroup|MsgCloseLease/, reason: "describes a CLI or self-custody flow" },
    { pattern: /akashml/i, reason: "describes AkashML, which is not part of Console deployments" },
    { pattern: /x-api-key|curl |console-api\.akash\.network/, reason: "describes the Console API instead of the Console UI" },
    { pattern: /matcher|match_providers|scripts\/|rules\/|\.md\b|@\w+\.md/, reason: "refers to a skill file or script the assistant cannot use" },
    { pattern: /buffering_disable|proxy_buffer/, reason: "documents proxy tuning, which no provider applies yet" }
  ]
};
