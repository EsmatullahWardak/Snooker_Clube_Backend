import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaymentMethod, PaymentStatus } from '../../generated/prisma/client';

export class PaymentQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsUUID()
  memberId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
