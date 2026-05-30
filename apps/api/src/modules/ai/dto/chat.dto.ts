import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChatDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;
}
