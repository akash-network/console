import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { BrokerModule } from '@src/broker/broker.module';
import { RegistryProvider } from '@src/chain-events/providers/registry.provider';
import { CosmjsDecodingService } from '@src/chain-events/services/cosmjs-decoding/cosmjs-decoding.service';
import { CommonModule } from '@src/common/common.module';
import envConfig from './config/env.config';
import { StargateClientProvider } from './providers/stargate-client/stargate-client.provider';
import { BlockMessageService } from './services/block-message/block-message.service';
import { BlockMessageParserService } from './services/block-message-parser/block-message-parser.service';
import { BlockchainClientService } from './services/blockchain-client/blockchain-client.service';
import { ChainEventsService } from './services/chain-events/chain-events.service';
import { MessageDecoderService } from './services/message-decoder/message-decoder.service';

@Module({
  imports: [
    CommonModule,
    ConfigModule.forFeature(envConfig),
    BrokerModule.registerAsync({
      useFactory: async (configService: ConfigService) => ({
        appName: 'chain-events',
        postgresUri: configService.getOrThrow('EVENT_BROKER_POSTGRES_URI'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    ChainEventsService,
    BlockMessageService,
    BlockMessageParserService,
    BlockchainClientService,
    MessageDecoderService,
    StargateClientProvider,
    CosmjsDecodingService,
    RegistryProvider,
  ],
  exports: [BlockMessageService, MessageDecoderService],
})
export class ChainEventsModule {}
