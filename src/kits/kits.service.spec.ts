/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
// Prisma and the storage signer are replaced with plain jest mocks (typed
// `any`), as in included-kits.service.spec.ts, so the no-unsafe-* rules do not
// apply in this file. These tests call the real KitsService.getCourseKit.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { KitsService } from './kits.service';

type ProductOverrides = {
  in_stock?: boolean | null;
  stock?: number;
  stock_quantity?: number;
};

/** A kit_items row as Prisma returns it with KIT_INCLUDE. */
function kitItem(
  productId: number,
  quantity: number,
  product: ProductOverrides = {},
) {
  return {
    kit_id: 'kit-1',
    product_id: BigInt(productId),
    quantity,
    products: {
      id: BigInt(productId),
      title: `Product ${productId}`,
      slug: `product-${productId}`,
      price: new Prisma.Decimal(499),
      thumbnail_url: null,
      images: [],
      in_stock: true,
      stock: 100, // legacy column; default in the schema
      stock_quantity: 10,
      status: 'active',
      ...product,
    },
  };
}

function course(
  kitItems: ReturnType<typeof kitItem>[] | null,
  opts: { status?: string; isFree?: boolean } = {},
) {
  return {
    id: BigInt(44),
    is_free: opts.isFree ?? true,
    price: new Prisma.Decimal(opts.isFree === false ? 999 : 0),
    kits:
      kitItems === null
        ? null
        : {
            id: 'kit-1',
            name: 'Robotics Starter Kit',
            description: 'Everything for the course',
            status: opts.status ?? 'active',
            kit_items: kitItems,
          },
  };
}

function setup(courseRow: unknown) {
  const prisma: any = {
    courses: { findUnique: jest.fn().mockResolvedValue(courseRow) },
  };
  const storage: any = {
    createSignedImageUrl: jest.fn().mockResolvedValue(null),
  };
  const service = new KitsService(prisma, storage);
  return { service, prisma, storage };
}

/** Availability of a single-item kit whose product has the given stock fields. */
async function availabilityFor(quantity: number, product: ProductOverrides) {
  const { service } = setup(course([kitItem(7, quantity, product)]));
  const res: any = await service.getCourseKit('44');
  return {
    item: res.kit.items[0].available as boolean,
    kit: res.kit.all_available as boolean,
  };
}

describe('KitsService.getCourseKit: item availability', () => {
  it('stock_quantity = -1 is unlimited inventory: available for any kit quantity', async () => {
    expect(await availabilityFor(1, { stock_quantity: -1 })).toEqual({
      item: true,
      kit: true,
    });
    expect(await availabilityFor(500, { stock_quantity: -1 })).toEqual({
      item: true,
      kit: true,
    });
  });

  it('stock_quantity = 0 is unavailable', async () => {
    expect(await availabilityFor(1, { stock_quantity: 0 })).toEqual({
      item: false,
      kit: false,
    });
  });

  it('positive stock_quantity covering the kit quantity is available (including exactly equal)', async () => {
    expect(await availabilityFor(2, { stock_quantity: 10 })).toEqual({
      item: true,
      kit: true,
    });
    expect(await availabilityFor(3, { stock_quantity: 3 })).toEqual({
      item: true,
      kit: true,
    });
  });

  it('positive stock_quantity below the kit quantity is unavailable', async () => {
    expect(await availabilityFor(3, { stock_quantity: 2 })).toEqual({
      item: false,
      kit: false,
    });
  });

  it('legacy `stock` never overrides stock_quantity', async () => {
    // Plenty of legacy stock, none in stock_quantity → unavailable.
    expect(await availabilityFor(1, { stock: 100, stock_quantity: 0 })).toEqual(
      { item: false, kit: false },
    );
    // Legacy stock too low, but enough stock_quantity → available.
    expect(await availabilityFor(5, { stock: 1, stock_quantity: 5 })).toEqual({
      item: true,
      kit: true,
    });
    // No legacy stock, unlimited stock_quantity → available.
    expect(await availabilityFor(2, { stock: 0, stock_quantity: -1 })).toEqual({
      item: true,
      kit: true,
    });
  });

  it('in_stock = false makes an item unavailable even with unlimited stock_quantity', async () => {
    expect(
      await availabilityFor(1, { in_stock: false, stock_quantity: -1 }),
    ).toEqual({ item: false, kit: false });
    // null is not false: only an explicit false blocks.
    expect(
      await availabilityFor(1, { in_stock: null, stock_quantity: 5 }),
    ).toEqual({ item: true, kit: true });
  });

  it('all_available is false when any one item is unavailable, true when all are', async () => {
    const mixed = setup(
      course([
        kitItem(7, 1, { stock_quantity: -1 }),
        kitItem(8, 2, { stock_quantity: 1 }),
        kitItem(9, 1, { stock_quantity: 4 }),
      ]),
    );
    const res: any = await mixed.service.getCourseKit('44');
    expect(res.kit.items.map((i: any) => [i.product_id, i.available])).toEqual([
      ['7', true],
      ['8', false],
      ['9', true],
    ]);
    expect(res.kit.all_available).toBe(false);

    const ok = setup(
      course([
        kitItem(7, 1, { stock_quantity: -1 }),
        kitItem(9, 2, { stock_quantity: 2 }),
      ]),
    );
    expect(
      ((await ok.service.getCourseKit('44')) as any).kit.all_available,
    ).toBe(true);
  });
});

describe('KitsService.getCourseKit: response shape', () => {
  it('course with no kit returns exactly { course_id, kit: null }', async () => {
    const { service, storage } = setup(course(null));
    await expect(service.getCourseKit('21')).resolves.toEqual({
      course_id: '21',
      kit: null,
    });
    expect(storage.createSignedImageUrl).not.toHaveBeenCalled();
  });

  it('course whose kit is not active also returns { course_id, kit: null }', async () => {
    const { service } = setup(course([kitItem(7, 1)], { status: 'inactive' }));
    await expect(service.getCourseKit('44')).resolves.toEqual({
      course_id: '44',
      kit: null,
    });
  });

  it('unknown course → 404; non-numeric id → 400 (no database call)', async () => {
    const missing = setup(null);
    await expect(missing.service.getCourseKit('999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const bad = setup(course(null));
    await expect(bad.service.getCourseKit('abc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(bad.prisma.courses.findUnique).not.toHaveBeenCalled();
  });

  it('free course: kit sold separately; item fields serialised (ids and Decimal price as strings)', async () => {
    const { service } = setup(course([kitItem(7, 2, { stock_quantity: -1 })]));
    const res: any = await service.getCourseKit('44');
    expect(res).toEqual({
      course_id: '44',
      kit: {
        id: 'kit-1',
        name: 'Robotics Starter Kit',
        description: 'Everything for the course',
        items: [
          {
            product_id: '7',
            title: 'Product 7',
            slug: 'product-7',
            quantity: 2,
            price: '499',
            image: null,
            available: true,
          },
        ],
        all_available: true,
      },
      kit_included: false,
      kit_purchase_required: true,
      label: 'Kit available for purchase (not included free)',
    });
    // Neither stock column is exposed in the public response.
    expect(res.kit.items[0]).not.toHaveProperty('stock');
    expect(res.kit.items[0]).not.toHaveProperty('stock_quantity');
  });

  it('paid course: kit included', async () => {
    const { service } = setup(course([kitItem(7, 1)], { isFree: false }));
    const res: any = await service.getCourseKit('45');
    expect(res.kit_included).toBe(true);
    expect(res.kit_purchase_required).toBe(false);
    expect(res.label).toBe('Kit included with course');
  });
});
