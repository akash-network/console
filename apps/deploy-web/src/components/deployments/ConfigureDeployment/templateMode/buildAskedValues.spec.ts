import { describe, expect, it } from "vitest";

import type { ServiceType } from "@src/types";
import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import type { AskedValueSetting } from "./buildAskedValues";
import { buildAskedValues, summarizeAskedValues } from "./buildAskedValues";

type EnvRow = { key: string; value?: string; isSecret?: boolean };

describe(buildAskedValues.name, () => {
  it("asks one question for a key used in two services", () => {
    const { build } = setup({
      services: [
        { title: "web", env: [{ key: "MODEL", value: "llama" }] },
        { title: "worker", env: [{ key: "MODEL", value: "mistral" }] }
      ],
      asked: ["MODEL"]
    });

    expect(build()).toEqual([
      {
        key: "MODEL",
        label: "Model",
        type: "text",
        default: "llama",
        required: false,
        bindings: [
          { service: "web", env: "MODEL" },
          { service: "worker", env: "MODEL" }
        ]
      }
    ]);
  });

  it("always asks for a secret and never gives it a default", () => {
    const { build } = setup({ services: [{ title: "web", env: [{ key: "HF_TOKEN", value: "ac-secret://HF_TOKEN", isSecret: true }] }] });

    expect(build()).toStrictEqual([{ key: "HF_TOKEN", label: "HF token", type: "secret", required: true, bindings: [{ service: "web", env: "HF_TOKEN" }] }]);
  });

  it("treats a key as secret when any of its rows is secret", () => {
    const { build } = setup({
      services: [
        { title: "web", env: [{ key: "TOKEN", value: "plain" }] },
        { title: "worker", env: [{ key: "TOKEN", value: "ac-secret://TOKEN", isSecret: true }] }
      ]
    });

    expect(build()).toStrictEqual([
      {
        key: "TOKEN",
        label: "Token",
        type: "secret",
        required: true,
        bindings: [
          { service: "web", env: "TOKEN" },
          { service: "worker", env: "TOKEN" }
        ]
      }
    ]);
  });

  it("keeps a secret a secret whatever type was customized for it", () => {
    const { build } = setup({
      services: [{ title: "web", env: [{ key: "TOKEN", value: "ac-secret://TOKEN", isSecret: true }] }],
      customized: { TOKEN: { type: "text", label: "Access token" } }
    });

    expect(build()).toStrictEqual([{ key: "TOKEN", label: "Access token", type: "secret", required: true, bindings: [{ service: "web", env: "TOKEN" }] }]);
  });

  it("keeps a customized label and type and recomputes the rest from the rows", () => {
    const customized: AskedValueSetting["customized"] = { label: "Log verbosity", type: "choice", choices: ["debug", "info"] };

    const first = setup({
      services: [{ title: "web", env: [{ key: "LOG_LEVEL", value: "info" }] }],
      asked: ["LOG_LEVEL"],
      customized: { LOG_LEVEL: customized }
    });
    const second = setup({
      services: [
        { title: "web", env: [{ key: "LOG_LEVEL", value: "debug" }] },
        { title: "worker", env: [{ key: "LOG_LEVEL", value: "debug" }] }
      ],
      asked: ["LOG_LEVEL"],
      customized: { LOG_LEVEL: customized }
    });

    expect(first.build()).toStrictEqual([
      {
        key: "LOG_LEVEL",
        label: "Log verbosity",
        type: "choice",
        choices: ["debug", "info"],
        default: "info",
        required: false,
        bindings: [{ service: "web", env: "LOG_LEVEL" }]
      }
    ]);
    expect(second.build()).toStrictEqual([
      {
        key: "LOG_LEVEL",
        label: "Log verbosity",
        type: "choice",
        choices: ["debug", "info"],
        default: "debug",
        required: false,
        bindings: [
          { service: "web", env: "LOG_LEVEL" },
          { service: "worker", env: "LOG_LEVEL" }
        ]
      }
    ]);
  });

  it("drops the bindings of rows that were removed", () => {
    const both = [
      { title: "web", env: [{ key: "MODEL", value: "llama" }] },
      { title: "worker", env: [{ key: "MODEL", value: "llama" }] }
    ];

    const { build } = setup({ services: both.slice(0, 1), asked: ["MODEL"] });

    expect(build()[0].bindings).toEqual([{ service: "web", env: "MODEL" }]);
  });

  it("leaves unasked plain rows out", () => {
    const { build } = setup({
      services: [
        {
          title: "web",
          env: [
            { key: "MODEL", value: "llama" },
            { key: "LOG_LEVEL", value: "info" }
          ]
        }
      ],
      asked: ["MODEL"]
    });

    expect(build().map(value => value.key)).toEqual(["MODEL"]);
  });

  it("leaves a row out when its setting says it is not asked", () => {
    const { build } = setup({
      services: [{ title: "web", env: [{ key: "MODEL", value: "llama" }] }],
      settings: { MODEL: { key: "MODEL", isAsked: false, customized: { label: "Model" } } }
    });

    expect(build()).toEqual([]);
  });

  it("orders values by first appearance", () => {
    const { build } = setup({
      services: [
        {
          title: "web",
          env: [
            { key: "B", value: "1" },
            { key: "A", value: "2" }
          ]
        },
        {
          title: "worker",
          env: [
            { key: "C", value: "3" },
            { key: "A", value: "4" },
            { key: "B", value: "5" }
          ]
        }
      ],
      asked: ["A", "B", "C"]
    });

    expect(build().map(value => value.key)).toEqual(["B", "A", "C"]);
  });

  it("ignores the reserved SSH key even when it is asked", () => {
    const { build } = setup({
      services: [{ title: "web", env: [{ key: "SSH_PUBKEY", value: "ssh-ed25519 AAAA", isSecret: true }] }],
      asked: ["SSH_PUBKEY"]
    });

    expect(build()).toEqual([]);
  });

  it("skips services without variables and rows without a key", () => {
    const { build } = setup({
      services: [
        { title: "web" },
        {
          title: "worker",
          env: [
            { key: "  ", value: "x" },
            { key: "", value: "y" },
            { key: "MODEL", value: "llama" }
          ]
        }
      ],
      asked: ["MODEL", ""]
    });

    expect(build().map(value => value.key)).toEqual(["MODEL"]);
  });

  it("trims the key of a row", () => {
    const { build } = setup({ services: [{ title: "web", env: [{ key: " MODEL ", value: "llama" }] }], asked: ["MODEL"] });

    expect(build()[0].bindings).toEqual([{ service: "web", env: "MODEL" }]);
  });

  it.each(["MY-VAR", "my.var", "1ABC", "A B"])("cannot ask for %s, which the api would refuse as a key", key => {
    const { build } = setup({ services: [{ title: "web", env: [{ key, value: "x" }] }], asked: [key] });

    expect(build()).toEqual([]);
  });

  it("accepts a key of exactly 64 characters and refuses 65", () => {
    const sixtyFour = `K${"A".repeat(63)}`;
    const sixtyFive = `${sixtyFour}A`;
    const { build } = setup({
      services: [
        {
          title: "web",
          env: [
            { key: sixtyFour, value: "x" },
            { key: sixtyFive, value: "x" }
          ]
        }
      ],
      asked: [sixtyFour, sixtyFive]
    });

    expect(build().map(value => value.key)).toEqual([sixtyFour]);
  });

  describe("type guess from the first row", () => {
    it("asks a true or false value as a yes or no defaulting to it", () => {
      const { build } = setup({ services: [{ title: "web", env: [{ key: "DEBUG", value: "TRUE" }] }], asked: ["DEBUG"] });

      expect(build()[0]).toStrictEqual({
        key: "DEBUG",
        label: "Debug",
        type: "boolean",
        default: "true",
        required: false,
        bindings: [{ service: "web", env: "DEBUG" }]
      });
    });

    it("asks a whole number as an integer", () => {
      const { build } = setup({ services: [{ title: "web", env: [{ key: "MAX_MODEL_LEN", value: "8192" }] }], asked: ["MAX_MODEL_LEN"] });

      expect(build()[0]).toStrictEqual({
        key: "MAX_MODEL_LEN",
        label: "Max model len",
        type: "number",
        default: "8192",
        integer: true,
        required: false,
        bindings: [{ service: "web", env: "MAX_MODEL_LEN" }]
      });
    });

    it("asks a decimal as a number that is not whole", () => {
      const { build } = setup({ services: [{ title: "web", env: [{ key: "TEMPERATURE", value: "0.7" }] }], asked: ["TEMPERATURE"] });

      expect(build()[0]).toMatchObject({ type: "number", default: "0.7", integer: false });
    });

    it("requires an empty value as text with no default", () => {
      const { build } = setup({ services: [{ title: "web", env: [{ key: "MODEL" }] }], asked: ["MODEL"] });

      expect(build()[0]).toStrictEqual({ key: "MODEL", label: "Model", type: "text", required: true, bindings: [{ service: "web", env: "MODEL" }] });
    });

    it("takes the default from the first row even when it is empty", () => {
      const { build } = setup({
        services: [
          { title: "web", env: [{ key: "MODEL", value: "" }] },
          { title: "worker", env: [{ key: "MODEL", value: "llama" }] }
        ],
        asked: ["MODEL"]
      });

      expect(build()[0]).toMatchObject({ type: "text", required: true });
      expect(build()[0]).not.toHaveProperty("default");
    });
  });

  describe("customized fields", () => {
    it("overrides the label, trimmed and cut to 80 characters", () => {
      const { build } = setup({
        services: [
          {
            title: "web",
            env: [
              { key: "A", value: "1" },
              { key: "B", value: "1" },
              { key: "C", value: "1" }
            ]
          }
        ],
        customized: { A: { label: `  Name  ` }, B: { label: "x".repeat(81) }, C: { label: "y".repeat(80) } },
        asked: ["A", "B", "C"]
      });

      expect(build().map(value => value.label)).toEqual(["Name", "x".repeat(80), "y".repeat(80)]);
    });

    it("falls back to the label of the key when the customized one is blank", () => {
      const { build } = setup({
        services: [{ title: "web", env: [{ key: "MODEL_NAME", value: "x" }] }],
        customized: { MODEL_NAME: { label: "   " } },
        asked: ["MODEL_NAME"]
      });

      expect(build()[0].label).toBe("Model name");
    });

    it("labels a key with no words after the key itself", () => {
      const { build } = setup({ services: [{ title: "web", env: [{ key: "__", value: "x" }] }], asked: ["__"] });

      expect(build()[0].label).toBe("__");
    });

    it("keeps a help text, trimmed and cut to 500 characters, and omits a blank one", () => {
      const { build } = setup({
        services: [
          {
            title: "web",
            env: [
              { key: "A", value: "1" },
              { key: "B", value: "1" },
              { key: "C", value: "1" },
              { key: "D", value: "1" }
            ]
          }
        ],
        customized: { A: { help: "  Which model  " }, B: { help: "h".repeat(501) }, C: { help: "   " }, D: { help: "h".repeat(500) } },
        asked: ["A", "B", "C", "D"]
      });

      const [a, b, c, d] = build();
      expect(a.help).toBe("Which model");
      expect(b.help).toBe("h".repeat(500));
      expect(c).not.toHaveProperty("help");
      expect(d.help).toBe("h".repeat(500));
    });

    it("overrides required on any type", () => {
      const { build } = setup({
        services: [{ title: "web", env: [{ key: "MODEL", value: "llama" }, { key: "OTHER" }, { key: "TOKEN", value: "ac-secret://TOKEN", isSecret: true }] }],
        customized: { MODEL: { required: true }, OTHER: { required: false }, TOKEN: { required: false } },
        asked: ["MODEL", "OTHER"]
      });

      expect(build().map(value => value.required)).toEqual([true, false, false]);
    });

    it("lets a plain row be asked as a secret without a default", () => {
      const { build } = setup({ services: [{ title: "web", env: [{ key: "PIN", value: "1234" }] }], customized: { PIN: { type: "secret" } }, asked: ["PIN"] });

      expect(build()).toStrictEqual([{ key: "PIN", label: "Pin", type: "secret", required: true, bindings: [{ service: "web", env: "PIN" }] }]);
    });

    it("applies the number constraints only to a number", () => {
      const customized = { min: 1, max: 10, integer: false, minLength: 2, maxLength: 4 };
      const asNumber = setup({
        services: [{ title: "web", env: [{ key: "N", value: "5" }] }],
        customized: { N: { type: "number", ...customized } },
        asked: ["N"]
      });
      const asText = setup({ services: [{ title: "web", env: [{ key: "N", value: "5" }] }], customized: { N: { type: "text", ...customized } }, asked: ["N"] });

      expect(asNumber.build()[0]).toStrictEqual({
        key: "N",
        label: "N",
        type: "number",
        default: "5",
        required: false,
        min: 1,
        max: 10,
        integer: false,
        bindings: [{ service: "web", env: "N" }]
      });
      expect(asText.build()[0]).toStrictEqual({
        key: "N",
        label: "N",
        type: "text",
        default: "5",
        required: false,
        minLength: 2,
        maxLength: 4,
        bindings: [{ service: "web", env: "N" }]
      });
    });

    it("applies the choices only to a choice", () => {
      const { build } = setup({
        services: [
          {
            title: "web",
            env: [
              { key: "A", value: "x" },
              { key: "B", value: "x" }
            ]
          }
        ],
        customized: { A: { type: "choice", choices: ["x", "y"] }, B: { type: "text", choices: ["x", "y"] } },
        asked: ["A", "B"]
      });

      const [a, b] = build();
      expect(a).toHaveProperty("choices", ["x", "y"]);
      expect(b).not.toHaveProperty("choices");
    });

    it("lets a whole-number flag override the one guessed from the row", () => {
      const { build } = setup({ services: [{ title: "web", env: [{ key: "N", value: "5" }] }], customized: { N: { integer: false } }, asked: ["N"] });

      expect(build()[0]).toMatchObject({ type: "number", integer: false });
    });

    it("leaves the whole-number flag out when the row is not a number", () => {
      const { build } = setup({ services: [{ title: "web", env: [{ key: "N", value: "five" }] }], customized: { N: { type: "number" } }, asked: ["N"] });

      expect(build()[0]).not.toHaveProperty("integer");
    });

    it("recomputes the guess from the row when the customization names no type", () => {
      const { build } = setup({ services: [{ title: "web", env: [{ key: "N", value: "true" }] }], customized: { N: { label: "Flag" } }, asked: ["N"] });

      expect(build()[0]).toMatchObject({ type: "boolean", default: "true", label: "Flag" });
    });
  });

  describe("choice", () => {
    it("drops a default that is not among the choices", () => {
      const { build } = setup({
        services: [{ title: "web", env: [{ key: "LEVEL", value: "trace" }] }],
        customized: { LEVEL: { type: "choice", choices: ["debug", "info"] } },
        asked: ["LEVEL"]
      });

      expect(build()[0]).toStrictEqual({
        key: "LEVEL",
        label: "Level",
        type: "choice",
        choices: ["debug", "info"],
        required: true,
        bindings: [{ service: "web", env: "LEVEL" }]
      });
    });

    it("falls back to the guessed type while no choices are given", () => {
      const { build } = setup({
        services: [
          {
            title: "web",
            env: [
              { key: "A", value: "info" },
              { key: "B", value: "info" }
            ]
          }
        ],
        customized: { A: { type: "choice" }, B: { type: "choice", choices: [] } },
        asked: ["A", "B"]
      });

      expect(build().map(value => value.type)).toEqual(["text", "text"]);
    });

    it("keeps at most 50 choices of at most 200 characters", () => {
      const choices = Array.from({ length: 51 }, (_, index) => `${index}`.padEnd(201, "x"));
      const { build } = setup({ services: [{ title: "web", env: [{ key: "A", value: "" }] }], customized: { A: { type: "choice", choices } }, asked: ["A"] });

      const [value] = build() as Array<Extract<TemplateAskedValue, { type: "choice" }>>;
      expect(value.choices).toHaveLength(50);
      expect(value.choices.every(choice => choice.length === 200)).toBe(true);
      expect(value.choices[0]).toBe("0".padEnd(200, "x"));
    });

    it("keeps 50 choices and 200-character choices whole", () => {
      const choices = Array.from({ length: 50 }, (_, index) => `${index}`.padEnd(200, "x"));
      const { build } = setup({ services: [{ title: "web", env: [{ key: "A", value: "" }] }], customized: { A: { type: "choice", choices } }, asked: ["A"] });

      expect(build()[0]).toHaveProperty("choices", choices);
    });
  });

  describe("boolean", () => {
    it("drops a default that is not true or false", () => {
      const { build } = setup({
        services: [{ title: "web", env: [{ key: "FLAG", value: "yes" }] }],
        customized: { FLAG: { type: "boolean" } },
        asked: ["FLAG"]
      });

      expect(build()[0]).toStrictEqual({ key: "FLAG", label: "Flag", type: "boolean", required: true, bindings: [{ service: "web", env: "FLAG" }] });
    });
  });

  describe("limits the api enforces", () => {
    it("drops a default longer than 4096 characters and keeps one of exactly 4096", () => {
      const { build } = setup({
        services: [
          {
            title: "web",
            env: [
              { key: "LONG", value: "x".repeat(4097) },
              { key: "EDGE", value: "y".repeat(4096) }
            ]
          }
        ],
        asked: ["LONG", "EDGE"]
      });

      const [long, edge] = build();
      expect(long).not.toHaveProperty("default");
      expect(long.required).toBe(true);
      expect(edge).toHaveProperty("default", "y".repeat(4096));
    });

    it("binds at most 20 rows to one value", () => {
      const services = Array.from({ length: 21 }, (_, index) => ({ title: `svc-${index}`, env: [{ key: "MODEL", value: "llama" }] }));
      const { build } = setup({ services, asked: ["MODEL"] });

      const [value] = build();
      expect(value.bindings).toHaveLength(20);
      expect(value.bindings[19]).toEqual({ service: "svc-19", env: "MODEL" });
    });

    it("asks at most 50 values", () => {
      const env = Array.from({ length: 51 }, (_, index) => ({ key: `KEY_${index}`, value: "x" }));
      const { build } = setup({ services: [{ title: "web", env }], asked: env.map(row => row.key) });

      const values = build();
      expect(values).toHaveLength(50);
      expect(values[49].key).toBe("KEY_49");
    });

    it("asks exactly 50 values whole", () => {
      const env = Array.from({ length: 50 }, (_, index) => ({ key: `KEY_${index}`, value: "x" }));
      const { build } = setup({ services: [{ title: "web", env }], asked: env.map(row => row.key) });

      expect(build()).toHaveLength(50);
    });
  });

  function setup(input: {
    services: Array<{ title: string; env?: EnvRow[] }>;
    asked?: string[];
    customized?: Record<string, AskedValueSetting["customized"]>;
    settings?: Record<string, AskedValueSetting>;
  }) {
    const services = input.services.map(entry => buildService(entry));
    const settings: Record<string, AskedValueSetting> =
      input.settings ??
      Object.fromEntries(
        [...new Set([...(input.asked ?? []), ...Object.keys(input.customized ?? {})])].map(key => [
          key,
          { key, isAsked: (input.asked ?? []).includes(key), customized: input.customized?.[key] ?? {} }
        ])
      );

    return { services, build: () => buildAskedValues(services, settings) };
  }
});

describe(summarizeAskedValues.name, () => {
  it("counts the asked values and the secrets among them", () => {
    const { summary } = setup({
      services: [
        {
          title: "web",
          env: [
            { key: "MODEL", value: "llama" },
            { key: "HF_TOKEN", value: "ac-secret://HF_TOKEN", isSecret: true },
            { key: "DB_PASSWORD", value: "ac-secret://DB_PASSWORD", isSecret: true }
          ]
        }
      ],
      asked: ["MODEL"]
    });

    expect(summary).toMatchObject({ asked: 3, secrets: 2 });
  });

  it("lists the plain keys saved as they are, once each and in order", () => {
    const { summary } = setup({
      services: [
        {
          title: "web",
          env: [
            { key: "LOG_LEVEL", value: "info" },
            { key: "MODEL", value: "llama" },
            { key: "HF_TOKEN", value: "ac-secret://HF_TOKEN", isSecret: true },
            { key: "PORT", value: "8000" }
          ]
        },
        {
          title: "worker",
          env: [
            { key: "PORT", value: "8001" },
            { key: "LOG_LEVEL", value: "debug" },
            { key: "SSH_PUBKEY", value: "ssh-ed25519 AAAA" },
            { key: " ", value: "x" }
          ]
        }
      ],
      asked: ["MODEL"]
    });

    expect(summary.savedAsIs).toEqual(["LOG_LEVEL", "PORT"]);
  });

  it("lists a key the api cannot take as a value among those saved as they are", () => {
    const { summary } = setup({ services: [{ title: "web", env: [{ key: "MY-VAR", value: "x" }] }], asked: ["MY-VAR"] });

    expect(summary.savedAsIs).toEqual(["MY-VAR"]);
  });

  it("counts the plain rows that look like a secret, whether or not they are asked", () => {
    const { summary } = setup({
      services: [
        {
          title: "web",
          env: [
            { key: "OPENAI_API_KEY", value: "sk-abcdefghijklmnopqrstuvwx" },
            { key: "MODEL", value: "llama" },
            { key: "HF_TOKEN", value: "ac-secret://HF_TOKEN", isSecret: true },
            { key: "SSH_PUBKEY", value: "sk-abcdefghijklmnopqrstuvwx" }
          ]
        },
        { title: "worker", env: [{ key: "OPENAI_API_KEY", value: "sk-abcdefghijklmnopqrstuvwx" }, { key: "NOTE" }] }
      ],
      asked: ["OPENAI_API_KEY"]
    });

    expect(summary.needsAttention).toBe(2);
  });

  it("does not count a secret row for attention even when its value looks like a key", () => {
    const { summary } = setup({ services: [{ title: "web", env: [{ key: "API_KEY", value: "sk-abcdefghijklmnopqrstuvwx", isSecret: true }] }] });

    expect(summary.needsAttention).toBe(0);
  });

  it("summarizes a template with no variables", () => {
    const { summary } = setup({ services: [{ title: "web" }] });

    expect(summary).toStrictEqual({ asked: 0, secrets: 0, needsAttention: 0, savedAsIs: [] });
  });

  function setup(input: { services: Array<{ title: string; env?: EnvRow[] }>; asked?: string[] }) {
    const services = input.services.map(entry => buildService(entry));
    const settings = Object.fromEntries((input.asked ?? []).map(key => [key, { key, isAsked: true, customized: {} }]));
    const values = buildAskedValues(services, settings);
    return { summary: summarizeAskedValues(values, services) };
  }
});

function buildService(input: { title: string; env?: EnvRow[] }): ServiceType {
  return { ...defaultServiceWithPlacement().services[0], id: `${input.title}-id`, title: input.title, env: input.env };
}
