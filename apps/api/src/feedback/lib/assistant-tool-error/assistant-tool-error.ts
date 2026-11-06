/** A refusal the model can act on, whose message goes back to it as the tool result. */
export class AssistantToolError extends Error {
  name = "AssistantToolError";
}

/** A proposal held back before its card is shown, whose screening result goes back to the model so it can adjust or explain. */
export class AssistantProposalWithheldError extends Error {
  name = "AssistantProposalWithheldError";

  constructor(readonly feedback: Record<string, unknown>) {
    super("The proposal was held back");
  }
}
