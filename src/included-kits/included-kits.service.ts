import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class IncludedKitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  findMine(userId: string) {
    return this.prisma.included_kit_claims.findMany({
      where: { user_id: userId, status: 'pending' },
      include: { kits: { include: { kit_items: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  async claim(
    userId: string,
    claimId: string,
    idempotencyKey: string,
    shippingAddress: Record<string, any>,
  ) {
    // Retry with the same key: return the original order instead of failing.
    const existing = await this.prisma.included_kit_claim_attempts.findUnique({
      where: { idempotency_key: idempotencyKey },
      include: { included_kit_claims: true },
    });
    if (existing) {
      if (
        existing.claim_id !== claimId ||
        existing.included_kit_claims.user_id !== userId
      ) {
        throw new ConflictException('Idempotency key already used');
      }
      return this.prisma.orders.findUnique({
        where: { id: existing.order_id },
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const claim = await tx.included_kit_claims.findFirst({
          where: { id: claimId, user_id: userId },
          include: { kits: { include: { kit_items: true } } },
        });
        if (!claim) throw new NotFoundException('Kit claim not found');

        // Atomic pending -> claimed flip; guards against concurrent double claims.
        const flipped = await tx.included_kit_claims.updateMany({
          where: { id: claimId, user_id: userId, status: 'pending' },
          data: { status: 'claimed', updated_at: new Date() },
        });
        if (flipped.count === 0) {
          throw new ConflictException('Kit already claimed');
        }

        const kitItems = claim.kits.kit_items;
        if (kitItems.length === 0) {
          throw new BadRequestException('Kit has no items');
        }

        const zero = new Prisma.Decimal(0);
        const orderId = randomUUID();

        const order = await tx.orders.create({
          data: {
            id: orderId,
            user_id: userId,
            total_amount: zero,
            subtotal: zero,
            tax_amount: zero,
            status: 'paid',
            order_type: 'kit',
            shipping_address: shippingAddress as Prisma.InputJsonValue,
            items: kitItems.map((i) => ({
              product_id: i.product_id.toString(),
              quantity: i.quantity,
            })) as Prisma.InputJsonValue,
          },
        });

        await tx.order_items.createMany({
          data: kitItems.map((i) => ({
            order_id: order.id,
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: zero,
            user_id: userId,
          })),
        });

        for (const i of kitItems) {
          await this.productsService.deductStock(i.product_id, i.quantity, tx);
        }

        await tx.included_kit_claim_attempts.create({
          data: {
            claim_id: claimId,
            order_id: order.id,
            idempotency_key: idempotencyKey,
            status: 'completed',
          },
        });

        await tx.included_kit_claims.update({
          where: { id: claimId },
          data: { order_id: order.id },
        });

        return order;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const winner = await this.prisma.included_kit_claim_attempts.findUnique(
          {
            where: { idempotency_key: idempotencyKey },
            include: { included_kit_claims: true },
          },
        );
        if (
          winner &&
          winner.claim_id === claimId &&
          winner.included_kit_claims.user_id === userId
        ) {
          return this.prisma.orders.findUnique({
            where: { id: winner.order_id },
          });
        }
      }
      throw e;
    }
  }
}
