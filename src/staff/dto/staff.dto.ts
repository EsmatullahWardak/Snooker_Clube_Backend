import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RoleName, UserStatus } from '../../generated/prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateStaffDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message:
      'password must contain uppercase, lowercase, number, and special characters',
  })
  password!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsEnum(RoleName)
  role!: RoleName;
}

export class UpdateStaffDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/)
  password?: string;
}

export class StaffQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
