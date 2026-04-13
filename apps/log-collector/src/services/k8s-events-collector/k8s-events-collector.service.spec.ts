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
    const { service, ac, watch, writeStream, fireEvent, endWatch } = setup({ podInfo });

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

  it("should log POD_EVENTS_WATCH_ESTABLISHED on first event received", async () => {
    const podInfo = seedPodInfoTestData();
    const { service, ac, watch, loggerService, fireEvent, endWatch } = setup({ podInfo });

    const event = seedKubernetesEventTestData({ involvedObject: { kind: "Pod", name: podInfo.podName, namespace: podInfo.namespace } });

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalled());

    expect(loggerService.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "POD_EVENTS_WATCH_ESTABLISHED" }));

    fireEvent("ADDED", event);
    await vi.waitFor(() => expect(loggerService.info).toHaveBeenCalledWith(expect.objectContaining({ event: "POD_EVENTS_WATCH_ESTABLISHED" })));

    fireEvent("MODIFIED", event);

    ac.abort();
    endWatch();
    await startPromise;

    expect(loggerService.info).toHaveBeenCalledWith(expect.objectContaining({ event: "POD_EVENTS_WATCH_ESTABLISHED", podName: podInfo.podName }));
    expect(loggerService.info).toHaveBeenCalledTimes(1);
  });

  it("should only include curated fields in the JSON output", async () => {
    const podInfo = seedPodInfoTestData();
    const { service, ac, watch, writeStream, fireEvent, endWatch } = setup({ podInfo });

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
    const { service, watch, loggerService, errorHandlerService, endWatch } = setup({ podInfo });

    const forbiddenError = Object.assign(new Error("Forbidden"), { statusCode: 403 });
    errorHandlerService.isForbidden.mockReturnValue(true);

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalled());

    endWatch(forbiddenError);
    await startPromise;

    expect(loggerService.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "POD_EVENTS_WATCH_FORBIDDEN", podName: podInfo.podName }));
    expect(loggerService.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "POD_EVENTS_WATCH_ESTABLISHED" }));
  });

  it("should reconnect when watch ends without error", async () => {
    const { service, ac, watch, endWatch } = setup();

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(1));

    endWatch();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(2));

    ac.abort();
    endWatch();
    await startPromise;
  });

  it("passes the last-seen resourceVersion on normal reconnect to avoid duplicates", async () => {
    const { service, ac, watch, fireEvent, endWatch, watchResourceVersionAt } = setup();

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(1));

    fireEvent("ADDED", seedKubernetesEventTestData({ metadata: { resourceVersion: "456" } }));
    endWatch();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(2));

    expect(watchResourceVersionAt(1)).toBe("456");

    ac.abort();
    endWatch();
    await startPromise;
  });

  it("does not write ERROR phase events to the output stream", async () => {
    const { service, ac, watch, writeStream, fireEvent, endWatch, STATUS_TOO_OLD_RESOURCE_VERSION } = setup();
    const normalEvent = seedKubernetesEventTestData({ reason: "Scheduled", lastTimestamp: "2025-06-15T10:30:00.000Z" as unknown as Date });

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(1));

    fireEvent("ERROR", STATUS_TOO_OLD_RESOURCE_VERSION);
    fireEvent("ADDED", normalEvent);
    await vi.waitFor(() => expect(writeStream.write).toHaveBeenCalled());

    ac.abort();
    endWatch();
    await startPromise;

    expect(writeStream.write).toHaveBeenCalledTimes(1);
    expect(writeStream.write).toHaveBeenCalledWith(expect.stringContaining('"phase":"ADDED"'));
  });

  it("skips duplicate events on reconnect by uid:resourceVersion", async () => {
    const { service, ac, watch, writeStream, fireEvent, endWatch } = setup();

    const event1 = seedKubernetesEventTestData({
      metadata: { uid: "uid-1", resourceVersion: "100" },
      reason: "Scheduled",
      lastTimestamp: "2025-06-15T10:30:00.000Z" as unknown as Date
    });
    const event2 = seedKubernetesEventTestData({
      metadata: { uid: "uid-2", resourceVersion: "101" },
      reason: "Started",
      lastTimestamp: "2025-06-15T10:30:01.000Z" as unknown as Date
    });

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(1));

    fireEvent("ADDED", event1);
    fireEvent("ADDED", event2);
    await vi.waitFor(() => expect(writeStream.write).toHaveBeenCalledTimes(2));

    endWatch();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(2));

    fireEvent("ADDED", event1);
    fireEvent("ADDED", event2);
    const event3 = seedKubernetesEventTestData({
      metadata: { uid: "uid-3", resourceVersion: "200" },
      reason: "Pulled",
      lastTimestamp: "2025-06-15T10:31:00.000Z" as unknown as Date
    });
    fireEvent("ADDED", event3);
    await vi.waitFor(() => expect(writeStream.write).toHaveBeenCalledTimes(3));

    ac.abort();
    endWatch();
    await startPromise;

    expect(writeStream.write).toHaveBeenCalledTimes(3);
  });

  it("reconnects without a resourceVersion after an ERROR phase event", async () => {
    const { service, ac, watch, fireEvent, endWatch, watchResourceVersionAt, STATUS_TOO_OLD_RESOURCE_VERSION } = setup();

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(1));

    fireEvent("ADDED", seedKubernetesEventTestData({ metadata: { resourceVersion: "111" } }));
    fireEvent("ERROR", STATUS_TOO_OLD_RESOURCE_VERSION);
    endWatch();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalledTimes(2));

    expect(watchResourceVersionAt(1)).toBeUndefined();

    ac.abort();
    endWatch();
    await startPromise;
  });

  it("should throw on non-403 watch error", async () => {
    const podInfo = seedPodInfoTestData();
    const { service, watch, errorHandlerService, endWatch } = setup({ podInfo });

    const watchError = new Error("connection refused");
    errorHandlerService.isForbidden.mockReturnValue(false);

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalled());

    endWatch(watchError);

    await expect(startPromise).rejects.toThrow("connection refused");
  });

  it("should stop when signal is aborted", async () => {
    const podInfo = seedPodInfoTestData();
    const { service, ac, watch, endWatch } = setup({ podInfo });

    const startPromise = service.collectPodEvents();
    await vi.waitFor(() => expect(watch.watch).toHaveBeenCalled());

    ac.abort();
    endWatch();
    await startPromise;

    expect(watch.watch).toHaveBeenCalledTimes(1);
  });

  function setup(input: { podInfo?: ReturnType<typeof seedPodInfoTestData> } = {}) {
    const podInfo = input.podInfo ?? seedPodInfoTestData();
    const ac = new AbortController();

    const watch = mock<Watch>();
    const handlers: { eventCb?: (phase: string, apiObj: CoreV1Event) => void; doneCb?: (err?: unknown) => void } = {};

    watch.watch.mockImplementation(async (_path, _params, cb, done) => {
      handlers.eventCb = cb;
      handlers.doneCb = done;
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

    return {
      service,
      ac,
      watch,
      loggerService,
      errorHandlerService,
      fileDestination,
      writeStream,
      fireEvent: (phase: string, event: CoreV1Event) => handlers.eventCb?.(phase, event),
      endWatch: (err?: unknown) => handlers.doneCb?.(err),
      watchResourceVersionAt: (callIndex: number) => (watch.watch.mock.calls[callIndex]?.[1] as { resourceVersion?: string } | undefined)?.resourceVersion,
      STATUS_TOO_OLD_RESOURCE_VERSION: {
        kind: "Status",
        status: "Failure",
        message: "too old resource version: 12345",
        reason: "Expired",
        code: 410
      } as unknown as CoreV1Event
    };
  }
});
