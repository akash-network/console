import { kvArrayToObject } from "./keyValue";

describe("kvArrayToObject", () => {
  it("converts array of key-value pairs to object", () => {
    const input = [
      { key: "name", value: "John" },
      { key: "age", value: "30" },
      { key: "city", value: "New York" }
    ];

    const result = kvArrayToObject(input);

    expect(result).toEqual({
      name: "John",
      age: "30",
      city: "New York"
    });
  });

  it("handles empty array", () => {
    const result = kvArrayToObject([]);
    expect(result).toEqual({});
  });

  it("handles array with undefined values", () => {
    const input = [
      { key: "name", value: "John" },
      { key: "age", value: undefined },
      { key: "city", value: "New York" }
    ];

    const result = kvArrayToObject(input);

    expect(result).toEqual({
      name: "John",
      age: undefined,
      city: "New York"
    });
  });

  it("overwrites duplicate keys with last value", () => {
    const input = [
      { key: "name", value: "John" },
      { key: "name", value: "Jane" },
      { key: "age", value: "30" }
    ];

    const result = kvArrayToObject(input);

    expect(result).toEqual({
      name: "Jane",
      age: "30"
    });
  });
});
