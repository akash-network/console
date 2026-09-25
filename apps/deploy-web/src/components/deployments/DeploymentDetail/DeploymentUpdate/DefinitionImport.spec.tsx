import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto } from "@src/types/deployment";
import { DefinitionImport, DEPENDENCIES } from "./DefinitionImport";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const BROWSER_SDL = `version: "2.0"
services:
  web:
    image: ghcr.io/acme/web:1.2.0
    env:
      - DATABASE_PASSWORD=hunter2hunter2
      - LOG_LEVEL=debug
    expose:
      - port: 80
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
          - size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

const IMPORTED_SDL = `version: "2.0"
services:
  api:
    image: ghcr.io/acme/api:3.0.0
    env:
      - API_TOKEN=ac-secret://API_TOKEN
      - MODE=prod
    credentials:
      host: ghcr.io
      username: acme-bot
      password: registry-password
`;

const SDL_WITH_REFERENCED_CREDENTIALS = `version: "2.0"
services:
  api:
    image: ghcr.io/acme/api:3.0.0
    credentials:
      host: ghcr.io
      username: ac-secret://REGISTRY_USERNAME
      password: ac-secret://REGISTRY_PASSWORD
`;

const SDL_REPEATING_A_VARIABLE = `version: "2.0"
services:
  api:
    image: ghcr.io/acme/api:3.0.0
    env:
      - API_TOKEN=plain-token
      - API_TOKEN=ac-secret://API_TOKEN
`;

const SDL_REFERRING_TO_A_BUILT_IN_NAME = `version: "2.0"
services:
  api:
    image: ghcr.io/acme/api:3.0.0
    env:
      - FORMATTER=ac-secret://toString
`;

describe(DefinitionImport.name, () => {
  describe("with this browser's copy of the definition", () => {
    it("offers to save it straight away, saying where it came from", () => {
      setup({ browserSdl: BROWSER_SDL });

      expect(screen.getByText(/this browser still has the copy it was created with/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save to my account" })).toBeEnabled();
    });

    it("lists each variable by name with a switch to keep it secret, suggesting the ones that look like secrets", () => {
      setup({ browserSdl: BROWSER_SDL });

      const web = screen.getByRole("group", { name: "Service web" });
      expect(within(web).getByRole("switch", { name: "Keep DATABASE_PASSWORD secret" })).toBeChecked();
      expect(within(web).getByRole("switch", { name: "Keep LOG_LEVEL secret" })).not.toBeChecked();
    });

    it("never shows a variable's value", () => {
      setup({ browserSdl: BROWSER_SDL });

      expect(screen.queryByText(/hunter2hunter2/)).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue("hunter2hunter2")).not.toBeInTheDocument();
    });

    it("records it with the variables kept secret sealed and the rest as written", async () => {
      const { record } = setup({ browserSdl: BROWSER_SDL });

      await userEvent.click(screen.getByRole("button", { name: "Save to my account" }));

      const [definition] = record.mock.calls[0];
      expect(definition.secrets).toEqual({ DATABASE_PASSWORD: "hunter2hunter2" });
      expect(definition.sdl).toContain("DATABASE_PASSWORD=ac-secret://DATABASE_PASSWORD");
      expect(definition.sdl).toContain("LOG_LEVEL=debug");
    });

    it("records a variable switched off as written", async () => {
      const { record } = setup({ browserSdl: BROWSER_SDL });

      await userEvent.click(screen.getByRole("switch", { name: "Keep DATABASE_PASSWORD secret" }));
      await userEvent.click(screen.getByRole("button", { name: "Save to my account" }));

      expect(record).toHaveBeenCalledWith({ sdl: BROWSER_SDL, secrets: {} });
    });

    it("holds the save while one runs", () => {
      setup({ browserSdl: BROWSER_SDL, isSaving: true });

      expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    });
  });

  describe("without a copy of the definition", () => {
    it("asks for the sdl instead of showing an empty form", () => {
      setup({});

      expect(screen.getByText(/Upload or paste the SDL it was created with/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save to my account" })).not.toBeInTheDocument();
    });

    it("reviews an sdl imported through the dialog before recording it", async () => {
      const { record } = setup({});

      await userEvent.click(screen.getByRole("button", { name: "Upload or paste SDL" }));
      await userEvent.click(screen.getByRole("button", { name: "import-the-sdl" }));

      expect(screen.getByRole("group", { name: "Service api" })).toBeInTheDocument();
      expect(record).not.toHaveBeenCalled();
    });

    it("asks for a value for each secret the sdl refers to, and holds the save until each has one", async () => {
      const { record } = setup({ importedSdl: IMPORTED_SDL });
      await chooseTheImportedSdl();

      expect(screen.getByRole("button", { name: "Save to my account" })).toBeDisabled();
      await userEvent.type(screen.getByLabelText("API_TOKEN value"), "token-value");
      await userEvent.click(screen.getByRole("button", { name: "Save to my account" }));

      expect(record.mock.calls[0][0].secrets).toMatchObject({ API_TOKEN: "token-value" });
    });

    it("says registry credentials are saved as secrets, and seals them", async () => {
      const { record } = setup({ importedSdl: IMPORTED_SDL });
      await chooseTheImportedSdl();

      expect(screen.getByText("Registry credentials are always saved as secrets.")).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText("API_TOKEN value"), "token-value");
      await userEvent.click(screen.getByRole("button", { name: "Save to my account" }));

      expect(record.mock.calls[0][0].secrets).toMatchObject({ REGISTRY_USERNAME: "acme-bot", REGISTRY_PASSWORD: "registry-password" });
    });

    it("holds the save for a secret named like an object built-in until it has a value", async () => {
      const { record } = setup({ importedSdl: SDL_REFERRING_TO_A_BUILT_IN_NAME });
      await chooseTheImportedSdl();

      expect(screen.getByLabelText("FORMATTER value")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Save to my account" })).toBeDisabled();
      await userEvent.type(screen.getByLabelText("FORMATTER value"), "json");
      await userEvent.click(screen.getByRole("button", { name: "Save to my account" }));

      expect(record.mock.calls[0][0].secrets).toEqual({ toString: "json" });
    });

    it("asks for a value for each secret a registry credential refers to, and holds the save until each has one", async () => {
      const { record } = setup({ importedSdl: SDL_WITH_REFERENCED_CREDENTIALS });
      await chooseTheImportedSdl();

      await userEvent.type(screen.getByLabelText("Registry username value"), "acme-bot");
      expect(screen.getByRole("button", { name: "Save to my account" })).toBeDisabled();
      await userEvent.type(screen.getByLabelText("Registry password value"), "registry-password");
      await userEvent.click(screen.getByRole("button", { name: "Save to my account" }));

      expect(record.mock.calls[0][0].secrets).toEqual({ REGISTRY_USERNAME: "acme-bot", REGISTRY_PASSWORD: "registry-password" });
    });
  });

  it("asks for the value of a reference a repeated variable carries", async () => {
    const { record } = setup({ importedSdl: SDL_REPEATING_A_VARIABLE });
    await chooseTheImportedSdl();

    expect(screen.getByRole("button", { name: "Save to my account" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("API_TOKEN value"), "token-value");
    await userEvent.click(screen.getByRole("button", { name: "Save to my account" }));

    expect(record.mock.calls[0][0].secrets).toMatchObject({ API_TOKEN: "token-value" });
  });

  describe("an sdl that does not match what the deployment runs", () => {
    it("explains it and offers to apply the sdl as an update or to choose another", async () => {
      const { applyAsUpdate } = setup({ browserSdl: BROWSER_SDL, mismatch: true });

      expect(screen.getByText(/doesn't match what the deployment is running/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Apply as update" }));

      expect(applyAsUpdate).toHaveBeenCalledWith(expect.objectContaining({ secrets: { DATABASE_PASSWORD: "hunter2hunter2" } }));
      expect(screen.getByRole("button", { name: "Choose another SDL" })).toBeInTheDocument();
    });

    it("offers no update for a closed deployment", () => {
      setup({ browserSdl: BROWSER_SDL, mismatch: true, deploymentState: "closed" });

      expect(screen.getByText(/doesn't match what the deployment ran/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Apply as update" })).not.toBeInTheDocument();
    });

    it("offers the update only once every secret the sdl refers to has a value", async () => {
      setup({ browserSdl: IMPORTED_SDL, mismatch: true });

      expect(screen.getByRole("button", { name: "Apply as update" })).toBeDisabled();
      await userEvent.type(screen.getByLabelText("API_TOKEN value"), "token-value");

      expect(screen.getByRole("button", { name: "Apply as update" })).toBeEnabled();
    });
  });

  describe("the api's verdict on the sdl last sent", () => {
    it("is dropped once another sdl is chosen", async () => {
      const { clearRefusals } = setup({ browserSdl: BROWSER_SDL, mismatch: true });

      await userEvent.click(screen.getByRole("button", { name: "Choose another SDL" }));
      await userEvent.click(screen.getByRole("button", { name: "import-the-sdl" }));

      expect(clearRefusals).toHaveBeenCalled();
    });

    it("is dropped once a secret's value changes", async () => {
      const { clearRefusals } = setup({ browserSdl: IMPORTED_SDL, mismatch: true });

      await userEvent.type(screen.getByLabelText("API_TOKEN value"), "t");

      expect(clearRefusals).toHaveBeenCalled();
    });

    it("is dropped once a variable is switched", async () => {
      const { clearRefusals } = setup({ browserSdl: BROWSER_SDL, refusal: "Invalid SDL" });

      await userEvent.click(screen.getByRole("switch", { name: "Keep DATABASE_PASSWORD secret" }));

      expect(clearRefusals).toHaveBeenCalled();
    });
  });

  it("shows the refusal the api gave for the document", () => {
    setup({ browserSdl: BROWSER_SDL, refusal: 'Invalid SDL: no value supplied for SDL Reference "ac-secret://API_TOKEN"' });

    expect(screen.getByText('Invalid SDL: no value supplied for SDL Reference "ac-secret://API_TOKEN"')).toBeInTheDocument();
  });

  it("lets another sdl be chosen in place of the one under review", async () => {
    setup({ browserSdl: BROWSER_SDL, importedSdl: IMPORTED_SDL });

    await userEvent.click(screen.getByRole("button", { name: "Choose another SDL" }));
    await userEvent.click(screen.getByRole("button", { name: "import-the-sdl" }));

    expect(screen.getByRole("group", { name: "Service api" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Service web" })).not.toBeInTheDocument();
  });

  async function chooseTheImportedSdl() {
    await userEvent.click(screen.getByRole("button", { name: "Upload or paste SDL" }));
    await userEvent.click(screen.getByRole("button", { name: "import-the-sdl" }));
  }

  function setup(
    input: {
      browserSdl?: string;
      importedSdl?: string;
      isSaving?: boolean;
      mismatch?: boolean;
      refusal?: string | null;
      deploymentState?: string;
    } = {}
  ) {
    const record = vi.fn();
    const applyAsUpdate = vi.fn();
    const clearRefusals = vi.fn();
    const onImported = vi.fn();
    const useDefinitionImport: typeof DEPENDENCIES.useDefinitionImport = () => ({
      record,
      applyAsUpdate,
      clearRefusals,
      isSaving: input.isSaving ?? false,
      mismatch: input.mismatch ?? false,
      refusal: input.refusal ?? null
    });
    const ImportSdlDialog: typeof DEPENDENCIES.ImportSdlDialog = props => (
      <button type="button" onClick={() => "onImportSdl" in props && props.onImportSdl(input.importedSdl ?? IMPORTED_SDL, { method: "paste" })}>
        import-the-sdl
      </button>
    );

    render(
      <DefinitionImport
        deployment={mock<DeploymentDto>({ dseq: "4321", state: input.deploymentState ?? "active" })}
        browserSdl={input.browserSdl}
        onImported={onImported}
        dependencies={{ ...DEPENDENCIES, useDefinitionImport, ImportSdlDialog }}
      />
    );

    return { record, applyAsUpdate, clearRefusals, onImported };
  }
});
