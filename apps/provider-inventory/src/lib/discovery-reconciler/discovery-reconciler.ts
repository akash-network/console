import type { ChainProvider } from "@src/types/chain-provider";

export interface StreamHandle {
  hostUri: string;
}

export type DiscoveryCommand =
  | { kind: "stop"; owner: string }
  | { kind: "refreshAttributes"; provider: ChainProvider }
  | { kind: "start"; provider: ChainProvider }
  | { kind: "restart"; provider: ChainProvider };

export function* reconcileDiscovery(
  currentRegistry: ReadonlyMap<string, StreamHandle>,
  latestProviderState: readonly ChainProvider[]
): Generator<DiscoveryCommand> {
  const newProviders = new Set<string>(latestProviderState.map(p => p.owner));

  for (const owner of currentRegistry.keys()) {
    if (!newProviders.has(owner)) {
      yield { kind: "stop", owner };
    }
  }

  const orderedByHeightDesc = [...latestProviderState].sort((a, b) => {
    if (a.createdHeight === b.createdHeight) return 0;
    return a.createdHeight > b.createdHeight ? -1 : 1;
  });
  for (const provider of orderedByHeightDesc) {
    const observedProvider = currentRegistry.get(provider.owner);
    if (!observedProvider) {
      yield { kind: "start", provider };
    } else if (observedProvider.hostUri !== provider.hostUri) {
      yield { kind: "restart", provider };
    } else {
      yield { kind: "refreshAttributes", provider };
    }
  }
}
