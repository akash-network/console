import { SDL } from "@akashnetwork/akashjs/build/sdl";
import { v2Sdl } from "@akashnetwork/akashjs/build/sdl/types";
import { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import { singleton } from "tsyringe";

type NetworkType = "beta2" | "beta3";

@singleton()
export class SdlService {
  private isValidString(value: unknown): value is string {
    return typeof value === "string" && !!value;
  }

  private getSdl(yamlJson: string | v2Sdl, networkType: NetworkType, networkId: NetworkId) {
    return this.isValidString(yamlJson) ? SDL.fromString(yamlJson, networkType, networkId) : new SDL(yamlJson, networkType, networkId);
  }

  public getDeploymentGroups(yamlJson: string | v2Sdl, networkType: NetworkType, networkId: NetworkId) {
    const sdl = this.getSdl(yamlJson, networkType, networkId);
    return sdl.groups();
  }

  public getManifest(yamlJson: string | v2Sdl, networkType: NetworkType, networkId: NetworkId, asString = false): string | any {
    const sdl = this.getSdl(yamlJson, networkType, networkId);
    const manifest = sdl.manifest(asString);
    return asString ? JSON.stringify(manifest) : manifest;
  }

  public async getManifestVersion(yamlJson: string | v2Sdl, networkType: NetworkType, networkId: NetworkId) {
    const sdl = this.getSdl(yamlJson, networkType, networkId);
    return sdl.manifestVersion();
  }

  public getManifestYaml(sdlConfig: v2Sdl, networkType: NetworkType, networkId: NetworkId) {
    const sdl = this.getSdl(sdlConfig, networkType, networkId);
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
