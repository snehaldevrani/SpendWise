import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCustomCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  merchants?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10)
  emoji?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}
