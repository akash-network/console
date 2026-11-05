import { z } from "@hono/zod-openapi";

import { MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/deployment/http-schemas/runtime-limit";
import { deploymentCloseReasonEnum, MAX_CLOSE_REASON_DETAILS_LENGTH } from "@src/deployment/model-schemas";
import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/deployment/utils/deployment-name/deployment-name";
import {
  ASSISTANT_ALERT_KINDS,
  ASSISTANT_HARDWARE_INTERCONNECTS,
  AssistantDseqSchema,
  AssistantServicePatchSchema
} from "@src/feedback/http-schemas/assistant-action.schema";
import { TemplateIdSchema } from "@src/template/http-schemas/template.schema";
import { AkashAddressSchema } from "@src/utils/schema";

export const MAX_LOG_TAIL_LINES = 200;
export const MAX_GENERATED_SDL_LENGTH = 20_000;

const MAX_TEXT_LENGTH = 300;
const MAX_NAME_LENGTH = 100;
const MAX_TEMPLATE_ID_LENGTH = 255;

const Dseq = AssistantDseqSchema.openapi({ description: "Deployment sequence number" });
const ServiceName = z.string().min(1).max(MAX_NAME_LENGTH).openapi({ description: "A service name the deployment's SDL declares" });
const ShortText = z.string().trim().min(1).max(MAX_TEXT_LENGTH);
const EnvName = z
  .string()
  .regex(/^[-._a-zA-Z][-._a-zA-Z0-9]*$/)
  .max(MAX_NAME_LENGTH);

export const READ_TOOL_ARGUMENTS = {
  list_deployments: z.object({
    state: z.enum(["active", "closed"]).optional().openapi({ description: "Defaults to active" }),
    search: z.string().max(MAX_DEPLOYMENT_NAME_LENGTH).optional().openapi({ description: "Part of a deployment name or dseq" })
  }),
  get_deployment: z.object({ dseq: Dseq }),
  get_bids: z.object({ dseq: Dseq }),
  get_balance_and_spend: z.object({}),
  get_lease_close_reason: z.object({ dseq: Dseq }),
  list_templates: z.object({ query: z.string().max(MAX_TEXT_LENGTH).optional().openapi({ description: "Words to match, such as a model or app name" }) }),
  search_docs: z.object({ query: ShortText })
};

export const CLIENT_TOOL_ARGUMENTS = {
  read_logs: z.object({
    dseq: Dseq,
    service: ServiceName.optional(),
    tailLines: z.number().int().min(1).max(MAX_LOG_TAIL_LINES).default(100)
  }),
  read_events: z.object({ dseq: Dseq })
};

const ResourceChangeSchema = z
  .object({
    cpu: z.number().positive().max(512).optional().openapi({ description: "vCPU units" }),
    memory: z
      .string()
      .regex(/^\d+(\.\d+)?(Ki|Mi|Gi|Ti|K|M|G|T)$/)
      .optional()
      .openapi({ description: "Such as 4Gi" }),
    storage: z
      .string()
      .regex(/^\d+(\.\d+)?(Ki|Mi|Gi|Ti|K|M|G|T)$/)
      .optional()
      .openapi({ description: "Ephemeral storage size, such as 10Gi" }),
    gpu: z
      .object({
        units: z.number().int().min(0).max(64),
        models: z.array(z.string().max(MAX_NAME_LENGTH)).max(10).optional().openapi({ description: "vendor/model pairs such as nvidia/a100" })
      })
      .optional(),
    count: z.number().int().min(1).max(100).optional().openapi({ description: "Replicas" })
  })
  .strict();

const deploymentAlert = (alert: string) => alert !== "wallet_balance";

export const PROPOSAL_TOOL_ARGUMENTS = {
  create_deployment: z
    .object({
      templateId: TemplateIdSchema.max(MAX_TEMPLATE_ID_LENGTH).optional(),
      sdl: z.string().max(MAX_GENERATED_SDL_LENGTH).optional(),
      name: z.string().trim().min(1).max(MAX_DEPLOYMENT_NAME_LENGTH).optional(),
      runtimeLimitHours: z.number().int().min(1).max(MAX_RUNTIME_LIMIT_INCREMENT_HOURS).optional()
    })
    .refine(({ templateId, sdl }) => !!templateId !== !!sdl, { message: "Give either a templateId or an sdl, not both" }),
  choose_bid: z.object({
    dseq: Dseq,
    choices: z
      .array(z.object({ gseq: z.number().int().positive(), oseq: z.number().int().positive(), provider: z.string().max(MAX_NAME_LENGTH) }))
      .min(1)
      .max(10)
  }),
  update_deployment: z.object({
    dseq: Dseq,
    services: z.record(ServiceName, AssistantServicePatchSchema).refine(services => Object.keys(services).length > 0, { message: "Name at least one service" })
  }),
  set_secret: z.object({ dseq: Dseq, service: ServiceName, name: EnvName }),
  set_registry_credentials: z.object({
    dseq: Dseq,
    service: ServiceName,
    host: z.string().min(1).max(MAX_NAME_LENGTH).openapi({ description: "Registry host, such as ghcr.io" }),
    usernameHint: z.string().max(MAX_NAME_LENGTH).optional()
  }),
  redeploy_with_resources: z.object({
    dseq: Dseq,
    reason: ShortText,
    services: z.record(ServiceName, ResourceChangeSchema).refine(services => Object.keys(services).length > 0, { message: "Name at least one service" })
  }),
  rename_deployment: z.object({ dseq: Dseq, name: z.string().trim().min(1).max(MAX_DEPLOYMENT_NAME_LENGTH) }),
  move_deployment: z.object({ dseq: Dseq, projectId: z.string().uuid() }),
  add_runtime_hours: z.object({ dseq: Dseq, hours: z.number().int().min(1).max(MAX_RUNTIME_LIMIT_INCREMENT_HOURS) }),
  remove_runtime_limit: z.object({ dseq: Dseq }),
  send_manifest_again: z.object({ dseq: Dseq }),
  close_deployment: z.object({
    dseq: Dseq,
    reason: z.enum(deploymentCloseReasonEnum.enumValues),
    reasonDetails: z.string().trim().max(MAX_CLOSE_REASON_DETAILS_LENGTH).optional()
  }),
  create_alert: z
    .object({
      alert: z.enum(ASSISTANT_ALERT_KINDS),
      dseq: Dseq.optional().openapi({ description: "Required for deployment alerts" }),
      thresholdUsd: z.number().positive().max(1_000_000).optional()
    })
    .refine(({ alert, dseq }) => !deploymentAlert(alert) || !!dseq, { message: "A deployment alert needs a dseq" }),
  redeem_coupon: z.object({ code: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional() }),
  save_as_template: z.object({ dseq: Dseq, title: z.string().trim().min(1).max(MAX_NAME_LENGTH), description: ShortText.optional() }),
  favorite_provider: z.object({ provider: AkashAddressSchema.openapi({ description: "Provider address" }) }),
  request_hardware: z.object({
    gpuModel: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    gpuCount: z.number().int().min(1).max(1000),
    interconnect: z.enum(ASSISTANT_HARDWARE_INTERCONNECTS).default("none"),
    notes: ShortText.optional()
  }),
  buy_credits: z.object({ amountUsd: z.number().positive().max(100_000).optional() }),
  configure_auto_recharge: z.object({ thresholdUsd: z.number().positive().max(100_000).optional(), amountUsd: z.number().positive().max(100_000).optional() }),
  open_in_editor: z.object({
    dseq: Dseq.optional(),
    templateId: TemplateIdSchema.max(MAX_TEMPLATE_ID_LENGTH).optional(),
    sdl: z.string().max(MAX_GENERATED_SDL_LENGTH).optional()
  })
};

export type ReadToolName = keyof typeof READ_TOOL_ARGUMENTS;
export type ClientToolName = keyof typeof CLIENT_TOOL_ARGUMENTS;
export type ProposalActionType = keyof typeof PROPOSAL_TOOL_ARGUMENTS;
export type ReadToolArguments<T extends ReadToolName> = z.infer<(typeof READ_TOOL_ARGUMENTS)[T]>;
export type ClientToolArguments<T extends ClientToolName> = z.infer<(typeof CLIENT_TOOL_ARGUMENTS)[T]>;
export type ProposalArguments<T extends ProposalActionType> = z.infer<(typeof PROPOSAL_TOOL_ARGUMENTS)[T]>;
