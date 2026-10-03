export type ShellTokenKind = "comment" | "command" | "string" | "plain";

export type ShellToken = { text: string; kind: ShellTokenKind };

const SHELL_COMMANDS = ["curl", "jq", "export", "until", "do", "done", "sleep", "npx", "brew", "akt"];

const SHELL_TOKEN_PATTERN = new RegExp(`("[^"]*"|'[^']*'|(?<![\\w./-])(?:${SHELL_COMMANDS.join("|")})(?![\\w./-]))`);

export function tokenizeShellLine(line: string): ShellToken[] {
  if (line.trimStart().startsWith("#")) return [{ text: line, kind: "comment" }];

  return line
    .split(SHELL_TOKEN_PATTERN)
    .filter(text => text !== "")
    .map(text => ({ text, kind: classifyShellToken(text) }));
}

function classifyShellToken(text: string): ShellTokenKind {
  if (text.startsWith('"') || text.startsWith("'")) return "string";
  return SHELL_COMMANDS.includes(text) ? "command" : "plain";
}
