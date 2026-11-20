/** Changing any of this copy means bumping `version`, which asks every user to agree again. */
export const ASSISTANT_CONSENT_COPY = {
  version: "2026-11-19",
  title: "Before we start",
  intro: "The assistant answers using your account, so here's what happens with your data.",
  points: [
    "Your messages, and the deployment and billing details it looks up to answer, are processed by an AI model running on Akash (AkashML).",
    "It never changes anything without you clicking Confirm.",
    "Secrets we recognize in env vars and SDL, such as passwords and tokens, are removed before anything is sent or saved."
  ],
  reviewOptInLabel: "Let the Akash team review my conversations to improve Console",
  reviewOptInDescription:
    "Optional. Saved conversations are sorted into topics by AI services we use (AkashML, and in some cases TypeSafe). Without this, your conversations aren't saved. You can change it anytime in Settings."
} as const;

export const ASSISTANT_CONSENT_COPY_VERSION = ASSISTANT_CONSENT_COPY.version;
