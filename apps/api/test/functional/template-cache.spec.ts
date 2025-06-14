import * as fs from "node:fs";
import * as path from "node:path";

import { getTemplateGallery } from "@src/services/external/templatesCollector";
import { dataFolderPath } from "@src/utils/constants";
import { env } from "@src/utils/env";

const fakeHeaders = {
  headers: {
    "x-ratelimit-remaining": 100
  }
};

env.GITHUB_PAT = "ghp_1234567890";
const sha = "generated-sha";

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
                  sha
                }
              },
              ...fakeHeaders
            });
          }),
          getContent: jest.fn().mockImplementation((params: { owner: string; repo: string; path: string }) => {
            if (params.path === "README.md") {
              return Promise.resolve({
                status: 200,
                data: fs.readFileSync(path.join(__dirname, "..", "mocks/templates/git", params.owner, params.repo, params.path.toLowerCase()), "utf8"),
                ...fakeHeaders
              });
            }

            return Promise.resolve({
              status: 200,
              data: JSON.parse(
                fs.readFileSync(path.join(__dirname, "..", "mocks/templates/git", params.owner, params.repo, params.path, "index.json"), "utf8")
              ),
              ...fakeHeaders
            });
          })
        }
      }
    }))
  };
});

describe("Template cache generation", () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  const expectCacheFile = (filename: string) => {
    const result = fs.readFileSync(path.join(__dirname, "../..", "dist/.data/templates", filename), "utf8");
    expect(result).toMatchSnapshot();
  };

  describe("Generating cache", () => {
    it("creates files as expected", async () => {
      await getTemplateGallery({
        githubPAT: env.GITHUB_PAT,
        dataFolderPath
      });

      expectCacheFile(`akash-network-awesome-akash-${sha}.json`);
      expectCacheFile(`akash-network-cosmos-omnibus-${sha}.json`);
      expectCacheFile(`cryptoandcoffee-akash-linuxserver-${sha}.json`);
    });
  });
});
