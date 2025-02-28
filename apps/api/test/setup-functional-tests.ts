import "reflect-metadata";

import { closeConnections, migratePG } from "@src/core";

beforeAll(async () => {
  await migratePG();
});

afterAll(async () => {
  await closeConnections();
});

expect.extend({
  toBeTypeOrNull(received: unknown, type: StringConstructor) {
    try {
      expect(received).toEqual(expect.any(type));
      return {
        message: () => `Ok`,
        pass: true
      };
    } catch (error) {
      return received === null
        ? {
            message: () => `Ok`,
            pass: true
          }
        : {
            message: () => `expected ${received} to be ${type} type or null`,
            pass: false
          };
    }
  },

  dateTimeZ(received: string) {
    const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})Z$/;
    const pass = pattern.test(received);

    return {
      pass,
      message: () => `expected ${received} to be a UTC datetime string with milliseconds`
    };
  }
});
