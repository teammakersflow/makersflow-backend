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
import { QuizQuestionsModule } from './quiz-questions/quiz-questions.module';
import { CoursePurchasesModule } from './course-purchases/course-purchases.module';
import { LessonProgressModule } from './lesson-progress/lesson-progress.module';
import { PromotionsModule } from './promotions/promotions.module';
import { NewsModule } from './news/news.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { LessonNotesModule } from './lesson-notes/lesson-notes.module';
import { LessonResourcesModule } from './lesson-resources/lesson-resources.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { ReviewRepliesModule } from './review-replies/review-replies.module';
import { CouponUsageModule } from './coupon-usage/coupon-usage.module';
import { ShippingAddressesModule } from './shipping-addresses/shipping-addresses.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { PushTokensModule } from './push-tokens/push-tokens.module';
import { FeedbackModule } from './feedback/feedback.module';
import { SecurityLogsModule } from './security-logs/security-logs.module';
import { StreaksModule } from './streaks/streaks.module';

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
    QuizQuestionsModule,
    CoursePurchasesModule,
    LessonProgressModule,
    PromotionsModule,
    NewsModule,
    AnnouncementsModule,
    LessonNotesModule,
    LessonResourcesModule,
    PromoCodesModule,
    ReviewRepliesModule,
    CouponUsageModule,
    ShippingAddressesModule,
    WishlistModule,
    PushTokensModule,
    FeedbackModule,
    SecurityLogsModule,
    StreaksModule,
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