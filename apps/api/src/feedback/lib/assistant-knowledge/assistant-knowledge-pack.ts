export interface KnowledgeDocument {
  id: string;
  title: string;
  source: string;
  markdown: string;
}

/** Bump on every content change, so a stored conversation can tell which pack answered it. */
export const ASSISTANT_KNOWLEDGE_PACK_VERSION = "2026-11-04.1";

export const ASSISTANT_KNOWLEDGE_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: "sdl-essentials",
    title: "SDL essentials",
    source: "Akash SDL reference; apps/api deployment schemas",
    markdown: `
## Structure of an SDL
An SDL (stack definition language) file is YAML with \`version\`, \`services\`, \`profiles\` and \`deployment\`. \`services\` declares containers (image, command, args, env, expose, params). \`profiles.compute\` declares resources per profile: \`cpu.units\`, \`memory.size\`, \`storage.size\`, and optionally \`gpu.units\` with \`attributes.vendor.nvidia\` models. \`profiles.placement\` declares where to run and the price per block. \`deployment\` maps each service to a placement profile and a replica \`count\`.

## Images
Use an explicit image tag such as \`nginx:1.25.3\`. A missing tag means \`latest\`, which makes deployments hard to reproduce and update.

## Exposing ports
\`expose\` lists the container \`port\`, the external port \`as\` (defaults to \`port\`), and \`to\`. \`to: - global: true\` makes the port reachable from the internet. A global HTTP port exposed \`as: 80\` gets a provider hostname (the URI shown in Console) and can take custom domains in \`accept\`. Other global ports are mapped to a random public port on the provider. \`to: - service: <name>\` makes a port reachable only by another service of the same deployment.

## Storage
Storage without attributes is ephemeral: it is lost when the container restarts. Persistent storage is a named volume with \`attributes.persistent: true\` and a \`class\` (\`beta1\` HDD, \`beta2\` SSD, \`beta3\` NVMe), mounted through \`params.storage.<volume>.mount\` on the service. \`ram\` class volumes are memory backed and not persistent.

## GPUs
A GPU is requested with \`gpu.units\` and \`attributes.vendor.nvidia\` listing acceptable models, such as \`- model: a100\`. Listing several models, or none, lets more providers bid. The \`interface\` attribute only accepts \`pcie\` or \`sxm\`.

## What can change after a deployment is created
These can change on a running deployment, without a redeploy: image, command, args, environment variables, secrets, private registry credentials, exposed port numbers and \`as\` ports, custom domains (\`accept\`), HTTP options, and a volume's mount path and read-only flag.

These cannot change on a running deployment: CPU, memory, GPU count or model, storage size, replica count, placement and pricing, and which ports are globally exposed. Changing them needs a new deployment. In Console, redeploy from the deployment's page so the new deployment starts from the same SDL and keeps its stored secrets, then close the old one.
`
  },
  {
    id: "console-deploy",
    title: "Deploying with Console",
    source: "apps/api deployment routes; apps/deploy-web deploy flow",
    markdown: `
## Creating a deployment
Pick a template from the gallery or write an SDL in the deployment editor, then deploy. Console creates the deployment on Akash and funds it from the account's credits. Providers then send bids. Choose a bid to create the lease; billing starts with the lease. Console then sends the manifest to the provider, which starts the containers.

## One-click deploy
Some templates can deploy in one click: Console picks the first provider that bids and creates the lease for you.

## Runtime limit
A deployment can carry a runtime limit of 1 to 48 hours, counted from the lease start. When it runs out, Console closes the deployment and returns unused funds. A limit can be extended by up to 48 hours per request, or removed so the deployment runs until it is closed.

## Updating a running deployment
Open the deployment and change image, command, args, environment variables, ports, domains or storage mounts. Console records the new definition, updates the deployment on Akash and sends the new manifest to the provider. Resource changes need a redeploy (see SDL essentials).

## Send again
When a provider never received the manifest, the deployment page offers "Send again", which sends the manifest to the provider again. There is no container restart action in Console.

## Closing a deployment
Closing stops the containers and the lease, and returns the unused funds to the credit balance. A closed deployment cannot be reopened. Console asks why you are closing it.
`
  },
  {
    id: "console-env-secrets",
    title: "Environment variables, secrets and private registries",
    source: "apps/api sdl-secrets; Akash Console API secrets reference",
    markdown: `
## Environment variables
Environment variables are set per service as \`NAME=value\` entries. They can be added, changed or removed on a running deployment.

## Secrets
A secret is an environment variable whose value Console stores encrypted and never shows again. The value is typed in Console and sealed in the browser before it is sent. In an SDL a secret is referenced as \`NAME=ac-secret://NAME\`. Never paste a secret, token or password into a chat or a support message.

## Private registries
Images from a private registry need credentials on the service: host, username and password. Without them the provider cannot pull the image. Credentials can be set on a running deployment, and the password is stored like a secret.
`
  },
  {
    id: "console-domains",
    title: "Custom domains and URIs",
    source: "apps/api PATCH /v1/deployments expose.accept",
    markdown: `
## Provider URI
A service exposing an HTTP port globally gets a URI from its provider, shown on the deployment page.

## Custom domains
Add your domain to the service's accepted domains (\`accept\`) on the deployment page. Then create a DNS CNAME record at your DNS host pointing the domain at the provider URI of that service.
`
  },
  {
    id: "console-logs-alerts",
    title: "Logs, events and alerts",
    source: "apps/deploy-web deployment page; apps/api notifications",
    markdown: `
## Logs and events
The deployment page shows live logs per service and Kubernetes events (image pulls, container starts, restarts, OOM kills). Console reads them from the provider through your browser session. Logs only exist while the lease is active.

## Alerts
Console can email you when a deployment's escrow balance runs low, when a deployment closes, and when your wallet balance falls below a threshold. Alerts are set on the deployment page or on the Alerts page, and are sent to your email notification channel.
`
  },
  {
    id: "console-billing",
    title: "Credits, billing, auto recharge and the free trial",
    source: "apps/api billing config and wallet settings; Akash Console account reference",
    markdown: `
## Credits
A Console account holds USD credits. Console funds every deployment from them automatically: each deployment's escrow is kept topped up while credits last, so there is nothing to deposit by hand. The balance shows Available credits and Escrow held by running deployments, which returns to Available as they close. When credits run out, running deployments live on what their escrow holds, then close. The fix is to add credits.

## Buying credits
Credits are bought on the Billing page by card. Card entry and 3D Secure happen there.

## Auto recharge
Auto recharge charges your default payment method a set amount whenever the credit balance falls to a threshold. It is turned on and configured on the Billing page.

## Coupons
Coupon codes are redeemed on the Billing page, next to adding credits.

## Free trial
New accounts can start on a free trial with trial credits. Trial deployments are limited in CPU and memory, some GPU models and GPU interconnect are not available, and a trial deployment is closed automatically after a set number of hours. Adding funds ends those limits.
`
  },
  {
    id: "troubleshooting-no-bids",
    title: "Troubleshooting: no bids",
    source: "apps/api bid screening and placement options",
    markdown: `
## Why a deployment gets no bids
Providers bid only when they can meet every requirement of a group: CPU, memory, storage size and class, GPU model and count, region or attributes, and auditor requirements. A deployment waiting longer than a few minutes without bids usually asks for something no provider with free capacity offers right now.

## What to change
Check how many providers could bid with the assistant or the deployment page. Then relax compute requirements, in this order: fewer GPUs (only if the workload can run on fewer), more acceptable GPU models, a different storage class, then less CPU, memory or storage. These need a redeploy. Pricing is your choice and Console does not change it for you.

## Free trial
Some GPU models and GPU interconnect are not available on a free trial, and trial deployments are limited in CPU and memory. Adding funds removes those limits.
`
  },
  {
    id: "troubleshooting-runtime",
    title: "Troubleshooting a running deployment",
    source: "Kubernetes event reasons; apps/api lease status",
    markdown: `
## Image fails to pull
Events show \`ErrImagePull\` or \`ImagePullBackOff\`. The image name or tag is wrong, the image does not exist for the provider's CPU architecture, or it lives in a private registry that needs credentials. Fix the image or tag, or set registry credentials on the service.

## Container crashes or restarts
Events show \`CrashLoopBackOff\` or repeated restarts. Read the last log lines: a missing environment variable, a wrong command or args, or an application error are the usual causes. Fix the env, command or image.

## Out of memory
Events show \`OOMKilled\`. The container used more memory than the profile grants. Memory cannot change on a running deployment, so redeploy with more memory.

## URI unreachable or 502
The provider's ingress reached the service but nothing answered. Check that the application listens on the exposed container port, on 0.0.0.0 rather than 127.0.0.1, and that the service is ready in the lease status. A wrong port can be fixed by updating the exposed port. If the service is ready and listening and the URI still fails, the provider may have an issue: ask on Discord.

## Lease closed unexpectedly
A lease closes when the owner closes it, when its escrow runs out of funds, when Console closes it (runtime limit reached, free trial ended, provider unreachable, or no lease created), or when the provider closes it (for example manifest timeout or decommission). The close reason and Console's activity tell which. Redeploy to run the workload again.

## Provider reclaiming capacity
A provider can start reclaiming a lease that allows reclamation. The lease then shows a reclamation deadline, and closes after it. Redeploy elsewhere before the deadline to avoid downtime.
`
  }
];
