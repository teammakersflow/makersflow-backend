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
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required');
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
      throw new NotFoundException('Eligible course purchase not found');
    }

    const existingClaim = await this.prisma.included_kit_claims.findUnique({
      where: { course_purchase_id: purchase.id },
      include: { attempts: true },
    });

    const previousAttempt = existingClaim?.attempts.find(
      (attempt) => attempt.idempotency_key === idempotencyKey,
    );

    /*
     * A retry with the same idempotency key returns the original attempt.
     * It never re-validates the kit or the address: the order already holds
     * its own address snapshot, and a paid student must be able to recover
     * even if the address was later edited or deleted.
     */
    if (existingClaim && previousAttempt) {
      return this.resumeAttempt(existingClaim.status, previousAttempt);
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

    const address = await this.shippingAddressesService.validateForKitCheckout(
      userId,
      BigInt(addressId),
    );

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

    /*
     * Course checkout creates the claim row as `pending` with no order.
     * That row means "not claimed yet". Only a pending claim that already
     * has an order is waiting for a payment.
     */
    if (existingClaim?.status === 'pending' && existingClaim.order_id) {
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
      const weight = item.products.weight_kg ?? item.products.weight;

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

    if (!shippingAmount.isFinite() || shippingAmount.isNegative()) {
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
      const amountInPaise = Math.round(Number(shippingAmount.toFixed(2)) * 100);

      if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
        throw new BadRequestException('Invalid shipping amount for payment');
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
      id: addressId,
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
        if (existingClaim) {
          /*
           * Only take the claim if nobody else changed it since we read it.
           * Two first claims with different keys cannot both start an order.
           */
          const taken = await tx.included_kit_claims.updateMany({
            where: {
              id: claimId,
              status: existingClaim.status,
              order_id: existingClaim.order_id,
            },
            data: {
              status: 'pending',
              order_id: orderId,
              updated_at: new Date(),
            },
          });

          if (taken.count !== 1) {
            throw new ConflictException(
              'This kit claim was started by another request. Retry with the same idempotency key.',
            );
          }
        } else {
          await tx.included_kit_claims.create({
            data: {
              id: claimId,
              user_id: userId,
              course_purchase_id: purchase.id,
              kit_id: kit.id,
              order_id: orderId,
              status: 'pending',
            },
          });
        }

        const claim = { id: claimId };

        const order = await tx.orders.create({
          data: {
            id: orderId,
            user_id: userId,
            total_amount: shippingAmount,
            subtotal: new Prisma.Decimal(0),
            tax_amount: new Prisma.Decimal(0),
            discount_amount: new Prisma.Decimal(0),
            status: shippingAmount.isZero() ? 'pending_fulfillment' : 'pending',
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
            status: shippingAmount.isZero() ? 'pending_fulfillment' : 'pending',
          },
        });

        // Zero-shipping claims have no Razorpay payment to verify.
        // Reserve inventory and update claim status atomically.
        if (shippingAmount.isZero()) {
          await this.deductKitStock(tx, kit.kit_items);

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
        razorpayKeyId: this.configService.get<string>('RAZORPAY_KEY_ID'),
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

  /*
   * Same idempotency key again (page reload, "Complete shipping payment").
   * Never creates a new Razorpay order. If Razorpay already captured a
   * matching payment that was never verified (for example the tab closed),
   * the kit is fulfilled now through the same locked transaction as
   * verify-payment, so stock is still deducted only once.
   */
  private async resumeAttempt(
    claimStatus: string,
    attempt: { id: string; claim_id: string; order_id: string },
  ) {
    const previousOrder = await this.prisma.orders.findUnique({
      where: { id: attempt.order_id },
      select: {
        id: true,
        total_amount: true,
        status: true,
        razorpay_order_id: true,
        shipping_address: true,
      },
    });

    if (!previousOrder) {
      throw new NotFoundException(
        'The previous included kit order was not found',
      );
    }

    const previousPayment = previousOrder.razorpay_order_id
      ? await this.prisma.payments.findUnique({
          where: { razorpay_order_id: previousOrder.razorpay_order_id },
          select: { id: true, amount: true, status: true },
        })
      : null;

    const shippingAmount = Number(
      previousPayment?.amount ?? previousOrder.total_amount,
    );
    const expectedPaise = Math.round(shippingAmount * 100);

    let alreadyFulfilled = claimStatus === 'fulfilled';
    let paymentCaptured = previousPayment?.status === 'captured';
    let providerOrderPaid = false;
    let fulfilledNow = false;
    let reconciliationReason: string | null = null;

    if (previousOrder.razorpay_order_id && !alreadyFulfilled) {
      const razorpayOrderId = previousOrder.razorpay_order_id;
      let capturedPaymentId: string | null = null;

      try {
        const razorpayOrder = await this.razorpay.orders.fetch(razorpayOrderId);
        const razorpayPayments =
          await this.razorpay.orders.fetchPayments(razorpayOrderId);

        const captured = razorpayPayments.items.find(
          (payment) =>
            payment.status === 'captured' &&
            payment.order_id === razorpayOrderId &&
            payment.currency === 'INR' &&
            Number(payment.amount) === expectedPaise,
        );

        capturedPaymentId = captured?.id ?? null;
        providerOrderPaid = razorpayOrder.status === 'paid';

        if (
          Number(razorpayOrder.amount) !== expectedPaise ||
          (providerOrderPaid && !captured) ||
          (!captured && Number(razorpayOrder.amount_paid) > 0)
        ) {
          throw new ConflictException(
            'Razorpay reports a payment for this kit order that does not match the expected amount. Manual reconciliation is required. No new payment order was created.',
          );
        }
      } catch (error) {
        if (error instanceof ConflictException) {
          throw error;
        }

        throw new ConflictException(
          'Unable to confirm the existing Razorpay order status. Please retry later or contact support. No new payment order was created.',
        );
      }

      if (capturedPaymentId) {
        paymentCaptured = true;

        if (!previousPayment) {
          reconciliationReason = 'The local payment record is missing.';
        } else {
          const claim = await this.prisma.included_kit_claims.findUnique({
            where: { id: attempt.claim_id },
            include: { kits: { include: { kit_items: true } } },
          });

          if (!claim) {
            throw new NotFoundException('Included kit claim not found');
          }

          try {
            const outcome = await this.fulfilCapturedPayment({
              razorpayOrderId,
              razorpayPaymentId: capturedPaymentId,
              razorpaySignature: null,
              paymentRecordId: previousPayment.id,
              orderId: previousOrder.id,
              claimId: claim.id,
              attemptId: attempt.id,
              kitItems: claim.kits.kit_items,
            });

            alreadyFulfilled = true;
            fulfilledNow = outcome === 'fulfilled';
          } catch (error) {
            if (
              !(error instanceof ConflictException) &&
              !(error instanceof NotFoundException)
            ) {
              throw error;
            }

            reconciliationReason = error.message;
          }
        }
      }
    }

    const requiresReconciliation = paymentCaptured && !alreadyFulfilled;

    const paymentRequired =
      !!previousOrder.razorpay_order_id &&
      !paymentCaptured &&
      !alreadyFulfilled &&
      !providerOrderPaid;

    return {
      claimId: attempt.claim_id,
      attemptId: attempt.id,
      orderId: previousOrder.id,
      order: {
        id: previousOrder.id,
        total_amount: previousOrder.total_amount,
        status: fulfilledNow ? 'pending_fulfillment' : previousOrder.status,
        razorpay_order_id: previousOrder.razorpay_order_id,
        shipping_address: previousOrder.shipping_address,
      },
      reused: true,
      paymentRequired,
      paymentCaptured,
      alreadyFulfilled,
      fulfilledNow,
      requiresReconciliation,
      shippingAmount: shippingAmount.toFixed(2),
      amount: expectedPaise,
      currency: 'INR',
      razorpayOrderId: paymentRequired ? previousOrder.razorpay_order_id : null,
      razorpayKeyId: paymentRequired
        ? this.configService.get<string>('RAZORPAY_KEY_ID')
        : null,
      message: fulfilledNow
        ? 'Your shipping payment was already received. The kit order is confirmed and awaiting fulfillment.'
        : alreadyFulfilled
          ? 'This included kit has already been fulfilled.'
          : requiresReconciliation
            ? `Payment is captured, but the kit order could not be confirmed automatically. Support will reconcile it.${
                reconciliationReason ? ` Reason: ${reconciliationReason}` : ''
              }`
            : paymentRequired
              ? 'Existing payment order retrieved. Complete shipping payment.'
              : 'This included kit does not require shipping payment.',
    };
  }

  /*
   * Deduct each kit product once. -1 means unlimited stock; finite stock is
   * decremented with a conditional update so it can never go negative.
   */
  private async deductKitStock(
    tx: Prisma.TransactionClient,
    kitItems: Array<{ product_id: bigint; quantity: number }>,
  ) {
    for (const item of kitItems) {
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
  }

  /*
   * Fulfil a kit order whose payment Razorpay has confirmed as captured.
   * Shared by verify-payment and the retry path. The claim row is locked,
   * so concurrent calls for the same claim run one at a time and stock is
   * deducted exactly once. If fulfilment fails, the captured payment is
   * still recorded and a reconciliation error is thrown.
   */
  private async fulfilCapturedPayment(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string | null;
    paymentRecordId: string;
    orderId: string;
    claimId: string;
    attemptId: string;
    kitItems: Array<{ product_id: bigint; quantity: number }>;
  }): Promise<'fulfilled' | 'already_fulfilled'> {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      paymentRecordId,
      orderId,
      claimId,
      attemptId,
      kitItems,
    } = params;

    const paymentCapturedData = {
      razorpay_payment_id: razorpayPaymentId,
      ...(razorpaySignature ? { razorpay_signature: razorpaySignature } : {}),
      status: 'captured',
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Lock this claim row so concurrent verification requests
        // for the same claim are processed one at a time.
        const lockedClaims = await tx.$queryRaw<
          Array<{ id: string; status: string }>
        >`
        SELECT id, status
        FROM public.included_kit_claims
        WHERE id = ${claimId}::uuid
        FOR UPDATE
      `;

        const currentClaim = lockedClaims[0];

        if (!currentClaim) {
          throw new NotFoundException('Included kit claim not found');
        }

        if (currentClaim.status === 'fulfilled') {
          return 'already_fulfilled' as const;
        }

        /*
         * If this payment ID is already associated with another order,
         * do not allow it to be reused.
         */
        const alreadyUsed = await tx.payments.findFirst({
          where: {
            razorpay_payment_id: razorpayPaymentId,
            NOT: { razorpay_order_id: razorpayOrderId },
          },
        });

        if (alreadyUsed) {
          throw new ConflictException(
            'This Razorpay payment is already associated with another order',
          );
        }

        await this.deductKitStock(tx, kitItems);

        await tx.payments.update({
          where: { razorpay_order_id: razorpayOrderId },
          data: paymentCapturedData,
        });

        await tx.orders.update({
          where: { id: orderId },
          data: {
            razorpay_payment_id: razorpayPaymentId,
            payment_id: paymentRecordId,
            status: 'pending_fulfillment',
          },
        });

        await tx.included_kit_claims.update({
          where: { id: claimId },
          data: {
            status: 'fulfilled',
            updated_at: new Date(),
          },
        });

        await tx.included_kit_claim_attempts.update({
          where: { id: attemptId },
          data: {
            status: 'fulfilled',
            updated_at: new Date(),
          },
        });

        return 'fulfilled' as const;
      });
    } catch (error) {
      // Razorpay confirmed capture, but local fulfillment failed.
      // Record the captured payment outside the rolled-back transaction.
      try {
        await this.prisma.payments.update({
          where: { razorpay_order_id: razorpayOrderId },
          data: paymentCapturedData,
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
  }

  async verifyPayment(userId: string, dto: VerifyIncludedKitPaymentDto) {
    if (!userId) {
      throw new UnauthorizedException('Authentication is required');
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = dto;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new BadRequestException(
        'All Razorpay verification fields are required',
      );
    }

    const secret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (!secret) {
      throw new Error('RAZORPAY_KEY_SECRET is not configured');
    }

    const paymentRecord = await this.prisma.payments.findUnique({
      where: { razorpay_order_id },
    });

    if (!paymentRecord || paymentRecord.user_id !== userId) {
      throw new NotFoundException('Payment order not found for this user');
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
      throw new BadRequestException('Invalid Razorpay payment signature');
    }

    /*
     * Verify payment status with Razorpay's API as well.
     * Do not trust the client callback alone.
     */
    const payment = await this.razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== razorpay_order_id ||
      payment.status !== 'captured' ||
      payment.currency !== 'INR' ||
      Number(payment.amount) !== Math.round(Number(paymentRecord.amount) * 100)
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
      throw new NotFoundException('Included kit order not found');
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
      throw new NotFoundException('Included kit claim not found');
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
      throw new NotFoundException('Included kit claim attempt not found');
    }

    const outcome = await this.fulfilCapturedPayment({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paymentRecordId: paymentRecord.id,
      orderId: order.id,
      claimId: claim.id,
      attemptId: attempt.id,
      kitItems: claim.kits.kit_items,
    });

    if (outcome === 'already_fulfilled') {
      return {
        success: true,
        alreadyFulfilled: true,
        orderId: order.id,
        claimId: claim.id,
        message: 'This included kit has already been fulfilled.',
      };
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
            shipping_address: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return Promise.all(
      claims.map(async (claim) => {
        const shippingAddress = claim.orders?.shipping_address;

        const snapshotId =
          shippingAddress &&
          typeof shippingAddress === 'object' &&
          !Array.isArray(shippingAddress)
            ? shippingAddress.id
            : undefined;

        // Orders created before the address id was stored have none: null.
        const shippingAddressId =
          typeof snapshotId === 'string' || typeof snapshotId === 'number'
            ? String(snapshotId)
            : null;

        return {
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
          shipping_address_id: shippingAddressId,
          order: claim.orders
            ? {
                id: claim.orders.id,
                status: claim.orders.status,
              }
            : null,
          created_at: claim.created_at,
        };
      }),
    );
  }
}
