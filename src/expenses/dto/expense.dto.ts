import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaymentMethod } from '../../generated/prisma/client';

const clean = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export class CreateExpenseDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @IsUUID()
  categoryId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999.99)
  amount!: number;

  @IsDateString()
  expenseDate!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(180)
  vendor?: string;

  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Transform(clean)
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  receiptUrl?: string;

  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class UpdateExpenseDto {
  @IsOptional()
  @Transform(clean)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999_999_999.99)
  amount?: number;

  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(180)
  vendor?: string;

  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Transform(clean)
  @IsUrl({ require_protocol: true })
  receiptUrl?: string;

  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class ExpenseQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
