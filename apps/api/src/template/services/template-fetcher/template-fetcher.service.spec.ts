import type { Octokit } from "@octokit/rest";
import { mock, mockDeep } from "jest-mock-extended";

import type { LoggerService } from "@src/core";
import type { GithubChainRegistryChainResponse } from "@src/types";
import type { Template } from "../../types/template";
import type { ArchiveReader, DirectoryEntry, GitHubArchiveService } from "../github-archive/github-archive.service";
import type { TemplateProcessorService } from "../template-processor/template-processor.service";
import { REPOSITORIES, TemplateFetcherService } from "./template-fetcher.service";

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
      const { service, archiveService, templateProcessor } = setup();
      const repoVersion = "abc123";
      const readmeContent =
        `# Awesome Akash\n` +
        `### AI\n` +
        `Some description\n` +
        `- [Template1](./template1)\n` +
        `- [Template2](./template2)\n` +
        `### Gaming\n` +
        `- [Game1](./games/game1)\n`;

      mockArchive(archiveService, async () =>
        createMockArchiveReader({
          files: {
            "README.md": readmeContent,
            "./template1/README.md": "# Template README",
            "./template1/deploy.yaml": "deploy content",
            "./template2/README.md": "# Template README",
            "./template2/deploy.yaml": "deploy content",
            "./games/game1/README.md": "# Template README",
            "./games/game1/deploy.yaml": "deploy content"
          },
          directories: {
            "./template1": [
              { name: "README.md", path: "./template1/README.md", type: "file" },
              { name: "deploy.yaml", path: "./template1/deploy.yaml", type: "file" }
            ],
            "./template2": [
              { name: "README.md", path: "./template2/README.md", type: "file" },
              { name: "deploy.yaml", path: "./template2/deploy.yaml", type: "file" }
            ],
            "./games/game1": [
              { name: "README.md", path: "./games/game1/README.md", type: "file" },
              { name: "deploy.yaml", path: "./games/game1/deploy.yaml", type: "file" }
            ]
          }
        })
      );

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "processed-template" }));

      const result = await service.fetchAwesomeAkashTemplates(repoVersion);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("AI");
      expect(result[1].title).toBe("Gaming");
    });

    it("skips templates without deploy file", async () => {
      const { service, archiveService, templateProcessor } = setup();
      const readmeContent = `### AI\n\n` + `- [Template1](./template1)\n`;

      mockArchive(archiveService, async () =>
        createMockArchiveReader({
          files: {
            "README.md": readmeContent,
            "./template1/README.md": "# Template README"
          },
          directories: {
            "./template1": [{ name: "README.md", path: "./template1/README.md", type: "file" }]
          }
        })
      );

      templateProcessor.processTemplate.mockReturnValue(null);

      const result = await service.fetchAwesomeAkashTemplates("v1");

      expect(result[0].templates).toHaveLength(0);
    });

    it("includes config.json when fetching templates", async () => {
      const { service, archiveService, templateProcessor } = setup();
      const readmeContent = `### AI\n` + `- [Template1](./template1)\n`;

      mockArchive(archiveService, async () =>
        createMockArchiveReader({
          files: {
            "README.md": readmeContent,
            "./template1/README.md": "# README",
            "./template1/deploy.yaml": "deploy",
            "./template1/config.json": '{"ssh": true}'
          },
          directories: {
            "./template1": [
              { name: "README.md", path: "./template1/README.md", type: "file" },
              { name: "deploy.yaml", path: "./template1/deploy.yaml", type: "file" },
              { name: "config.json", path: "./template1/config.json", type: "file" }
            ]
          }
        })
      );

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      await service.fetchAwesomeAkashTemplates("v1");

      expect(templateProcessor.processTemplate).toHaveBeenCalledWith(expect.any(Object), "# README", "deploy", null, '{"ssh": true}');
    });
  });

  describe("fetchOmnibusTemplates", () => {
    it("fetches templates from directory listing", async () => {
      const { service, archiveService, templateProcessor } = setup();
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

      mockArchiveWithChainRegistry(
        archiveService,
        async () =>
          createMockArchiveReader({
            files: {
              "cosmos/README.md": "# README content",
              "cosmos/deploy.yaml": "deploy: content",
              "osmosis/README.md": "# README content",
              "osmosis/deploy.yaml": "deploy: content"
            },
            directories: {
              "": [
                { name: "cosmos", path: "cosmos", type: "dir" },
                { name: "osmosis", path: "osmosis", type: "dir" },
                { name: ".github", path: ".github", type: "dir" },
                { name: "_scripts", path: "_scripts", type: "dir" },
                { name: "README.md", path: "README.md", type: "file" }
              ],
              cosmos: [
                { name: "README.md", path: "cosmos/README.md", type: "file" },
                { name: "deploy.yaml", path: "cosmos/deploy.yaml", type: "file" }
              ],
              osmosis: [
                { name: "README.md", path: "osmosis/README.md", type: "file" },
                { name: "deploy.yaml", path: "osmosis/deploy.yaml", type: "file" }
              ]
            }
          }),
        {
          cosmos: cosmosChainData,
          osmosis: osmosisChainData
        }
      );

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "processed" }));

      const result = await service.fetchOmnibusTemplates(repoVersion);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Blockchain");
      expect(result[0].templates).toHaveLength(2);
    });

    it("excludes hidden directories and directories starting with underscore", async () => {
      const { service, archiveService, templateProcessor } = setup();

      const cosmosChainData: Partial<GithubChainRegistryChainResponse> = {
        pretty_name: "Cosmos",
        logo_URIs: {}
      };

      mockArchiveWithChainRegistry(
        archiveService,
        async () =>
          createMockArchiveReader({
            files: {
              "cosmos/README.md": "content",
              "cosmos/deploy.yaml": "content"
            },
            directories: {
              "": [
                { name: "cosmos", path: "cosmos", type: "dir" },
                { name: ".hidden", path: ".hidden", type: "dir" },
                { name: "_internal", path: "_internal", type: "dir" }
              ],
              cosmos: [
                { name: "README.md", path: "cosmos/README.md", type: "file" },
                { name: "deploy.yaml", path: "cosmos/deploy.yaml", type: "file" }
              ]
            }
          }),
        {
          cosmos: cosmosChainData
        }
      );

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      const result = await service.fetchOmnibusTemplates("v1");

      expect(result[0].templateSources).toHaveLength(1);
      expect(result[0].templateSources[0].name).toBe("Cosmos");
    });

    it("uses default summary when chain registry fetch fails", async () => {
      const { service, archiveService, templateProcessor, logger } = setup();

      mockArchiveWithChainRegistry(
        archiveService,
        async () =>
          createMockArchiveReader({
            files: {
              "unknown-chain/README.md": "content",
              "unknown-chain/deploy.yaml": "content"
            },
            directories: {
              "": [{ name: "unknown-chain", path: "unknown-chain", type: "dir" }],
              "unknown-chain": [
                { name: "README.md", path: "unknown-chain/README.md", type: "file" },
                { name: "deploy.yaml", path: "unknown-chain/deploy.yaml", type: "file" }
              ]
            }
          }),
        {}
      );

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      const result = await service.fetchOmnibusTemplates("v1");

      expect(result[0].templateSources[0].summary).toBe(
        "This is a meta package of cosmos-sdk-based docker images and configuration meant to make deploying onto Akash easy and standardized across cosmos."
      );
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "CHAIN_REGISTRY_DATA_FETCH_FAILED" }));
    });

    it("uses first logo URI from chain data", async () => {
      const { service, archiveService, templateProcessor } = setup();

      const cosmosChainData: Partial<GithubChainRegistryChainResponse> = {
        pretty_name: "Cosmos",
        logo_URIs: { png: "https://first.png", svg: "https://second.svg" }
      };

      mockArchiveWithChainRegistry(
        archiveService,
        async () =>
          createMockArchiveReader({
            files: {
              "cosmos/README.md": "content",
              "cosmos/deploy.yaml": "content"
            },
            directories: {
              "": [{ name: "cosmos", path: "cosmos", type: "dir" }],
              cosmos: [
                { name: "README.md", path: "cosmos/README.md", type: "file" },
                { name: "deploy.yaml", path: "cosmos/deploy.yaml", type: "file" }
              ]
            }
          }),
        {
          cosmos: cosmosChainData
        }
      );

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      const result = await service.fetchOmnibusTemplates("v1");

      expect(result[0].templateSources[0].logoUrl).toBe("https://first.png");
    });
  });

  describe("when archive download fails", () => {
    it("returns empty array and logs warning instead of throwing", async () => {
      const { service, archiveService, logger } = setup();
      archiveService.getArchive.mockRejectedValue(new Error("Failed to download archive"));

      const result = await service.fetchAwesomeAkashTemplates("v1");

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "FETCH_TEMPLATES_FROM_README_FAILED",
          repoOwner: "akash-network",
          repoName: "awesome-akash",
          repoVersion: "v1"
        })
      );
    });
  });

  describe("when template source processing fails", () => {
    it("logs warning and continues processing other templates", async () => {
      const { service, archiveService, templateProcessor, logger } = setup();
      const readmeContent = `### AI\n` + `- [Working](./working)\n` + `- [Failing](./failing)\n`;

      mockArchive(archiveService, async () =>
        createMockArchiveReader({
          files: {
            "README.md": readmeContent,
            "./working/README.md": "# Working README",
            "./working/deploy.yaml": "deploy"
          },
          directories: {
            "./working": [
              { name: "README.md", path: "./working/README.md", type: "file" },
              { name: "deploy.yaml", path: "./working/deploy.yaml", type: "file" }
            ],
            "./failing": "THROW"
          }
        })
      );

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "working" }));

      const result = await service.fetchAwesomeAkashTemplates("v1");

      expect(result[0].templates).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TEMPLATE_SOURCE_PROCESSING_SKIPPED" }));
    });
  });

  describe("when template path is absolute URL", () => {
    it("logs warning and skips the template", async () => {
      const { service, archiveService, templateProcessor, logger } = setup();
      const readmeContent = `### External\n` + `- [External](https://external.com/template)\n`;

      mockArchive(archiveService, async () =>
        createMockArchiveReader({
          files: {
            "README.md": readmeContent
          },
          directories: {}
        })
      );

      const result = await service.fetchAwesomeAkashTemplates("v1");

      expect(result[0].templates).toHaveLength(0);
      expect(templateProcessor.processTemplate).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "TEMPLATE_SOURCE_PROCESSING_SKIPPED"
        })
      );
    });
  });

  describe("when GUIDE.md exists", () => {
    it("includes guide content in template processing", async () => {
      const { service, archiveService, templateProcessor } = setup();
      const readmeContent = `### AI\n` + `- [WithGuide](./with-guide)\n`;

      mockArchive(archiveService, async () =>
        createMockArchiveReader({
          files: {
            "README.md": readmeContent,
            "./with-guide/README.md": "# README",
            "./with-guide/deploy.yaml": "deploy content",
            "./with-guide/GUIDE.md": "# Step by Step Guide"
          },
          directories: {
            "./with-guide": [
              { name: "README.md", path: "./with-guide/README.md", type: "file" },
              { name: "deploy.yaml", path: "./with-guide/deploy.yaml", type: "file" },
              { name: "GUIDE.md", path: "./with-guide/GUIDE.md", type: "file" }
            ]
          }
        })
      );

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      await service.fetchAwesomeAkashTemplates("v1");

      expect(templateProcessor.processTemplate).toHaveBeenCalledWith(expect.any(Object), "# README", "deploy content", "# Step by Step Guide", null);
    });
  });

  describe("when deploy.yml is used instead of deploy.yaml", () => {
    it("finds deploy.yml file", async () => {
      const { service, archiveService, templateProcessor } = setup();
      const readmeContent = `### AI\n` + `- [YmlDeploy](./yml-deploy)\n`;

      mockArchive(archiveService, async () =>
        createMockArchiveReader({
          files: {
            "README.md": readmeContent,
            "./yml-deploy/README.md": "# README",
            "./yml-deploy/deploy.yml": "deploy content"
          },
          directories: {
            "./yml-deploy": [
              { name: "README.md", path: "./yml-deploy/README.md", type: "file" },
              { name: "deploy.yml", path: "./yml-deploy/deploy.yml", type: "file" }
            ]
          }
        })
      );

      templateProcessor.processTemplate.mockReturnValue(createTemplate({ id: "t1" }));

      await service.fetchAwesomeAkashTemplates("v1");

      expect(templateProcessor.processTemplate).toHaveBeenCalledWith(expect.any(Object), "# README", "deploy content", null, null);
    });
  });

  function setup() {
    const templateProcessor = mock<TemplateProcessorService>();
    const logger = mock<LoggerService>();
    const octokit = mockDeep<Octokit>();
    const archiveService = mock<GitHubArchiveService>();

    const service = new TemplateFetcherService(templateProcessor, logger, () => octokit, archiveService, {
      githubPAT: "test-pat"
    });

    return { service, templateProcessor, logger, octokit, archiveService };
  }

  function createMockArchiveReader(config: { files: Record<string, string>; directories: Record<string, DirectoryEntry[] | "THROW"> }): ArchiveReader {
    return {
      async readFile(path: string): Promise<string | null> {
        if (Object.hasOwn(config.files, path)) {
          return config.files[path];
        }
        return null;
      },
      listDirectory(path: string): DirectoryEntry[] {
        if (Object.hasOwn(config.directories, path)) {
          const value = config.directories[path];
          if (value === "THROW") {
            throw new Error(`Directory listing failed for ${path}`);
          }
          return value;
        }
        return [];
      }
    };
  }

  function mockArchive(archiveService: ReturnType<typeof mock<GitHubArchiveService>>, factory: () => Promise<ArchiveReader>) {
    archiveService.getArchive.mockImplementation(factory);
  }

  function mockArchiveWithChainRegistry(
    archiveService: ReturnType<typeof mock<GitHubArchiveService>>,
    templateFactory: () => Promise<ArchiveReader>,
    chains: Record<string, Partial<GithubChainRegistryChainResponse>>
  ) {
    const chainRegistryFiles: Record<string, string> = {};
    for (const [chainPath, data] of Object.entries(chains)) {
      chainRegistryFiles[`${chainPath}/chain.json`] = JSON.stringify(data);
    }

    const chainRegistryReader = createMockArchiveReader({
      files: chainRegistryFiles,
      directories: {}
    });

    archiveService.getArchive.mockImplementation(async (owner, repo) => {
      if (owner === "cosmos" && repo === "chain-registry") {
        return chainRegistryReader;
      }
      return templateFactory();
    });
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
});
