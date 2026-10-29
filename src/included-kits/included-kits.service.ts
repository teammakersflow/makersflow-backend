import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { ShippingAddressesService } from '../shipping-addresses/shipping-addresses.service';
import { ShippingRatesService } from '../shipping-rates/shipping-rates.service';
import { ClaimIncludedKitDto } from './dto/claim-included-kit.dto';
import { VerifyIncludedKitPaymentDto } from './dto/verify-included-kit-payment.dto';


@Injectable()
export class IncludedKitsService {
  private readonly razorpay: Razorpay;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly shippingAddressesService: ShippingAddressesService,
    private readonly shippingRatesService: ShippingRatesService,
    private readonly storage: StorageService,
  ) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      throw new Error(
        'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required',
      );
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  async claim(userId: string, dto: ClaimIncludedKitDto) {
    if (!userId) {
      throw new UnauthorizedException('Authentication is required');
    }

    if (!/^[0-9a-f-]{36}$/i.test(dto.coursePurchaseId)) {
      throw new BadRequestException('Invalid course purchase ID');
    }

    const addressId = dto.shippingAddressId.trim();

    if (!/^\d+$/.test(addressId)) {
      throw new BadRequestException('Invalid shipping address ID');
    }

    const idempotencyKey = dto.idempotencyKey.trim();

    if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new BadRequestException(
        'Idempotency key must contain 8-128 characters',
      );
    }

    const purchase = await this.prisma.course_purchases.findFirst({
      where: {
        id: dto.coursePurchaseId,
        user_id: userId,
        access_granted: true,
        status: 'active',
      },
      include: {
        courses: {
          include: {
            kits: {
              include: {
                kit_items: {
                  include: { products: true },
                },
              },
            },
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException(
        'Eligible course purchase not found',
      );
    }

    const kit = purchase.courses.kits;

    if (!kit || kit.status !== 'active' || kit.kit_items.length === 0) {
      throw new BadRequestException(
        'This course does not have an available kit',
      );
    }

    for (const item of kit.kit_items) {
      if (item.quantity < 1) {
        throw new BadRequestException(
          'The kit contains an invalid product quantity',
        );
      }
    }

    const address =
      await this.shippingAddressesService.validateForKitCheckout(
        userId,
        BigInt(addressId),
      );

    const existingClaim =
      await this.prisma.included_kit_claims.findUnique({
        where: { course_purchase_id: purchase.id },
        include: { attempts: true },
      });

    const previousAttempt = existingClaim?.attempts.find(
      (attempt) => attempt.idempotency_key === idempotencyKey,
    );

    if (previousAttempt) {
      const previousOrder = await this.prisma.orders.findUnique({
        where: { id: previousAttempt.order_id },
        select: {
          id: true,
          total_amount: true,
          status: true,
          razorpay_order_id: true,
        },
      });

      if (!previousOrder) {
        throw new NotFoundException(
          'The previous included kit order was not found',
        );
      }

      return {
        claimId: previousAttempt.claim_id,
        attemptId: previousAttempt.id,
        order: previousOrder,
        reused: true,
      };
    }

    if (existingClaim?.status === 'fulfilled') {
      throw new ConflictException(
        'The included kit has already been fulfilled',
      );
    }

    if (existingClaim?.status === 'processing') {
      throw new ConflictException(
        'The included kit claim is already processing',
      );
    }

        if (existingClaim?.status === 'pending') {
      throw new ConflictException(
        'A payment for this included kit is already pending. Retry with the original idempotency key or complete/reconcile the existing payment.',
      );
    }

    const pickupPostcode = this.configService
      .get<string>('SHIPROCKET_PICKUP_POSTCODE')
      ?.trim();

    const deliveryPostcode = address.postal_code.trim();

    if (!pickupPostcode) {
      throw new BadRequestException(
        'Shiprocket pickup postcode is not configured',
      );
    }

    if (!/^\d{6}$/.test(deliveryPostcode)) {
      throw new BadRequestException(
        'A valid 6-digit delivery pincode is required',
      );
    }

    const totalWeightKg = kit.kit_items.reduce((total, item) => {
      const weight =
        item.products.weight_kg ?? item.products.weight;

      return total + Number(weight) * item.quantity;
    }, 0);

    const shippingAmount = new Prisma.Decimal(
      await this.shippingRatesService.getShippingAmount({
        pickup_postcode: pickupPostcode,
        delivery_postcode: deliveryPostcode,
        weight: Math.max(totalWeightKg, 0.1),
        product_type: 'product',
      }),
    );

    if (
      !shippingAmount.isFinite() ||
      shippingAmount.isNegative()
    ) {
      throw new BadRequestException(
        'Invalid shipping charge returned by shipping provider',
      );
    }

    const claimId = existingClaim?.id ?? randomUUID();
    const orderId = randomUUID();
    const attemptId = randomUUID();

    let razorpayOrderId: string | null = null;

    /*
     * Create a Razorpay order only when shipping costs money.
     * Razorpay amounts are specified in paise.
     */
    if (!shippingAmount.isZero()) {
      const amountInPaise = Math.round(
        Number(shippingAmount.toFixed(2)) * 100,
      );

      if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
        throw new BadRequestException(
          'Invalid shipping amount for payment',
        );
      }

      const razorpayOrder = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: orderId,
        notes: {
          order_id: orderId,
          user_id: userId,
          claim_id: claimId,
          attempt_id: attemptId,
          order_type: 'included_kit',
        },
      });

      razorpayOrderId = razorpayOrder.id;
    }

    const addressSnapshot = {
      full_name: address.full_name,
      address_line1: address.address_line1,
      address_line2: address.address_line2,
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      phone: address.phone,
    };

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const claim = existingClaim
          ? await tx.included_kit_claims.update({
              where: { id: claimId },
              data: {
                status: 'pending',
                order_id: orderId,
                updated_at: new Date(),
              },
            })
          : await tx.included_kit_claims.create({
              data: {
                id: claimId,
                user_id: userId,
                course_purchase_id: purchase.id,
                kit_id: kit.id,
                order_id: orderId,
                status: 'pending',
              },
            });

        const order = await tx.orders.create({
          data: {
            id: orderId,
            user_id: userId,
            total_amount: shippingAmount,
            subtotal: new Prisma.Decimal(0),
            tax_amount: new Prisma.Decimal(0),
            discount_amount: new Prisma.Decimal(0),
            status: shippingAmount.isZero()
              ? 'pending_fulfillment'
              : 'pending',
            order_type: 'included_kit',
            shipping_address: addressSnapshot,
            items: kit.kit_items.map((item) => ({
              product_id: item.product_id.toString(),
              title: item.products.title,
              quantity: item.quantity,
              unit_price: '0.00',
            })),
            razorpay_order_id: razorpayOrderId,
          },
        });

        for (const item of kit.kit_items) {
          await tx.order_items.create({
            data: {
              order_id: order.id,
              user_id: userId,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: new Prisma.Decimal(0),
            },
          });
        }

        const attempt = await tx.included_kit_claim_attempts.create({
          data: {
            id: attemptId,
            claim_id: claim.id,
            order_id: order.id,
            idempotency_key: idempotencyKey,
            status: shippingAmount.isZero()
              ? 'pending_fulfillment'
              : 'pending',
          },
        });

        // Zero-shipping claims have no Razorpay payment to verify.
// Reserve inventory and update claim status atomically.
if (shippingAmount.isZero()) {
  for (const item of kit.kit_items) {
    const product = await tx.products.findUnique({
      where: { id: item.product_id },
      select: {
        id: true,
        stock_quantity: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Kit product ${item.product_id.toString()} was not found`,
      );
    }

    // -1 means unlimited stock.
    if (product.stock_quantity === -1) {
      continue;
    }

    const updated = await tx.products.updateMany({
      where: {
        id: item.product_id,
        stock_quantity: { gte: item.quantity },
      },
      data: {
        stock_quantity: { decrement: item.quantity },
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException(
        `Insufficient stock for product ${item.product_id.toString()}`,
      );
    }
  }

  await tx.included_kit_claims.update({
    where: { id: claim.id },
    data: {
      status: 'fulfilled',
      updated_at: new Date(),
    },
  });

  await tx.included_kit_claim_attempts.update({
    where: { id: attempt.id },
    data: {
      status: 'fulfilled',
      updated_at: new Date(),
    },
  });
}

        if (razorpayOrderId) {
          await tx.payments.create({
            data: {
              user_id: userId,
              razorpay_order_id: razorpayOrderId,
              amount: shippingAmount,
              currency: 'INR',
              status: 'pending',
            },
          });
        }

        return { claim, order, attempt };
      });

      return {
        claimId: created.claim.id,
        attemptId: created.attempt.id,
        orderId: created.order.id,
        shippingAmount: shippingAmount.toFixed(2),
        currency: 'INR',
        paymentRequired: !shippingAmount.isZero(),
        razorpayOrderId,
        razorpayKeyId: this.configService.get<string>(
          'RAZORPAY_KEY_ID',
        ),
        message: shippingAmount.isZero()
          ? 'No shipping payment is required. Inventory has been reserved and the order is awaiting fulfillment.'
          : 'Shipping charge calculated. Complete payment using the returned Razorpay order.',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A claim attempt already exists. Retry with the same idempotency key.',
        );
      }

      throw error;
    }
  }

  async verifyPayment(
    userId: string,
    dto: VerifyIncludedKitPaymentDto,
  ) {
    if (!userId) {
      throw new UnauthorizedException('Authentication is required');
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      dto;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      throw new BadRequestException(
        'All Razorpay verification fields are required',
      );
    }

    const secret = this.configService.get<string>(
      'RAZORPAY_KEY_SECRET',
    );

    if (!secret) {
      throw new Error('RAZORPAY_KEY_SECRET is not configured');
    }

    const paymentRecord = await this.prisma.payments.findUnique({
      where: { razorpay_order_id },
    });

    if (!paymentRecord || paymentRecord.user_id !== userId) {
      throw new NotFoundException(
        'Payment order not found for this user',
      );
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const supplied = Buffer.from(razorpay_signature, 'utf8');
    const expected = Buffer.from(expectedSignature, 'utf8');

    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw new BadRequestException(
        'Invalid Razorpay payment signature',
      );
    }

    /*
     * Verify payment status with Razorpay's API as well.
     * Do not trust the client callback alone.
     */
    const payment = await this.razorpay.payments.fetch(
      razorpay_payment_id,
    );

    if (
      payment.order_id !== razorpay_order_id ||
      payment.status !== 'captured' ||
      payment.currency !== 'INR' ||
      Number(payment.amount) !==
        Math.round(Number(paymentRecord.amount) * 100)
    ) {
      throw new BadRequestException(
        'Razorpay payment is not captured or the payment details do not match',
      );
    }

    const order = await this.prisma.orders.findFirst({
      where: {
        razorpay_order_id,
        user_id: userId,
        order_type: 'included_kit',
      },
    });

    if (!order) {
      throw new NotFoundException(
        'Included kit order not found',
      );
    }

    const claim = await this.prisma.included_kit_claims.findFirst({
    where: {
      order_id: order.id,
      user_id: userId,
    },
    include: {
      kits: {
        include: {
          kit_items: true,
        },
      },
    },
  });

    if (!claim) {
      throw new NotFoundException(
        'Included kit claim not found',
      );
    }

    /*
     * A successful retry must never deduct stock twice.
     */
    if (claim.status === 'fulfilled') {
      return {
        success: true,
        alreadyFulfilled: true,
        orderId: order.id,
        claimId: claim.id,
        message: 'This included kit has already been fulfilled.',
      };
    }

    const attempt = await this.prisma.included_kit_claim_attempts.findUnique({
      where: { order_id: order.id },
    });

    if (!attempt) {
      throw new NotFoundException(
        'Included kit claim attempt not found',
      );
    }

    /*
     * Inventory deduction and status updates happen atomically.
     * A failed stock check rolls the transaction back.
     */
    try {
      await this.prisma.$transaction(async (tx) => {
  // Lock this claim row so concurrent verification requests
  // for the same claim are processed one at a time.
      const lockedClaims = await tx.$queryRaw<
        Array<{ id: string; status: string }>
      >`
        SELECT id, status
        FROM public.included_kit_claims
        WHERE id = ${claim.id}::uuid
        FOR UPDATE
      `;

      const currentClaim = lockedClaims[0];

      if (!currentClaim) {
        throw new NotFoundException('Included kit claim not found');
      }

      if (currentClaim.status === 'fulfilled') {
        return;
      }

      const currentAttempt =
        await tx.included_kit_claim_attempts.findUnique({
          where: { id: attempt.id },
        });

      if (!currentAttempt) {
        throw new NotFoundException(
          'Included kit claim attempt not found',
        );
      }

      /*
       * If this payment ID is already associated with another order,
       * do not allow it to be reused.
       */
      const alreadyUsed = await tx.payments.findFirst({
        where: {
          razorpay_payment_id,
          NOT: { razorpay_order_id },
        },
      });

      if (alreadyUsed) {
        throw new ConflictException(
          'This Razorpay payment is already associated with another order',
        );
      }

      for (const item of claim.kits.kit_items) {
        /*
         * -1 means unlimited stock.
         * Finite stock is decremented using a conditional update.
         */
        const product = await tx.products.findUnique({
          where: { id: item.product_id },
          select: { id: true, stock_quantity: true },
        });

        if (!product) {
          throw new NotFoundException(
            `Kit product ${item.product_id.toString()} was not found`,
          );
        }

        if (product.stock_quantity === -1) {
          continue;
        }

        const updated = await tx.products.updateMany({
          where: {
            id: item.product_id,
            stock_quantity: { gte: item.quantity },
          },
          data: {
            stock_quantity: { decrement: item.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            `Insufficient stock for product ${item.product_id.toString()}`,
          );
        }
      }

      await tx.payments.update({
        where: { razorpay_order_id },
        data: {
          razorpay_payment_id,
          razorpay_signature,
          status: 'captured',
        },
      });

      await tx.orders.update({
        where: { id: order.id },
        data: {
          razorpay_payment_id,
          payment_id: paymentRecord.id,
          status: 'pending_fulfillment',
        },
      });

      await tx.included_kit_claims.update({
        where: { id: claim.id },
        data: {
          status: 'fulfilled',
          updated_at: new Date(),
        },
      });

      await tx.included_kit_claim_attempts.update({
        where: { id: attempt.id },
        data: {
          status: 'fulfilled',
          updated_at: new Date(),
        },
      });
    });

    } catch (error) {
      // Razorpay confirmed capture, but local fulfillment failed.
      // Record the captured payment outside the rolled-back transaction.
      try {
        await this.prisma.payments.update({
          where: { razorpay_order_id },
          data: {
            razorpay_payment_id,
            razorpay_signature,
            status: 'captured',
          },
        });
      } catch {
        throw new ConflictException(
          'Payment was captured, but fulfillment and payment-state recording failed. Manual reconciliation is required.',
        );
      }

      throw new ConflictException(
        `Payment was captured, but included-kit fulfillment failed. Manual reconciliation is required. Cause: ${
          error instanceof Error ? error.message : 'Unknown transaction error'
        }`,
      );
    }

    return {
      success: true,
      orderId: order.id,
      claimId: claim.id,
      message:
        'Payment verified and stock deducted. The order is awaiting fulfillment.',
    };
  }
  async findMine(userId: string) {
    const claims = await this.prisma.included_kit_claims.findMany({
      where: { user_id: userId },
      include: {
        course_purchases: {
          include: {
            courses: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        kits: {
          include: {
            kit_items: {
              include: {
                products: {
                  select: {
                    id: true,
                    title: true,
                    thumbnail_url: true,
                    images: true,
                  },
                },
              },
            },
          },
        },
        orders: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return Promise.all(
      claims.map(async (claim) => ({
        id: claim.id,
        status: claim.status,
        course_purchase_id: claim.course_purchase_id,
        course: {
          id: claim.course_purchases.courses.id.toString(),
          title: claim.course_purchases.courses.title,
        },
        kit: {
          id: claim.kits.id,
          name: claim.kits.name,
          items: await Promise.all(
            claim.kits.kit_items.map(async (item) => ({
              product_id: item.products.id.toString(),
              title: item.products.title,
              quantity: item.quantity,
              thumbnail_url: await this.storage.createSignedImageUrl(
                item.products.thumbnail_url ??
                  item.products.images[0] ??
                  null,
              ),
            })),
          ),
        },
        order: claim.orders
          ? {
              id: claim.orders.id,
              status: claim.orders.status,
            }
          : null,
        created_at: claim.created_at,
      })),
    );
  }
}
