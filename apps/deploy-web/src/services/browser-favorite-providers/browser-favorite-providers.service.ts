import type { NetworkStore } from "@akashnetwork/network-store";
import { fromBech32 } from "@cosmjs/encoding";

/** Favorites the app kept in this browser before they moved to the account, read only so they can be moved over. */
export class BrowserFavoriteProvidersService {
  constructor(
    private readonly storage: Storage,
    private readonly networkStore: NetworkStore
  ) {}

  /** Skips an entry the api would refuse, so one bad address cannot hold the others back. */
  read(): string[] {
    return [...new Set(storedFavoritesOf(this.storage.getItem(this.#key)).filter(isAkashAddress))];
  }

  forget(): void {
    this.storage.removeItem(this.#key);
  }

  get #key(): string {
    return `${this.networkStore.selectedNetworkId}/provider.data`;
  }
}

function storedFavoritesOf(stored: string | null): unknown[] {
  if (!stored) return [];

  try {
    const { favorites } = JSON.parse(stored) as { favorites?: unknown };
    return Array.isArray(favorites) ? favorites : [];
  } catch {
    return [];
  }
}

function isAkashAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    return fromBech32(value).prefix === "akash";
  } catch {
    return false;
  }
}
