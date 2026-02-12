/**
 * Custom Monaco language definition for deployment logs/events.
 *
 * Log format (logs):   [serviceName]: message
 * Event format:        [serviceName]: [type] [reason] [objectKind] note
 */

/* eslint-disable no-useless-escape */
import { languages } from "monaco-editor/esm/vs/editor/editor.api.js";

const logLanguage: languages.IMonarchLanguage = {
  tokenPostfix: ".log",
  tokenizer: {
    root: [
      [/^\[[\w.-]+\]:/, "namespace"],
      [/\[Warning\]/, "keyword"],
      [/\[Normal\]/, "string"],
      [/\[[\w]+\]/, "type"],
      [/[^\[]+/, "string"]
    ]
  }
};

languages.register({ id: "log" });
languages.setMonarchTokensProvider("log", logLanguage);
