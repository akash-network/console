type ProjectAwareConfig = { test?: { projects?: unknown[] } };

export declare function unitProjectsOnly<TConfig extends ProjectAwareConfig>(config: TConfig): TConfig;
