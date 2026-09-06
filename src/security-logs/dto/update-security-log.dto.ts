import { PartialType } from '@nestjs/swagger';
import { CreateSecurityLogDto } from './create-security-log.dto';

export class UpdateSecurityLogDto extends PartialType(CreateSecurityLogDto) {}
