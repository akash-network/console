import { ServiceSchema } from "./sdlBuilder";

describe("ServiceSchema", () => {
  it("validates a minimal valid service", () => {
    const result = ServiceSchema.safeParse({
      title: "web",
      image: "nginx:latest",
      profile: {
        cpu: 0.1,
        ram: 256,
        ramUnit: "Mi",
        storage: [{ size: 512, unit: "Mi" }]
      },
      expose: [{ port: 80, as: 80, global: true }],
      placement: {
        name: "dcloud",
        pricing: { amount: 1000, denom: "uakt" }
      },
      count: 1
    });

    expect(result.success).toBe(true);
  });
});
