import { isHttpError } from "http-errors";
import { randomUUID } from "node:crypto";
import { inject, singleton } from "tsyringe";
import { z, ZodError, type ZodIssue } from "zod";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { type AssistantAction, type AssistantDiagnosis, AssistantDiagnosisSchema } from "@src/feedback/http-schemas/assistant-action.schema";
import type { AssistantLiveHelpReason } from "@src/feedback/http-schemas/assistant-conversation.schema";
import { assistantKnowledge } from "@src/feedback/lib/assistant-knowledge/assistant-knowledge";
import { AssistantProposalWithheldError, AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import {
  CLIENT_TOOL_ARGUMENTS,
  type ClientToolArguments,
  type ClientToolName,
  LIVE_HELP_TOOL_ARGUMENTS,
  type LIVE_HELP_TOOL_NAME,
  PROPOSAL_TOOL_ARGUMENTS,
  READ_TOOL_ARGUMENTS,
  type ReadToolArguments,
  type ReadToolName
} from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import {
  assistantChatTools,
  CONSOLE_API_READ_TOOL_NAME,
  isClientToolName,
  isLiveHelpToolName,
  isReadToolName,
  proposalActionTypeOf,
  splitProposalArguments
} from "@src/feedback/lib/assistant-tools/assistant-tools";
import { redactSecrets } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { ChatTool, ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";
import { AssistantAccountToolsService } from "@src/feedback/services/assistant-account-tools/assistant-account-tools.service";
import { AssistantBidToolsService } from "@src/feedback/services/assistant-bid-tools/assistant-bid-tools.service";
import { AssistantConsoleApiService } from "@src/feedback/services/assistant-console-api/assistant-console-api.service";
import { AssistantDeploymentToolsService } from "@src/feedback/services/assistant-deployment-tools/assistant-deployment-tools.service";
import { AssistantProposalService, type ProposalContext } from "@src/feedback/services/assistant-proposal/assistant-proposal.service";

export const MAX_TOOL_RESULT_LENGTH = 8_000;
const TRUNCATION_MARK = "...[truncated]";
const DiagnosisArgumentSchema = z.object({ diagnosis: AssistantDiagnosisSchema.optional() });
const FAILED_TOOL_MESSAGE = "The tool failed. Tell the user this data could not be read right now.";
const WITHHELD_PROPOSAL_NOTE =
  "No provider can bid on this, so the user did not see a card. Propose an adjusted SDL that has bidders, keeping its price and denom: drop placement attributes no audited provider signed, change resources the user did not ask for, or pick another template, after at most two availability checks. If nothing fits, say which requirement no provider meets right now, and offer request_hardware or a smaller alternative.";
const TEMPLATE_SDL_LEFT_OUT_NOTE = "The template's SDL is too long to include here, so pick another template or explain why nothing fits.";
const RETRY_ONCE_HINT = "Call it once more with corrected arguments, or answer without it.";

export type ClientToolCall = { [K in ClientToolName]: { id: string; name: K; arguments: ClientToolArguments<K> } }[ClientToolName];

export type ToolOutcome =
  | { kind: "result"; content: string; summary: string; ok: boolean }
  | { kind: "proposal"; content: string; summary: string; ok: true; proposalId: string; action: AssistantAction; diagnosis?: AssistantDiagnosis }
  | { kind: "live_help"; content: string; reason: AssistantLiveHelpReason }
  | { kind: "client"; call: ClientToolCall };

export function truncated(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - TRUNCATION_MARK.length)}${TRUNCATION_MARK}`;
}

/** Tool results reach the model as JSON data, redacted and bounded, so their content cannot pass for instructions or flood the context. */
export function toolContentOf(tool: string, payload: { data: unknown } | { error: string }): string {
  return truncated(redactSecrets(JSON.stringify({ tool, ...payload })), MAX_TOOL_RESULT_LENGTH);
}

function fitsToolResult(tool: string, payload: { data: unknown }): boolean {
  return redactSecrets(JSON.stringify({ tool, ...payload })).length <= MAX_TOOL_RESULT_LENGTH;
}

/** Leaves out a template SDL too long for the result cap, since a cut payload would reach the model as broken JSON without its note. */
function withheldContentOf(tool: string, { templateSdl, ...feedback }: Record<string, unknown>): string {
  const payload = { data: { shownToUser: false, ...feedback, templateSdl, note: WITHHELD_PROPOSAL_NOTE } };
  if (fitsToolResult(tool, payload)) return toolContentOf(tool, payload);

  return toolContentOf(tool, { data: { shownToUser: false, ...feedback, note: `${WITHHELD_PROPOSAL_NOTE} ${TEMPLATE_SDL_LEFT_OUT_NOTE}` } });
}

type DedicatedReadToolName = Exclude<ReadToolName, typeof CONSOLE_API_READ_TOOL_NAME>;

function summaryOf(name: DedicatedReadToolName, args: Record<string, unknown>): string {
  const summaries: Record<DedicatedReadToolName, string> = {
    list_deployments: "Read your deployments",
    get_deployment: `Read deployment ${args.dseq}`,
    get_bids: `Read the bids on deployment ${args.dseq}`,
    get_balance_and_spend: "Read your balance and spend",
    get_lease_close_reason: `Read why deployment ${args.dseq} closed`,
    list_templates: "Searched the template gallery",
    search_docs: "Searched the Console docs",
    check_availability: "Checked which providers could bid"
  };

  return summaries[name];
}

const FAILED_SUMMARIES: Record<ReadToolName | ClientToolName | typeof LIVE_HELP_TOOL_NAME, string> = {
  list_deployments: "Could not read your deployments",
  get_deployment: "Could not read the deployment",
  get_bids: "Could not read the bids",
  get_balance_and_spend: "Could not read your balance and spend",
  get_lease_close_reason: "Could not read why the deployment closed",
  list_templates: "Could not search the template gallery",
  search_docs: "Could not search the Console docs",
  check_availability: "Could not check which providers could bid",
  read_console_api: "Could not read your Console data",
  read_logs: "Could not read the logs",
  read_events: "Could not read the events",
  suggest_live_help: "Could not suggest live help"
};

function failedSummaryOf(name: string): string {
  if (Object.hasOwn(FAILED_SUMMARIES, name)) return FAILED_SUMMARIES[name as keyof typeof FAILED_SUMMARIES];

  const type = proposalActionTypeOf(name);
  return type ? `Could not propose ${type.replaceAll("_", " ")}` : "Could not use a tool the assistant does not have";
}

/** Evidence is quoted from logs and events the user's workload wrote, so it is redacted like any tool result before the user or the team sees it. */
function redactedDiagnosisOf(diagnosis: unknown): AssistantDiagnosis | undefined {
  const parsed = DiagnosisArgumentSchema.parse({ diagnosis }).diagnosis;
  if (!parsed) return undefined;

  const evidence = parsed.evidence.filter(line => line.trim());
  return evidence.length > 0 ? { summary: redactSecrets(parsed.summary), evidence: evidence.map(redactSecrets) } : undefined;
}

function rejectionOf(error: unknown): string | null {
  if (error instanceof AssistantToolError) return error.message;
  if (isHttpError(error) && error.status < 500) return error.message;

  return null;
}

/** A YAML parse error quotes the SDL lines around the fault after its first line, so only that first line reaches the logs. */
function loggedRejectionOf(rejection: string): string {
  return redactSecrets(rejection.split("\n", 1)[0]);
}

class AssistantToolArgumentsRejectedError extends Error {
  constructor(readonly issues: ZodIssue[]) {
    super("The tool arguments were rejected");
  }
}

/** Only argument validation counts as a rejection, so a schema error from a downstream service still reads as a tool failure. */
function validArguments<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ZodError) throw new AssistantToolArgumentsRejectedError(error.issues);
    throw error;
  }
}

function parsedArguments(call: ChatToolCall): unknown {
  try {
    return JSON.parse(call.function.arguments || "{}");
  } catch {
    throw new AssistantToolArgumentsRejectedError([{ code: "custom", path: [], message: "The arguments are not valid JSON" }]);
  }
}

function propertyNamesOf(schema: unknown): string[] {
  if (!schema || typeof schema !== "object") return [];

  const { properties } = schema as { properties?: object };
  return [...Object.keys(properties ?? {}), ...Object.values(schema).flatMap(propertyNamesOf)];
}

/** Record keys such as service names come from the arguments, so only the tools' own parameter names reach the log. */
function loggedPathOf(path: (string | number)[]): string {
  const parameterNames = new Set(assistantChatTools().flatMap(tool => propertyNamesOf(tool.function.parameters)));
  return path.map(segment => (typeof segment === "number" || parameterNames.has(segment) ? segment : "*")).join(".") || "(root)";
}

@singleton()
export class AssistantToolRunnerService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentTools: AssistantDeploymentToolsService,
    private readonly bidTools: AssistantBidToolsService,
    private readonly accountTools: AssistantAccountToolsService,
    private readonly consoleApi: AssistantConsoleApiService,
    private readonly proposalService: AssistantProposalService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AssistantToolRunnerService.name });
  }

  /** Falls back to the tools without the route catalog, so a docs outage costs the assistant one tool's catalog rather than the turn. */
  async chatTools(): Promise<ChatTool[]> {
    try {
      return assistantChatTools(await this.consoleApi.catalog());
    } catch (error) {
      this.#logger.warn({ event: "ASSISTANT_CONSOLE_API_CATALOG_FAILED", error });
      return assistantChatTools();
    }
  }

  async run(call: ChatToolCall, context: ProposalContext): Promise<ToolOutcome> {
    const name = call.function.name;

    try {
      return await this.#run(call, context);
    } catch (error) {
      if (error instanceof AssistantProposalWithheldError) {
        return {
          kind: "result",
          content: withheldContentOf(name, error.feedback),
          summary: "Held back a proposal no provider can bid on",
          ok: false
        };
      }

      return { kind: "result", content: toolContentOf(name, { error: this.#reasonOf(name, error) }), summary: failedSummaryOf(name), ok: false };
    }
  }

  async #run(call: ChatToolCall, context: ProposalContext): Promise<ToolOutcome> {
    const name = call.function.name;
    const args = parsedArguments(call);

    if (isReadToolName(name)) {
      const parsed = validArguments(() => READ_TOOL_ARGUMENTS[name].parse(args));
      const { data, summary } =
        name === CONSOLE_API_READ_TOOL_NAME
          ? await this.consoleApi.read(parsed as ReadToolArguments<typeof CONSOLE_API_READ_TOOL_NAME>)
          : { data: await this.#read(name, parsed, context), summary: summaryOf(name, parsed) };

      return { kind: "result", content: toolContentOf(name, { data }), summary, ok: true };
    }

    if (isClientToolName(name)) {
      return { kind: "client", call: { id: call.id, name, arguments: validArguments(() => CLIENT_TOOL_ARGUMENTS[name].parse(args)) } as ClientToolCall };
    }

    if (isLiveHelpToolName(name)) {
      const { reason } = validArguments(() => LIVE_HELP_TOOL_ARGUMENTS.parse(args));
      return {
        kind: "live_help",
        content: toolContentOf(name, {
          data: { shownToUser: true, note: "The user now sees a Discord card. Ask one or two short questions about what they were trying to do." }
        }),
        reason
      };
    }

    const type = proposalActionTypeOf(name);
    if (!type) throw new AssistantToolError(`There is no tool named ${name}.`);

    const { actionArguments, diagnosis } = splitProposalArguments(type, args);
    const redactedDiagnosis = validArguments(() => redactedDiagnosisOf(diagnosis));
    const action = await this.proposalService.propose(
      type,
      validArguments(() => PROPOSAL_TOOL_ARGUMENTS[type].parse(actionArguments)),
      context
    );
    const proposalId = randomUUID();

    return {
      kind: "proposal",
      content: toolContentOf(name, { data: { proposalId, shownToUser: true, note: "The user now sees a card and decides. Do not claim it is done." } }),
      summary: `Proposed ${type.replaceAll("_", " ")}`,
      ok: true,
      proposalId,
      action,
      ...(redactedDiagnosis && { diagnosis: redactedDiagnosis })
    };
  }

  async #read(name: DedicatedReadToolName, args: unknown, context: ProposalContext): Promise<unknown> {
    switch (name) {
      case "list_deployments":
        return await this.deploymentTools.listDeployments(args as ReadToolArguments<"list_deployments">);
      case "get_deployment":
        return await this.deploymentTools.getDeployment(args as ReadToolArguments<"get_deployment">);
      case "get_lease_close_reason":
        return await this.deploymentTools.getLeaseCloseReason(args as ReadToolArguments<"get_lease_close_reason">);
      case "get_bids":
        return await this.bidTools.getBids(args as ReadToolArguments<"get_bids">);
      case "get_balance_and_spend":
        return await this.accountTools.getBalanceAndSpend(args as ReadToolArguments<"get_balance_and_spend">);
      case "list_templates":
        return await this.accountTools.listTemplates(args as ReadToolArguments<"list_templates">);
      case "search_docs":
        return assistantKnowledge.search((args as ReadToolArguments<"search_docs">).query);
      case "check_availability":
        return await this.#checkAvailability(args as ReadToolArguments<"check_availability">, context);
    }
  }

  async #checkAvailability({ templateId, sdl }: ReadToolArguments<"check_availability">, context: ProposalContext) {
    const checkedSdl = sdl ? this.proposalService.pricedSdl(sdl, context) : await this.accountTools.templateSdl(templateId as string);
    return await this.bidTools.checkAvailability(checkedSdl, { isTrialing: context.isTrialing === true });
  }

  #reasonOf(tool: string, error: unknown): string {
    if (error instanceof AssistantToolArgumentsRejectedError) return this.#rejectedArgumentsReasonOf(tool, error.issues);
    const rejection = rejectionOf(error);
    if (rejection === null) {
      this.#logger.warn({ event: "ASSISTANT_TOOL_FAILED", tool, error });
      return FAILED_TOOL_MESSAGE;
    }

    this.#logger.info({ event: "ASSISTANT_TOOL_REJECTED", tool, reason: loggedRejectionOf(rejection) });
    return rejection;
  }

  /** Logs where the arguments failed but never their values, which can quote the user's own data. */
  #rejectedArgumentsReasonOf(tool: string, issues: ZodIssue[]): string {
    this.#logger.warn({ event: "ASSISTANT_TOOL_ARGUMENTS_REJECTED", tool, issues: issues.map(({ path, code }) => ({ path: loggedPathOf(path), code })) });

    return `Invalid arguments for ${tool}: ${issues.map(({ path, message }) => `${path.join(".") || "(root)"} ${message}`).join("; ")}. ${RETRY_ONCE_HINT}`;
  }
}
