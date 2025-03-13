import { Module } from '@nestjs/common';

import { BrokerModule } from '@src/broker/broker.module';
import { RegistryProvider } from '@src/chain-events/providers/registry.provider';
import { CosmjsDecodingService } from '@src/chain-events/services/cosmjs-decoding/cosmjs-decoding.service';
import { CommonModule } from '@src/common/common.module';
import { configService, ConfigServiceProvider } from './config/env.config';
import { StargateClientProvider } from './providers/stargate-client/stargate-client.provider';
import { BlockMessageService } from './services/block-message/block-message.service';
import { BlockMessageParserService } from './services/block-message-parser/block-message-parser.service';
import { BlockchainClientService } from './services/blockchain-client/blockchain-client.service';
import { ChainEventsService } from './services/chain-events/chain-events.service';
import { MessageDecoderService } from './services/message-decoder/message-decoder.service';

@Module({
  imports: [
    CommonModule,
    BrokerModule.forRoot({
      appName: 'chain-events',
      postgresUri: configService.getOrThrow('EVENT_BROKER_POSTGRES_URI'),
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
    ConfigServiceProvider,
  ],
  exports: [BlockMessageService, MessageDecoderService],
})
export class ChainEventsModule {}
