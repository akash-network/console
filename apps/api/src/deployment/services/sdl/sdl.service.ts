import { SDL } from "@akashnetwork/akashjs/build/sdl";
import { v2Manifest, v2Sdl, v3Manifest } from "@akashnetwork/akashjs/build/sdl/types";
import { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";

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

  public getManifest(yamlJson: string | v2Sdl, networkType: NetworkType, asString = false): string | v2Manifest | v3Manifest {
    const sdl = this.getSdl(yamlJson, networkType);
    const manifest = sdl.manifest(asString);
    return asString ? (JSON.stringify(manifest) as string) : manifest;
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
    } catch (error) {
      return false;
    }
  }
}
