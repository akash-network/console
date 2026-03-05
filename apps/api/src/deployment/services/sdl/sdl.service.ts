import type { v2Manifest, v2Sdl, v3Manifest } from "@akashnetwork/chain-sdk";
import type { NetworkId } from "@akashnetwork/chain-sdk";
import { SDL } from "@akashnetwork/chain-sdk";
import yaml from "js-yaml";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";

type NetworkType = "beta2" | "beta3";

@singleton()
export class SdlService {
  private readonly networkId: NetworkId;

  constructor(@InjectBillingConfig() private readonly config: BillingConfig) {
    this.networkId = this.config.NETWORK as NetworkId;
  }

  private isValidString(value: unknown): value is string {
    return typeof value === "string" && !!value;
  }

  private getSdl(yamlJson: string | v2Sdl, networkType: NetworkType) {
    return this.isValidString(yamlJson) ? SDL.fromString(yamlJson, networkType, this.networkId) : new SDL(yamlJson, networkType, this.networkId);
  }

  public getDeploymentGroups(yamlJson: string | v2Sdl, networkType: NetworkType) {
    const sdl = this.getSdl(yamlJson, networkType);
    return sdl.groups();
  }

  public getManifest(yamlJson: string | v2Sdl, networkType: NetworkType, asString: true): string;
  public getManifest(yamlJson: string | v2Sdl, networkType: NetworkType, asString?: false): v2Manifest | v3Manifest;
  public getManifest(yamlJson: string | v2Sdl, networkType: NetworkType, asString = false): string | v2Manifest | v3Manifest {
    const sdl = this.getSdl(yamlJson, networkType);
    const manifest = sdl.manifest(asString) as v2Manifest | v3Manifest | string;
    if (asString) {
      return JSON.stringify(manifest);
    }
    return manifest;
  }

  public async getManifestVersion(yamlJson: string | v2Sdl, networkType: NetworkType) {
    const sdl = this.getSdl(yamlJson, networkType);
    return sdl.manifestVersion();
  }

  public getManifestYaml(sdlConfig: v2Sdl, networkType: NetworkType) {
    const sdl = this.getSdl(sdlConfig, networkType);
    return sdl.manifestSortedJSON();
  }

  public validateSdl(yamlJson: string) {
    try {
      SDL.fromString(yamlJson, "beta3");
      return true;
    } catch {
      return false;
    }
  }

  public appendAuditorRequirement(yamlStr: string, allowedAuditors: string[]): string {
    const sdl = this.getSdl(yamlStr, "beta3");
    const sdlData = sdl.data as v2Sdl;
    const placementData = sdlData?.profiles?.placement || {};

    for (const [, value] of Object.entries(placementData)) {
      if (!value.signedBy?.anyOf || !value.signedBy?.allOf) {
        value.signedBy = {
          anyOf: value.signedBy?.anyOf || [],
          allOf: value.signedBy?.allOf || []
        };
      }

      for (const auditor of allowedAuditors) {
        if (!value.signedBy.anyOf.includes(auditor)) {
          value.signedBy.anyOf.push(auditor);
        }
      }
    }

    const result = yaml.dump(sdlData, {
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
