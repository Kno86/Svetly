import { Controller, Get, Header } from '@nestjs/common';
import { getVersionInfo, type VersionInfo } from './version.js';

@Controller('version')
export class VersionController {
  private readonly info = getVersionInfo();

  @Get()
  @Header('Cache-Control', 'no-store')
  get(): VersionInfo {
    return this.info;
  }
}
