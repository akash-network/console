import { isHttpError } from "http-errors";
import { randomUUID } from "node:crypto";
import { inject, singleton } from "tsyringe";
import { ZodError } from "zod";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import type { AssistantAction } from "@src/feedback/http-schemas/assistant-action.schema";
import { assistantKnowledge } from "@src/feedback/lib/assistant-knowledge/assistant-knowledge";
import { AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import {
  CLIENT_TOOL_ARGUMENTS,
  type ClientToolArguments,
  type ClientToolName,
  PROPOSAL_TOOL_ARGUMENTS,
  READ_TOOL_ARGUMENTS,
  type ReadToolArguments,
  type ReadToolName
} from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import { isClientToolName, isReadToolName, proposalActionTypeOf } from "@src/feedback/lib/assistant-tools/assistant-tools";
import { redactSecrets } from "@src/feedback/lib/redact-secrets/redact-secrets";
import type { ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";
import { AssistantAccountToolsService } from "@src/feedback/services/assistant-account-tools/assistant-account-tools.service";
import { AssistantBidToolsService } from "@src/feedback/services/assistant-bid-tools/assistant-bid-tools.service";
import { AssistantDeploymentToolsService } from "@src/feedback/services/assistant-deployment-tools/assistant-deployment-tools.service";
import { AssistantProposalService, type ProposalContext } from "@src/feedback/services/assistant-proposal/assistant-proposal.service";

export const MAX_TOOL_RESULT_LENGTH = 8_000;
const TRUNCATION_MARK = "...[truncated]";
const FAILED_TOOL_MESSAGE = "The tool failed. Tell the user this data could not be read right now.";

export type ClientToolCall = { [K in ClientToolName]: { id: string; name: K; arguments: ClientToolArguments<K> } }[ClientToolName];

export type ToolOutcome =
  | { kind: "result"; content: string; summary: string; ok: boolean }
  | { kind: "proposal"; content: string; summary: string; ok: true; proposalId: string; action: AssistantAction }
  | { kind: "client"; call: ClientToolCall };

export function truncated(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - TRUNCATION_MARK.length)}${TRUNCATION_MARK}`;
}

/** Tool results reach the model as JSON data, redacted and bounded, so their content cannot pass for instructions or flood the context. */
export function toolContentOf(tool: string, payload: { data: unknown } | { error: string }): string {
  return truncated(redactSecrets(JSON.stringify({ tool, ...payload })), MAX_TOOL_RESULT_LENGTH);
}

function summaryOf(name: ReadToolName, args: Record<string, unknown>): string {
  const summaries: Record<ReadToolName, string> = {
    list_deployments: "Read your deployments",
    get_deployment: `Read deployment ${args.dseq}`,
    get_bids: `Read the bids on deployment ${args.dseq}`,
    get_balance_and_spend: "Read your balance and spend",
    get_lease_close_reason: `Read why deployment ${args.dseq} closed`,
    list_templates: "Searched the template gallery",
    search_docs: "Searched the Console docs"
  };

  return summaries[name];
}

function parsedArguments(call: ChatToolCall): unknown {
  try {
    return JSON.parse(call.function.arguments || "{}");
  } catch {
    throw new AssistantToolError("The arguments are not valid JSON.");
  }
}

@singleton()
export class AssistantToolRunnerService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentTools: AssistantDeploymentToolsService,
    private readonly bidTools: AssistantBidToolsService,
    private readonly accountTools: AssistantAccountToolsService,
    private readonly proposalService: AssistantProposalService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AssistantToolRunnerService.name });
  }

  async run(call: ChatToolCall, context: ProposalContext): Promise<ToolOutcome> {
    const name = call.function.name;

    try {
      return await this.#run(call, context);
    } catch (error) {
      return { kind: "result", content: toolContentOf(name, { error: this.#reasonOf(name, error) }), summary: `Could not run ${name}`, ok: false };
    }
  }

  async #run(call: ChatToolCall, context: ProposalContext): Promise<ToolOutcome> {
    const name = call.function.name;
    const args = parsedArguments(call);

    if (isReadToolName(name)) {
      const parsed = READ_TOOL_ARGUMENTS[name].parse(args);
      return { kind: "result", content: toolContentOf(name, { data: await this.#read(name, parsed) }), summary: summaryOf(name, parsed), ok: true };
    }

    if (isClientToolName(name)) {
      return { kind: "client", call: { id: call.id, name, arguments: CLIENT_TOOL_ARGUMENTS[name].parse(args) } as ClientToolCall };
    }

    const type = proposalActionTypeOf(name);
    if (!type) throw new AssistantToolError(`There is no tool named ${name}.`);

    const action = await this.proposalService.propose(type, PROPOSAL_TOOL_ARGUMENTS[type].parse(args), context);
    const proposalId = randomUUID();

    return {
      kind: "proposal",
      content: toolContentOf(name, { data: { proposalId, shownToUser: true, note: "The user now sees a card and decides. Do not claim it is done." } }),
      summary: `Proposed ${type.replaceAll("_", " ")}`,
      ok: true,
      proposalId,
      action
    };
  }

  async #read(name: ReadToolName, args: unknown): Promise<unknown> {
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
    }
  }

  #reasonOf(tool: string, error: unknown): string {
    if (error instanceof ZodError) return `Invalid arguments: ${error.issues.map(issue => `${issue.path.join(".") || "(root)"} ${issue.message}`).join("; ")}`;
    if (error instanceof AssistantToolError) return error.message;
    if (isHttpError(error) && error.status < 500) return error.message;

    this.#logger.warn({ event: "ASSISTANT_TOOL_FAILED", tool, error });
    return FAILED_TOOL_MESSAGE;
  }
}
