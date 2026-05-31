import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class SignupDto {
  // @IsEmail() validates RFC 5322 format; @Matches enforces a real TLD (2+ chars)
  @IsEmail({}, { message: 'Enter a valid email address (e.g. you@gmail.com)' })
  @Matches(/\.[a-zA-Z]{2,}$/, { message: 'Enter a valid email address (e.g. you@gmail.com)' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;
}
