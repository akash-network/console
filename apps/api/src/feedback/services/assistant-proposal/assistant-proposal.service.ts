import { singleton } from "tsyringe";

import { BidController } from "@src/bid/controllers/bid/bid.controller";
import { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import { DeploymentSettingController } from "@src/deployment/controllers/deployment-setting/deployment-setting.controller";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import type { AssistantAction, AssistantActionOf, ServiceResources } from "@src/feedback/http-schemas/assistant-action.schema";
import { AssistantProposalWithheldError, AssistantToolError } from "@src/feedback/lib/assistant-tool-error/assistant-tool-error";
import type { ProposalActionType, ProposalArguments } from "@src/feedback/lib/assistant-tools/assistant-tool-arguments";
import { redactSecrets } from "@src/feedback/lib/redact-secrets/redact-secrets";
import { keepsPricing } from "@src/feedback/lib/sdl-pricing/sdl-pricing";
import { sdlWithResources } from "@src/feedback/lib/sdl-resources/sdl-with-resources";
import { type SdlServiceSummary, summarizeSdl } from "@src/feedback/lib/sdl-summary/sdl-summary";
import { AssistantAccountToolsService } from "@src/feedback/services/assistant-account-tools/assistant-account-tools.service";
import { AssistantBidToolsService, type SdlAvailability } from "@src/feedback/services/assistant-bid-tools/assistant-bid-tools.service";

export interface ProposalContext {
  isTrialing: boolean | null;
  /** SDLs held back earlier in the turn for having no bidders, whose pricing an adjusted SDL has to keep. */
  withheldSdls: string[];
}

const CHANGED_PRICING_MESSAGE =
  "This SDL changes the price or denom of the SDL held back for having no bidders. Keep its pricing and adjust only placement attributes or resources, or pick another template by templateId.";

type ResourceChange = ProposalArguments<"redeploy_with_resources">["services"][string];

function serviceNamed(services: SdlServiceSummary[], name: string): SdlServiceSummary {
  const service = services.find(({ service }) => service === name);
  if (!service)
    throw new AssistantToolError(
      `The deployment has no service named ${JSON.stringify(name)}. Its services are: ${services.map(({ service }) => service).join(", ")}`
    );

  return service;
}

function looksSecret(name: string, value: string): boolean {
  const entry = `${name}=${value}`;
  return redactSecrets(entry) !== entry;
}

function resourcesAfter(before: ServiceResources, change: ResourceChange): ServiceResources {
  const gpu = change.gpu ? (change.gpu.units === 0 ? null : { units: change.gpu.units, models: change.gpu.models ?? before.gpu?.models ?? [] }) : before.gpu;

  return {
    cpu: change.cpu ?? before.cpu,
    memory: change.memory ?? before.memory,
    storage: change.storage ? [change.storage, ...before.storage.slice(1)] : before.storage,
    gpu,
    count: change.count ?? before.count
  };
}

/** Builds the typed action a card renders; every value it shows is read here, never taken from the model's prose. */
@singleton()
export class AssistantProposalService {
  constructor(
    private readonly deploymentController: DeploymentController,
    private readonly deploymentSettingController: DeploymentSettingController,
    private readonly bidController: BidController,
    private readonly sdlService: SdlService,
    private readonly accountTools: AssistantAccountToolsService,
    private readonly bidTools: AssistantBidToolsService
  ) {}

  async propose<T extends ProposalActionType>(type: T, args: ProposalArguments<T>, context: ProposalContext): Promise<AssistantAction> {
    const input = { type, args } as { [K in ProposalActionType]: { type: K; args: ProposalArguments<K> } }[ProposalActionType];

    switch (input.type) {
      case "create_deployment":
        return await this.#createDeployment(input.args, context);
      case "choose_bid":
        return await this.#chooseBid(input.args);
      case "update_deployment":
        return await this.#updateDeployment(input.args);
      case "set_secret":
        return await this.#setSecret(input.args);
      case "set_registry_credentials":
        return await this.#setRegistryCredentials(input.args);
      case "redeploy_with_resources":
        return await this.#redeployWithResources(input.args, context);
      case "rename_deployment":
        return { type: "rename_deployment", tier: "confirm", dseq: input.args.dseq, from: (await this.#deployment(input.args.dseq)).name, to: input.args.name };
      case "add_runtime_hours":
        return await this.#addRuntimeHours(input.args);
      case "remove_runtime_limit":
        return { type: "remove_runtime_limit", tier: "confirm", dseq: input.args.dseq, currentLimitHours: await this.#currentRuntimeLimit(input.args.dseq) };
      case "close_deployment":
        return await this.#closeDeployment(input.args);
      case "send_manifest_again":
        await this.#activeDeployment(input.args.dseq);
        return { type: "send_manifest_again", tier: "confirm", dseq: input.args.dseq };
      case "create_alert":
        await this.#activeDeployment(input.args.dseq);
        return { type: "create_alert", tier: "confirm", alert: "deployment_closed", dseq: input.args.dseq, channel: "email" };
      case "open_in_editor":
        this.#assertKeepsWithheldPricing(input.args.sdl, context);
        return this.#withoutLookup(input);
      default:
        return this.#withoutLookup(input);
    }
  }

  #withoutLookup(
    input: { [K in ProposalActionType]: { type: K; args: ProposalArguments<K> } }[Exclude<
      ProposalActionType,
      | "create_deployment"
      | "choose_bid"
      | "update_deployment"
      | "set_secret"
      | "set_registry_credentials"
      | "redeploy_with_resources"
      | "rename_deployment"
      | "add_runtime_hours"
      | "remove_runtime_limit"
      | "close_deployment"
      | "send_manifest_again"
      | "create_alert"
    >]
  ): AssistantAction {
    switch (input.type) {
      case "move_deployment":
        return { type: "move_deployment", tier: "confirm", ...input.args };
      case "redeem_coupon":
        return { type: "redeem_coupon", tier: "confirm", code: input.args.code ?? null };
      case "save_as_template":
        return { type: "save_as_template", tier: "confirm", dseq: input.args.dseq, title: input.args.title, description: input.args.description ?? null };
      case "favorite_provider":
        return { type: "favorite_provider", tier: "confirm", provider: input.args.provider };
      case "request_hardware":
        return { type: "request_hardware", tier: "confirm", ...input.args, notes: input.args.notes ?? null };
      case "buy_credits":
        return { type: "buy_credits", tier: "deep_link", amountUsd: input.args.amountUsd ?? null };
      case "configure_auto_recharge":
        return { type: "configure_auto_recharge", tier: "deep_link", thresholdUsd: input.args.thresholdUsd ?? null, amountUsd: input.args.amountUsd ?? null };
      case "open_in_editor":
        return {
          type: "open_in_editor",
          tier: "deep_link",
          dseq: input.args.dseq ?? null,
          templateId: input.args.templateId ?? null,
          sdl: input.args.sdl ?? null
        };
    }
  }

  async #createDeployment(args: ProposalArguments<"create_deployment">, context: ProposalContext): Promise<AssistantActionOf<"create_deployment">> {
    this.#assertKeepsWithheldPricing(args.sdl, context);
    const sdl = args.templateId ? await this.accountTools.templateSdl(args.templateId) : (args.sdl as string);

    const availability = await this.bidTools.checkAvailability(sdl, { isTrialing: context.isTrialing === true });
    if (availability.providersAbleToBid === 0) {
      context.withheldSdls.push(sdl);
      throw new AssistantProposalWithheldError({ ...availability, ...(args.templateId && { templateSdl: sdl }) });
    }

    const parsed = this.sdlService.parse(sdl);
    const services = (parsed.ok && summarizeSdl(parsed.value)) || [];

    return {
      type: "create_deployment",
      tier: "confirm",
      templateId: args.templateId ?? null,
      sdl,
      name: args.name ?? null,
      runtimeLimitHours: args.runtimeLimitHours ?? null,
      services: services.map(({ service, image, resources }) => ({ service, image, resources })),
      providersAbleToBid: availability.providersAbleToBid
    };
  }

  #assertKeepsWithheldPricing(sdl: string | undefined, context: ProposalContext) {
    const withheldSdl = context.withheldSdls.at(-1);
    if (sdl && withheldSdl && !keepsPricing(withheldSdl, sdl)) throw new AssistantToolError(CHANGED_PRICING_MESSAGE);
  }

  async #chooseBid({ dseq, choices }: ProposalArguments<"choose_bid">): Promise<AssistantActionOf<"choose_bid">> {
    const { data: bids } = await this.bidController.list(dseq);

    return {
      type: "choose_bid",
      tier: "confirm",
      dseq,
      choices: choices.map(({ gseq, oseq, provider }) => {
        const match = bids.find(({ bid }) => bid.state === "open" && bid.id.gseq === gseq && bid.id.oseq === oseq && bid.id.provider === provider);
        if (!match) throw new AssistantToolError(`There is no open bid from ${provider} for group ${gseq}/${oseq}. Read the bids again with get_bids.`);

        return { gseq, oseq, provider, price: match.bid.price };
      })
    };
  }

  async #updateDeployment({ dseq, services }: ProposalArguments<"update_deployment">): Promise<AssistantActionOf<"update_deployment">> {
    const { data, declared } = await this.#deploymentWithServices(dseq);

    return {
      type: "update_deployment",
      tier: "confirm",
      dseq,
      name: data.name,
      manifestVersion: data.consoleSettings!.manifestVersion,
      services: Object.entries(services).map(([name, patch]) => {
        const { image, command, args, envKeys, expose, storage } = serviceNamed(declared, name);
        const secretLike = Object.entries(patch.env ?? {}).find(([key, value]) => value !== null && looksSecret(key, value));
        if (secretLike)
          throw new AssistantToolError(
            `${secretLike[0]} looks like a secret. Propose it with propose_set_secret so the user types the value in a secure input.`
          );

        return { service: name, before: { image, command, args, envKeys, expose, storage }, patch };
      })
    };
  }

  async #setSecret({ dseq, service, name }: ProposalArguments<"set_secret">): Promise<AssistantActionOf<"set_secret">> {
    const { declared } = await this.#deploymentWithServices(dseq);
    return { type: "set_secret", tier: "confirm", dseq, service, name, replacesExisting: serviceNamed(declared, service).envKeys.includes(name) };
  }

  async #setRegistryCredentials({
    dseq,
    service,
    host,
    usernameHint
  }: ProposalArguments<"set_registry_credentials">): Promise<AssistantActionOf<"set_registry_credentials">> {
    const { declared } = await this.#deploymentWithServices(dseq);
    return {
      type: "set_registry_credentials",
      tier: "confirm",
      dseq,
      service,
      image: serviceNamed(declared, service).image,
      host,
      usernameHint: usernameHint ?? null
    };
  }

  async #redeployWithResources(
    { dseq, reason, services }: ProposalArguments<"redeploy_with_resources">,
    context: ProposalContext
  ): Promise<AssistantActionOf<"redeploy_with_resources">> {
    const { data, declared } = await this.#deploymentWithServices(dseq);
    const changes = Object.entries(services).map(([name, change]) => {
      const before = serviceNamed(declared, name).resources;
      return { service: name, before, after: resourcesAfter(before, change) };
    });
    const availability = await this.#availabilityAfter(data.consoleSettings!.sdl, changes, context);
    if (availability?.providersAbleToBid === 0) throw new AssistantProposalWithheldError({ ...availability });

    return {
      type: "redeploy_with_resources",
      tier: "deep_link",
      dseq,
      reason,
      services: changes,
      providersAbleToBid: availability?.providersAbleToBid ?? null
    };
  }

  async #availabilityAfter(sdl: string, changes: Parameters<typeof sdlWithResources>[1], context: ProposalContext): Promise<SdlAvailability | null> {
    const changedSdl = sdlWithResources(sdl, changes);
    return changedSdl ? await this.bidTools.checkAvailability(changedSdl, { isTrialing: context.isTrialing === true }) : null;
  }

  async #addRuntimeHours({ dseq, hours }: ProposalArguments<"add_runtime_hours">): Promise<AssistantActionOf<"add_runtime_hours">> {
    const { data } = await this.deploymentSettingController.findV2({ dseq });
    if (data.runtimeLimitHours === null) throw new AssistantToolError("This deployment has no runtime limit, so it already runs until it is closed.");

    return {
      type: "add_runtime_hours",
      tier: "confirm",
      dseq,
      hours,
      currentLimitHours: data.runtimeLimitHours,
      newLimitHours: data.runtimeLimitHours + hours,
      runtimeEndsAt: data.runtimeEndsAt
    };
  }

  async #currentRuntimeLimit(dseq: string): Promise<number> {
    const { data } = await this.deploymentSettingController.findV2({ dseq });
    if (data.runtimeLimitHours === null) throw new AssistantToolError("This deployment has no runtime limit to remove.");

    return data.runtimeLimitHours;
  }

  async #closeDeployment({ dseq, reason, reasonDetails }: ProposalArguments<"close_deployment">): Promise<AssistantActionOf<"close_deployment">> {
    const data = await this.#activeDeployment(dseq);
    return { type: "close_deployment", tier: "destructive", dseq, name: data.name, reason, reasonDetails: reasonDetails ?? null };
  }

  async #deployment(dseq: string) {
    return (await this.deploymentController.findByDseq(dseq)).data;
  }

  async #activeDeployment(dseq: string) {
    const data = await this.#deployment(dseq);
    if (data.deployment.state !== "active") throw new AssistantToolError(`Deployment ${dseq} is ${data.deployment.state}, not active.`);

    return data;
  }

  async #deploymentWithServices(dseq: string) {
    const data = await this.#activeDeployment(dseq);
    const parsed = data.consoleSettings ? this.sdlService.parse(data.consoleSettings.sdl) : null;
    const declared = parsed?.ok ? summarizeSdl(parsed.value) : null;
    if (!declared) throw new AssistantToolError(`Console holds no readable SDL for deployment ${dseq}, so it cannot be changed from here.`);

    return { data, declared };
  }
}
