import { MsgCreateDeployment } from '@akashnetwork/akash-api/v1beta3';
import { faker } from '@faker-js/faker';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import Long from 'long';

import { RegistryProvider } from '@src/chain-events/providers/registry.provider';
import { MessageDecoderService } from './message-decoder.service';

import { mockAkashAddress } from '@test/seeders/akash-address.seeder';

describe(MessageDecoderService.name, () => {
  it('should be defined', async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  describe('decodeMsg', () => {
    it('should decode a message', async () => {
      const { service } = await setup();

      const owner = mockAkashAddress();
      const dseq = faker.number.int();
      const encoded = MsgCreateDeployment.encode(
        MsgCreateDeployment.fromPartial({
          id: {
            owner,
            dseq,
          },
        }),
      ).finish();
      const result = service.decodeMsg(
        `/${MsgCreateDeployment.$type}`,
        encoded,
      );

      expect(result).toMatchObject({
        $type: MsgCreateDeployment.$type,
        id: {
          dseq: expect.any(Long),
          owner,
        },
      });
    });

    it('should throw an error if the message type is not found', async () => {
      const { service } = await setup();

      const encoded = new Uint8Array([1, 2, 3, 4]);
      const invalidType = faker.string.alphanumeric(10);

      expect(() => service.decodeMsg(invalidType, encoded)).toThrow(
        'Type not found: ' + invalidType,
      );
    });
  });

  describe('uint8arrayToString', () => {
    it('should convert Uint8Array to string', async () => {
      const { service } = await setup();

      const testString = faker.lorem.sentence();
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(testString);

      const result = service.uint8arrayToString(uint8Array);

      expect(result).toBe(testString);
    });

    it('should handle empty Uint8Array', async () => {
      const { service } = await setup();

      const uint8Array = new Uint8Array([]);
      const result = service.uint8arrayToString(uint8Array);

      expect(result).toBe('');
    });

    it('should handle JSON data', async () => {
      const { service } = await setup();

      const jsonData = {
        key: faker.lorem.word(),
        value: faker.lorem.sentence(),
        number: faker.number.int(),
        special: '!@#$%^&*()',
      };
      const jsonString = JSON.stringify(jsonData);
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonString);

      const result = service.uint8arrayToString(uint8Array);

      expect(result).toBe(jsonString);
      expect(JSON.parse(result)).toEqual(jsonData);
    });
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: MessageDecoderService;
  }> {
    const module = await Test.createTestingModule({
      providers: [MessageDecoderService, RegistryProvider],
    }).compile();

    return {
      module,
      service: module.get<MessageDecoderService>(MessageDecoderService),
    };
  }
});
