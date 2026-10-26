import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IncludedKitsService } from './included-kits.service';

describe('IncludedKitsService.claim', () => {
  const userId = 'u1';
  const claimId = 'c1';
  const key = 'idem-key-12345';
  const address = { line1: 'x' };

  let tx: any;
  let prisma: any;
  let products: any;
  let service: IncludedKitsService;

  beforeEach(() => {
    tx = {
      included_kit_claims: {
        findFirst: jest.fn().mockResolvedValue({
          id: claimId,
          kits: { kit_items: [{ product_id: BigInt(1), quantity: 2 }] },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      orders: { create: jest.fn().mockResolvedValue({ id: 'o1' }) },
      order_items: { createMany: jest.fn().mockResolvedValue({}) },
      included_kit_claim_attempts: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      included_kit_claim_attempts: { findUnique: jest.fn().mockResolvedValue(null) },
      orders: { findUnique: jest.fn().mockResolvedValue({ id: 'o1' }) },
      $transaction: jest.fn((cb: any) => cb(tx)),
    };
    products = { deductStock: jest.fn().mockResolvedValue({}) };
    service = new IncludedKitsService(prisma, products);
  });

  it('creates order, deducts stock, records attempt (happy path)', async () => {
    const res = await service.claim(userId, claimId, key, address);
    expect(res).toEqual({ id: 'o1' });
    expect(products.deductStock).toHaveBeenCalledWith(BigInt(1), 2, tx);
    expect(tx.included_kit_claim_attempts.create).toHaveBeenCalled();
    expect(tx.included_kit_claims.update).toHaveBeenCalledWith({
      where: { id: claimId },
      data: { order_id: 'o1' },
    });
  });

  it('throws 409 when the claim is already claimed', async () => {
    tx.included_kit_claims.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.claim(userId, claimId, key, address)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.orders.create).not.toHaveBeenCalled();
  });

  it('returns the original order on same-key retry without a transaction', async () => {
    prisma.included_kit_claim_attempts.findUnique.mockResolvedValue({
      claim_id: claimId,
      order_id: 'o1',
      included_kit_claims: { user_id: userId },
    });
    const res = await service.claim(userId, claimId, key, address);
    expect(res).toEqual({ id: 'o1' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('propagates out-of-stock and records no attempt', async () => {
    products.deductStock.mockRejectedValue(
      new BadRequestException('Insufficient inventory'),
    );
    await expect(service.claim(userId, claimId, key, address)).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.included_kit_claim_attempts.create).not.toHaveBeenCalled();
  });

  it('returns the winner order when a concurrent request hits P2002', async () => {
    prisma.included_kit_claim_attempts.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        claim_id: claimId,
        order_id: 'o1',
        included_kit_claims: { user_id: userId },
      });
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const res = await service.claim(userId, claimId, key, address);
    expect(res).toEqual({ id: 'o1' });
  });
});
