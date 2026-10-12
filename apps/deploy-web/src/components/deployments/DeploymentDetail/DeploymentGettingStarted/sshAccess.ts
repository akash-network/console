import type { LeaseStatusDto } from "@src/queries/useLeaseQuery";
import { SSH_PUBKEY_ENV_KEY } from "@src/types/sdlBuilder/sdlBuilder";
import { isVmImage } from "@src/utils/sdl/vmImages";
import type { ManifestServiceDetail } from "../DeploymentPlacements/placementModel";

const SSH_PORT = 22;

const MAX_PORT = 65535;

const PLAIN_HOST = /^[A-Za-z0-9.:-]+$/;

/** Must match where the configure page's SSH key instructions put the private key it generates. */
export const SSH_PRIVATE_KEY_PATH = "~/.ssh/id_rsa";

export interface SshCommand {
  serviceName: string;
  command: string;
}

export function isSshService(service: ManifestServiceDetail): boolean {
  return (!!service.image && isVmImage(service.image)) || !!service.env?.some(entry => entry.key === SSH_PUBKEY_ENV_KEY);
}

export function buildSshCommands(
  manifestServices: Record<string, ManifestServiceDetail>,
  forwardedPortsByService: LeaseStatusDto["forwarded_ports"]
): SshCommand[] {
  return Object.entries(forwardedPortsByService).flatMap(([serviceName, forwardedPorts]) => {
    const service = manifestServices[serviceName];
    if (!service || !isSshService(service)) return [];

    return forwardedPorts
      .filter(forwardedPort => forwardedPort.port === SSH_PORT && PLAIN_HOST.test(forwardedPort.host) && isValidPort(forwardedPort.externalPort))
      .map(forwardedPort => ({ serviceName, command: `ssh root@${forwardedPort.host} -p ${forwardedPort.externalPort} -i ${SSH_PRIVATE_KEY_PATH}` }));
  });
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= MAX_PORT;
}
