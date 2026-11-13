import type { components } from "@akashnetwork/console-api-types";

export type UserTemplateListItem = components["schemas"]["UserTemplateListItem"];

export type TemplateVisibility = UserTemplateListItem["visibility"];

export type TemplateIconId = NonNullable<components["schemas"]["CreateUserTemplateRequest"]["data"]["icon"]>;
