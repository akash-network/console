import axios from "axios";
import humanInterval from "human-interval";

import { getPrettyTime } from "@src/utils";

class TaskDef {
  name: string;
  function: () => Promise<void>;
  interval: number;
  runAtStart: boolean;
  runningPromise: Promise<void> | null = null;
  successfulRunCount: number = 0;
  failedRunCount: number = 0;
  latestError: string | Error | null = null;
  healthchecksConfig: HealthchecksConfig | null = null;

  get runCount() {
    return this.successfulRunCount + this.failedRunCount;
  }

  constructor(name: string, fn: () => Promise<void>, interval: number, runAtStart?: boolean, healthchecksConfig?: HealthchecksConfig) {
    if (healthchecksConfig && !healthchecksConfig.id) {
      console.warn("Healthchecks config provided without an id.");
    }

    this.name = name;
    this.function = fn;
    this.interval = interval;
    this.runAtStart = !!runAtStart;
    this.healthchecksConfig = healthchecksConfig?.id ? healthchecksConfig : null;
  }
}

interface SchedulerConfig {
  errorHandler?: (task: TaskDef, error: Error) => void;
  healthchecksEnabled?: boolean;
}

interface HealthchecksConfig {
  id: string;
  measureDuration?: boolean;
}

export class Scheduler {
  private tasks: Map<string, TaskDef> = new Map();
  private readonly config: Required<SchedulerConfig>;

  constructor(config?: SchedulerConfig) {
    this.config = {
      ...config,
      healthchecksEnabled: !!config?.healthchecksEnabled,
      errorHandler: config?.errorHandler || ((task, err) => console.error(`Task "${task.name}" failed: ${err}`))
    };
  }

  public registerTask(
    name: string,
    fn: () => Promise<void>,
    interval: number | string,
    runAtStart: boolean = true,
    healthchecksConfig?: HealthchecksConfig
  ): void {
    if (this.tasks.has(name)) {
      throw new Error(`Task with name "${name}" already exists`);
    }

    const intervalMs = typeof interval === "string" ? humanInterval(interval) : interval;

    if (typeof intervalMs === "undefined" || Number.isNaN(intervalMs)) {
      throw new Error(`Invalid interval "${interval}"`);
    }

    console.log(`Registered task "${name}" to run every ${getPrettyTime(intervalMs)}`);

    this.tasks.set(name, new TaskDef(name, fn, intervalMs, runAtStart, healthchecksConfig));
  }

  public start(): void {
    for (const task of this.tasks.values()) {
      if (task.runAtStart) {
        this.runTask(task);
      }

      setInterval(() => {
        const runningTask = this.tasks.get(task.name);
        if (!runningTask || runningTask.runningPromise) {
          console.log(`Skipping task "${task.name}" because it is already running`);
          return;
        }

        console.log(`Starting task "${task.name}"`);
        this.runTask(runningTask);
      }, task.interval);
    }
  }

  private runTask(runningTask: TaskDef): void {
    let pingStartPromise = Promise.resolve();
    if (this.config.healthchecksEnabled && runningTask.healthchecksConfig?.measureDuration) {
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
      .catch(err => {
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

  async healthchecksPingStart(runningTask: TaskDef): Promise<void> {
    if (!runningTask.healthchecksConfig) return;

    try {
      await axios.get(`https://hc-ping.com/${runningTask.healthchecksConfig.id}/start`);
    } catch (err) {
      console.error(err);
    }
  }

  async healthchecksPingSuccess(runningTask: TaskDef): Promise<void> {
    if (!runningTask.healthchecksConfig) return;

    try {
      await axios.get(`https://hc-ping.com/${runningTask.healthchecksConfig.id}`);
    } catch (err) {
      console.error(err);
    }
  }

  async healthchecksPingFailure(runningTask: TaskDef): Promise<void> {
    if (!runningTask.healthchecksConfig) return;

    try {
      await axios.get(`https://hc-ping.com/${runningTask.healthchecksConfig.id}/fail`);
    } catch (err) {
      console.error(err);
    }
  }

  public getTasksStatus() {
    return Array.from(this.tasks.values()).map(task => ({
      name: task.name,
      isRunning: !!task.runningPromise,
      interval: getPrettyTime(task.interval),
      runCount: task.runCount,
      successfulRunCount: task.successfulRunCount,
      failedRunCount: task.failedRunCount,
      latestError: task.latestError,
      healthchecksConfig: !!task.healthchecksConfig
    }));
  }
}
