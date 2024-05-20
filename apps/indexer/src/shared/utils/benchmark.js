"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayTimesForGroup = exports.displayTimes = exports.startTimer = exports.measureAsync = exports.measure = exports.measureMethodAsync = exports.measureMethod = void 0;
const perf_hooks_1 = require("perf_hooks");
const date_1 = require("./date");
const math_1 = require("./math");
let benchmarkTimes = {};
let firstTime = null;
let lastTime = null;
let activeTimer = null;
function measureMethod(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = (...args) => {
        const timer = startTimer(`${target.constructor.name}.${propertyKey}`);
        const result = originalMethod.apply(this, args);
        timer.end();
        return result;
    };
}
exports.measureMethod = measureMethod;
function measureMethodAsync(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args) {
        return __awaiter(this, void 0, void 0, function* () {
            const timer = startTimer(`${target.constructor.name}.${propertyKey}`);
            const result = yield originalMethod.apply(this, args);
            timer.end();
            return result;
        });
    };
}
exports.measureMethodAsync = measureMethodAsync;
function measure(name, fn) {
    const timer = startTimer(name);
    try {
        return fn();
    }
    finally {
        timer.end();
    }
}
exports.measure = measure;
function measureAsync(name, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        const timer = startTimer(name);
        return yield fn().finally(() => timer.end());
    });
}
exports.measureAsync = measureAsync;
function startTimer(name) {
    const startTime = perf_hooks_1.performance.now();
    const parent = activeTimer;
    if (!(name in benchmarkTimes)) {
        benchmarkTimes[name] = {
            name: name,
            parent: parent,
            firstTime: startTime,
            time: 0,
            frequency: 0
        };
    }
    let oldActiveTimer = activeTimer;
    activeTimer = name;
    if (!firstTime) {
        firstTime = startTime;
    }
    return {
        end: () => {
            const endTime = perf_hooks_1.performance.now();
            if (activeTimer === name) {
                activeTimer = oldActiveTimer;
            }
            const key = name;
            benchmarkTimes[key].time += endTime - startTime;
            benchmarkTimes[key].frequency++;
            benchmarkTimes[key].lastTime = endTime;
            lastTime = endTime;
        }
    };
}
exports.startTimer = startTimer;
function displayTimes() {
    const groups = Object.values(benchmarkTimes)
        .map((x) => x.parent)
        .filter((value, index, self) => self.indexOf(value) === index);
    for (const group of groups) {
        displayTimesForGroup(group);
    }
}
exports.displayTimes = displayTimes;
function displayTimesForGroup(group) {
    console.log("Group: " + (group || "ROOT"));
    const fullTime = group
        ? Object.values(benchmarkTimes)
            .filter((x) => x.name == group)
            .reduce((acc, curr) => acc + curr.time, 0)
        : lastTime - firstTime;
    const totalRecordedTime = Object.values(benchmarkTimes)
        .filter((x) => x.parent == group)
        .reduce((acc, curr) => acc + curr.time, 0);
    const results = Object.keys(benchmarkTimes)
        .sort((a, b) => benchmarkTimes[b].time - benchmarkTimes[a].time)
        .filter((x) => benchmarkTimes[x].parent == group)
        .map((key) => ({
        name: key,
        time: (0, date_1.getPrettyTime)(benchmarkTimes[key].time),
        percentage: (0, math_1.round)((benchmarkTimes[key].time / fullTime) * 100, 2) + "%",
        frequency: benchmarkTimes[key].frequency.toString(),
        average: (0, date_1.getPrettyTime)(benchmarkTimes[key].time / benchmarkTimes[key].frequency)
    }));
    results.push({
        name: "------------",
        time: "-----",
        percentage: "-----",
        frequency: "---",
        average: "---"
    });
    const unaccountedFor = fullTime - totalRecordedTime;
    results.push({
        name: "Unaccounted for",
        time: (0, date_1.getPrettyTime)(unaccountedFor),
        percentage: `${(0, math_1.round)((unaccountedFor / fullTime) * 100)}%`,
        frequency: "",
        average: ""
    });
    results.push({
        name: "Total",
        time: (0, date_1.getPrettyTime)(fullTime),
        percentage: "100%",
        frequency: "",
        average: ""
    });
    console.table(results);
}
exports.displayTimesForGroup = displayTimesForGroup;
//# sourceMappingURL=benchmark.js.map