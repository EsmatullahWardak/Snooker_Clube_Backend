import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { GameStatus, PaymentMethod } from '../../generated/prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class StartGameDto {
  @IsUUID()
  tableId!: string;

  @IsUUID()
  memberId!: string;
}

export class EndGameDto {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class GameQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus;

  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @Type(() => Number)
  tableNumber?: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
