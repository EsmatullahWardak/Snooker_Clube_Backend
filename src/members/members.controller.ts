import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  CreateMemberDto,
  MemberQueryDto,
  UpdateMemberDto,
} from './dto/member.dto';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@Query() query: MemberQueryDto) {
    return this.members.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.members.get(id);
  }

  @Post()
  create(@Body() dto: CreateMemberDto, @CurrentUser() user: AuthenticatedUser) {
    return this.members.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.members.update(id, dto, user.id);
  }
}
