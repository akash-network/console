import {
  MsgCloseDeployment,
  MsgCreateDeployment,
} from '@akashnetwork/akash-api/akash/deployment/v1beta3';
import type { DecodedTxRaw } from '@cosmjs/proto-signing';
import { faker } from '@faker-js/faker';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { LoggerService } from '@src/common/services/logger.service';
import { CosmjsDecodingService } from '../cosmjs-decoding/cosmjs-decoding.service';
import { MessageDecoderService } from '../message-decoder/message-decoder.service';
import { BlockMessageParserService } from './block-message-parser.service';

import { MockProvider } from '@test/mocks/provider.mock';
import { generateDeploymentID, generateSimpleMockBlock } from '@test/seeders';

describe(BlockMessageParserService.name, () => {
  it('should be defined', async () => {
    const { service } = await setup();

    expect(service).toBeDefined();
  });

  describe('parseBlockMessages', () => {
    it('should parse a block with no transactions', async () => {
      const { service, loggerService } = await setup();

      const height = faker.number.int({ min: 1, max: 1000000 });
      const mockBlock = { ...generateSimpleMockBlock({ height }), txs: [] };

      const result = service.parseBlockMessages(mockBlock);

      expect(result).toMatchObject({
        height: height,
        hash: mockBlock.id,
        messages: [],
      });
      expect(loggerService.debug).toHaveBeenCalledWith({
        event: 'NO_TRANSACTIONS_IN_BLOCK',
        height,
      });
    });

    it('should parse a block with transactions', async () => {
      const { service, messageDecoder, loggerService } = await setup();

      const height = faker.number.int({ min: 1, max: 1000000 });
      const mockBlock = generateSimpleMockBlock({ height, txCount: 1 });

      const deploymentId = generateDeploymentID();
      const createDeploymentValue = { id: deploymentId };
      const closeDeploymentValue = { id: deploymentId };

      messageDecoder.decodeMsg.mockImplementation((typeUrl: string) => {
        if (typeUrl.includes('MsgCreateDeployment')) {
          return createDeploymentValue;
        } else if (typeUrl.includes('MsgCloseDeployment')) {
          return closeDeploymentValue;
        }
        return null;
      });

      const result = service.parseBlockMessages(mockBlock);

      expect(result).toMatchObject({
        height,
        hash: mockBlock.id,
        messages: [
          {
            typeUrl: '/akash.deployment.v1beta3.MsgCreateDeployment',
            value: createDeploymentValue,
          },
          {
            typeUrl: '/akash.deployment.v1beta3.MsgCloseDeployment',
            value: closeDeploymentValue,
          },
        ],
      });

      expect(loggerService.debug).toHaveBeenCalledWith({
        event: 'PARSING_TRANSACTIONS_FROM_BLOCK',
        height,
        txCount: 1,
      });
    });

    it('should filter messages by type', async () => {
      const { service, messageDecoder } = await setup();

      const height = faker.number.int({ min: 1, max: 1000000 });
      const mockBlock = generateSimpleMockBlock({ height, txCount: 1 });
      const messageType = MsgCreateDeployment.$type;

      const deploymentId = generateDeploymentID();
      const createDeploymentValue = { id: deploymentId };
      const closeDeploymentValue = { id: deploymentId };

      messageDecoder.decodeMsg.mockImplementation((typeUrl: string) => {
        if (typeUrl.includes('MsgCreateDeployment')) {
          return createDeploymentValue;
        } else if (typeUrl.includes('MsgCloseDeployment')) {
          return closeDeploymentValue;
        }
        return null;
      });

      const result = service.parseBlockMessages(mockBlock, [messageType]);

      expect(result).toMatchObject({
        height,
        hash: mockBlock.id,
        messages: [
          {
            typeUrl: '/akash.deployment.v1beta3.MsgCreateDeployment',
            value: createDeploymentValue,
          },
        ],
      });
    });

    it('should handle multiple message types in filter', async () => {
      const { service, messageDecoder } = await setup();

      const height = faker.number.int({ min: 1, max: 1000000 });
      const mockBlock = generateSimpleMockBlock({ height, txCount: 1 });
      const messageTypes = [
        MsgCreateDeployment.$type,
        MsgCloseDeployment.$type,
      ];

      const deploymentId = generateDeploymentID();
      const createDeploymentValue = { id: deploymentId };
      const closeDeploymentValue = { id: deploymentId };

      messageDecoder.decodeMsg.mockImplementation((typeUrl: string) => {
        if (typeUrl.includes('MsgCreateDeployment')) {
          return createDeploymentValue;
        } else if (typeUrl.includes('MsgCloseDeployment')) {
          return closeDeploymentValue;
        }
        return null;
      });

      const result = service.parseBlockMessages(mockBlock, messageTypes);

      expect(result).toMatchObject({
        height,
        hash: mockBlock.id,
        messages: [
          {
            typeUrl: '/akash.deployment.v1beta3.MsgCreateDeployment',
            value: createDeploymentValue,
          },
          {
            typeUrl: '/akash.deployment.v1beta3.MsgCloseDeployment',
            value: closeDeploymentValue,
          },
        ],
      });
    });

    it('should handle errors when parsing transactions', async () => {
      const { service, cosmjsDecodingService, loggerService } = await setup();

      const height = faker.number.int({ min: 1, max: 1000000 });
      const mockBlock = generateSimpleMockBlock({ height, txCount: 1 });

      cosmjsDecodingService.decodeTxRaw.mockImplementation(() => {
        throw new Error('Failed to decode transaction');
      });

      const result = service.parseBlockMessages(mockBlock);

      expect(result).toMatchObject({
        height: height,
        hash: mockBlock.id,
        messages: [],
      });
      expect(loggerService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ERROR_PARSING_TRANSACTION',
          height,
          error: 'Failed to decode transaction',
        }),
      );
    });

    it('should handle errors in message extraction', async () => {
      const { service, messageDecoder, loggerService } = await setup();

      const height = faker.number.int({ min: 1, max: 1000000 });
      const mockBlock = generateSimpleMockBlock({ height, txCount: 1 });

      messageDecoder.decodeMsg.mockImplementation(() => {
        return null;
      });

      const result = service.parseBlockMessages(mockBlock);

      expect(result).toMatchObject({
        height: height,
        hash: mockBlock.id,
        messages: [],
      });
      expect(loggerService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'ERROR_EXTRACTING_MESSAGE',
          error: 'Failed to decode message value',
        }),
      );
    });

    it('should correctly match message types', async () => {
      const { service, messageDecoder, cosmjsDecodingService } = await setup();

      const height = faker.number.int({ min: 1, max: 1000000 });
      const mockBlock = generateSimpleMockBlock({ height, txCount: 1 });

      cosmjsDecodingService.decodeTxRaw.mockImplementationOnce(
        () =>
          ({
            body: {
              messages: [
                {
                  typeUrl: 'akash.deployment.v1beta3.MsgCreateDeployment', // without leading slash
                  value: new Uint8Array([1, 2, 3]),
                },
              ],
              memo: 'test memo',
            },
          }) as DecodedTxRaw,
      );

      messageDecoder.decodeMsg.mockReturnValue({
        id: generateDeploymentID(),
      });

      const result = service.parseBlockMessages(mockBlock, [
        MsgCreateDeployment.$type,
      ]);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].typeUrl).toBe(
        'akash.deployment.v1beta3.MsgCreateDeployment',
      );
    });
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: BlockMessageParserService;
    messageDecoder: MockProxy<MessageDecoderService>;
    cosmjsDecodingService: MockProxy<CosmjsDecodingService>;
    loggerService: MockProxy<LoggerService>;
  }> {
    const module = await Test.createTestingModule({
      providers: [
        BlockMessageParserService,
        MockProvider(MessageDecoderService),
        MockProvider(CosmjsDecodingService),
        MockProvider(LoggerService),
      ],
    }).compile();

    const cosmjsDecodingService = module.get<MockProxy<CosmjsDecodingService>>(
      CosmjsDecodingService,
    );
    setupCosmjsDecodingService(cosmjsDecodingService);

    return {
      module,
      service: module.get<BlockMessageParserService>(BlockMessageParserService),
      messageDecoder: module.get<MockProxy<MessageDecoderService>>(
        MessageDecoderService,
      ),
      cosmjsDecodingService,
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
    };
  }

  function setupCosmjsDecodingService(
    cosmjsDecodingService: MockProxy<CosmjsDecodingService>,
  ) {
    cosmjsDecodingService.decodeTxRaw.mockImplementation(
      () =>
        ({
          body: {
            messages: [
              {
                typeUrl: '/akash.deployment.v1beta3.MsgCreateDeployment',
                value: new Uint8Array([1, 2, 3]),
              },
              {
                typeUrl: '/akash.deployment.v1beta3.MsgCloseDeployment',
                value: new Uint8Array([4, 5, 6]),
              },
            ],
            memo: 'test memo',
          },
        }) as DecodedTxRaw,
    );
    cosmjsDecodingService.sha256.mockReturnValue(new Uint8Array([1, 2, 3, 4]));
    cosmjsDecodingService.toHex.mockReturnValue('ABCDEF1234567890');
  }
});
