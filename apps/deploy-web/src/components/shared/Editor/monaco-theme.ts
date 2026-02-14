import { editor } from "monaco-editor/esm/vs/editor/editor.api.js";

editor.defineTheme("vs-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "log.error", foreground: "f48771", fontStyle: "bold" },
    { token: "log.exception", foreground: "f48771" },
    { token: "log.warning", foreground: "dcdcaa" },
    { token: "log.info", foreground: "4fc1ff" },
    { token: "log.debug", foreground: "608b4e" },
    { token: "log.verbose", foreground: "608b4e" },
    { token: "log.date", foreground: "808080" },
    { token: "namespace", foreground: "4ec9b0" }
  ],
  colors: {}
});

editor.defineTheme("hc-light", {
  base: "hc-light",
  inherit: true,
  rules: [
    { token: "log.error", foreground: "cd3131", fontStyle: "bold" },
    { token: "log.exception", foreground: "cd3131" },
    { token: "log.warning", foreground: "bf8803" },
    { token: "log.info", foreground: "0000ff" },
    { token: "log.debug", foreground: "008000" },
    { token: "log.verbose", foreground: "008000" },
    { token: "log.date", foreground: "808080" },
    { token: "namespace", foreground: "267f99" }
  ],
  colors: {}
});
