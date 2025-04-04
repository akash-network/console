import { v2Sdl } from "@akashnetwork/akashjs/build/sdl/types";
import dot from "dot-object";
import update, { CustomCommands, Spec } from "immutability-helper";
import { dump } from "js-yaml";

import sdlBasic from "./sdl-basic.json";

type AnySpec = Spec<object, CustomCommands<object>>;

export const createSdlJson = ($spec: AnySpec = {}): v2Sdl => {
  return update(sdlBasic, dot.object($spec)) as unknown as v2Sdl;
};

export const createSdlYml = ($spec: AnySpec = {}): string => {
  return dump(createSdlJson($spec), { forceQuotes: true, quotingType: '"' });
};
