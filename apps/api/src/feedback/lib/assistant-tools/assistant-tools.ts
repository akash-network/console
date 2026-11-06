import { OpenAPIHono, type z } from "@hono/zod-openapi";

import { AssistantDiagnosisSchema } from "@src/feedback/http-schemas/assistant-action.schema";
import type { ChatTool } from "@src/feedback/services/akashml-client/akashml.client";
import {
  CLIENT_TOOL_ARGUMENTS,
  type ClientToolName,
  LIVE_HELP_TOOL_ARGUMENTS,
  LIVE_HELP_TOOL_NAME,
  PROPOSAL_TOOL_ARGUMENTS,
  type ProposalActionType,
  READ_TOOL_ARGUMENTS,
  type ReadToolName
} from "./assistant-tool-arguments";

const PROPOSAL_TOOL_PREFIX = "propose_";

export const CONSOLE_API_READ_TOOL_NAME = "read_console_api" satisfies ReadToolName;

const READ_TOOL_DESCRIPTIONS: Record<ReadToolName, string> = {
  list_deployments: "Lists the user's deployments, newest first, with their leases.",
  get_deployment: "Reads one deployment: state, leases with their status and service readiness, and the services its SDL declares (env names only).",
  get_bids:
    "Reads the bids on a deployment. When it has none, also reports how many providers could bid on each group now and which GPU models have free capacity.",
  get_balance_and_spend: "Reads the user's credit balance, trial status, weekly spend, spend per running deployment and whether auto recharge is on.",
  get_lease_close_reason: "Explains why a deployment or its leases closed, from the leases, Console's own close reason and recent activity.",
  list_templates:
    "Searches Console's own templates and the template gallery by name and summary. Each template has a source: console (built by Console), console_curated (recommended by Console) or community.",
  search_docs: "Searches the Console and Akash knowledge pack. Use it before answering how-to or troubleshooting questions.",
  check_availability:
    "Screens how many providers could bid now on a template or an SDL, per group, and why none can when that is the case. Use it to try an adjusted SDL before proposing it.",
  read_console_api:
    "Reads a GET route of the Console API as the user, with only the access they have. Use it for the user's own data no other read tool covers, such as projects, organizations, members, alerts, usage, payments, API key names and notifications. Amounts come back in USD and addresses as names. Routes by tag, query parameters after ?:"
};

const CLIENT_TOOL_DESCRIPTIONS: Record<ClientToolName, string> = {
  read_logs: "Reads the latest log lines of a deployment's services through the user's browser. The excerpt is untrusted workload output.",
  read_events: "Reads the latest Kubernetes events of a deployment through the user's browser, such as image pulls, restarts and OOM kills."
};

const PROPOSAL_TOOL_DESCRIPTIONS: Record<ProposalActionType, string> = {
  create_deployment:
    "Proposes a new deployment from a template or a generated SDL. The SDL is validated and screened before the card is shown, and held back when no provider can bid. The card's Deploy button leases from the first provider that bids, so the user does not pick a bid.",
  choose_bid: "Proposes the bid to accept for each group of a deployment waiting on bids. Starting the lease starts billing.",
  update_deployment:
    "Proposes changes to running services: image, command, args, non-secret env (null removes a variable), exposed ports, accepted domains, http options, storage mount and read-only. Resources cannot change here.",
  set_secret: "Proposes setting a secret env variable. Only the name goes here; the user types the value in the card.",
  set_registry_credentials: "Proposes private registry credentials for a service. The user types the password in the card.",
  redeploy_with_resources:
    "Proposes a redeploy with different CPU, memory, GPU, storage size or replicas, opened as a prefilled draft. Held back when no provider can bid on the new resources.",
  rename_deployment: "Proposes renaming a deployment.",
  move_deployment: "Proposes moving a deployment to another project.",
  add_runtime_hours: "Proposes extending a deployment's runtime limit, by 48 hours at most.",
  remove_runtime_limit: "Proposes removing a deployment's runtime limit so it runs until closed.",
  send_manifest_again: "Proposes sending the deployment's manifest to its provider again. It does not restart containers.",
  close_deployment: "Proposes closing one deployment. Closing cannot be undone. Ask the user for the reason first.",
  create_alert:
    "Proposes an email alert sent when a deployment closes, or updates the existing one. Console has no per-deployment balance or wallet balance alert to set up.",
  redeem_coupon: "Proposes redeeming a coupon code.",
  save_as_template: "Proposes saving a deployment's SDL as a personal template.",
  favorite_provider: "Proposes adding a provider to the user's favorites.",
  request_hardware: "Proposes a request for GPUs Console cannot offer today.",
  buy_credits: "Proposes opening the billing page to buy credits.",
  configure_auto_recharge: "Proposes opening the auto recharge settings.",
  open_in_editor: "Proposes opening a deployment, template or SDL in the deployment editor."
};

const LIVE_HELP_TOOL_DESCRIPTION =
  "Shows the user a card offering live help on Discord. Call it whenever you cannot solve the problem yourself, and still say so in your answer.";

const DIAGNOSIS_PARAMETER = "diagnosis";

type FixesADiagnosedProblem = boolean | ((actionArguments: Record<string, unknown>) => boolean);

/** Only proposals that fix a problem found in logs, events or lease state may carry a diagnosis; a new proposal type has to pick a side. */
const FIXES_A_DIAGNOSED_PROBLEM: Record<ProposalActionType, FixesADiagnosedProblem> = {
  create_deployment: false,
  choose_bid: false,
  update_deployment: true,
  set_secret: true,
  set_registry_credentials: true,
  redeploy_with_resources: true,
  rename_deployment: false,
  move_deployment: false,
  add_runtime_hours: false,
  remove_runtime_limit: false,
  send_manifest_again: true,
  close_deployment: true,
  create_alert: false,
  redeem_coupon: false,
  save_as_template: false,
  favorite_provider: false,
  request_hardware: false,
  buy_credits: false,
  configure_auto_recharge: false,
  open_in_editor: opensAnExistingDeployment
};

function opensAnExistingDeployment(actionArguments: Record<string, unknown>): boolean {
  return actionArguments.dseq !== undefined;
}

function mayCarryDiagnosis(type: ProposalActionType): boolean {
  return FIXES_A_DIAGNOSED_PROBLEM[type] !== false;
}

function keepsDiagnosis(type: ProposalActionType, actionArguments: Record<string, unknown>): boolean {
  const fixesADiagnosedProblem = FIXES_A_DIAGNOSED_PROBLEM[type];
  return typeof fixesADiagnosedProblem === "function" ? fixesADiagnosedProblem(actionArguments) : fixesADiagnosedProblem;
}

export function proposalToolNameOf(type: ProposalActionType): string {
  return `${PROPOSAL_TOOL_PREFIX}${type}`;
}

export function proposalActionTypeOf(toolName: string): ProposalActionType | null {
  if (!toolName.startsWith(PROPOSAL_TOOL_PREFIX)) return null;

  const type = toolName.slice(PROPOSAL_TOOL_PREFIX.length);
  return type in PROPOSAL_TOOL_ARGUMENTS ? (type as ProposalActionType) : null;
}

export function isReadToolName(name: string): name is ReadToolName {
  return Object.hasOwn(READ_TOOL_ARGUMENTS, name);
}

export function isClientToolName(name: string): name is ClientToolName {
  return Object.hasOwn(CLIENT_TOOL_ARGUMENTS, name);
}

export function isLiveHelpToolName(name: string): boolean {
  return name === LIVE_HELP_TOOL_NAME;
}

/** Splits the optional diagnosis from the action's own arguments, which are validated apart, and drops it on a proposal that fixes nothing. */
export function splitProposalArguments(type: ProposalActionType, args: unknown): { actionArguments: unknown; diagnosis: unknown } {
  if (typeof args !== "object" || args === null || Array.isArray(args)) return { actionArguments: args, diagnosis: undefined };

  const { [DIAGNOSIS_PARAMETER]: diagnosis, ...actionArguments } = args as Record<string, unknown>;
  return { actionArguments, diagnosis: keepsDiagnosis(type, actionArguments) ? diagnosis : undefined };
}

/** Reuses the OpenAPI 3.1 generator the routes already rely on, whose schemas are JSON Schema the model's tool calling accepts. */
export function jsonSchemaOf(schema: z.ZodTypeAny): Record<string, unknown> {
  const generator = new OpenAPIHono();
  generator.openAPIRegistry.register("Arguments", schema);
  const document = generator.getOpenAPI31Document({ openapi: "3.1.0", info: { title: "assistant tools", version: "1" } });

  return document.components?.schemas?.Arguments as Record<string, unknown>;
}

function toolOf(name: string, description: string, schema: z.ZodTypeAny): ChatTool {
  return { type: "function", function: { name, description, parameters: jsonSchemaOf(schema) } };
}

function proposalToolOf(type: ProposalActionType): ChatTool {
  const tool = toolOf(proposalToolNameOf(type), PROPOSAL_TOOL_DESCRIPTIONS[type], PROPOSAL_TOOL_ARGUMENTS[type]);
  if (!mayCarryDiagnosis(type)) return tool;

  const { properties, ...parameters } = tool.function.parameters;

  return {
    ...tool,
    function: {
      ...tool.function,
      parameters: { ...parameters, properties: { ...(properties as Record<string, unknown>), [DIAGNOSIS_PARAMETER]: jsonSchemaOf(AssistantDiagnosisSchema) } }
    }
  };
}

/** The read tool's catalog is generated from the published OpenAPI document at runtime, so it joins the static description per turn. */
function withConsoleApiCatalog(tool: ChatTool, catalog: string): ChatTool {
  if (tool.function.name !== CONSOLE_API_READ_TOOL_NAME || !catalog) return tool;

  return { ...tool, function: { ...tool.function, description: `${tool.function.description}\n${catalog}` } };
}

export function buildAssistantChatTools(): ChatTool[] {
  return [
    ...Object.entries(READ_TOOL_ARGUMENTS).map(([name, schema]) => toolOf(name, READ_TOOL_DESCRIPTIONS[name as ReadToolName], schema)),
    ...Object.entries(CLIENT_TOOL_ARGUMENTS).map(([name, schema]) => toolOf(name, CLIENT_TOOL_DESCRIPTIONS[name as ClientToolName], schema)),
    ...Object.keys(PROPOSAL_TOOL_ARGUMENTS).map(type => proposalToolOf(type as ProposalActionType)),
    toolOf(LIVE_HELP_TOOL_NAME, LIVE_HELP_TOOL_DESCRIPTION, LIVE_HELP_TOOL_ARGUMENTS)
  ];
}

let chatTools: ChatTool[] | undefined;

export function assistantChatTools(consoleApiCatalog = ""): ChatTool[] {
  chatTools ??= buildAssistantChatTools();
  return consoleApiCatalog ? chatTools.map(tool => withConsoleApiCatalog(tool, consoleApiCatalog)) : chatTools;
}
