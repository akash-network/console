import type { ScenarioExpectation } from "./assistant-scenario.types";
import type { RecordedRequest } from "./assistant-turn-recorder";

export interface TurnToolCall {
  name: string;
  summary: string | null;
  ok: boolean | null;
}

export interface TurnProposal {
  type: string;
  action: Record<string, unknown>;
}

export interface TurnRecord {
  said: string;
  ttftMs: number | null;
  totalMs: number;
  toolCalls: TurnToolCall[];
  proposals: TurnProposal[];
  liveHelp: boolean;
  text: string;
  doneReason: string | null;
  error: string | null;
  httpStatus: number | null;
  timedOut: boolean;
}

export type UxIssue =
  | "empty_answer"
  | "error"
  | "timeout"
  | "duplicate_reads"
  | "failed_reads"
  | "slow_first_token"
  | "slow_turn"
  | "long_answer"
  | "leaks_tool_names"
  | "cut_off";

export interface ScenarioScore {
  answered: boolean;
  correct: boolean;
  actionable: boolean;
  resolved: boolean;
  failures: string[];
  uxIssues: UxIssue[];
  toolCalls: number;
  maxTtftMs: number | null;
  totalMs: number;
}

const SLOW_FIRST_TOKEN_MS = 10_000;
const SLOW_TURN_MS = 45_000;
const LONG_ANSWER_WORDS = 250;
const POINTS_THE_WAY = /\b(go to|open|click|select|choose|page|tab|settings|billing|templates|deploy button|discord)\b/i;
const TOOL_NAME_LEAK = /\b(propose_[a-z_]+|search_docs|get_bids|get_deployment|list_templates|read_logs|read_events|suggest_live_help|tool call)\b/;

export function turnRecordOf(said: string, sentAt: number, requests: RecordedRequest[], timedOut: boolean): TurnRecord {
  const events = requests.flatMap(request => request.events);
  const firstText = events.find(({ event }) => event.type === "text_delta" && String(event.text ?? "").trim());
  const summaries = new Map<string, { summary: string | null; ok: boolean | null }>();
  for (const { event } of events) {
    if (event.type === "tool_result_summary") summaries.set(String(event.toolCallId), { summary: String(event.summary), ok: Boolean(event.ok) });
  }

  const last = events.at(-1)?.event;
  const failedRequest = requests.find(request => request.status !== null && request.status !== 200);
  const endedAt = Math.max(sentAt, ...requests.map(request => request.endedAt ?? request.startedAt));

  return {
    said,
    ttftMs: firstText ? firstText.at - sentAt : null,
    totalMs: endedAt - sentAt,
    toolCalls: events
      .filter(({ event }) => event.type === "tool_started")
      .map(({ event }) => ({ name: String(event.name), ...(summaries.get(String(event.toolCallId)) ?? { summary: null, ok: null }) })),
    proposals: events
      .filter(({ event }) => event.type === "action_proposal")
      .map(({ event }) => {
        const action = event.action as Record<string, unknown>;
        return { type: String(action.type), action };
      }),
    liveHelp: events.some(({ event }) => event.type === "live_help_suggested"),
    text: events
      .filter(({ event }) => event.type === "text_delta")
      .map(({ event }) => String(event.text ?? ""))
      .join(""),
    doneReason: last?.type === "done" ? String(last.reason) : null,
    error: last?.type === "error" ? String(last.code) : failedRequest ? `http_${failedRequest.status}` : null,
    httpStatus: failedRequest?.status ?? requests[0]?.status ?? null,
    timedOut
  };
}

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function expectationFailures(expected: ScenarioExpectation, turns: TurnRecord[], panel: { isOpen: boolean }): string[] {
  const called = new Set(turns.flatMap(turn => turn.toolCalls.map(call => call.name)));
  const proposed = turns.flatMap(turn => turn.proposals.map(proposal => proposal.type));
  const text = turns.map(turn => turn.text).join("\n");
  const proposalText = turns.flatMap(turn => turn.proposals.map(proposal => JSON.stringify(proposal.action))).join("\n");
  const failures: string[] = [];

  for (const name of expected.calls ?? []) if (!called.has(name)) failures.push(`did not call ${name}`);
  for (const name of expected.neverCalls ?? []) if (called.has(name)) failures.push(`called ${name}`);
  for (const type of expected.proposes ?? []) if (!proposed.includes(type)) failures.push(`did not propose ${type}`);
  if (expected.proposesAnyOf && !expected.proposesAnyOf.some(type => proposed.includes(type)))
    failures.push(`proposed none of ${expected.proposesAnyOf.join("/")}`);
  if (expected.neverProposes && proposed.length > 0) failures.push(`proposed ${proposed.join(", ")}`);
  for (const type of expected.neverProposesTypes ?? []) if (proposed.includes(type)) failures.push(`proposed ${type}`);
  for (const needle of expected.mentions ?? []) {
    if (!includesText(text, needle) && !includesText(proposalText, needle)) failures.push(`never mentions "${needle}"`);
  }
  if (expected.mentionsAnyOf && !expected.mentionsAnyOf.some(needle => includesText(text, needle) || includesText(proposalText, needle)))
    failures.push(`mentions none of ${expected.mentionsAnyOf.join("/")}`);
  for (const needle of expected.neverMentions ?? []) if (includesText(text, needle)) failures.push(`says "${needle}"`);
  if (expected.liveHelp && !turns.some(turn => turn.liveHelp)) failures.push("no live help card");
  if (expected.panelStaysOpen && !panel.isOpen) failures.push("panel closed on navigation");
  if (expected.panelClosed && panel.isOpen) failures.push("panel still open");

  return failures;
}

function duplicateReadCount(turn: TurnRecord): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const call of turn.toolCalls) {
    if (call.name.startsWith("propose_")) continue;
    const key = `${call.name}:${call.summary ?? ""}`;
    if (seen.has(key)) duplicates++;
    seen.add(key);
  }

  return duplicates;
}

function uxIssuesOf(turns: TurnRecord[]): UxIssue[] {
  const issues = new Set<UxIssue>();

  for (const turn of turns) {
    const answeredSomehow = turn.text.trim().length > 0 || turn.proposals.length > 0 || turn.liveHelp;
    if (!answeredSomehow && !turn.error) issues.add("empty_answer");
    if (turn.error) issues.add("error");
    if (turn.timedOut) issues.add("timeout");
    if (duplicateReadCount(turn) > 0) issues.add("duplicate_reads");
    if (turn.toolCalls.some(call => call.ok === false)) issues.add("failed_reads");
    if (turn.ttftMs !== null && turn.ttftMs > SLOW_FIRST_TOKEN_MS) issues.add("slow_first_token");
    if (turn.totalMs > SLOW_TURN_MS) issues.add("slow_turn");
    if (turn.text.split(/\s+/).filter(Boolean).length > LONG_ANSWER_WORDS) issues.add("long_answer");
    if (TOOL_NAME_LEAK.test(turn.text)) issues.add("leaks_tool_names");
    if (turn.doneReason === "length") issues.add("cut_off");
  }

  return [...issues];
}

export function scoreScenario(expected: ScenarioExpectation, turns: TurnRecord[], panel: { isOpen: boolean }): ScenarioScore {
  const spoken = turns.filter(turn => turn.said);
  const failures = expectationFailures(expected, spoken, panel);
  const lastTurn = spoken.at(-1);
  const answered = spoken.every(turn => !turn.error && !turn.timedOut && (turn.text.trim().length > 0 || turn.proposals.length > 0 || turn.liveHelp));
  const actionable =
    !!lastTurn && (spoken.some(turn => turn.proposals.length > 0) || lastTurn.liveHelp || POINTS_THE_WAY.test(lastTurn.text) || !!expected.panelClosed);
  const ttfts = spoken.map(turn => turn.ttftMs).filter((ttft): ttft is number => ttft !== null);

  return {
    answered,
    correct: failures.length === 0,
    actionable,
    resolved: answered && failures.length === 0 && actionable,
    failures,
    uxIssues: uxIssuesOf(spoken),
    toolCalls: spoken.reduce((total, turn) => total + turn.toolCalls.length, 0),
    maxTtftMs: ttfts.length ? Math.max(...ttfts) : null,
    totalMs: spoken.reduce((total, turn) => total + turn.totalMs, 0)
  };
}
