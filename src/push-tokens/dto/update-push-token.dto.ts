import { PartialType } from '@nestjs/swagger';
import { CreatePushTokenDto } from './create-push-token.dto';

export class UpdatePushTokenDto extends PartialType(CreatePushTokenDto) {}
