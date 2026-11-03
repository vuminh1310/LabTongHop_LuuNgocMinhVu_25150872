import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { BooksModule } from './books/books.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'mysql',
        host: cfg.get('DB_HOST', 'localhost'),
        port: parseInt(cfg.get('DB_PORT', '3306'), 10),
        username: cfg.get('DB_USERNAME', 'root'),
        password: cfg.get('DB_PASSWORD', ''),
        database: cfg.get('DB_NAME', 'bookstore'),
        autoLoadEntities: true,
        // Tu dong tao/cap nhat bang. Chi dung khi hoc/phat trien.
        synchronize: true,
      }),
    }),
    UsersModule,
    AuthModule,
    CategoriesModule,
    BooksModule,
    OrdersModule,
  ],
})
export class AppModule {}
