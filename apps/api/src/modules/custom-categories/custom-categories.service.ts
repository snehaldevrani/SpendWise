import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomCategoryDto } from './dto/create-custom-category.dto';
import { UpdateCustomCategoryDto } from './dto/update-custom-category.dto';

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '_');
}

@Injectable()
export class CustomCategoriesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.customCategory.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  async create(userId: string, dto: CreateCustomCategoryDto) {
    const slug = toSlug(dto.name);

    const existing = await this.prisma.customCategory.findFirst({ where: { userId, slug } });
    if (existing) throw new ConflictException(`Category "${dto.name}" already exists`);

    const category = await this.prisma.customCategory.create({
      data: {
        userId,
        name: dto.name.trim(),
        slug,
        merchants: dto.merchants,
        emoji: dto.emoji,
        color: dto.color,
      },
    });

    if (dto.merchants.length > 0) {
      await this.prisma.transaction.updateMany({
        where: { userId, merchant: { in: dto.merchants } },
        data: { category: slug },
      });
    }

    return category;
  }

  async update(userId: string, id: string, dto: UpdateCustomCategoryDto) {
    const existing = await this.prisma.customCategory.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Category not found');

    const newSlug = dto.name ? toSlug(dto.name) : existing.slug;

    // Reset all transactions previously assigned to this category
    await this.prisma.transaction.updateMany({
      where: { userId, category: existing.slug },
      data: { category: 'other' },
    });

    const updated = await this.prisma.customCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim(), slug: newSlug } : {}),
        ...(dto.merchants !== undefined ? { merchants: dto.merchants } : {}),
        ...(dto.emoji !== undefined ? { emoji: dto.emoji } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });

    // Re-apply with updated merchant list
    const merchants = dto.merchants ?? existing.merchants;
    if (merchants.length > 0) {
      await this.prisma.transaction.updateMany({
        where: { userId, merchant: { in: merchants } },
        data: { category: newSlug },
      });
    }

    return updated;
  }

  async delete(userId: string, id: string) {
    const existing = await this.prisma.customCategory.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Category not found');

    await this.prisma.transaction.updateMany({
      where: { userId, category: existing.slug },
      data: { category: 'other' },
    });

    await this.prisma.customCategory.delete({ where: { id } });
    return { deleted: true };
  }

  // Called after a new statement upload to classify transactions using existing rules
  async applyRules(userId: string) {
    const categories = await this.prisma.customCategory.findMany({ where: { userId } });
    for (const cat of categories) {
      if (cat.merchants.length > 0) {
        await this.prisma.transaction.updateMany({
          where: { userId, merchant: { in: cat.merchants } },
          data: { category: cat.slug },
        });
      }
    }
  }
}
