import type { CoreV1Event, Watch } from "@kubernetes/client-node";
import { mock } from "vitest-mock-extended";

import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { FileDestinationService } from "@src/services/file-destination/file-destination.service";
import type { LoggerService } from "@src/services/logger/logger.service";
import { K8sEventsCollectorService } from "./k8s-events-collector.service";

import { seedKubernetesEventTestData } from "@test/seeders/kubernetes-event.seeder";
import { seedPodInfoTestData } from "@test/seeders/pod-info.seeder";

describe(K8sEventsCollectorService.name, () => {
  it("should watch events filtered by pod name and write formatted lines", async () => {
    const podInfo = seedPodInfoTestData();
    const { service, ac, watch, writeStream } = setup({ podInfo });

    const event = seedKubernetesEventTestData({
      involvedObject: { kind: "Pod", name: podInfo.podName, namespace: podInfo.namespace },
      type: "Normal",
      reason: "Scheduled",
      lastTimestamp: "2025-06-15T10:30:00.000Z" as unknown as Date
    });

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalled());

    fireEvent("ADDED", event);
    await vi.waitFor(() => expect(writeStream.write).toHaveBeenCalled());

    ac.abort();
    endWatch();
    await startPromise;

    expect(watch.watch).toHaveBeenCalledWith(
      `/api/v1/namespaces/${podInfo.namespace}/events`,
      expect.objectContaining({ fieldSelector: `involvedObject.name=${podInfo.podName}` }),
      expect.any(Function),
      expect.any(Function)
    );

    expect(writeStream.write).toHaveBeenCalledWith(expect.stringContaining('"timestamp":"2025-06-15T10:30:00.000Z"'));
    expect(writeStream.write).toHaveBeenCalledWith(expect.stringContaining('"phase":"ADDED"'));
    expect(writeStream.write).toHaveBeenCalledWith(expect.stringContaining('"reason":"Scheduled"'));
  });

  it("should only include curated fields in the JSON output", async () => {
    const podInfo = seedPodInfoTestData();
    const { service, ac, writeStream } = setup({ podInfo });

    const event = seedKubernetesEventTestData({
      metadata: { resourceVersion: "200", uid: "some-uid", name: "event-name", creationTimestamp: new Date() },
      involvedObject: { kind: "Pod", name: podInfo.podName, namespace: podInfo.namespace, uid: "pod-uid", apiVersion: "v1", resourceVersion: "50" },
      source: { component: "kubelet", host: "node-2" }
    });

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalled());

    fireEvent("MODIFIED", event);
    await vi.waitFor(() => expect(writeStream.write).toHaveBeenCalled());

    ac.abort();
    endWatch();
    await startPromise;

    expect(writeStream.write).toHaveBeenCalledWith(
      expect.stringContaining(`"involvedObject":{"kind":"Pod","name":"${podInfo.podName}","namespace":"${podInfo.namespace}"}`)
    );
    expect(writeStream.write).not.toHaveBeenCalledWith(expect.stringContaining('"uid"'));
    expect(writeStream.write).not.toHaveBeenCalledWith(expect.stringContaining('"apiVersion"'));
  });

  it("should log POD_EVENTS_WATCH_FORBIDDEN and return on 403 error", async () => {
    const podInfo = seedPodInfoTestData();
    const { service, loggerService, errorHandlerService } = setup({ podInfo });

    const forbiddenError = Object.assign(new Error("Forbidden"), { statusCode: 403 });
    errorHandlerService.isForbidden.mockReturnValue(true);

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalled());

    endWatch(forbiddenError);
    await startPromise;

    expect(loggerService.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "POD_EVENTS_WATCH_FORBIDDEN", podName: podInfo.podName }));
  });

  it("should reconnect when watch ends without error", async () => {
    const podInfo = seedPodInfoTestData();
    const { service, ac } = setup({ podInfo });

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(1));

    endWatch();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(2));

    ac.abort();
    endWatch();
    await startPromise;
  });

  it("should pass resourceVersion from last event on reconnect", async () => {
    const podInfo = seedPodInfoTestData();
    const { service, ac } = setup({ podInfo });

    const event = seedKubernetesEventTestData({ metadata: { resourceVersion: "456" } });

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(1));

    fireEvent("ADDED", event);

    endWatch();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(2));

    expect(watch.watch).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ resourceVersion: "456" }),
      expect.any(Function),
      expect.any(Function)
    );

    ac.abort();
    endWatch();
    await startPromise;
  });

  it("should throw on non-403 watch error", async () => {
    const podInfo = seedPodInfoTestData();
    const { service, errorHandlerService } = setup({ podInfo });

    const watchError = new Error("connection refused");
    errorHandlerService.isForbidden.mockReturnValue(false);

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalled());

    endWatch(watchError);

    await expect(startPromise).rejects.toThrow("connection refused");
  });

  it("should stop when signal is aborted", async () => {
    const podInfo = seedPodInfoTestData();
    const { service, ac } = setup({ podInfo });

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalled());

    ac.abort();
    endWatch();
    await startPromise;

    expect(watch.watch).toHaveBeenCalledTimes(1);
  });

  let watch: ReturnType<typeof mock<Watch>>;
  let eventCb: (phase: string, apiObj: CoreV1Event) => void;
  let doneCb: (err?: unknown) => void;
  const fireEvent = (phase: string, event: CoreV1Event) => eventCb(phase, event);
  const endWatch = (err?: unknown) => doneCb(err);

  function setup(input: { podInfo?: ReturnType<typeof seedPodInfoTestData> } = {}) {
    const podInfo = input.podInfo ?? seedPodInfoTestData();
    const ac = new AbortController();

    watch = mock<Watch>();
    eventCb = () => {};
    doneCb = () => {};

    watch.watch.mockImplementation(async (_path, _params, cb, done) => {
      eventCb = cb;
      doneCb = done;
      return new AbortController();
    });

    const loggerService = mock<LoggerService>();
    const errorHandlerService = mock<ErrorHandlerService>();
    errorHandlerService.isForbidden.mockReturnValue(false);

    const writeStream = mock<NodeJS.WritableStream>();
    writeStream.write.mockReturnValue(true);

    const fileDestination = mock<FileDestinationService>();
    fileDestination.createWriteStream.mockResolvedValue(writeStream);

    const service = new K8sEventsCollectorService(podInfo, fileDestination, watch, loggerService, errorHandlerService, ac.signal);

    return { service, ac, watch, loggerService, errorHandlerService, fileDestination, writeStream };
  }
});
