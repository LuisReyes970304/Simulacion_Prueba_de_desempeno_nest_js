import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { SolicitudesModule } from './solicitudes/solicitudes.module.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    SolicitudesModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration]
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        autoLoadEntities: true, 
        synchronize: true, 
      }),
    }),
    AuthModule,
  ],
})
export class AppModule {}
