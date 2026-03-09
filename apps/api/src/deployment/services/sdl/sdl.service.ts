import type { Manifest, NetworkId, SDLInput } from "@akashnetwork/chain-sdk";
import { generateManifest, generateManifestVersion, manifestToSortedJSON, yaml as sdlYaml } from "@akashnetwork/chain-sdk";
import jsYaml from "js-yaml";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";

type NetworkType = "beta2" | "beta3";

@singleton()
export class SdlService {
  private readonly networkId: NetworkId;

  constructor(@InjectBillingConfig() private readonly config: BillingConfig) {
    this.networkId = this.config.NETWORK as NetworkId;
  }

  private parseSdlInput(yamlJson: string | SDLInput): SDLInput {
    return typeof yamlJson === "string" ? sdlYaml.template<SDLInput>(yamlJson) : yamlJson;
  }

  private buildManifest(sdlInput: SDLInput) {
    const result = generateManifest(sdlInput, this.networkId);
    if (!result.ok) {
      throw new Error(result.value.map(e => e.message).join(", "));
    }
    return result.value;
  }

  public getDeploymentGroups(yamlJson: string | SDLInput, _networkType: NetworkType) {
    const sdlInput = this.parseSdlInput(yamlJson);
    return this.buildManifest(sdlInput).groupSpecs;
  }

  public getManifest(yamlJson: string | SDLInput, _networkType: NetworkType, asString: true): string;
  public getManifest(yamlJson: string | SDLInput, _networkType: NetworkType, asString?: false): Manifest;
  public getManifest(yamlJson: string | SDLInput, _networkType: NetworkType, asString = false): string | Manifest {
    const sdlInput = this.parseSdlInput(yamlJson);
    const { groups } = this.buildManifest(sdlInput);
    if (asString) {
      return manifestToSortedJSON(groups);
    }
    return groups;
  }

  public async getManifestVersion(yamlJson: string | SDLInput, _networkType: NetworkType) {
    const sdlInput = this.parseSdlInput(yamlJson);
    const { groups } = this.buildManifest(sdlInput);
    return generateManifestVersion(groups);
  }

  public getManifestYaml(sdlConfig: SDLInput, _networkType: NetworkType) {
    const { groups } = this.buildManifest(sdlConfig);
    return manifestToSortedJSON(groups);
  }

  public validateSdl(yamlJson: string) {
    try {
      const sdlInput = sdlYaml.template<SDLInput>(yamlJson);
      const result = generateManifest(sdlInput);
      return !!result.ok;
    } catch {
      return false;
    }
  }

  public appendAuditorRequirement(yamlStr: string, allowedAuditors: string[]): string {
    const sdlData = jsYaml.load(yamlStr) as SDLInput;
    const placementData = sdlData?.profiles?.placement || {};

    for (const [, value] of Object.entries(placementData)) {
      if (!value.signedBy?.anyOf || !value.signedBy?.allOf) {
        value.signedBy = {
          anyOf: value.signedBy?.anyOf || [],
          allOf: value.signedBy?.allOf || []
        };
      }

      for (const auditor of allowedAuditors) {
        if (!value.signedBy!.anyOf!.includes(auditor)) {
          value.signedBy!.anyOf!.push(auditor);
        }
      }
    }

    const result = jsYaml.dump(sdlData, {
      indent: 2,
      quotingType: '"',
      styles: {
        "!!null": "empty"
      }
    });

    return `---
${result}`;
  }
}
