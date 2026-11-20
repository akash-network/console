/** The compact JSON of a definition is itself a YAML document, so every check, limit and seal binding the SDL text goes through applies to it unchanged. */
export function submittedSdlOf(document: { sdl?: string; definition?: Record<string, unknown> }): string {
  return document.sdl ?? JSON.stringify(document.definition);
}
