import { IsEnum } from 'class-validator';
import { TableStatus } from '../../generated/prisma/client';

export class UpdateTableStatusDto {
  @IsEnum(TableStatus)
  status!: TableStatus;
}
