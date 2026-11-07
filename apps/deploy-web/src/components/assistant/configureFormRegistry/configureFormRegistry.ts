import { useSyncExternalStore } from "react";

import type { AssistantActionOf } from "@src/types/assistant";

export interface ConfigureFormPlacementScreening {
  placement: string;
  status: "screened" | "screening" | "failed" | "not_screenable";
  providersAbleToBid?: number;
  notBidding?: number;
  reasons?: string[];
}

export interface ConfigureFormServiceRead {
  name: string;
  placement: string | null;
  image: string | null;
  replicas: number;
  cpu: number;
  cpuArch: string | null;
  memory: string;
  ephemeralStorage: string;
  ramStorage: { size: string; mount: string | null } | null;
  persistentStorage: { name: string | null; class: string | null; size: string; mount: string | null; readOnly: boolean }[];
  gpu: { units: number; models: string[] } | null;
  ports: { port: number; as: number | null; proto: string | null; global: boolean }[];
  envNames: string[];
  hasCommand: boolean;
}

/** What the assistant may read of the form: names of env variables but never their values, and no command, credentials or keys. */
export interface ConfigureFormRead {
  phase: string;
  editable: boolean;
  services: ConfigureFormServiceRead[];
  placements: { name: string; regions: string[]; attributes: { key: string; value: string }[] }[];
  invalidSettings: string[];
  providers: ConfigureFormPlacementScreening[];
  screeningSdl: string | null;
}

export type ConfigureFormEdit = Pick<AssistantActionOf<"edit_configure_form">, "services" | "placements">;

export interface ConfigureFormHandle {
  read(): ConfigureFormRead;
  /** Throws with a message the user can act on when the edit does not fit the form. */
  applyEdit(edit: ConfigureFormEdit): void;
}

/** Lets the assistant panel, which renders outside the configure page, reach the one configure form while it is mounted. */
export class ConfigureFormRegistry {
  #handle: ConfigureFormHandle | null = null;
  readonly #listeners = new Set<() => void>();

  get current(): ConfigureFormHandle | null {
    return this.#handle;
  }

  publish(handle: ConfigureFormHandle): () => void {
    this.#setHandle(handle);
    return () => {
      if (this.#handle === handle) this.#setHandle(null);
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  #setHandle(handle: ConfigureFormHandle | null) {
    this.#handle = handle;
    this.#listeners.forEach(listener => listener());
  }
}

const configureFormRegistry = new ConfigureFormRegistry();

export function useConfigureFormRegistry(): ConfigureFormRegistry {
  return configureFormRegistry;
}

export function useIsConfigureFormOpen(registry: ConfigureFormRegistry = configureFormRegistry): boolean {
  return useSyncExternalStore(
    registry.subscribe,
    () => registry.current !== null,
    () => false
  );
}
