import { IsString, MinLength, MaxLength, IsArray, IsOptional, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatHistoryTurn {
  @IsIn(['user', 'model'])
  role!: 'user' | 'model';

  @IsString()
  parts!: string;
}

export class ChatDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;

  /** Conversation history from previous turns. Empty array = first message. */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryTurn)
  history?: ChatHistoryTurn[];
}
