import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  weeklyEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  newSubAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  spikeAlert?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;
}
