import type { Logger as LoggerBase } from "@akashnetwork/logging";
import type { INestApplication, Type } from "@nestjs/common";
import type { NestFactory } from "@nestjs/core";
import { mock } from "jest-mock-extended";

import type { ShutdownService } from "@src/common/services/shutdown/shutdown.service";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import { bootstrapHttp } from "./bootstrap";

describe("bootstrapHttp", () => {
  it("should bootstrap http server with all hooks and logger", async () => {
    const mockApp = mock<INestApplication>();
    const mockLogger = mock<LoggerBase>();
    const mockShutdown = mock<ShutdownService>();
    const mockFactory = mock<typeof NestFactory>();
    const moduleMock = class AppModule {} as Type<any>;

    mockApp.get.mockReturnValue(mockShutdown);
    mockFactory.create.mockResolvedValue(mockApp);

    process.env.PORT = "4321";

    await bootstrapHttp(moduleMock, {
      logger: mockLogger,
      nestFactory: mockFactory
    });

    expect(mockFactory.create).toHaveBeenCalledWith(moduleMock, {
      logger: mockLogger
    });

    expect(mockApp.enableShutdownHooks).toHaveBeenCalled();
    expect(mockApp.get).toHaveBeenCalledWith(expect.any(Function));
    expect(mockShutdown.onShutdown).toHaveBeenCalledWith(expect.any(Function));
    expect(mockApp.enableVersioning).toHaveBeenCalled();
    expect(mockApp.useGlobalInterceptors).toHaveBeenCalledWith(expect.any(HttpResultInterceptor));
    expect(mockApp.useGlobalFilters).toHaveBeenCalledWith(expect.any(HttpExceptionFilter));

    expect(mockApp.listen).toHaveBeenCalledWith("4321");
    expect(mockLogger.log).toHaveBeenCalledWith("Server started on port 4321");
  });

  it("should fallback to port 3000 if PORT is not set", async () => {
    const port = process.env.PORT;
    delete process.env.PORT;

    const mockApp = mock<INestApplication>();
    const mockLogger = mock<LoggerBase>();
    const mockShutdown = mock<ShutdownService>();
    const mockFactory = mock<typeof NestFactory>();
    const moduleMock = class AppModule {} as Type<any>;

    mockApp.get.mockReturnValue(mockShutdown);
    mockFactory.create.mockResolvedValue(mockApp);

    await bootstrapHttp(moduleMock, {
      logger: mockLogger,
      nestFactory: mockFactory
    });

    expect(mockApp.listen).toHaveBeenCalledWith(3000);
    expect(mockLogger.log).toHaveBeenCalledWith("Server started on port 3000");

    process.env.PORT = port;
  });
});
