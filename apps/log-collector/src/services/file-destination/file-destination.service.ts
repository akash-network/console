import * as fsGlobal from "fs";
import memoize from "lodash/memoize";
import * as pathGlobal from "path";
import { PassThrough } from "stream";
import { setTimeout as delay } from "timers/promises";

import type { ConfigService } from "@src/services/config/config.service";
import type { LoggerService } from "@src/services/logger/logger.service";
import type { PodInfo } from "@src/services/pod-discovery/pod-discovery.service";

/**
 * Manages file-based log destinations for Kubernetes pod logs
 *
 * This service handles:
 * - Creating and managing log files for individual pods
 * - Automatic log file rotation based on configurable size limits
 * - Retrieving the last log line for resumption purposes
 * - Memoized log path generation for performance
 * - Graceful error handling for file system operations
 *
 * The service creates log files in the format: `<namespace>_<podName>` within
 * the configured log directory, and implements automatic rotation when files
 * exceed the maximum size limit (configurable via LOG_MAX_FILE_SIZE_BYTES).
 * Rotation keeps up to LOG_MAX_ROTATED_FILES rotated files.
 */
export class FileDestinationService {
  /**
   * Creates a new FileDestinationService instance
   *
   * @param loggerService - Service for logging application events
   * @param configService - Service for accessing configuration values
   * @param podInfo - Information about the pod to manage logs for
   * @param fs - File system module (defaults to Node.js fs module)
   * @param path - Path module (defaults to Node.js path module)
   */
  constructor(
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService,
    private readonly podInfo: PodInfo,
    private readonly fs = fsGlobal,
    private readonly path = pathGlobal
  ) {
    this.getLogPath = memoize(this.getLogPath.bind(this));
  }

  /**
   * Creates a stable write stream for the pod's log file
   *
   * This method returns a single stable write stream that handles file rotation
   * internally. The client code can write to this stream continuously without
   * worrying about rotation. If rotation fails, the stream will emit an 'error'
   * event that the client should handle.
   *
   * @returns Promise that resolves to a stable write stream for the log file
   * @throws Error if file system operations fail during initialization
   */
  async createWriteStream(): Promise<NodeJS.WritableStream> {
    const filePath = await this.getLogPath();
    const stableStream = new PassThrough();
    this.createStableWriteStream(filePath, stableStream);

    return stableStream;
  }

  /**
   * Retrieves the last non-empty line from the pod's log file
   *
   * This method is used for log resumption to avoid duplicate log collection.
   * It reads the entire file and returns the last non-empty line, or null
   * if the file is empty or doesn't exist.
   *
   * @returns Promise that resolves to the last log line or null if no logs exist
   */
  async getLastLogLine(): Promise<string | null> {
    try {
      const filePath = await this.getLogPath();
      return await this.readLastLineFromFile(filePath);
    } catch (error) {
      return null;
    }
  }

  /**
   * Gets the log file path for the pod (memoized)
   *
   * This method is memoized to improve performance when called multiple times.
   * It ensures the log file exists before returning the path.
   *
   * @returns Promise that resolves to the absolute path of the log file
   * @throws Error if directory creation or file creation fails
   */
  private async getLogPath(): Promise<string> {
    const filePath = this.buildLogFilePath();
    await this.ensureFileExists(filePath);
    return filePath;
  }

  /**
   * Builds the log file path based on pod information
   *
   * Creates a filename in the format `<namespace>_<podName>` and joins it
   * with the configured log directory.
   *
   * @returns The absolute path for the pod's log file
   */
  private buildLogFilePath(): string {
    const filename = `${this.podInfo.namespace}_${this.podInfo.podName}.log`;
    return this.path.join(this.configService.get("LOG_DIR"), filename);
  }

  /**
   * Ensures the log file exists, creating it and its directory if necessary
   *
   * This method:
   * 1. Checks if the log file exists
   * 2. If not, checks if the log directory exists
   * 3. Creates the directory if it doesn't exist
   * 4. Creates an empty log file
   * 5. Logs the creation events
   *
   * @param filePath - The absolute path of the log file to ensure exists
   * @throws Error if directory or file creation fails
   */
  private async ensureFileExists(filePath: string): Promise<void> {
    try {
      await this.fs.promises.access(filePath);
    } catch (error) {
      const logDir = this.configService.get("LOG_DIR");

      try {
        await this.fs.promises.access(logDir);
      } catch (dirError) {
        await this.fs.promises.mkdir(logDir, { recursive: true });
        this.loggerService.info({
          message: "Created log directory",
          path: logDir
        });
      }

      await this.fs.promises.writeFile(filePath, "");
      this.loggerService.info({
        message: "Created log file",
        filePath,
        namespace: this.podInfo.namespace,
        podName: this.podInfo.podName
      });
    }
  }

  /**
   * Creates a stable write stream that handles rotation internally
   *
   * This method creates a PassThrough stream that acts as a stable interface
   * for the client. It internally manages file rotation by monitoring the
   * underlying file size and creating new write streams when rotation is needed.
   * If rotation fails, it emits an 'error' event on the stable stream.
   *
   * @param filePath - The absolute path of the file to create a write stream for
   * @param stableStream - The PassThrough stream to configure for log processing
   * @returns A stable write stream that handles rotation internally
   */
  private createStableWriteStream(filePath: string, stableStream: PassThrough): void {
    const maxFileSize = this.configService.get("LOG_MAX_FILE_SIZE_BYTES");
    let currentWriteStream: NodeJS.WritableStream | undefined;
    let isEnded = false;

    try {
      currentWriteStream = this.fs.createWriteStream(filePath, {
        flags: "a",
        autoClose: false
      });

      stableStream.pipe(currentWriteStream);

      const checkFileSizePeriodically = async (): Promise<void> => {
        while (!isEnded) {
          try {
            await delay(1000);

            if (isEnded) break;

            const stats = await this.fs.promises.stat(filePath);
            if (stats.size >= maxFileSize) {
              try {
                stableStream.unpipe(currentWriteStream!);
                currentWriteStream!.end();

                await new Promise<void>(resolve => {
                  currentWriteStream!.on("finish", resolve);
                });

                await this.rotateLogFile(filePath);

                currentWriteStream = this.fs.createWriteStream(filePath, {
                  flags: "a",
                  autoClose: false
                });

                stableStream.pipe(currentWriteStream);

                this.loggerService.info({
                  message: "Log file rotated successfully",
                  filePath
                });
              } catch (error) {
                this.loggerService.error({
                  error,
                  message: "Failed to rotate log file",
                  filePath
                });
                stableStream.emit("error", error);
                break;
              }
            }
          } catch (error) {
            this.loggerService.error({
              error,
              message: "Failed to check file size for rotation",
              filePath
            });
          }
        }
      };

      checkFileSizePeriodically().catch(error => {
        this.loggerService.error({
          error,
          message: "File size checking loop failed",
          filePath
        });
        stableStream.emit("error", error);
      });
    } catch (error) {
      stableStream.emit("error", error);
    }

    const cleanup = () => {
      isEnded = true;
      if (currentWriteStream) {
        currentWriteStream.end();
        currentWriteStream = undefined;
      }
    };

    stableStream.on("end", cleanup);
    stableStream.on("error", cleanup);
  }

  /**
   * Reads and returns the last non-empty line from a file
   *
   * Reads the entire file content, splits it into lines, filters out empty
   * lines, and returns the last non-empty line or null if no content exists.
   *
   * @param filePath - The absolute path of the file to read
   * @returns Promise that resolves to the last non-empty line or null
   * @throws Error if file reading fails
   */
  private async readLastLineFromFile(filePath: string): Promise<string | null> {
    const fileContent = await this.fs.promises.readFile(filePath, "utf8");
    const nonEmptyLines = fileContent.split("\n").filter(line => line.trim());

    return nonEmptyLines.length > 0 ? nonEmptyLines[nonEmptyLines.length - 1] : null;
  }

  /**
   * Rotates a log file by shifting existing rotated files and removing the oldest
   *
   * This method:
   * 1. Shifts all existing rotated files (e.g., file.1 → file.2, file.2 → file.3)
   * 2. Renames the current file to file.1
   * 3. Removes the oldest rotated file if it exists
   * 4. Logs the rotation event
   *
   * @param filePath - The path of the log file to rotate
   * @throws Error if file system operations fail (except for missing files)
   */
  private async rotateLogFile(filePath: string): Promise<void> {
    try {
      await this.shiftRotatedFiles(filePath);
      await this.removeOldestRotatedFile(filePath);
      this.loggerService.info({
        message: "Log file rotated",
        filePath
      });
    } catch (error) {
      this.loggerService.error({
        error,
        message: "Failed to rotate log file",
        filePath
      });
    }
  }

  /**
   * Shifts existing rotated files to make room for a new rotation
   *
   * Iterates backwards through existing rotated files and renames them
   * to the next number (e.g., file.4 → file.5, file.3 → file.4, etc.).
   * The current file becomes file.1.
   *
   * Missing files are ignored (ENOENT errors are caught and ignored).
   *
   * @param filePath - The base path of the log file
   * @throws Error if file system operations fail (except for missing files)
   */
  private async shiftRotatedFiles(filePath: string): Promise<void> {
    for (let i = this.configService.get("LOG_MAX_ROTATED_FILES") - 1; i >= 0; i--) {
      const oldPath = i === 0 ? filePath : `${filePath}.${i}`;
      const newPath = `${filePath}.${i + 1}`;

      try {
        await this.fs.promises.rename(oldPath, newPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }
  }

  /**
   * Removes the oldest rotated file to maintain the rotation limit
   *
   * Attempts to delete the file that would exceed the maximum number
   * of rotated files (e.g., file.6 if MAX_ROTATED_FILES is 5).
   * Missing files are ignored (ENOENT errors are caught and ignored).
   *
   * @param filePath - The base path of the log file
   * @throws Error if file system operations fail (except for missing files)
   */
  private async removeOldestRotatedFile(filePath: string): Promise<void> {
    const oldestFile = `${filePath}.${this.configService.get("LOG_MAX_ROTATED_FILES") + 1}`;

    try {
      await this.fs.promises.unlink(oldestFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
