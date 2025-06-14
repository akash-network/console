import { faker } from "@faker-js/faker";
import * as fs from "node:fs";
import * as path from "node:path";

import { app } from "@src/app";
import type { Category } from "@src/services/external/templatesCollector";
import { env } from "@src/utils/env";

const fakeHeaders = {
  headers: {
    "x-ratelimit-remaining": 100
  }
};

env.GITHUB_PAT = "ghp_1234567890";

jest.mock("@octokit/rest", () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
      rest: {
        repos: {
          getBranch: jest.fn().mockImplementation(() => {
            return Promise.resolve({
              status: 200,
              data: {
                commit: {
                  sha: faker.git.commitSha()
                }
              },
              ...fakeHeaders
            });
          }),
          getContent: jest.fn().mockImplementation((params: { owner: string; repo: string; path: string }) => {
            if (params.path === "README.md") {
              return Promise.resolve({
                status: 200,
                data: fs.readFileSync(path.join(__dirname, "..", "mocks/templates", params.owner, params.repo, params.path.toLowerCase()), "utf8"),
                ...fakeHeaders
              });
            }

            return Promise.resolve({
              status: 200,
              data: JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mocks/templates", params.owner, params.repo, params.path, "index.json"), "utf8")),
              ...fakeHeaders
            });
          })
        }
      }
    }))
  };
});

describe("Templates API", () => {
  const expectCategory = (result: Category[], expectedCategory: string, expectedTemplateIds: string[]) => {
    const category = result.find((c: { title: string }) => c.title === expectedCategory);
    expect(category.templates).toHaveLength(expectedTemplateIds.length);
    const templateIds = category.templates.map(({ id }) => id);
    templateIds.forEach(templateId => {
      expect(expectedTemplateIds).toContain(templateId);
    });
  };

  describe("GET /v1/templates", () => {
    it("returns list of templates with full data", async () => {
      const response = await app.request("/v1/templates");

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.length).toBe(4);
      expectCategory(result, "Blockchain", ["akash-network-cosmos-omnibus-akash", "akash-network-cosmos-omnibus-archway"]);
      expectCategory(result, "Official", ["akash-network-awesome-akash-lunie-lite", "akash-network-awesome-akash-ssh-ubuntu"]);
      expectCategory(result, "AI - CPU", ["akash-network-awesome-akash-alpaca-cpp"]);
      expectCategory(result, "LinuxServer", ["cryptoandcoffee-akash-linuxserver-adguardhome-sync", "cryptoandcoffee-akash-linuxserver-airsonic-advanced"]);
    });
  });

  describe("GET /v1/templates-list", () => {
    it("returns list of templates grouped by categories", async () => {
      const response = await app.request("/v1/templates-list");

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data.length).toBe(4);
      expectCategory(result.data, "Blockchain", ["akash-network-cosmos-omnibus-akash", "akash-network-cosmos-omnibus-archway"]);
      expectCategory(result.data, "Official", ["akash-network-awesome-akash-lunie-lite", "akash-network-awesome-akash-ssh-ubuntu"]);
      expectCategory(result.data, "AI - CPU", ["akash-network-awesome-akash-alpaca-cpp"]);
      expectCategory(result.data, "LinuxServer", ["cryptoandcoffee-akash-linuxserver-adguardhome-sync", "cryptoandcoffee-akash-linuxserver-airsonic-advanced"]);
    });
  });

  describe("GET /v1/templates/{id}", () => {
    it("returns template data by id", async () => {
      const response = await app.request("/v1/templates/akash-network-awesome-akash-ssh-ubuntu");

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data.name).toBe("Ubuntu SSH");
    });

    it("returns 404 for non-existent template", async () => {
      const response = await app.request("/v1/templates/non-existent-template");
      expect(response.status).toBe(404);
    });
  });
});
