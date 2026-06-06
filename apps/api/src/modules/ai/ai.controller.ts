import { Body, Controller, Post, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { RagService } from '../rag/rag.service';
import { ChatDto } from './dto/chat.dto';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(
    private aiService: AiService,
    private ragService: RagService,
  ) {}

  @Get('recommendations')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  getRecommendations(@CurrentUser() user: AuthUser) {
    return this.aiService.getRecommendations(user.id);
  }

  @Post('chat')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async chat(@CurrentUser() user: AuthUser, @Body() dto: ChatDto) {
    const chunks = await this.ragService.search(user.id, dto.question);
    const answer = await this.aiService.chat(user.id, dto.question, chunks, dto.history ?? []);
    return { answer, sourcesUsed: chunks.length };
  }
}
