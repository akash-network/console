/** A refusal the model can act on, whose message goes back to it as the tool result. */
export class AssistantToolError extends Error {
  name = "AssistantToolError";
}
