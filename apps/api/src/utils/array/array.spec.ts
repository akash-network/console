import { createFilterUnique } from "./array";

describe("array helpers", () => {
  describe("createFilterUnique", () => {
    it("should return a functionning unique filter with default equality matcher", () => {
      const arrayWithDuplicate = [1, 2, 2, 3, 3, 3];
      const expected = [1, 2, 3];

      expect(arrayWithDuplicate.filter(createFilterUnique())).toEqual(expected);
    });

    it("should return a functionning unique filter with custom matcher", () => {
      const arrayWithDuplicate = [{ v: 1 }, { v: 2 }, { v: 2 }, { v: 3 }, { v: 3 }, { v: 3 }];
      const expected = [{ v: 1 }, { v: 2 }, { v: 3 }];

      expect(arrayWithDuplicate.filter(createFilterUnique((a, b) => a.v === b.v))).toEqual(expected);
    });
  });
});
