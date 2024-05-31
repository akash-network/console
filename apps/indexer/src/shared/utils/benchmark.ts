import { performance } from "perf_hooks";
import { getPrettyTime } from "./date";
import { round } from "./math";

type BenchmarkDetails = {
  name: string;
  parent?: string;
  firstTime?: number;
  lastTime?: number;
  time: number;
  frequency: number;
};

let benchmarkTimes: { [key: string]: BenchmarkDetails } = {};
let firstTime = null;
let lastTime = null;
let activeTimer = null;

export function measureMethod(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = (...args: any[]) => {
    const timer = startTimer(`${target.constructor.name}.${propertyKey}`);
    const result = originalMethod.apply(this, args);
    timer.end();

    return result;
  };
}

export function measureMethodAsync(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const timer = startTimer(`${target.constructor.name}.${propertyKey}`);
    const result = await originalMethod.apply(this, args);
    timer.end();

    return result;
  };
}

export function measure<T>(name: string, fn: () => T): T {
  const timer = startTimer(name);

  try {
    return fn();
  } finally {
    timer.end();
  }
}

export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const timer = startTimer(name);
  return await fn().finally(() => timer.end());
}

export function startTimer(name: string) {
  const startTime = performance.now();

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
    end: (): void => {
      const endTime = performance.now();

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

export function displayTimes(): void {
  const groups = Object.values(benchmarkTimes)
    .map((x) => x.parent)
    .filter((value, index, self) => self.indexOf(value) === index);

  for (const group of groups) {
    displayTimesForGroup(group);
  }
}

export function displayTimesForGroup(group: string) {
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
      time: getPrettyTime(benchmarkTimes[key].time),
      percentage: round((benchmarkTimes[key].time / fullTime) * 100, 2) + "%",
      frequency: benchmarkTimes[key].frequency.toString(),
      average: getPrettyTime(benchmarkTimes[key].time / benchmarkTimes[key].frequency)
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
    time: getPrettyTime(unaccountedFor),
    percentage: `${round((unaccountedFor / fullTime) * 100)}%`,
    frequency: "",
    average: ""
  });

  results.push({
    name: "Total",
    time: getPrettyTime(fullTime),
    percentage: "100%",
    frequency: "",
    average: ""
  });

  console.table(results);
}
