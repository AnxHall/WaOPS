import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { loadConfig } from '@waops/config';
import { TokenService } from './jwt.service.js';

const cfg = loadConfig();

@Module({
  imports: [
    JwtModule.register({
      secret: cfg.env.JWT_SECRET,
      signOptions: { expiresIn: cfg.env.JWT_ACCESS_TTL_SECONDS },
    }),
  ],
  providers: [TokenService],
  exports: [TokenService, JwtModule],
})
export class AuthModule {}
