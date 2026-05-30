import { Body, Controller, Post, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  getRecommendations(@CurrentUser() user: AuthUser) {
    return this.aiService.getRecommendations(user.id);
  }

  @Post('chat')
  async chat(@CurrentUser() user: AuthUser, @Body() dto: ChatDto) {
    const chunks = await this.ragService.search(user.id, dto.question);
    const answer = await this.aiService.chat(user.id, dto.question, chunks);
    return { answer, sourcesUsed: chunks.length };
  }
}
