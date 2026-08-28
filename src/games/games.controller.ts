import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { RoleName } from '../generated/prisma/client';
import { EndGameDto, GameQueryDto, StartGameDto } from './dto/game.dto';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  list(@Query() query: GameQueryDto) {
    return this.games.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.games.get(id);
  }

  @Post()
  start(@Body() dto: StartGameDto, @CurrentUser() user: AuthenticatedUser) {
    return this.games.start(dto, user.id);
  }

  @Post(':id/end')
  end(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndGameDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.games.end(id, dto, user.id);
  }

  @Roles(RoleName.ADMIN, RoleName.MANAGER)
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.games.cancel(id, user.id);
  }
}
