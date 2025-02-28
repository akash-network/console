import { ForbiddenError } from "@casl/ability";
import { millisecondsInHour } from "date-fns/constants";
import assert from "http-assert";
import template from "lodash/template";
import vault from "node-vault";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { FindDeploymentSettingParams } from "@src/deployment/http-schemas/deployment-setting.schema";
import {
  DeploymentSettingRepository,
  DeploymentSettingsInput,
  DeploymentSettingsOutput
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DrainingDeploymentService } from "../draining-deployment/draining-deployment.service";

type DeploymentSettingWithEstimatedTopUpAmount = DeploymentSettingsOutput & { estimatedTopUpAmount: number; topUpFrequencyMs: number };

@singleton()
export class DeploymentSettingService {
  private readonly topUpFrequencyMs = this.config.get("AUTO_TOP_UP_JOB_INTERVAL_IN_H") * millisecondsInHour;
  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly authService: AuthService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly config: DeploymentConfigService
  ) {
    this.demoSdlPersistence();
  }

  /**
   * POC: SDL Template Storage & Secret Management Demo
   *
   * This demo showcases:
   * 1. Storing SDL templates with variable placeholders
   * 2. Securely managing secrets in Vault
   * 3. Template interpolation at runtime
   *
   * Flow:
   * - SDL template is stored with placeholders (e.g. ${FOO})
   * - Secrets are stored separately in Vault
   * - At deployment time, secrets are retrieved and interpolated
   *
   * @example
   * Template: "services: web: image: ${IMAGE_TAG}"
   * Secrets: { IMAGE_TAG: "nginx:1.19" }
   * Result: "services: web: image: nginx:1.19"
   */
  private async demoSdlPersistence() {
    // Initialize Vault client
    // TODO: Move vault config to environment variables
    const vaultClient = vault({
      endpoint: "http://localhost:8200",
      token: "myroot"
    });

    // Mock DB storage
    let sdlCache = "";

    /**
     * Saves SDL template and its secrets
     * Template goes to DB, secrets to Vault
     */
    const save = async (deploymentSettingId: string, sdl: string, secrets: Record<string, string>): Promise<void> => {
      try {
        // Store secrets in Vault
        await vaultClient.write(`secret/data/deployment/${deploymentSettingId}/sdl/secrets`, { data: secrets });

        // Store SDL template in DB
        sdlCache = sdl; // TODO: Replace with actual DB storage
      } catch (error) {
        console.error("Failed to save SDL and secrets:", error);
        throw new Error("Failed to save deployment configuration");
      }
    };

    /**
     * Retrieves and interpolates SDL template with secrets
     * @returns Fully interpolated SDL ready for deployment
     */
    const read = async (deploymentSettingId: string, sdl: string): Promise<string> => {
      try {
        // Get secrets from Vault
        const secrets = await vaultClient.read(`secret/data/deployment/${deploymentSettingId}/sdl/secrets`);

        // Get SDL from DB
        sdl = sdlCache; // TODO: Replace with actual DB query

        // Interpolate template with secrets
        const interpolate = template(sdl);
        return interpolate(secrets.data.data);
      } catch (error) {
        console.error("Failed to read and interpolate SDL:", error);
        throw new Error("Failed to prepare deployment configuration");
      }
    };

    // Demo usage
    const demoDeploymentId = "demo-deployment-123";
    const demoSdl = `
      # Example SDL with secret placeholder
      services:
        web:
          image: nginx
          environment:
            - FOO=\${FOO}  # Secret will be injected here
    `;
    const demoSecrets = { FOO: "bar" };

    try {
      // Save template and secrets
      await save(demoDeploymentId, demoSdl, demoSecrets);

      // Read and interpolate
      const interpolatedSdl = await read(demoDeploymentId, demoSdl);

      console.log("=== SDL Storage & Secrets Demo ===");
      console.log("Original template:", demoSdl);
      console.log("Secrets:", demoSecrets);
      console.log("Interpolated result:", interpolatedSdl);
    } catch (error) {
      console.error("Demo failed:", error);
    }
  }

  async findOrCreateByUserIdAndDseq(params: FindDeploymentSettingParams): Promise<DeploymentSettingWithEstimatedTopUpAmount | undefined> {
    const setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(params);

    if (setting) {
      return this.withEstimatedTopUpAmount(setting);
    }

    try {
      return await this.create(params);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return undefined;
      }
      throw error;
    }
  }

  async create(input: DeploymentSettingsInput): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    return this.withEstimatedTopUpAmount(await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create(input));
  }

  async upsert(
    params: FindDeploymentSettingParams,
    input: Pick<DeploymentSettingsInput, "autoTopUpEnabled">
  ): Promise<DeploymentSettingWithEstimatedTopUpAmount> {
    let setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "update").updateBy(params, input, { returning: true });

    try {
      setting =
        setting ||
        (await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "create").create({
          ...input,
          ...params
        }));

      return this.withEstimatedTopUpAmount(setting);
    } catch (error) {
      assert(!(error instanceof ForbiddenError), 404, "Deployment setting not found");
      throw error;
    }
  }

  async withEstimatedTopUpAmount(params: DeploymentSettingsOutput): Promise<DeploymentSettingWithEstimatedTopUpAmount>;
  async withEstimatedTopUpAmount(params: undefined): Promise<undefined>;
  async withEstimatedTopUpAmount(params?: DeploymentSettingsOutput): Promise<DeploymentSettingWithEstimatedTopUpAmount | undefined> {
    if (!params) {
      return undefined;
    }

    if (!params.autoTopUpEnabled) {
      return { ...params, estimatedTopUpAmount: 0, topUpFrequencyMs: this.topUpFrequencyMs };
    }

    const estimatedTopUpAmount = await this.drainingDeploymentService.calculateTopUpAmountForDseqAndUserId(params.dseq, params.userId);

    return { ...params, estimatedTopUpAmount, topUpFrequencyMs: this.topUpFrequencyMs };
  }
}
