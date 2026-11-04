import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { describe, expect, it, onTestFinished } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";
import { AddressConfirmationService } from "@src/modules/notifications/services/address-confirmation/address-confirmation.service";
import { InternalAddressConfirmationController } from "./internal-address-confirmation.controller";

import { MockProvider } from "@test/mocks/provider.mock";

describe(InternalAddressConfirmationController.name, () => {
  it("confirms the address of the link's token", async () => {
    const { app, addressConfirmationService } = await setup({ confirms: true });

    const res = await request(app.getHttpServer()).post("/internal/v1/address-confirmations").send({ token: "link-token" });

    expect(res.status).toBe(204);
    expect(addressConfirmationService.confirm).toHaveBeenCalledWith("link-token");
  });

  it("answers 400 for a token that confirms nothing", async () => {
    const { app } = await setup({ confirms: false });

    const res = await request(app.getHttpServer()).post("/internal/v1/address-confirmations").send({ token: "used-token" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ message: "The confirmation link is invalid or was already used", code: "INVALID_CONFIRMATION_LINK" });
  });

  it("answers 400 without confirming anything for a request without a token", async () => {
    const { app, addressConfirmationService } = await setup({ confirms: true });

    const res = await request(app.getHttpServer()).post("/internal/v1/address-confirmations").send({ token: "" });

    expect(res.status).toBe(400);
    expect(addressConfirmationService.confirm).not.toHaveBeenCalled();
  });

  async function setup(input: { confirms: boolean }) {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalAddressConfirmationController],
      providers: [MockProvider(AddressConfirmationService), MockProvider(LoggerService)]
    }).compile();

    const addressConfirmationService = module.get<MockProxy<AddressConfirmationService>>(AddressConfirmationService);
    addressConfirmationService.confirm.mockResolvedValue(input.confirms);

    const app = module.createNestApplication();
    app.useGlobalInterceptors(new HttpResultInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter(module.get(LoggerService)));
    await app.init();
    onTestFinished(() => app.close());

    return { app, addressConfirmationService };
  }
});
