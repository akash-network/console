"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var keyValue_1 = require("./keyValue");
describe("kvArrayToObject", function () {
    it("converts array of key-value pairs to object", function () {
        var input = [
            { key: "name", value: "John" },
            { key: "age", value: "30" },
            { key: "city", value: "New York" }
        ];
        var result = (0, keyValue_1.kvArrayToObject)(input);
        expect(result).toEqual({
            name: "John",
            age: "30",
            city: "New York"
        });
    });
    it("handles empty array", function () {
        var result = (0, keyValue_1.kvArrayToObject)([]);
        expect(result).toEqual({});
    });
    it("handles array with undefined values", function () {
        var input = [
            { key: "name", value: "John" },
            { key: "age", value: undefined },
            { key: "city", value: "New York" }
        ];
        var result = (0, keyValue_1.kvArrayToObject)(input);
        expect(result).toEqual({
            name: "John",
            age: undefined,
            city: "New York"
        });
    });
    it("overwrites duplicate keys with last value", function () {
        var input = [
            { key: "name", value: "John" },
            { key: "name", value: "Jane" },
            { key: "age", value: "30" }
        ];
        var result = (0, keyValue_1.kvArrayToObject)(input);
        expect(result).toEqual({
            name: "Jane",
            age: "30"
        });
    });
});
