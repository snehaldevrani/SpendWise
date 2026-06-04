import {
  BadRequestException,
  Body,
  Controller,
  Get,
  MessageEvent,
  Post,
  Query,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Observable, interval } from 'rxjs';
import { exhaustMap, take, takeWhile } from 'rxjs/operators';
import { UploadsService } from './uploads.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { IMPORT_QUEUE } from '../../jobs/queue.constants';

const ALLOWED_MIMETYPES = new Set([
  'text/csv',
  'text/plain',                                                          // some banks label CSV as text/plain
  'application/vnd.ms-excel',                                           // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  // .xlsx
  'application/octet-stream',                                           // fallback for some browsers on .csv
  'application/pdf',                                                    // .pdf
]);

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(
    private uploadsService: UploadsService,
    @InjectQueue(IMPORT_QUEUE) private importQueue: Queue,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post('csv')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMETYPES.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Unsupported file type: ${file.mimetype}. Supported formats: CSV, XLS, XLSX, PDF`), false);
        }
      },
    }),
  )
  importCsv(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('password') password?: string,
  ) {
    return this.uploadsService.importCsv(user.id, file, password);
  }

  /**
   * SSE stream that emits BullMQ job progress for the 3 post-upload background jobs.
   * Query param: ?jobs=id1,id2,id3  (comma-separated job IDs returned by POST /uploads/csv)
   * Streams ~every 1.5 s until all jobs are completed or failed (max ~5 min).
   */
  @Sse('progress')
  streamProgress(@Query('jobs') jobs: string): Observable<MessageEvent> {
    const jobIds = (jobs ?? '').split(',').filter(Boolean).slice(0, 3);
    const STEP_NAMES = ['Generating embeddings', 'Detecting subscriptions', 'Computing insights'];

    return interval(1500).pipe(
      // exhaustMap: skip tick if previous poll is still running (avoids queue buildup)
      exhaustMap(async () => {
        const states = await Promise.all(
          jobIds.map(async (id) => {
            const job = await this.importQueue.getJob(id);
            // null = job cleaned up after completion, treat as completed
            if (!job) return 'completed';
            return job.getState();
          }),
        );

        const completedCount = states.filter((s) => s === 'completed').length;
        const failedCount = states.filter((s) => s === 'failed').length;
        const done = completedCount + failedCount === Math.max(jobIds.length, 1);

        return {
          data: {
            steps: STEP_NAMES.map((name, i) => ({
              name,
              status: states[i] ?? 'waiting',
            })),
            percent: Math.round((completedCount / Math.max(jobIds.length, 1)) * 100),
            done,
            hasFailures: failedCount > 0,
          },
        };
      }),
      // Emit the final done=true event, then complete the Observable
      takeWhile((event) => !(event.data as { done: boolean }).done, true),
      // Safety cap: ~5 minutes
      take(200),
    );
  }
}
