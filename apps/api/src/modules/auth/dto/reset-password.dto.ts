import { IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MaxLength(512)
  token!: string;

  @IsString()
  @MaxLength(36)
  recordId!: string;

  @IsString()
  @MaxLength(128)
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword!: string;
}
