import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

const DUMMY_PASSWORD_HASH =
  '$2b$12$ahwxn5heQkp1REMjrLxGWehEL6qhatjCTTWQ7txodi9zDAk5Bf.wW';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, status: 'ACTIVE', deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches)
      throw new UnauthorizedException('Invalid email or password.');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'AUTH_LOGIN',
      resourceType: 'User',
      resourceId: user.id,
    });

    const expiresIn = this.parseExpiry(
      this.config.get<string>('JWT_EXPIRES_IN', '8h'),
    );
    const token = await this.jwt.signAsync({ sub: user.id }, { expiresIn });
    return { token, user: this.toAuthenticatedUser(user) };
  }

  async findAuthenticatedUser(
    userId: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    return user ? this.toAuthenticatedUser(user) : null;
  }

  async recordLogout(userId: string) {
    await this.audit.record({
      actorId: userId,
      action: 'AUTH_LOGOUT',
      resourceType: 'User',
      resourceId: userId,
    });
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: {
      name: AuthenticatedUser['role'];
      permissions: { permission: { code: string } }[];
    };
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      permissions: user.role.permissions.map(
        ({ permission }) => permission.code,
      ),
    };
  }

  private parseExpiry(value: string): number {
    const match = /^(\d+)(s|m|h)$/.exec(value);
    if (!match)
      throw new Error(
        'JWT_EXPIRES_IN must use seconds (s), minutes (m), or hours (h).',
      );
    const amount = Number(match[1]);
    return amount * ({ s: 1, m: 60, h: 3600 }[match[2]] ?? 1);
  }
}
