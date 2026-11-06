import { z } from "@hono/zod-openapi";

import { PatchServiceSchema } from "@src/deployment/http-schemas/deployment.schema";
import { MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/deployment/http-schemas/runtime-limit";
import { deploymentCloseReasonEnum } from "@src/deployment/model-schemas";

export const AssistantDseqSchema = z.string().regex(/^[1-9]\d{0,19}$/, "A dseq is a positive integer");

/** Only the alert Console users can set up themselves today: per-deployment balance alerts are retired and wallet balance alerts have no create flow. */
export const ASSISTANT_ALERT_KINDS = ["deployment_closed"] as const;

export const ASSISTANT_HARDWARE_INTERCONNECTS = ["none", "server", "cluster"] as const;

const ServiceExposeSnapshotSchema = z.object({
  port: z.number().int(),
  as: z.number().int().nullable(),
  accept: z.array(z.string()),
  global: z.boolean()
});

const ServiceSnapshotSchema = z.object({
  image: z.string().nullable(),
  command: z.array(z.string()).nullable(),
  args: z.array(z.string()).nullable(),
  envKeys: z.array(z.string()).openapi({ description: "Names of the variables the service declares today. Values are never included." }),
  expose: z.array(ServiceExposeSnapshotSchema),
  storage: z.array(z.object({ volume: z.string(), mount: z.string().nullable(), readOnly: z.boolean() }))
});

export const ServiceResourcesSchema = z.object({
  cpu: z.number().nullable(),
  memory: z.string().nullable(),
  storage: z.array(z.string()),
  gpu: z.object({ units: z.number().int(), models: z.array(z.string()) }).nullable(),
  count: z.number().int().nullable().openapi({ description: "Replicas" })
});

/** What PATCH /v1/deployments/{dseq} accepts for one service, minus registry credentials, which only the secure input of their own card may carry. */
export const AssistantServicePatchSchema = PatchServiceSchema.omit({ credentials: true }).strict();

const CONFIRM = z.literal("confirm");
const DESTRUCTIVE = z.literal("destructive");
const DEEP_LINK = z.literal("deep_link");

export const AssistantActionSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("create_deployment"),
      tier: CONFIRM,
      templateId: z.string().nullable(),
      sdl: z.string().openapi({ description: "Validated with the same checks a create runs before the card is shown." }),
      name: z.string().nullable(),
      runtimeLimitHours: z.number().int().nullable(),
      services: z.array(z.object({ service: z.string(), image: z.string().nullable(), resources: ServiceResourcesSchema })),
      providersAbleToBid: z
        .number()
        .int()
        .nullable()
        .openapi({ description: "Providers bid screening expects could bid on every group now, or null when screening did not answer." }),
      cost: z
        .object({
          estimatedUsdPerMonth: z
            .number()
            .nullable()
            .openapi({ description: "Typical provider prices for its CPU, memory and storage, or null when it requests GPUs." })
        })
        .nullable()
        .optional()
    }),
    z.object({
      type: z.literal("choose_bid"),
      tier: CONFIRM,
      dseq: AssistantDseqSchema,
      choices: z.array(
        z.object({
          gseq: z.number().int(),
          oseq: z.number().int(),
          provider: z.string(),
          price: z.object({ denom: z.string(), amount: z.string() }).openapi({ description: "The bid's own price per block, as the bid list returns it." })
        })
      )
    }),
    z.object({
      type: z.literal("update_deployment"),
      tier: CONFIRM,
      dseq: AssistantDseqSchema,
      name: z.string().nullable(),
      manifestVersion: z
        .string()
        .openapi({ description: "Send as `ifManifestVersion`, so the patch is refused when the deployment changed since the card was shown." }),
      services: z.array(z.object({ service: z.string(), before: ServiceSnapshotSchema, patch: AssistantServicePatchSchema }))
    }),
    z.object({
      type: z.literal("set_secret"),
      tier: CONFIRM,
      dseq: AssistantDseqSchema,
      service: z.string(),
      name: z.string().openapi({ description: "The variable name. The value is typed into the card's secure input and sealed in the browser." }),
      replacesExisting: z.boolean()
    }),
    z.object({
      type: z.literal("set_registry_credentials"),
      tier: CONFIRM,
      dseq: AssistantDseqSchema,
      service: z.string(),
      image: z.string().nullable(),
      host: z.string(),
      usernameHint: z.string().nullable().openapi({ description: "Prefills the username field. The password is typed into the card's secure input." })
    }),
    z.object({
      type: z.literal("redeploy_with_resources"),
      tier: DEEP_LINK,
      dseq: AssistantDseqSchema,
      reason: z.string(),
      services: z.array(z.object({ service: z.string(), before: ServiceResourcesSchema, after: ServiceResourcesSchema })),
      providersAbleToBid: z
        .number()
        .int()
        .nullable()
        .openapi({ description: "Providers bid screening expects could bid on every group with the new resources, or null when screening did not answer." })
    }),
    z.object({ type: z.literal("rename_deployment"), tier: CONFIRM, dseq: AssistantDseqSchema, from: z.string().nullable(), to: z.string() }),
    z.object({ type: z.literal("move_deployment"), tier: CONFIRM, dseq: AssistantDseqSchema, projectId: z.string().uuid() }),
    z.object({
      type: z.literal("add_runtime_hours"),
      tier: CONFIRM,
      dseq: AssistantDseqSchema,
      hours: z.number().int().min(1).max(MAX_RUNTIME_LIMIT_INCREMENT_HOURS),
      currentLimitHours: z.number().int(),
      newLimitHours: z.number().int().openapi({ description: "Send as `runtimeLimitHours`, which takes the new total." }),
      runtimeEndsAt: z.string().nullable()
    }),
    z.object({ type: z.literal("remove_runtime_limit"), tier: CONFIRM, dseq: AssistantDseqSchema, currentLimitHours: z.number().int() }),
    z.object({ type: z.literal("send_manifest_again"), tier: CONFIRM, dseq: AssistantDseqSchema }),
    z.object({
      type: z.literal("close_deployment"),
      tier: DESTRUCTIVE,
      dseq: AssistantDseqSchema,
      name: z.string().nullable(),
      reason: z.enum(deploymentCloseReasonEnum.enumValues),
      reasonDetails: z.string().nullable()
    }),
    z.object({
      type: z.literal("create_alert"),
      tier: CONFIRM,
      alert: z.enum(ASSISTANT_ALERT_KINDS),
      dseq: AssistantDseqSchema,
      channel: z.literal("email")
    }),
    z.object({ type: z.literal("redeem_coupon"), tier: CONFIRM, code: z.string().nullable() }),
    z.object({ type: z.literal("save_as_template"), tier: CONFIRM, dseq: AssistantDseqSchema, title: z.string(), description: z.string().nullable() }),
    z.object({ type: z.literal("favorite_provider"), tier: CONFIRM, provider: z.string() }),
    z.object({
      type: z.literal("request_hardware"),
      tier: CONFIRM,
      gpuModel: z.string(),
      gpuCount: z.number().int(),
      interconnect: z.enum(ASSISTANT_HARDWARE_INTERCONNECTS),
      notes: z.string().nullable()
    }),
    z.object({ type: z.literal("buy_credits"), tier: DEEP_LINK, amountUsd: z.number().nullable() }),
    z.object({ type: z.literal("configure_auto_recharge"), tier: DEEP_LINK, thresholdUsd: z.number().nullable(), amountUsd: z.number().nullable() }),
    z.object({
      type: z.literal("open_in_editor"),
      tier: DEEP_LINK,
      dseq: AssistantDseqSchema.nullable(),
      templateId: z.string().nullable(),
      sdl: z.string().nullable()
    })
  ])
  .openapi({
    description:
      "An action the assistant proposes. The API never executes it: the card shows it and, on Confirm, runs the same request the regular UI makes (`confirm`, `destructive`) or opens the existing page prefilled (`deep_link`)."
  });

export const MAX_DIAGNOSIS_SUMMARY_LENGTH = 300;
export const MAX_DIAGNOSIS_EVIDENCE_LINES = 6;
export const MAX_DIAGNOSIS_EVIDENCE_LINE_LENGTH = 300;

export const AssistantDiagnosisSchema = z
  .object({
    summary: z.string().trim().min(1).max(MAX_DIAGNOSIS_SUMMARY_LENGTH).openapi({ description: "What is wrong, in one or two plain sentences" }),
    evidence: z
      .array(z.string().max(MAX_DIAGNOSIS_EVIDENCE_LINE_LENGTH))
      .max(MAX_DIAGNOSIS_EVIDENCE_LINES)
      .openapi({ description: "The log or event lines the diagnosis rests on, quoted as read and redacted" })
  })
  .openapi({ description: "Why the assistant proposes this action, when it answers a problem it diagnosed" });

export type AssistantAction = z.infer<typeof AssistantActionSchema>;
export type AssistantActionType = AssistantAction["type"];
export type AssistantActionOf<T extends AssistantActionType> = Extract<AssistantAction, { type: T }>;
export type ServiceResources = z.infer<typeof ServiceResourcesSchema>;
export type AssistantServicePatch = z.infer<typeof AssistantServicePatchSchema>;
export type AssistantDiagnosis = z.infer<typeof AssistantDiagnosisSchema>;

export const ASSISTANT_ACTION_TYPES = AssistantActionSchema._def.options.map(option => option.shape.type.value) as AssistantActionType[];
