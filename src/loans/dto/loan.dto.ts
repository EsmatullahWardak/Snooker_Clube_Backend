import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { LoanStatus } from '../../generated/prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const optionalTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === ''
    ? undefined
    : trim({ value });

export class CreateLoanDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  playerName!: string;

  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @MaxLength(150)
  fatherName?: string;

  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim()
      ? value.trim().toLowerCase()
      : undefined,
  )
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @MaxLength(500)
  address?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999.99)
  amount!: number;
}

export class UpdateLoanStatusDto {
  @IsEnum(LoanStatus)
  status!: LoanStatus;
}

export class LoanQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;
}
