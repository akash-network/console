"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jest_mock_extended_1 = require("jest-mock-extended");
var useTrialDeploymentTimeRemaining_1 = require("./useTrialDeploymentTimeRemaining");
var react_1 = require("@testing-library/react");
describe("useTrialTimeRemaining", function () {
    var mockDate = new Date("2024-01-01T12:00:00Z");
    it("should return default values when no data is available", function () {
        var result = setup({
            useBlockReturn: {
                data: undefined,
                isLoading: false,
                error: null
            },
            createdHeight: 1000,
            trialDurationHours: 24,
            averageBlockTime: 6
        }).result;
        expect(result.current.timeLeft).toBeNull();
        expect(result.current.isExpired).toBe(false);
        expect(result.current.timeRemainingText).toBe("Calculating...");
    });
    it("should calculate time remaining for active trial", function () {
        var result = setup({
            useBlockReturn: {
                data: {
                    block: {
                        header: {
                            height: "1100"
                        }
                    }
                },
                isLoading: false,
                error: null
            },
            createdHeight: 1000,
            trialDurationHours: 24,
            averageBlockTime: 6
        }).result;
        expect(result.current.isExpired).toBe(false);
        expect(result.current.timeLeft).toBeInstanceOf(Date);
        expect(result.current.timeLeft.getTime()).toBeGreaterThan(mockDate.getTime());
        expect(result.current.timeRemainingText).toContain("in");
    });
    it("should return expired status when trial has ended", function () {
        var trialDurationHours = 24;
        var averageBlockTime = 6;
        var totalTrialBlocks = trialDurationHours * (3600 / averageBlockTime); // 14400 blocks
        var currentHeight = 1000 + totalTrialBlocks + 100; // Past trial end
        var result = setup({
            useBlockReturn: {
                data: {
                    block: {
                        header: {
                            height: currentHeight.toString()
                        }
                    }
                },
                isLoading: false,
                error: null
            },
            createdHeight: 1000,
            trialDurationHours: trialDurationHours,
            averageBlockTime: averageBlockTime
        }).result;
        expect(result.current.isExpired).toBe(true);
        expect(result.current.timeLeft).toBeNull();
        expect(result.current.timeRemainingText).toBe("Trial expired");
    });
    it("should handle edge case where blocks remaining is exactly 0", function () {
        var trialDurationHours = 24;
        var averageBlockTime = 6;
        var totalTrialBlocks = trialDurationHours * (3600 / averageBlockTime); // 14400 blocks
        var currentHeight = 1000 + totalTrialBlocks; // Exactly at trial end
        var result = setup({
            useBlockReturn: {
                data: {
                    block: {
                        header: {
                            height: currentHeight.toString()
                        }
                    }
                },
                isLoading: false,
                error: null
            },
            createdHeight: 1000,
            trialDurationHours: trialDurationHours,
            averageBlockTime: averageBlockTime
        }).result;
        expect(result.current.isExpired).toBe(true);
        expect(result.current.timeLeft).toBeNull();
        expect(result.current.timeRemainingText).toBe("Trial expired");
    });
    it("should handle different block times correctly", function () {
        var result = setup({
            useBlockReturn: {
                data: {
                    block: {
                        header: {
                            height: "1100"
                        }
                    }
                },
                isLoading: false,
                error: null
            },
            createdHeight: 1000,
            trialDurationHours: 12,
            averageBlockTime: 12 // 12 seconds per block
        }).result;
        expect(result.current.isExpired).toBe(false);
        expect(result.current.timeLeft).toBeInstanceOf(Date);
        expect(result.current.timeRemainingText).toContain("in");
    });
    it("should handle very short trial durations", function () {
        var result = setup({
            useBlockReturn: {
                data: {
                    block: {
                        header: {
                            height: "1001"
                        }
                    }
                },
                isLoading: false,
                error: null
            },
            createdHeight: 1000,
            trialDurationHours: 1, // 1 hour trial
            averageBlockTime: 6
        }).result;
        expect(result.current.isExpired).toBe(false);
        expect(result.current.timeLeft).toBeInstanceOf(Date);
        expect(result.current.timeRemainingText).toContain("in");
    });
    it("should handle decimal block times", function () {
        var result = setup({
            useBlockReturn: {
                data: {
                    block: {
                        header: {
                            height: "1100"
                        }
                    }
                },
                isLoading: false,
                error: null
            },
            createdHeight: 1000,
            trialDurationHours: 24,
            averageBlockTime: 5.5 // 5.5 seconds per block
        }).result;
        expect(result.current.isExpired).toBe(false);
        expect(result.current.timeLeft).toBeInstanceOf(Date);
        expect(result.current.timeRemainingText).toContain("in");
    });
    it("should return calculating text when createdHeight is not provided", function () {
        var result = setup({
            useBlockReturn: {
                data: {
                    block: {
                        header: {
                            height: "1100"
                        }
                    }
                },
                isLoading: false,
                error: null
            },
            createdHeight: undefined
        }).result;
        expect(result.current.timeLeft).toBeNull();
        expect(result.current.isExpired).toBe(false);
        expect(result.current.timeRemainingText).toBeNull();
    });
    it("should return calculating text when trialDurationHours is not provided", function () {
        var result = setup({
            useBlockReturn: {
                data: {
                    block: {
                        header: {
                            height: "1100"
                        }
                    }
                },
                isLoading: false,
                error: null
            },
            createdHeight: 1000,
            trialDurationHours: undefined
        }).result;
        expect(result.current.timeLeft).toBeNull();
        expect(result.current.isExpired).toBe(false);
        expect(result.current.timeRemainingText).toBe("Calculating...");
    });
    function withTimers(testFn) {
        jest.useFakeTimers();
        jest.setSystemTime(mockDate);
        try {
            return testFn();
        }
        finally {
            jest.useRealTimers();
            jest.clearAllMocks();
        }
    }
    function setup(input) {
        return withTimers(function () {
            var mockUseBlock = (0, jest_mock_extended_1.mockFn)();
            mockUseBlock.mockImplementation(function () { return input.useBlockReturn; });
            var result = (0, react_1.renderHook)(function () {
                return (0, useTrialDeploymentTimeRemaining_1.useTrialDeploymentTimeRemaining)({
                    createdHeight: input.createdHeight,
                    trialDurationHours: input.trialDurationHours,
                    averageBlockTime: input.averageBlockTime,
                    dependencies: {
                        useBlock: mockUseBlock
                    }
                });
            }).result;
            return { result: result, mockUseBlock: mockUseBlock };
        });
    }
});
