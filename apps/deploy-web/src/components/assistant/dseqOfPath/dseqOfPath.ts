const DEPLOYMENT_PATH = /^\/deployments\/(\d+)(?:\/|$)/;

export function dseqOfPath(pathname: string | null): string | undefined {
  return pathname?.match(DEPLOYMENT_PATH)?.[1];
}
