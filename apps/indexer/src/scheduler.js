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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
const human_interval_1 = __importDefault(require("human-interval"));
const date_1 = require("./shared/utils/date");
const node_fetch_1 = __importDefault(require("node-fetch"));
class TaskDef {
    get runCount() {
        return this.successfulRunCount + this.failedRunCount;
    }
    constructor(name, fn, interval, runAtStart, healthchecksConfig) {
        this.runningPromise = null;
        this.successfulRunCount = 0;
        this.failedRunCount = 0;
        this.latestError = null;
        if (healthchecksConfig && !healthchecksConfig.id) {
            console.warn("Healthchecks config provided without an id.");
        }
        this.name = name;
        this.function = fn;
        this.interval = interval;
        this.runAtStart = runAtStart;
        this.healthchecksConfig = (healthchecksConfig === null || healthchecksConfig === void 0 ? void 0 : healthchecksConfig.id) ? healthchecksConfig : null;
    }
}
class Scheduler {
    constructor(config) {
        this.tasks = new Map();
        this.config = {};
        this.config = Object.assign(Object.assign({}, config), { errorHandler: (config === null || config === void 0 ? void 0 : config.errorHandler) || ((task, err) => console.error(`Task "${task.name}" failed: ${err}`)) });
    }
    registerTask(name, fn, interval, runAtStart = true, healthchecksConfig) {
        if (this.tasks.has(name)) {
            throw new Error(`Task with name "${name}" already exists`);
        }
        if (typeof interval === "string" && isNaN((0, human_interval_1.default)(interval))) {
            throw new Error(`Invalid interval "${interval}"`);
        }
        const intervalMs = typeof interval === "string" ? (0, human_interval_1.default)(interval) : interval;
        console.log(`Registered task "${name}" to run every ${(0, date_1.getPrettyTime)(intervalMs)}`);
        this.tasks.set(name, new TaskDef(name, fn, intervalMs, runAtStart, healthchecksConfig));
    }
    start() {
        for (const task of this.tasks.values()) {
            if (task.runAtStart) {
                this.runTask(task);
            }
            setInterval(() => {
                const runningTask = this.tasks.get(task.name);
                if (runningTask.runningPromise) {
                    console.log(`Skipping task "${task.name}" because it is already running`);
                    return;
                }
                console.log(`Starting task "${task.name}"`);
                this.runTask(runningTask);
            }, task.interval);
        }
    }
    runTask(runningTask) {
        var _a;
        let pingStartPromise = Promise.resolve();
        if (this.config.healthchecksEnabled && ((_a = runningTask.healthchecksConfig) === null || _a === void 0 ? void 0 : _a.measureDuration)) {
            pingStartPromise = this.healthchecksPingStart(runningTask);
        }
        runningTask.runningPromise = runningTask
            .function()
            .then(() => {
            console.log(`Task "${runningTask.name}" completed successfully`);
            runningTask.successfulRunCount++;
            if (this.config.healthchecksEnabled && runningTask.healthchecksConfig) {
                pingStartPromise.finally(() => this.healthchecksPingSuccess(runningTask));
            }
        })
            .catch((err) => {
            runningTask.failedRunCount++;
            runningTask.latestError = err;
            this.config.errorHandler(runningTask, err);
            if (this.config.healthchecksEnabled && runningTask.healthchecksConfig) {
                pingStartPromise.finally(() => this.healthchecksPingFailure(runningTask));
            }
        })
            .finally(() => {
            runningTask.runningPromise = null;
        });
    }
    healthchecksPingStart(runningTask) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield (0, node_fetch_1.default)(`https://hc-ping.com/${runningTask.healthchecksConfig.id}/start`);
            }
            catch (err) {
                console.error(err);
            }
        });
    }
    healthchecksPingSuccess(runningTask) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield (0, node_fetch_1.default)(`https://hc-ping.com/${runningTask.healthchecksConfig.id}`);
            }
            catch (err) {
                console.error(err);
            }
        });
    }
    healthchecksPingFailure(runningTask) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield (0, node_fetch_1.default)(`https://hc-ping.com/${runningTask.healthchecksConfig.id}/fail`);
            }
            catch (err) {
                console.error(err);
            }
        });
    }
    getTasksStatus() {
        return Array.from(this.tasks.values()).map((task) => ({
            name: task.name,
            isRunning: !!task.runningPromise,
            function: task.function,
            interval: (0, date_1.getPrettyTime)(task.interval),
            runCount: task.runCount,
            successfulRunCount: task.successfulRunCount,
            failedRunCount: task.failedRunCount,
            latestError: task.latestError || null,
            healthchecksConfig: !!task.healthchecksConfig
        }));
    }
}
exports.Scheduler = Scheduler;
//# sourceMappingURL=scheduler.js.map