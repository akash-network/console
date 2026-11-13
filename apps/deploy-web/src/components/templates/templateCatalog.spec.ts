import { describe, expect, it } from "vitest";

import { MAX_TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_OPTIONS } from "./templateCatalog";

describe("template catalog", () => {
  it("offers the categories the API accepts, sorted", () => {
    expect(TEMPLATE_CATEGORY_OPTIONS).toEqual([
      "AI - CPU",
      "AI - GPU",
      "Benchmarking",
      "Blockchain",
      "Blogging",
      "Built with Cosmos-SDK",
      "Business",
      "CI/CD, DevOps",
      "Chat",
      "Data Visualization",
      "Databases and Administration",
      "DeFi",
      "Decentralized Storage",
      "Game Servers",
      "Games",
      "Hosting",
      "Machine Learning",
      "Mining - CPU",
      "Mining - GPU",
      "Mining Pools",
      "Network",
      "Official",
      "Peer-to-peer File Sharing",
      "Project Management",
      "Search Engines",
      "Social",
      "Tools",
      "Video Conferencing",
      "Wallet",
      "Web Frameworks"
    ]);
  });

  it("allows three categories per template", () => {
    expect(MAX_TEMPLATE_CATEGORIES).toBe(3);
  });
});
