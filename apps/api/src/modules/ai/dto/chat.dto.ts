import { IsString, MinLength, MaxLength, IsArray, IsOptional, ValidateNested, IsIn, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatHistoryTurn {
  @IsIn(['user', 'model'])
  role!: 'user' | 'model';

  @IsString()
  @MaxLength(2000)
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
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryTurn)
  history?: ChatHistoryTurn[];
}
