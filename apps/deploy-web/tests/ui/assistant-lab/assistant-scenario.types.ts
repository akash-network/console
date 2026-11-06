export const SCENARIO_CATEGORIES = ["first_deploy", "sdl", "troubleshooting", "lifecycle", "billing", "knowledge", "vague_multi_turn", "safety", "ux"] as const;

export type ScenarioCategory = (typeof SCENARIO_CATEGORIES)[number];

export const LAB_FIXTURES = ["live_web", "crash_loop", "oom", "bad_image", "private_image", "wrong_port", "no_bids", "closed"] as const;

export type LabFixture = (typeof LAB_FIXTURES)[number];

export type StartPage = "home" | "deployments" | "billing" | "templates" | "new_deployment" | { fixture: LabFixture };

export type ScenarioStep =
  | { say: string }
  | { followCard: "primary" | "cancel"; reason?: string; expectUrl?: RegExp }
  | { navigateTo: "deployments" | "billing" | "templates" | { fixture: LabFixture } }
  | { press: "Escape" | "Shift+A" };

export interface ScenarioExpectation {
  calls?: string[];
  neverCalls?: string[];
  proposes?: string[];
  proposesAnyOf?: string[];
  neverProposes?: boolean;
  neverProposesTypes?: string[];
  mentions?: string[];
  mentionsAnyOf?: string[];
  neverMentions?: string[];
  liveHelp?: boolean;
  panelStaysOpen?: boolean;
  panelClosed?: boolean;
}

export interface AssistantScenario {
  id: string;
  category: ScenarioCategory;
  title: string;
  start: StartPage;
  steps: ScenarioStep[];
  expect: ScenarioExpectation;
  viewport?: "mobile";
  mayCreateDeployments?: boolean;
  mirroredInApiEval?: boolean;
}
