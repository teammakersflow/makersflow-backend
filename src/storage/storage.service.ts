import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const REQUIRED_VARS = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET',
] as const;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;

  constructor(private readonly configService: ConfigService) {
    const missing = this.missingVars();

    if (missing.length) {
      this.logger.warn(
        `File storage disabled — missing ${missing.join(', ')}. ` +
          'Upload endpoints will return 503; the rest of the API is unaffected.',
      );
    }
  }

  private missingVars(): string[] {
    return REQUIRED_VARS.filter(
      (name) => !this.configService.get<string>(name),
    );
  }

  /**
   * Built on first use, not in the constructor. The S3 SDK throws
   * "Region is missing" the moment a client is constructed without config,
   * which previously failed Nest's DI and took down the whole application
   * at boot rather than just the upload endpoints.
   */
  private getClient(): S3Client {
    const missing = this.missingVars();

    if (missing.length) {
      throw new ServiceUnavailableException(
        `File storage is not configured (missing ${missing.join(', ')})`,
      );
    }

    if (!this.client) {
      this.client = new S3Client({
        region: this.configService.get<string>('AWS_REGION'),
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
          secretAccessKey: this.configService.get<string>(
            'AWS_SECRET_ACCESS_KEY',
          )!,
        },
      });
    }

    return this.client;
  }

  async createUploadUrl(
    fileName: string,
    contentType: string,
    folder:
  | 'courses'
  | 'products'
  | 'uploads'
  | 'lessons'
  | 'resources'
  | 'news'
  | 'avatars'
  | 'challenges',
  ) {
    const s3 = this.getClient();
    const bucket = this.configService.get<string>('AWS_S3_BUCKET')!;
    const key = `${folder}/${randomUUID()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300,
    });

    const publicUrl =
      `https://${bucket}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      key,
      publicUrl,
    };
  }

  async createSignedPlaybackUrl(videoUrl: string) {
    const s3 = this.getClient();

    const bucket =
      this.configService.get<string>('AWS_S3_BUCKET')!;

    const region =
      this.configService.get<string>('AWS_REGION')!;

    let key: string;

    try {
      const url = new URL(videoUrl);

      const expectedHost = `${bucket}.s3.${region}.amazonaws.com`;

      if (url.hostname !== expectedHost) {
        throw new Error('Invalid video storage URL');
      }

      key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

      if (!key) {
        throw new Error('Invalid video storage key');
      }
    } catch {
      throw new ServiceUnavailableException(
        'Invalid video storage URL',
      );
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 300,
    });

    return {
      signedUrl,
      expiresIn: 300,
    };
  }
  async createChallengeUploadUrl(
  fileName: string,
  contentType: string,
) {
  return this.createUploadUrl(
    fileName,
    contentType,
    'challenges',
  );
}

  async deleteObject(key: string) {
    const s3 = this.getClient();

    const bucket =
      this.configService.get<string>('AWS_S3_BUCKET')!;

    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    return {
      success: true,
      message: 'File deleted successfully',
    };
  }
}
