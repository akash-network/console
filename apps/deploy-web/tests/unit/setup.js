"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("@testing-library/jest-dom");
require("whatwg-fetch");
var node_buffer_1 = require("node:buffer");
var util_1 = require("util");
Object.assign(global, {
    TextDecoder: util_1.TextDecoder,
    TextEncoder: util_1.TextEncoder,
    Blob: node_buffer_1.Blob
});
beforeAll(function () {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: jest.fn().mockImplementation(function (query) { return ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(), // Deprecated
            removeListener: jest.fn(), // Deprecated
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn()
        }); })
    });
});
