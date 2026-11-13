import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { EnvironmentVariableType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { answerOf, askedValueIssuesOf, blockedReasonOf, withAnswer, withUnsetYesNoAsNo } from "./askedValueAnswers";

type ServiceInput = { title: string; env: EnvironmentVariableType[] };

const MODEL: TemplateAskedValue = {
  key: "MODEL_ID",
  label: "Model",
  type: "text",
  required: true,
  bindings: [
    { service: "vllm", env: "MODEL_ID" },
    { service: "webui", env: "DEFAULT_MODELS" }
  ]
};

describe("askedValueAnswers", () => {
  describe(answerOf.name, () => {
    it("reads the first bound row's value", () => {
      const values = setup([
        { title: "vllm", env: [{ key: "MODEL_ID", value: "llama" }] },
        { title: "webui", env: [{ key: "DEFAULT_MODELS", value: "mistral" }] }
      ]);

      expect(answerOf(values, MODEL)).toEqual({ value: "llama", isPresent: true });
    });

    it("reads a later binding when the first one's row was removed", () => {
      const values = setup([
        { title: "vllm", env: [] },
        { title: "webui", env: [{ key: "DEFAULT_MODELS", value: "mistral" }] }
      ]);

      expect(answerOf(values, MODEL)).toEqual({ value: "mistral", isPresent: true });
    });

    it("matches a row whose key carries stray spaces", () => {
      const values = setup([{ title: "vllm", env: [{ key: " MODEL_ID ", value: "llama" }] }]);

      expect(answerOf(values, MODEL)).toEqual({ value: "llama", isPresent: true });
    });

    it("reads an unset row as empty", () => {
      const values = setup([{ title: "vllm", env: [{ key: "MODEL_ID" }] }]);

      expect(answerOf(values, MODEL)).toEqual({ value: "", isPresent: true });
    });

    it("reads an unset yes/no as No", () => {
      const values = setup([{ title: "vllm", env: [{ key: "ENABLE_SIGNUP", value: "" }] }]);

      expect(answerOf(values, boolean())).toEqual({ value: "false", isPresent: true });
    });

    it("reads a secret whose row still holds the template's reference as not answered", () => {
      const values = setup([{ title: "vllm", env: [{ key: "HF_TOKEN", value: "ac-secret://HF_TOKEN", isSecret: true }] }]);

      expect(answerOf(values, secret())).toEqual({ value: "", isPresent: true });
    });

    it("reads a secret the deployer typed", () => {
      const typedSecret = faker.string.alphanumeric(24);
      const values = setup([{ title: "vllm", env: [{ key: "HF_TOKEN", value: typedSecret, isSecret: true }] }]);

      expect(answerOf(values, secret())).toEqual({ value: typedSecret, isPresent: true });
    });

    it("reads a plain row as written, even one spelling a reference", () => {
      const values = setup([{ title: "vllm", env: [{ key: "MODEL_ID", value: "ac-secret://MODEL_ID" }] }]);

      expect(answerOf(values, MODEL)).toEqual({ value: "ac-secret://MODEL_ID", isPresent: true });
    });

    it("reports a variable whose services and rows were all removed as absent", () => {
      const values = setup([{ title: "api", env: [{ key: "MODEL_ID", value: "llama" }] }]);

      expect(answerOf(values, MODEL)).toEqual({ value: "", isPresent: false });
    });

    it("reports a variable whose rows were renamed as absent", () => {
      const values = setup([{ title: "vllm", env: [{ key: "MODEL", value: "llama" }] }]);

      expect(answerOf(values, MODEL)).toEqual({ value: "", isPresent: false });
    });
  });

  describe(withAnswer.name, () => {
    it("writes one answer into every bound row", () => {
      const values = setup([
        {
          title: "vllm",
          env: [
            { key: "MODEL_ID", value: "llama" },
            { key: "PORT", value: "8000" }
          ]
        },
        { title: "webui", env: [{ key: " DEFAULT_MODELS", value: "llama" }] },
        { title: "worker", env: [{ key: "MODEL_ID", value: "kept" }] }
      ]);

      const answered = withAnswer(values, MODEL, "qwen");

      expect(envOf(answered)).toEqual([
        [
          { key: "MODEL_ID", value: "qwen" },
          { key: "PORT", value: "8000" }
        ],
        [{ key: " DEFAULT_MODELS", value: "qwen" }],
        [{ key: "MODEL_ID", value: "kept" }]
      ]);
      expect(values.services[0].env?.[0].value).toBe("llama");
    });

    it("keeps every service without a bound row as it was", () => {
      const values = setup([
        { title: "vllm", env: [{ key: "MODEL_ID", value: "llama" }] },
        { title: "worker", env: [{ key: "PORT", value: "8000" }] },
        { title: "webui", env: [] }
      ]);
      values.services[2].env = undefined;

      const answered = withAnswer(values, MODEL, "qwen");

      expect(answered.services[0]).not.toBe(values.services[0]);
      expect(answered.services[1]).toBe(values.services[1]);
      expect(answered.services[2]).toBe(values.services[2]);
    });

    it("keeps a secret answer marked secret, even on a row the template left empty", () => {
      const typedSecret = faker.string.alphanumeric(24);
      const values = setup([
        { title: "vllm", env: [{ key: "HF_TOKEN", value: "ac-secret://HF_TOKEN", isSecret: true }] },
        { title: "webui", env: [{ key: "HF_TOKEN", value: "" }] }
      ]);

      const answered = withAnswer(
        values,
        secret({
          bindings: [
            { service: "vllm", env: "HF_TOKEN" },
            { service: "webui", env: "HF_TOKEN" }
          ]
        }),
        typedSecret
      );

      expect(envOf(answered)).toEqual([[{ key: "HF_TOKEN", value: typedSecret, isSecret: true }], [{ key: "HF_TOKEN", value: typedSecret, isSecret: true }]]);
    });

    it("changes nothing for an absent variable", () => {
      const values = setup([{ title: "api", env: [{ key: "MODEL_ID", value: "llama" }] }]);

      expect(withAnswer(values, MODEL, "qwen")).toEqual(values);
    });
  });

  describe(withUnsetYesNoAsNo.name, () => {
    it("writes No into a yes/no whose bound rows are all empty", () => {
      const values = setup([
        { title: "vllm", env: [{ key: "ENABLE_SIGNUP", value: "" }] },
        { title: "webui", env: [{ key: "ENABLE_SIGNUP" }] }
      ]);

      const answered = withUnsetYesNoAsNo(values, [
        boolean({
          bindings: [
            { service: "vllm", env: "ENABLE_SIGNUP" },
            { service: "webui", env: "ENABLE_SIGNUP" }
          ]
        })
      ]);

      expect(envOf(answered)).toEqual([[{ key: "ENABLE_SIGNUP", value: "false" }], [{ key: "ENABLE_SIGNUP", value: "false" }]]);
    });

    it.each([
      { name: "a yes/no with a set row", askedValue: boolean(), env: [{ key: "ENABLE_SIGNUP", value: "true" }] },
      { name: "a yes/no whose rows were removed", askedValue: boolean(), env: [] },
      { name: "an empty value of another type", askedValue: text(), env: [{ key: "ADMIN_EMAIL", value: "" }] }
    ])("leaves $name as it is", ({ askedValue, env }) => {
      const values = setup([{ title: "vllm", env }]);

      expect(withUnsetYesNoAsNo(values, [askedValue])).toEqual(values);
    });

    it("leaves a yes/no with one set row as it is", () => {
      const values = setup([
        { title: "vllm", env: [{ key: "ENABLE_SIGNUP", value: "" }] },
        { title: "webui", env: [{ key: "ENABLE_SIGNUP", value: "true" }] }
      ]);

      expect(
        withUnsetYesNoAsNo(values, [
          boolean({
            bindings: [
              { service: "vllm", env: "ENABLE_SIGNUP" },
              { service: "webui", env: "ENABLE_SIGNUP" }
            ]
          })
        ])
      ).toEqual(values);
    });
  });

  describe(askedValueIssuesOf.name, () => {
    it.each<{ name: string; askedValue: TemplateAskedValue; value: string | undefined; issue: string | undefined }>([
      { name: "a required empty value", askedValue: text({ required: true }), value: "", issue: "Enter a value for Admin email to continue." },
      { name: "a required value of only spaces", askedValue: text({ required: true }), value: "  ", issue: "Enter a value for Admin email to continue." },
      { name: "a required unset value", askedValue: text({ required: true }), value: undefined, issue: "Enter a value for Admin email to continue." },
      { name: "an optional empty value", askedValue: text({ required: false, minLength: 3 }), value: "", issue: undefined },
      { name: "a filled required value", askedValue: text({ required: true }), value: "a@b.co", issue: undefined },
      { name: "a text shorter than its minimum", askedValue: text({ minLength: 3 }), value: "ab", issue: "Admin email is shorter than 3 characters." },
      { name: "a text at its minimum", askedValue: text({ minLength: 3 }), value: "abc", issue: undefined },
      { name: "a text reaching its minimum only with spaces", askedValue: text({ minLength: 3 }), value: " ab", issue: undefined },
      { name: "a text longer than its maximum", askedValue: text({ maxLength: 3 }), value: "abcd", issue: "Admin email is longer than 3 characters." },
      { name: "a text at its maximum", askedValue: text({ maxLength: 3 }), value: "abc", issue: undefined },
      {
        name: "a text over its maximum only with spaces",
        askedValue: text({ maxLength: 3 }),
        value: "abc ",
        issue: "Admin email is longer than 3 characters."
      },
      { name: "a text without bounds", askedValue: text(), value: "x".repeat(300), issue: undefined },
      { name: "a value that is not a number", askedValue: number(), value: "12a", issue: "Context length is not a number." },
      { name: "a number in exponent notation", askedValue: number(), value: "1e3", issue: "Context length is not a number." },
      { name: "a number with spaces around it", askedValue: number(), value: " 12 ", issue: "Context length is not a number." },
      { name: "a negative decimal", askedValue: number(), value: "-1.5", issue: undefined },
      { name: "a number without bounds", askedValue: number(), value: "-99999", issue: undefined },
      { name: "a decimal where a whole number is asked", askedValue: number({ integer: true }), value: "2.5", issue: "Context length is not a whole number." },
      { name: "a whole number where one is asked", askedValue: number({ integer: true }), value: "2", issue: undefined },
      { name: "a number below its minimum", askedValue: number({ min: 2048 }), value: "1024", issue: "Context length is below 2048." },
      { name: "a number at its minimum", askedValue: number({ min: 2048 }), value: "2048", issue: undefined },
      { name: "a number above its maximum", askedValue: number({ max: 32768 }), value: "40000", issue: "Context length is above 32768." },
      { name: "a number at its maximum", askedValue: number({ max: 32768 }), value: "32768", issue: undefined },
      { name: "a required empty number", askedValue: number({ required: true }), value: "", issue: "Enter a value for Context length to continue." },
      { name: "a choice outside its choices", askedValue: choice(), value: "gpt", issue: "Pick one of the choices." },
      { name: "a choice with stray spaces", askedValue: choice(), value: " qwen", issue: "Pick one of the choices." },
      { name: "one of the choices", askedValue: choice(), value: "qwen", issue: undefined },
      { name: "a required empty choice", askedValue: choice({ required: true }), value: "", issue: "Enter a value for Model to continue." },
      { name: "a required unset yes/no, which shows No", askedValue: boolean({ required: true }), value: "", issue: undefined },
      { name: "a yes/no set to true", askedValue: boolean(), value: "true", issue: undefined },
      { name: "a yes/no set to false", askedValue: boolean(), value: "false", issue: undefined },
      { name: "a yes/no that is neither true nor false", askedValue: boolean(), value: "yes", issue: "Pick Yes or No." },
      {
        name: "a secret still holding its reference",
        askedValue: secret(),
        value: "ac-secret://HF_TOKEN",
        issue: "Enter a value for Hugging Face token to continue."
      },
      {
        name: "an optional secret still holding its reference",
        askedValue: secret({ required: false }),
        value: "ac-secret://HF_TOKEN",
        issue: "Enter a value for Hugging Face token to continue."
      },
      { name: "a typed secret", askedValue: secret(), value: faker.string.alphanumeric(24), issue: undefined }
    ])("reports $name", ({ askedValue, value, issue }) => {
      const values = setup([{ title: "vllm", env: [{ key: askedValue.bindings[0].env, value, isSecret: askedValue.type === "secret" }] }]);

      expect(askedValueIssuesOf(values, [askedValue])).toEqual(issue === undefined ? {} : { [askedValue.key]: issue });
    });

    it("takes a secret's kept reference as answered once the deployment exists", () => {
      const values = setup([{ title: "vllm", env: [{ key: "HF_TOKEN", value: "ac-secret://HF_TOKEN", isSecret: true }] }]);

      expect(askedValueIssuesOf(values, [secret()], { isDeploymentCreated: true })).toEqual({});
      expect(askedValueIssuesOf(values, [secret()], { isDeploymentCreated: false })).toEqual({ HF_TOKEN: "Enter a value for Hugging Face token to continue." });
    });

    it("still asks for a secret emptied after the deployment exists", () => {
      const values = setup([{ title: "vllm", env: [{ key: "HF_TOKEN", value: "", isSecret: true }] }]);

      expect(askedValueIssuesOf(values, [secret()], { isDeploymentCreated: true })).toEqual({ HF_TOKEN: "Enter a value for Hugging Face token to continue." });
    });

    it("skips an optional variable whose rows were removed", () => {
      const values = setup([{ title: "api", env: [{ key: "MODEL_ID", value: "" }] }]);

      expect(askedValueIssuesOf(values, [{ ...MODEL, required: false }])).toEqual({});
    });

    it("asks for the row of a required variable whose rows were removed", () => {
      const values = setup([{ title: "api", env: [{ key: "MODEL_ID", value: "" }] }]);

      expect(askedValueIssuesOf(values, [MODEL])).toEqual({
        MODEL_ID: "Model isn't in this configuration anymore. Restore its row or reset the configuration."
      });
    });

    it("asks for a required value until every bound row holds one", () => {
      const values = setup([
        { title: "vllm", env: [{ key: "MODEL_ID", value: "llama" }] },
        { title: "webui", env: [{ key: "DEFAULT_MODELS", value: "" }] }
      ]);

      expect(askedValueIssuesOf(values, [MODEL])).toEqual({ MODEL_ID: "Enter a value for Model to continue." });
    });

    it("checks the value of every bound row", () => {
      const values = setup([
        { title: "vllm", env: [{ key: "MODEL_ID", value: "ok" }] },
        { title: "webui", env: [{ key: "DEFAULT_MODELS", value: "far too long" }] }
      ]);

      expect(askedValueIssuesOf(values, [{ ...MODEL, maxLength: 5 } as TemplateAskedValue])).toEqual({ MODEL_ID: "Model is longer than 5 characters." });
    });

    it("checks the filled rows of an optional value and skips its empty ones", () => {
      const values = setup([
        { title: "vllm", env: [{ key: "MODEL_ID", value: "" }] },
        { title: "webui", env: [{ key: "DEFAULT_MODELS", value: "ab" }] }
      ]);

      expect(askedValueIssuesOf(values, [{ ...MODEL, required: false, minLength: 3 } as TemplateAskedValue])).toEqual({
        MODEL_ID: "Model is shorter than 3 characters."
      });
    });

    it("keys each issue by its variable", () => {
      const values = setup([
        {
          title: "vllm",
          env: [
            { key: "MODEL_ID", value: "" },
            { key: "MAX_MODEL_LEN", value: "1" }
          ]
        }
      ]);

      expect(askedValueIssuesOf(values, [MODEL, number({ min: 2 })])).toEqual({
        MODEL_ID: "Enter a value for Model to continue.",
        MAX_MODEL_LEN: "Context length is below 2."
      });
    });
  });

  describe(blockedReasonOf.name, () => {
    it.each([
      { empty: 1, invalid: 0, reason: "1 required field is empty" },
      { empty: 2, invalid: 0, reason: "2 required fields are empty" },
      { empty: 0, invalid: 1, reason: "1 field has an invalid value" },
      { empty: 0, invalid: 2, reason: "2 fields have an invalid value" },
      { empty: 1, invalid: 1, reason: "1 required field is empty and 1 field has an invalid value" }
    ])("says $reason", ({ empty, invalid, reason }) => {
      const emptyValues = Array.from({ length: empty }, (_, index) => text({ key: `EMPTY_${index}`, required: true }));
      const invalidValues = Array.from({ length: invalid }, (_, index) => number({ key: `INVALID_${index}` }));
      const values = setup([
        {
          title: "vllm",
          env: [
            ...emptyValues.map(askedValue => ({ key: askedValue.key, value: "" })),
            ...invalidValues.map(askedValue => ({ key: askedValue.key, value: "x" }))
          ]
        }
      ]);

      expect(blockedReasonOf(values, [...emptyValues, ...invalidValues])).toBe(reason);
    });

    it("counts a required variable whose rows were removed as empty", () => {
      const values = setup([{ title: "api", env: [] }]);

      expect(blockedReasonOf(values, [MODEL])).toBe("1 required field is empty");
    });

    it("blocks nothing once a created deployment holds a secret's kept reference", () => {
      const values = setup([{ title: "vllm", env: [{ key: "HF_TOKEN", value: "ac-secret://HF_TOKEN", isSecret: true }] }]);

      expect(blockedReasonOf(values, [secret()], { isDeploymentCreated: true })).toBeUndefined();
      expect(blockedReasonOf(values, [secret()])).toBe("1 required field is empty");
    });

    it("blocks nothing once every variable is answered", () => {
      const values = setup([
        { title: "vllm", env: [{ key: "MODEL_ID", value: "llama" }] },
        { title: "webui", env: [{ key: "DEFAULT_MODELS", value: "llama" }] }
      ]);

      expect(blockedReasonOf(values, [MODEL])).toBeUndefined();
    });
  });

  function setup(services: ServiceInput[]) {
    const base = defaultServiceWithPlacement();
    return {
      ...base,
      services: services.map(
        (service, index): ServiceType => ({
          ...base.services[0],
          id: `service-${index}`,
          title: service.title,
          env: structuredClone(service.env)
        })
      )
    };
  }
});

function envOf(values: SdlBuilderFormValuesType) {
  return values.services.map(service => service.env);
}

function text(overrides: Partial<Extract<TemplateAskedValue, { type: "text" }>> = {}): TemplateAskedValue {
  const key = overrides.key ?? "ADMIN_EMAIL";
  return { key, label: "Admin email", type: "text", required: false, bindings: [{ service: "vllm", env: key }], ...overrides };
}

function number(overrides: Partial<Extract<TemplateAskedValue, { type: "number" }>> = {}): TemplateAskedValue {
  const key = overrides.key ?? "MAX_MODEL_LEN";
  return { key, label: "Context length", type: "number", required: false, bindings: [{ service: "vllm", env: key }], ...overrides };
}

function choice(overrides: Partial<Extract<TemplateAskedValue, { type: "choice" }>> = {}): TemplateAskedValue {
  return {
    key: "MODEL_ID",
    label: "Model",
    type: "choice",
    required: false,
    choices: ["llama", "qwen"],
    bindings: [{ service: "vllm", env: "MODEL_ID" }],
    ...overrides
  };
}

function boolean(overrides: Partial<Extract<TemplateAskedValue, { type: "boolean" }>> = {}): TemplateAskedValue {
  return {
    key: "ENABLE_SIGNUP",
    label: "Allow sign-ups",
    type: "boolean",
    required: false,
    bindings: [{ service: "vllm", env: "ENABLE_SIGNUP" }],
    ...overrides
  };
}

function secret(overrides: Partial<Extract<TemplateAskedValue, { type: "secret" }>> = {}): TemplateAskedValue {
  return { key: "HF_TOKEN", label: "Hugging Face token", type: "secret", required: true, bindings: [{ service: "vllm", env: "HF_TOKEN" }], ...overrides };
}
