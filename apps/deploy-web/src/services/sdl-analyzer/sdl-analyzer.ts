export class SDLAnalyzer {
  readonly #config: SDLAnalyzerConfig;

  constructor(config: SDLAnalyzerConfig) {
    this.#config = config;
  }

  hasCiCdImage(yml: string | null | undefined): boolean {
    if (!yml) return false;
    return yml.includes(this.#config.ciCdImageName);
  }
}

export interface SDLAnalyzerConfig {
  ciCdImageName: string;
}
