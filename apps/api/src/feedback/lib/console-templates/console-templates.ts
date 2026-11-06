export interface ConsoleTemplate {
  id: string;
  name: string;
  summary: string;
  sdl: string;
}

/** Mirrors `helloWorldTemplate` in deploy-web, which the onboarding picker deploys under the same id. */
const HELLO_WORLD: ConsoleTemplate = {
  id: "hello-world",
  name: "Hello World",
  summary: "Console's own hello world: a small web page that is live in about a minute. No placement attributes, so any provider can bid.",
  sdl: `---
version: "2.0"
services:
  web:
    image: ghcr.io/akash-network/hello-akash-world:2.1.0
    expose:
      - port: 3000
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 512Mi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 10000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`
};

export const CONSOLE_TEMPLATES: readonly ConsoleTemplate[] = [HELLO_WORLD];

export function consoleTemplateById(id: string): ConsoleTemplate | undefined {
  return CONSOLE_TEMPLATES.find(template => template.id === id);
}
