import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async getPreferences(userId: string) {
    const prefs = await this.prisma.userPreferences.findUnique({ where: { userId } });
    if (!prefs) {
      // Return defaults — row is created lazily on first update
      return { weeklyEmail: true, newSubAlert: true, spikeAlert: false, timezone: 'Asia/Kolkata' };
    }
    return {
      weeklyEmail: prefs.weeklyEmail,
      newSubAlert: prefs.newSubAlert,
      spikeAlert: prefs.spikeAlert,
      timezone: prefs.timezone,
    };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const prefs = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        weeklyEmail: dto.weeklyEmail ?? true,
        newSubAlert: dto.newSubAlert ?? true,
        spikeAlert: dto.spikeAlert ?? false,
        timezone: dto.timezone ?? 'Asia/Kolkata',
      },
      update: {
        ...(dto.weeklyEmail !== undefined && { weeklyEmail: dto.weeklyEmail }),
        ...(dto.newSubAlert !== undefined && { newSubAlert: dto.newSubAlert }),
        ...(dto.spikeAlert !== undefined && { spikeAlert: dto.spikeAlert }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      },
    });
    return {
      weeklyEmail: prefs.weeklyEmail,
      newSubAlert: prefs.newSubAlert,
      spikeAlert: prefs.spikeAlert,
      timezone: prefs.timezone,
    };
  }
}
