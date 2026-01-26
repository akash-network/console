import type { Octokit } from "@octokit/rest";
import { mock, mockDeep } from "jest-mock-extended";

import type { LoggerService } from "@src/core";
import type { GithubChainRegistryChainResponse } from "@src/types";
import type { GithubDirectoryItem } from "@src/types/github";
import type { Template } from "../../types/template";
import type { TemplateProcessorService } from "../template-processor/template-processor.service";
import { REPOSITORIES, TemplateFetcherService } from "./template-fetcher.service";

type GetContentParams = { path: string; owner?: string; repo?: string; ref?: string };

describe(TemplateFetcherService.name, () => {
  describe("fetchLatestCommitSha", () => {
    it("returns commit SHA for awesome-akash repository", async () => {
      const { service, octokit } = setup();
      const expectedSha = "abc123def456";
      octokit.rest.repos.getBranch.mockResolvedValue({
        status: 200,
        headers: { "x-ratelimit-remaining": "4999" },
        data: { commit: { sha: expectedSha } }
      } as never);

      const result = await service.fetchLatestCommitSha("awesome-akash");

      expect(result).toBe(expectedSha);
      expect(octokit.rest.repos.getBranch).toHaveBeenCalledWith({
        owner: REPOSITORIES["awesome-akash"].repoOwner,
        repo: REPOSITORIES["awesome-akash"].repoName,
        branch: REPOSITORIES["awesome-akash"].mainBranch
      });
    });

    it("returns commit SHA for cosmos-omnibus repository", async () => {
      const { service, octokit } = setup();
      const expectedSha = "omnibus123";
      octokit.rest.repos.getBranch.mockResolvedValue({
        status: 200,
        headers: { "x-ratelimit-remaining": "4998" },
        data: { commit: { sha: expectedSha } }
      } as never);

      const result = await service.fetchLatestCommitSha("cosmos-omnibus");

      expect(result).toBe(expectedSha);
      expect(octokit.rest.repos.getBranch).toHaveBeenCalledWith({
        owner: REPOSITORIES["cosmos-omnibus"].repoOwner,
        repo: REPOSITORIES["cosmos-omnibus"].repoName,
        branch: REPOSITORIES["cosmos-omnibus"].mainBranch
      });
    });

    it("returns commit SHA for akash-linuxserver repository", async () => {
      const { service, octokit } = setup();
      const expectedSha = "linux456";
      octokit.rest.repos.getBranch.mockResolvedValue({
        status: 200,
        headers: { "x-ratelimit-remaining": "4997" },
        data: { commit: { sha: expectedSha } }
      } as never);

      const result = await service.fetchLatestCommitSha("akash-linuxserver");

      expect(result).toBe(expectedSha);
      expect(octokit.rest.repos.getBranch).toHaveBeenCalledWith({
        owner: REPOSITORIES["akash-linuxserver"].repoOwner,
        repo: REPOSITORIES["akash-linuxserver"].repoName,
        branch: REPOSITORIES["akash-linuxserver"].mainBranch
      });
    });

    it("updates githubRequestsRemaining from response headers", async () => {
      const { service, octokit } = setup();
      octokit.rest.repos.getBranch.mockResolvedValue({
        status: 200,
        headers: { "x-ratelimit-remaining": "4500" },
        data: { commit: { sha: "abc" } }
      } as never);

      await service.fetchLatestCommitSha("awesome-akash");

      expect(service.githubRequestsRemaining).toBe("4500");
    });

    it("throws error when API returns non-200 status", async () => {
      const { service, octokit } = setup();
      octokit.rest.repos.getBranch.mockResolvedValue({
        status: 404,
        headers: {},
        data: {}
      } as never);

      await expect(service.fetchLatestCommitSha("awesome-akash")).rejects.toThrow("Failed to fetch latest version of akash-network/awesome-akash from github");
    });
  });

  describe("fetchAwesomeAkashTemplates", () => {
    it("fetches templates from README.md", async () => {
      const { service, octokit, templateProcessor } = setup();
      const repoVersion = "abc123";
      const readmeContent =
        `# Awesome Akash\n` +
        `### AI\n` +
        `Some description\n` +
        `- [Template1](./template1)\n` +
        `- [Template2](./template2)\n` +
        `### Gaming\n` +
        `- [Game1](./games/game1)\n`;

      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.path === "README.md") {
          return { status: 200, headers: {}, data: readmeContent };
        }
        if (params.path === "./template1" || params.path === "./template2" || params.path === "./games/game1") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: `${params.path}/README.md` }),
              createDirectoryItem({ name: "deploy.yaml", path: `${params.path}/deploy.yaml` })
            ]
          };
        }
        if (params.path.endsWith("/README.md")) {
          return { status: 200, headers: {}, data: "# Template README" };
        }
        if (params.path.endsWith("/deploy.yaml")) {
          return { status: 200, headers: {}, data: "deploy content" };
        }
        return { status: 200, headers: {}, data: [] };
      });

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "processed-template" }));

      const result = await service.fetchAwesomeAkashTemplates(repoVersion);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("AI");
      expect(result[1].title).toBe("Gaming");
    });

    it("skips templates without deploy file", async () => {
      const { service, octokit, templateProcessor } = setup();
      const readmeContent = `### AI\n\n` + `- [Template1](./template1)\n`;

      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.path === "README.md") {
          return { status: 200, headers: {}, data: readmeContent };
        }
        if (params.path === "./template1") {
          return {
            status: 200,
            headers: {},
            data: [createDirectoryItem({ name: "README.md", path: "./template1/README.md" })]
          };
        }
        if (params.path === "./template1/README.md") {
          return { status: 200, headers: {}, data: "# Template README" };
        }
        return { status: 200, headers: {}, data: [] };
      });

      templateProcessor.processTemplate.mockReturnValue(null);

      const result = await service.fetchAwesomeAkashTemplates("v1");

      expect(result[0].templates).toHaveLength(0);
    });

    it("includes config.json when fetching templates", async () => {
      const { service, octokit, templateProcessor } = setup();
      const readmeContent = `### AI\n` + `- [Template1](./template1)\n`;

      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.path === "README.md") {
          return { status: 200, headers: {}, data: readmeContent };
        }
        if (params.path === "./template1") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: "./template1/README.md" }),
              createDirectoryItem({ name: "deploy.yaml", path: "./template1/deploy.yaml" }),
              createDirectoryItem({ name: "config.json", path: "./template1/config.json" })
            ]
          };
        }
        if (params.path === "./template1/README.md") {
          return { status: 200, headers: {}, data: "# README" };
        }
        if (params.path === "./template1/deploy.yaml") {
          return { status: 200, headers: {}, data: "deploy" };
        }
        if (params.path === "./template1/config.json") {
          return { status: 200, headers: {}, data: '{"ssh": true}' };
        }
        return { status: 200, headers: {}, data: [] };
      });

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      await service.fetchAwesomeAkashTemplates("v1");

      expect(templateProcessor.processTemplate).toHaveBeenCalledWith(expect.any(Object), "# README", "deploy", null, '{"ssh": true}');
    });
  });

  describe("fetchLinuxServerTemplates", () => {
    it("fetches templates with ignore list filtering", async () => {
      const { service, octokit, templateProcessor } = setup();
      const readmeContent = `### Media\n` + `- [Plex](./plex)\n` + `- [Deprecated](./deprecated)\n`;
      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.path === "README.md") {
          return { status: 200, headers: {}, data: readmeContent };
        }
        if (params.path === "./plex") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: "./plex/README.md" }),
              createDirectoryItem({ name: "deploy.yaml", path: "./plex/deploy.yaml" })
            ]
          };
        }
        if (params.path === "./deprecated") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: "./deprecated/README.md" }),
              createDirectoryItem({ name: "deploy.yaml", path: "./deprecated/deploy.yaml" })
            ]
          };
        }
        if (params.path === "./plex/README.md") {
          return { status: 200, headers: {}, data: "# Plex Media Server" };
        }
        if (params.path === "./plex/deploy.yaml") {
          return { status: 200, headers: {}, data: "deploy content" };
        }
        if (params.path === "./deprecated/README.md") {
          return { status: 200, headers: {}, data: "THIS IMAGE IS DEPRECATED and should not be used" };
        }
        if (params.path === "./deprecated/deploy.yaml") {
          return { status: 200, headers: {}, data: "deploy content" };
        }
        return { status: 200, headers: {}, data: [] };
      });

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "plex" }));

      const result = await service.fetchLinuxServerTemplates("v1");

      expect(result[0].templates).toHaveLength(1);
      expect(templateProcessor.processTemplate).toHaveBeenCalledTimes(1);
    });

    it("filters templates containing 'not recommended for use by the general public'", async () => {
      const { service, octokit, templateProcessor } = setup();
      const readmeContent = `### Tools\n` + `- [Internal](./internal)\n`;
      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.path === "README.md") {
          return { status: 200, headers: {}, data: readmeContent };
        }
        if (params.path === "./internal") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: "./internal/README.md" }),
              createDirectoryItem({ name: "deploy.yaml", path: "./internal/deploy.yaml" })
            ]
          };
        }
        if (params.path === "./internal/README.md") {
          return { status: 200, headers: {}, data: "This tool is not recommended for use by the general public" };
        }
        if (params.path === "./internal/deploy.yaml") {
          return { status: 200, headers: {}, data: "deploy" };
        }
        return { status: 200, headers: {}, data: [] };
      });

      const result = await service.fetchLinuxServerTemplates("v1");

      expect(result[0].templates).toHaveLength(0);
      expect(templateProcessor.processTemplate).not.toHaveBeenCalled();
    });
  });

  describe("fetchOmnibusTemplates", () => {
    it("fetches templates from directory listing", async () => {
      const { service, octokit, templateProcessor } = setup();
      const repoVersion = "v1.0.0";

      const cosmosChainData: Partial<GithubChainRegistryChainResponse> = {
        pretty_name: "Cosmos Hub",
        description: "The Internet of Blockchains",
        logo_URIs: { png: "https://cosmos.network/logo.png" }
      };

      const osmosisChainData: Partial<GithubChainRegistryChainResponse> = {
        pretty_name: "Osmosis",
        description: "The DEX for Cosmos",
        logo_URIs: { svg: "https://osmosis.zone/logo.svg" }
      };

      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.owner === "cosmos" && params.repo === "chain-registry") {
          if (params.path === "cosmos/chain.json") {
            return { status: 200, headers: {}, data: JSON.stringify(cosmosChainData) };
          }
          if (params.path === "osmosis/chain.json") {
            return { status: 200, headers: {}, data: JSON.stringify(osmosisChainData) };
          }
        }
        if (params.path === "") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "cosmos", path: "cosmos", type: "dir" }),
              createDirectoryItem({ name: "osmosis", path: "osmosis", type: "dir" }),
              createDirectoryItem({ name: ".github", path: ".github", type: "dir" }),
              createDirectoryItem({ name: "_scripts", path: "_scripts", type: "dir" }),
              createDirectoryItem({ name: "README.md", path: "README.md", type: "file" })
            ]
          };
        }
        if (params.path === "cosmos" || params.path === "osmosis") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: `${params.path}/README.md` }),
              createDirectoryItem({ name: "deploy.yaml", path: `${params.path}/deploy.yaml` })
            ]
          };
        }
        if (params.path.endsWith("/README.md")) {
          return { status: 200, headers: {}, data: "# README content" };
        }
        if (params.path.endsWith("/deploy.yaml")) {
          return { status: 200, headers: {}, data: "deploy: content" };
        }
        return { status: 200, headers: {}, data: [] };
      });

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "processed" }));

      const result = await service.fetchOmnibusTemplates(repoVersion);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Blockchain");
      expect(result[0].templates).toHaveLength(2);
    });

    it("excludes hidden directories and directories starting with underscore", async () => {
      const { service, octokit, templateProcessor } = setup();

      const cosmosChainData: Partial<GithubChainRegistryChainResponse> = {
        pretty_name: "Cosmos",
        logo_URIs: {}
      };

      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.owner === "cosmos" && params.repo === "chain-registry" && params.path === "cosmos/chain.json") {
          return { status: 200, headers: {}, data: JSON.stringify(cosmosChainData) };
        }
        if (params.path === "") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "cosmos", path: "cosmos", type: "dir" }),
              createDirectoryItem({ name: ".hidden", path: ".hidden", type: "dir" }),
              createDirectoryItem({ name: "_internal", path: "_internal", type: "dir" })
            ]
          };
        }
        if (params.path === "cosmos") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: "cosmos/README.md" }),
              createDirectoryItem({ name: "deploy.yaml", path: "cosmos/deploy.yaml" })
            ]
          };
        }
        if (params.path === "cosmos/README.md" || params.path === "cosmos/deploy.yaml") {
          return { status: 200, headers: {}, data: "content" };
        }
        return { status: 200, headers: {}, data: [] };
      });

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      const result = await service.fetchOmnibusTemplates("v1");

      expect(result[0].templateSources).toHaveLength(1);
      expect(result[0].templateSources[0].name).toBe("Cosmos");
    });

    it("uses default summary when chain registry fetch fails", async () => {
      const { service, octokit, templateProcessor, logger } = setup();

      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.owner === "cosmos" && params.repo === "chain-registry") {
          throw new Error("Not found");
        }
        if (params.path === "") {
          return {
            status: 200,
            headers: {},
            data: [createDirectoryItem({ name: "unknown-chain", path: "unknown-chain", type: "dir" })]
          };
        }
        if (params.path === "unknown-chain") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: "unknown-chain/README.md" }),
              createDirectoryItem({ name: "deploy.yaml", path: "unknown-chain/deploy.yaml" })
            ]
          };
        }
        if (params.path === "unknown-chain/README.md" || params.path === "unknown-chain/deploy.yaml") {
          return { status: 200, headers: {}, data: "content" };
        }
        return { status: 200, headers: {}, data: [] };
      });

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      const result = await service.fetchOmnibusTemplates("v1");

      expect(result[0].templateSources[0].summary).toBe(
        "This is a meta package of cosmos-sdk-based docker images and configuration meant to make deploying onto Akash easy and standardized across cosmos."
      );
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "CHAIN_REGISTRY_DATA_FETCH_FAILED" }));
    });

    it("uses first logo URI from chain data", async () => {
      const { service, octokit, templateProcessor } = setup();

      const cosmosChainData: Partial<GithubChainRegistryChainResponse> = {
        pretty_name: "Cosmos",
        logo_URIs: { png: "https://first.png", svg: "https://second.svg" }
      };

      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.owner === "cosmos" && params.repo === "chain-registry" && params.path === "cosmos/chain.json") {
          return { status: 200, headers: {}, data: JSON.stringify(cosmosChainData) };
        }
        if (params.path === "") {
          return {
            status: 200,
            headers: {},
            data: [createDirectoryItem({ name: "cosmos", path: "cosmos", type: "dir" })]
          };
        }
        if (params.path === "cosmos") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: "cosmos/README.md" }),
              createDirectoryItem({ name: "deploy.yaml", path: "cosmos/deploy.yaml" })
            ]
          };
        }
        if (params.path === "cosmos/README.md" || params.path === "cosmos/deploy.yaml") {
          return { status: 200, headers: {}, data: "content" };
        }
        return { status: 200, headers: {}, data: [] };
      });

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      const result = await service.fetchOmnibusTemplates("v1");

      expect(result[0].templateSources[0].logoUrl).toBe("https://first.png");
    });
  });

  describe("when template source processing fails", () => {
    it("logs warning and continues processing other templates", async () => {
      const { service, octokit, templateProcessor, logger } = setup();
      const readmeContent = `### AI\n` + `- [Working](./working)\n` + `- [Failing](./failing)\n`;

      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.path === "README.md") {
          return { status: 200, headers: {}, data: readmeContent };
        }
        if (params.path === "./working") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: "./working/README.md" }),
              createDirectoryItem({ name: "deploy.yaml", path: "./working/deploy.yaml" })
            ]
          };
        }
        if (params.path === "./working/README.md") {
          return { status: 200, headers: {}, data: "# Working README" };
        }
        if (params.path === "./working/deploy.yaml") {
          return { status: 200, headers: {}, data: "deploy" };
        }
        if (params.path === "./failing") {
          throw new Error("Network error");
        }
        return { status: 200, headers: {}, data: [] };
      });

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "working" }));

      const result = await service.fetchAwesomeAkashTemplates("v1");

      expect(result[0].templates).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TEMPLATE_SOURCE_PROCESSING_SKIPPED" }));
    });
  });

  describe("when template path is absolute URL", () => {
    it("logs warning and skips the template", async () => {
      const { service, octokit, templateProcessor, logger } = setup();
      const readmeContent = `### External\n` + `- [External](https://external.com/template)\n`;
      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.path === "README.md") {
          return { status: 200, headers: {}, data: readmeContent };
        }
        return {
          status: 200,
          headers: {},
          data: [createDirectoryItem({ name: "README.md", path: "README.md" }), createDirectoryItem({ name: "deploy.yaml", path: "deploy.yaml" })]
        };
      });

      const result = await service.fetchAwesomeAkashTemplates("v1");

      expect(result[0].templates).toHaveLength(0);
      expect(templateProcessor.processTemplate).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "TEMPLATE_SOURCE_PROCESSING_SKIPPED",
          error: expect.objectContaining({ message: "Absolute URL not supported" })
        })
      );
    });
  });

  describe("when GUIDE.md exists", () => {
    it("includes guide content in template processing", async () => {
      const { service, octokit, templateProcessor } = setup();
      const readmeContent = `### AI\n` + `- [WithGuide](./with-guide)\n`;
      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.path === "README.md") {
          return { status: 200, headers: {}, data: readmeContent };
        }
        if (params.path === "./with-guide") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: "./with-guide/README.md" }),
              createDirectoryItem({ name: "deploy.yaml", path: "./with-guide/deploy.yaml" }),
              createDirectoryItem({ name: "GUIDE.md", path: "./with-guide/GUIDE.md" })
            ]
          };
        }
        if (params.path === "./with-guide/README.md") {
          return { status: 200, headers: {}, data: "# README" };
        }
        if (params.path === "./with-guide/deploy.yaml") {
          return { status: 200, headers: {}, data: "deploy content" };
        }
        if (params.path === "./with-guide/GUIDE.md") {
          return { status: 200, headers: {}, data: "# Step by Step Guide" };
        }
        return { status: 200, headers: {}, data: [] };
      });

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      await service.fetchAwesomeAkashTemplates("v1");

      expect(templateProcessor.processTemplate).toHaveBeenCalledWith(expect.any(Object), "# README", "deploy content", "# Step by Step Guide", null);
    });
  });

  describe("when deploy.yml is used instead of deploy.yaml", () => {
    it("finds deploy.yml file", async () => {
      const { service, octokit, templateProcessor } = setup();
      const readmeContent = `### AI\n` + `- [YmlDeploy](./yml-deploy)\n`;
      mockGetContent(octokit, async (params: GetContentParams) => {
        if (params.path === "README.md") {
          return { status: 200, headers: {}, data: readmeContent };
        }
        if (params.path === "./yml-deploy") {
          return {
            status: 200,
            headers: {},
            data: [
              createDirectoryItem({ name: "README.md", path: "./yml-deploy/README.md" }),
              createDirectoryItem({ name: "deploy.yml", path: "./yml-deploy/deploy.yml" })
            ]
          };
        }
        if (params.path === "./yml-deploy/README.md") {
          return { status: 200, headers: {}, data: "# README" };
        }
        if (params.path === "./yml-deploy/deploy.yml") {
          return { status: 200, headers: {}, data: "deploy content" };
        }
        return { status: 200, headers: {}, data: [] };
      });

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      await service.fetchAwesomeAkashTemplates("v1");

      expect(templateProcessor.processTemplate).toHaveBeenCalledWith(expect.any(Object), "# README", "deploy content", null, null);
    });
  });

  function setup() {
    const templateProcessor = mock<TemplateProcessorService>();
    const logger = mock<LoggerService>();
    const octokit = mockDeep<Octokit>();

    const service = new TemplateFetcherService(templateProcessor, logger, octokit);

    return { service, templateProcessor, logger, octokit };
  }

  function createDirectoryItem(overrides: Partial<GithubDirectoryItem>): GithubDirectoryItem {
    return {
      type: "file",
      size: 100,
      name: "file.txt",
      path: "file.txt",
      sha: "abc123",
      url: "https://api.github.com/file",
      git_url: "https://api.github.com/git/file",
      html_url: "https://github.com/file",
      download_url: "https://raw.githubusercontent.com/file",
      _links: {
        git: "https://api.github.com/git",
        html: "https://github.com",
        self: "https://api.github.com"
      },
      ...overrides
    };
  }

  function createTemplate(overrides: Partial<Template>): Template {
    return {
      id: "template-id",
      name: "Template Name",
      path: "template-path",
      readme: "# README",
      summary: "Template summary",
      logoUrl: "https://example.com/logo.png",
      deploy: "deploy content",
      githubUrl: "https://github.com/owner/repo",
      persistentStorageEnabled: false,
      config: { ssh: false, logoUrl: "" },
      ...overrides
    };
  }

  function mockGetContent(octokit: ReturnType<typeof mockDeep<Octokit>>, impl: (params: GetContentParams) => Promise<unknown>) {
    (octokit.rest.repos.getContent.mockImplementation as jest.Mock)(impl);
  }
});
