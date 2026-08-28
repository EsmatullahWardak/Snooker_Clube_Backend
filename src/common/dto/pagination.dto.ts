import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export const paginationMeta = (
  page: number,
  pageSize: number,
  total: number,
) => ({
  page,
  pageSize,
  total,
  pageCount: Math.ceil(total / pageSize),
});
