import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappOtpModule } from './whatsapp-otp/whatsapp-otp.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CouponsModule } from './coupons/coupons.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { CategoriesModule } from './categories/categories.module';
import { CoursesModule } from './courses/courses.module';
import { ModulesModule } from './modules/modules.module';
import { LessonsModule } from './lessons/lessons.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { CertificatesModule } from './certificates/certificates.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { StorageModule } from './storage/storage.module';
import { SettingsModule } from './settings/settings.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { QuizQuestionsModule } from './quiz-questions/quiz-questions.module';
import { LessonResourcesModule } from './lesson-resources/lesson-resources.module';
import { CoursePurchasesModule } from './course-purchases/course-purchases.module';
import { LessonProgressModule } from './lesson-progress/lesson-progress.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 20,
      },
    ]),
    PrismaModule,
    AuthModule,
    WhatsappOtpModule,
    UsersModule,
    ProductsModule,
    CouponsModule,
    OrdersModule,
    PaymentsModule,
    CategoriesModule,
    CoursesModule,
    ModulesModule,
    LessonsModule,
    EnrollmentsModule,
    CertificatesModule,
    ReviewsModule,
    NotificationsModule,
    AnalyticsModule,
    StorageModule,
    SettingsModule,
    PromoCodesModule,
    QuizQuestionsModule,
    LessonResourcesModule,
    CoursePurchasesModule,
    LessonProgressModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}