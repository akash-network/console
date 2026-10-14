import { describe, expect, it } from "vitest";

import { initialsOf } from "./initials";

describe(initialsOf.name, () => {
  it.each([
    ["marcus chen", "MC"],
    ["priya.raman", "PR"],
    ["lena_k-ostrova", "LK"],
    ["sam", "S"],
    ["  ", ""]
  ])("reads %j as %j", (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});
