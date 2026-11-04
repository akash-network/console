import { describe, expect, it } from "vitest";

import { buildAkashMlUrl, findAkashMlModel } from "./akashMlModels";

describe(findAkashMlModel.name, () => {
  it.each([
    ["akash-network-awesome-akash-Llama-3.3-70B", "Llama 3.3 70B", "/models/llama-3-3-70b"],
    ["akash-network-awesome-akash-Llama-3.1-405B-FP8", "Llama 3.3 70B", "/models/llama-3-3-70b"],
    ["akash-network-awesome-akash-Llama-2-70B", "Llama 3.3 70B", "/models/llama-3-3-70b"],
    ["akash-network-awesome-akash-Llama-4-Scout-17B-16E-Instruct", "Llama 3.3 70B", "/models/llama-3-3-70b"],
    ["akash-network-awesome-akash-openai-gpt-oss-120b", "GPT OSS 120B", "/models/gpt-oss-120b"],
    ["akash-network-awesome-akash-Kimi-K2-Thinking", "Kimi K3", "/models/kimi-k3"],
    ["akash-network-awesome-akash-Qwen3-235B-A22B-FP8", "Qwen", "/models"],
    ["akash-network-awesome-akash-QwQ-32B", "Qwen", "/models"]
  ])("matches %s to %s on AkashML", (templateId, name, path) => {
    expect(findAkashMlModel(templateId)).toEqual({ name, path });
  });

  it.each([
    "akash-network-awesome-akash-Llama-3.2-90B-Vision-Instruct",
    "akash-network-awesome-akash-DeepSeek-R1-Distill-Llama-70B",
    "akash-network-awesome-akash-DeepSeek-R1-Distill-Qwen-32B",
    "akash-network-awesome-akash-DeepSeek-R1",
    "akash-network-awesome-akash-llama-factory",
    "akash-network-awesome-akash-ollama-gpu",
    "akash-network-awesome-akash-comfyui",
    "akash-network-awesome-akash-stable-diffusion-webui"
  ])("finds no AkashML equivalent for %s", templateId => {
    expect(findAkashMlModel(templateId)).toBeUndefined();
  });

  it("finds no AkashML equivalent without a template", () => {
    expect(findAkashMlModel(undefined)).toBeUndefined();
  });
});

describe(buildAkashMlUrl.name, () => {
  it("tags the model page with the placement so AkashML can attribute sign-ups to Console", () => {
    const url = new URL(buildAkashMlUrl({ name: "Llama 3.3 70B", path: "/models/llama-3-3-70b" }, "template_detail"));

    expect(url.origin + url.pathname).toBe("https://akashml.com/models/llama-3-3-70b");
    expect(Object.fromEntries(url.searchParams)).toEqual({ utm_source: "akash-console", utm_medium: "template_detail", utm_campaign: "trial-gpu-block" });
  });
});
