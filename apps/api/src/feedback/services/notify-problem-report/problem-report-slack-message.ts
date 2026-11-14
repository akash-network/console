import type { AssistantProblemReportOutput } from "@src/feedback/repositories/assistant-problem-report/assistant-problem-report.repository";
import type { ReportedTurn } from "@src/feedback/repositories/assistant-turn-trace/assistant-turn-trace.repository";
import type { AssistantSlackMessage } from "@src/feedback/services/assistant-slack-notifier/assistant-slack-notifier.service";

export const PROBLEM_REPORT_HEADLINE = ":triangular_flag_on_post: *Assistant problem report*";

function escapeSlackText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function describeTranscript(report: Pick<AssistantProblemReportOutput, "transcript">): string {
  return report.transcript === null ? "Transcript: stored conversation" : "Transcript: attached";
}

function describeTurn(turn: ReportedTurn | undefined): string {
  return turn ? `Reported turn: ${turn.outcome} · ${escapeSlackText(turn.model)}` : "Reported turn: unknown";
}

/** Carries no user text, so neither the note nor the transcript ever reaches Slack. */
export function buildProblemReportSlackMessage(input: {
  report: Pick<AssistantProblemReportOutput, "note" | "transcript">;
  turn: ReportedTurn | undefined;
  adminConversationUrl: string | undefined;
}): AssistantSlackMessage {
  const attachments = `${describeTranscript(input.report)} · Note: ${input.report.note ? "attached" : "none"}`;
  const lines = [PROBLEM_REPORT_HEADLINE, attachments, describeTurn(input.turn)];
  if (input.adminConversationUrl) lines.push(`<${input.adminConversationUrl}|Open in admin>`);

  return { text: lines.join("\n") };
}
