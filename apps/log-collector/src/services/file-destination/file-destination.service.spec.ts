import type * as fsGlobal from "fs";
import type { WriteStream } from "fs";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";
import type * as pathGlobal from "path";
import { PassThrough } from "stream";
import { container } from "tsyringe";

import { ConfigService } from "@src/services/config/config.service";
import { LoggerService } from "@src/services/logger/logger.service";
import { FileDestinationService } from "./file-destination.service";

import { seedPodInfoTestData } from "@test/seeders/pod-info.seeder";
import { mockProvider } from "@test/utils/mock-provider.util";

type FsGlobal = typeof fsGlobal;

describe(FileDestinationService.name, () => {
  it("should create stable write stream successfully", async () => {
    const { fileDestinationService, mockFs, mockPath, expectedPath } = setup();
    const mockWriteStream = mock<WriteStream>();

    mockFs.promises.access.mockResolvedValue(undefined);
    mockFs.createWriteStream.mockReturnValue(mockWriteStream);
    mockPath.join.mockReturnValue(expectedPath);

    const result = await fileDestinationService.createWriteStream();

    expect(result).toBeInstanceOf(PassThrough);
    expect(mockFs.createWriteStream).toHaveBeenCalledWith(expectedPath, {
      flags: "a",
      autoClose: false
    });
  });

  it("should create log directory if it doesn't exist", async () => {
    const { fileDestinationService, loggerService, mockFs, mockPath, logDir, expectedPath } = setup();

    mockFs.promises.access
      .mockRejectedValueOnce(new Error("File not found"))
      .mockRejectedValueOnce(new Error("Directory not found"))
      .mockResolvedValue(undefined);
    mockFs.promises.mkdir.mockResolvedValue(undefined);
    mockFs.promises.writeFile.mockResolvedValue(undefined);
    mockFs.createWriteStream.mockReturnValue(mock<WriteStream>());
    mockPath.join.mockReturnValue(expectedPath);

    await fileDestinationService.createWriteStream();

    expect(mockFs.promises.mkdir).toHaveBeenCalledWith(logDir, { recursive: true });
    expect(loggerService.info).toHaveBeenCalledWith({
      message: "Created log directory",
      path: logDir
    });
  });

  it("should create log file if it doesn't exist", async () => {
    const { fileDestinationService, loggerService, mockFs, mockPath, expectedPath } = setup();

    mockFs.promises.access.mockRejectedValueOnce(new Error("File not found")).mockResolvedValue(undefined);
    mockFs.promises.writeFile.mockResolvedValue(undefined);
    mockFs.createWriteStream.mockReturnValue(mock<WriteStream>());
    mockPath.join.mockReturnValue(expectedPath);

    await fileDestinationService.createWriteStream();

    expect(mockFs.promises.writeFile).toHaveBeenCalledWith(expectedPath, "");
    expect(loggerService.info).toHaveBeenCalledWith({
      message: "Created log file",
      filePath: expectedPath,
      namespace: "test-namespace",
      podName: "test-pod"
    });
  });

  it("should cache log path after first access", async () => {
    const { fileDestinationService, mockFs, mockPath, configService } = setup();
    const logDir = configService.get("LOG_DIR");
    const expectedPath = `${logDir}/test-namespace_test-pod.log`;

    mockFs.promises.access.mockResolvedValue(undefined);
    mockFs.createWriteStream.mockReturnValue(mock<WriteStream>());
    mockPath.join.mockReturnValue(expectedPath);

    await fileDestinationService.createWriteStream();
    await fileDestinationService.createWriteStream();

    expect(mockPath.join).toHaveBeenCalledTimes(1);
  });

  it("should get last log line from file", async () => {
    const { fileDestinationService, mockFs, mockPath, expectedPath } = setup();
    const logContent = "2024-01-15T10:30:45.123456789Z INFO First line\n2024-01-15T10:30:46.123456789Z INFO Second line\n";

    mockFs.promises.access.mockResolvedValue(undefined);
    mockFs.promises.readFile.mockResolvedValue(logContent);
    mockPath.join.mockReturnValue(expectedPath);

    const result = await fileDestinationService.getLastLogLine();

    expect(result).toBe("2024-01-15T10:30:46.123456789Z INFO Second line");
    expect(mockFs.promises.readFile).toHaveBeenCalledWith(expectedPath, "utf8");
  });

  it("should return null for empty file", async () => {
    const { fileDestinationService, mockFs, mockPath, expectedPath } = setup();

    mockFs.promises.access.mockResolvedValue(undefined);
    mockFs.promises.readFile.mockResolvedValue("");
    mockPath.join.mockReturnValue(expectedPath);

    const result = await fileDestinationService.getLastLogLine();

    expect(result).toBeNull();
  });

  it("should return null for file with only empty lines", async () => {
    const { fileDestinationService, mockFs, mockPath, expectedPath } = setup();

    mockFs.promises.access.mockResolvedValue(undefined);
    mockFs.promises.readFile.mockResolvedValue("\n\n\n");
    mockPath.join.mockReturnValue(expectedPath);

    const result = await fileDestinationService.getLastLogLine();

    expect(result).toBeNull();
  });

  it("should handle file read errors gracefully", async () => {
    const { fileDestinationService, mockFs, mockPath, expectedPath } = setup();

    mockFs.promises.access.mockResolvedValue(undefined);
    mockFs.promises.readFile.mockRejectedValue(new Error("File read error"));
    mockPath.join.mockReturnValue(expectedPath);

    const result = await fileDestinationService.getLastLogLine();

    expect(result).toBeNull();
  });

  it("should create stable write stream with internal rotation handling", async () => {
    const { fileDestinationService, mockFs, mockPath, expectedPath } = setup();
    const mockWriteStream = mock<WriteStream>();

    mockFs.promises.access.mockResolvedValue(undefined);
    mockFs.createWriteStream.mockReturnValue(mockWriteStream);
    mockPath.join.mockReturnValue(expectedPath);

    const result = await fileDestinationService.createWriteStream();

    expect(result).toBeInstanceOf(PassThrough);
    expect(mockFs.createWriteStream).toHaveBeenCalledWith(expectedPath, { flags: "a", autoClose: false });
  });

  it("should build correct log file path", async () => {
    const { fileDestinationService, configService, mockFs, mockPath } = setup();

    mockFs.promises.access.mockResolvedValue(undefined);
    mockFs.createWriteStream.mockReturnValue(mock<WriteStream>());
    mockPath.join.mockReturnValue("/var/log/mycollector/test-namespace_test-pod");

    await fileDestinationService.createWriteStream();

    expect(mockPath.join).toHaveBeenCalledWith("/var/log/mycollector", "test-namespace_test-pod.log");
    expect(configService.get).toHaveBeenCalledWith("LOG_DIR");
  });

  function setup() {
    container.clearInstances();
    const podInfo = seedPodInfoTestData({
      podName: "test-pod",
      namespace: "test-namespace"
    });
    const loggerService = mockProvider(LoggerService);
    const configService = mockProvider(ConfigService);

    const mockFs = mock<Omit<FsGlobal, "promises"> & { promises: MockProxy<FsGlobal["promises"]> }>();
    mockFs.promises = mock<FsGlobal["promises"]>();

    const mockPath = mock<typeof pathGlobal>();

    const logDir = "/var/log/mycollector";
    const expectedPath = `${logDir}/test-namespace_test-pod.log`;

    configService.get.mockReturnValue(logDir);

    const fileDestinationService = new FileDestinationService(loggerService, configService, podInfo, mockFs, mockPath);

    return {
      fileDestinationService,
      podInfo,
      loggerService,
      configService,
      mockFs,
      mockPath,
      logDir,
      expectedPath
    };
  }
});
