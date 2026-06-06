import { IsString, MaxLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @MaxLength(1024)
  refreshToken!: string;
}
