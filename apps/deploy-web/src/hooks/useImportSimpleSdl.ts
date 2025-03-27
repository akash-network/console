import { useMemo } from "react";

import { importSimpleSdl } from "@src/utils/sdl/sdlImport";

export function useImportSimpleSdl(sdl: string | null | undefined) {
  return useMemo(() => {
    if (!sdl) return [];

    try {
      return importSimpleSdl(sdl);
    } catch (error) {
      console.error("Failed to parse SDL:", error);
      return [];
    }
  }, [sdl]);
}
