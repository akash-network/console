import type * as fsGlobal from "fs";
import type { ReadStream, WriteStream } from "fs";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";
import type * as pathGlobal from "path";
import type * as readlineGlobal from "readline";
import { container } from "tsyringe";

import { ConfigService } from "@src/services/config/config.service";
import { LoggerService } from "@src/services/logger/logger.service";
import { FileDestinationService } from "./file-destination.service";

import { seedConfigTestData } from "@test/seeders/config.seeder";
import { seedPodInfoTestData } from "@test/seeders/pod-info.seeder";
import { mockProvider } from "@test/utils/mock-provider.util";

type FsGlobal = typeof fsGlobal;

describe(FileDestinationService.name, () => {
  let cleanUp = () => {};
  afterEach(() => cleanUp());

  describe("createWriteStream", () => {
    it("should create stable write stream successfully", async () => {
      const { fileDestinationService, mockFs, expectedPath } = setup();
      await fileDestinationService.createWriteStream();

      expect(mockFs.createWriteStream).toHaveBeenCalledWith(expectedPath, {
        flags: "a",
        autoClose: false
      });
    });

    it("should create log directory if it doesn't exist", async () => {
      const { fileDestinationService, mockFs, logDir, loggerService } = setup();

      mockFs.promises.access
        .mockRejectedValueOnce(new Error("File not found"))
        .mockRejectedValueOnce(new Error("Directory not found"))
        .mockResolvedValue(undefined);

      await fileDestinationService.createWriteStream();

      expect(mockFs.promises.mkdir).toHaveBeenCalledWith(logDir, { recursive: true });
      expect(loggerService.info).toHaveBeenCalledWith({
        message: "Created log directory",
        path: logDir
      });
    });

    it("should create log file if it doesn't exist", async () => {
      const { fileDestinationService, loggerService, mockFs, expectedPath } = setup();

      mockFs.promises.access.mockRejectedValueOnce(new Error("File not found")).mockResolvedValue(undefined);

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
      const { fileDestinationService, mockPath } = setup();

      await fileDestinationService.createWriteStream();
      await fileDestinationService.createWriteStream();

      expect(mockPath.join).toHaveBeenCalledTimes(1);
    });

    it("should build correct log file path", async () => {
      const { fileDestinationService, mockPath, logDir } = setup();

      await fileDestinationService.createWriteStream();

      expect(mockPath.join).toHaveBeenCalledWith(logDir, "test-namespace_test-pod.log");
    });
  });

  describe("getLastLogLine", () => {
    it("should get last log line from file", async () => {
      const { fileDestinationService, mockFs, mockPath, expectedPath, mockReadline } = setup();
      const mockReadStream = mock<ReadStream>();
      const mockRl = mock<readlineGlobal.Interface>();

      mockFs.createReadStream.mockReturnValue(mockReadStream);
      mockReadline.createInterface.mockReturnValue(mockRl);
      mockPath.join.mockReturnValue(expectedPath);

      mockRl.on.mockImplementation((event, callback) => {
        if (event === "line") {
          callback("2024-01-15T10:30:45.123456789Z INFO First line");
          callback("2024-01-15T10:30:46.123456789Z INFO Second line");
        } else if (event === "close") {
          callback("close");
        }
        return mockRl;
      });

      const result = await fileDestinationService.getLastLogLines();

      expect(result).toMatchObject([
        { timestamp: new Date("2024-01-15T10:30:46.123456789Z").getTime(), line: "2024-01-15T10:30:46.123456789Z INFO Second line" }
      ]);
      expect(mockFs.createReadStream).toHaveBeenCalledWith(expectedPath, { encoding: "utf8" });
      expect(mockReadline.createInterface).toHaveBeenCalledWith({
        input: mockReadStream,
        crlfDelay: Infinity
      });
    });

    it("should get last log lines with same second from file", async () => {
      const { fileDestinationService, mockFs, mockPath, expectedPath, mockReadline } = setup();
      const mockReadStream = mock<ReadStream>();
      const mockRl = mock<readlineGlobal.Interface>();

      mockFs.createReadStream.mockReturnValue(mockReadStream);
      mockReadline.createInterface.mockReturnValue(mockRl);
      mockPath.join.mockReturnValue(expectedPath);

      mockRl.on.mockImplementation((event, callback) => {
        if (event === "line") {
          callback("2024-01-15T10:30:45.123456789Z INFO First line");
          callback("2024-01-15T10:30:46.123456789Z INFO Second line");
          callback("2024-01-15T10:30:46.133456789Z INFO Third line");
        } else if (event === "close") {
          callback("close");
        }
        return mockRl;
      });

      const result = await fileDestinationService.getLastLogLines();

      expect(result).toMatchObject([
        { timestamp: new Date("2024-01-15T10:30:46.123456789Z").getTime(), line: "2024-01-15T10:30:46.123456789Z INFO Second line" },
        { timestamp: new Date("2024-01-15T10:30:46.133456789Z").getTime(), line: "2024-01-15T10:30:46.133456789Z INFO Third line" }
      ]);
      expect(mockFs.createReadStream).toHaveBeenCalledWith(expectedPath, { encoding: "utf8" });
      expect(mockReadline.createInterface).toHaveBeenCalledWith({
        input: mockReadStream,
        crlfDelay: Infinity
      });
    });

    it("should return empty array for empty file", async () => {
      const { fileDestinationService, mockFs, mockPath, expectedPath, mockReadline } = setup();
      const mockReadStream = mock<ReadStream>();
      const mockRl = mock<readlineGlobal.Interface>();

      mockRl.on.mockImplementation((event, callback) => {
        if (event === "line") {
          callback("");
        } else if (event === "close") {
          callback("close");
        }
        return mockRl;
      });
      mockFs.createReadStream.mockReturnValue(mockReadStream);
      mockReadline.createInterface.mockReturnValue(mockRl);
      mockPath.join.mockReturnValue(expectedPath);

      const result = await fileDestinationService.getLastLogLines();

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });

    it("should handle file read errors gracefully", async () => {
      const { fileDestinationService, mockFs, mockPath, expectedPath, mockReadline } = setup();
      const mockReadStream = mock<ReadStream>();
      const mockRl = mock<readlineGlobal.Interface>();

      mockRl.on.mockReturnValue(mockRl);

      mockFs.createReadStream.mockReturnValue(mockReadStream);
      mockReadline.createInterface.mockReturnValue(mockRl);
      mockPath.join.mockReturnValue(expectedPath);

      mockRl.on.mockImplementation((event, callback) => {
        if (event === "error") {
          callback(new Error("File read error"));
        }
        return mockRl;
      });

      const result = await fileDestinationService.getLastLogLines();

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });
  });

  function setup() {
    container.clearInstances();
    const podInfo = seedPodInfoTestData({
      podName: "test-pod",
      namespace: "test-namespace"
    });
    const loggerService = mockProvider(LoggerService);
    const configService = new ConfigService(seedConfigTestData());
    container.register(ConfigService, { useValue: configService });

    const mockFs = mock<Omit<FsGlobal, "promises"> & { promises: MockProxy<FsGlobal["promises"]> }>();
    mockFs.promises = mock<FsGlobal["promises"]>();
    mockFs.createWriteStream.mockReset();
    mockFs.createReadStream = jest.fn() as any;
    const mockWriteStream = mock<WriteStream>();
    mockFs.createWriteStream.mockReturnValue(mockWriteStream);

    const mockPath = mock<typeof pathGlobal>();
    const logDir = configService.get("LOG_DIR");
    const expectedPath = `${logDir}/test-namespace_test-pod.log`;
    mockPath.join.mockReturnValue(expectedPath);

    const mockReadline = mock<typeof readlineGlobal>();
    const fileDestinationService = new FileDestinationService(loggerService, configService, podInfo, mockFs, mockPath, mockReadline);

    cleanUp = () => {
      fileDestinationService.stopRotating();
    };

    return {
      fileDestinationService,
      podInfo,
      loggerService,
      configService,
      mockFs,
      mockPath,
      mockReadline,
      expectedPath,
      logDir
    };
  }
});
