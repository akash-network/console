import type { SDLInput } from "@akashnetwork/chain-sdk";
import dot from "dot-object";
import update, { type CustomCommands, type Spec } from "immutability-helper";
import { dump } from "js-yaml";

import sdlBasic from "./sdl-basic.json";

type AnySpec = Spec<object, CustomCommands<object>>;

export const createSdlJson = ($spec: AnySpec = {}): SDLInput => {
  return update(sdlBasic, dot.object($spec)) as unknown as SDLInput;
};

export const createSdlYml = ($spec: AnySpec = {}): string => {
  return dump(createSdlJson($spec), { forceQuotes: true, quotingType: '"' });
};
