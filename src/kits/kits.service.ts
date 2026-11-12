import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateKitDto, KitItemDto, UpdateKitDto } from './dto/kit.dto';

const KIT_INCLUDE = {
  kit_items: {
    include: {
      products: {
        select: { id: true, title: true, slug: true, price: true, thumbnail_url: true, images: true, in_stock: true, stock: true, stock_quantity: true, status: true },
      },
    },
  },
} as const;

@Injectable()
export class KitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Checks the products exist and aren't duplicated, then returns rows ready to insert. */
  private async buildItems(kitId: string, items: KitItemDto[]) {
    const ids = items.map((i) => BigInt(i.product_id));
    if (new Set(ids.map(String)).size !== ids.length) {
      throw new BadRequestException('The same product is listed twice in this kit');
    }
    const found = await this.prisma.products.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) {
      const ok = new Set(found.map((p) => String(p.id)));
      throw new BadRequestException(`Unknown product(s): ${ids.filter((id) => !ok.has(String(id))).join(', ')}`);
    }
    return items.map((i, n) => ({ kit_id: kitId, product_id: ids[n], quantity: i.quantity }));
  }

  /** Re-sign product images so admin views never show expired S3 links. */
  private async signKit(kit: any) {
    if (!kit?.kit_items) return kit;
    kit.kit_items = await Promise.all(
      kit.kit_items.map(async (ki: any) => ({
        ...ki,
        products: ki.products && {
          ...ki.products,
          thumbnail_url: await this.storage.createSignedImageUrl(
            ki.products.thumbnail_url ?? ki.products.images?.[0] ?? null,
          ),
        },
      })),
    );
    return kit;
  }
  async create(dto: CreateKitDto) {
    const kit = await this.prisma.$transaction(async (tx) => {
      const created = await tx.kits.create({ data: { name: dto.name, description: dto.description } });
      await tx.kit_items.createMany({ data: await this.buildItems(created.id, dto.items) });
      return tx.kits.findUnique({ where: { id: created.id }, include: KIT_INCLUDE });
    });
    return serialize(await this.signKit(kit));
  }

  async findAll() {
    const kits = await this.prisma.kits.findMany({
      include: { ...KIT_INCLUDE, courses: { select: { id: true, title: true } } },
      orderBy: { created_at: 'desc' },
    });
    return serialize(await Promise.all(kits.map((k) => this.signKit(k))));
  }

  async findOne(id: string) {
    const kit = await this.prisma.kits.findUnique({
      where: { id },
      include: { ...KIT_INCLUDE, courses: { select: { id: true, title: true } } },
    });
    if (!kit) throw new NotFoundException('Kit not found');
    return serialize(await this.signKit(kit));
  }

  async update(id: string, dto: UpdateKitDto) {
    await this.findOne(id);
    const kit = await this.prisma.$transaction(async (tx) => {
      await tx.kits.update({
        where: { id },
        data: { name: dto.name, description: dto.description, status: dto.status },
      });
      if (dto.items) {
        const rows = await this.buildItems(id, dto.items);
        await tx.kit_items.deleteMany({ where: { kit_id: id } });
        await tx.kit_items.createMany({ data: rows });
      }
      return tx.kits.findUnique({ where: { id }, include: KIT_INCLUDE });
    });
    return serialize(await this.signKit(kit));
  }

  /** Refused once any user has claimed this kit; set status 'inactive' or detach it instead. */
  async remove(id: string) {
    await this.findOne(id);
    const claims = await this.prisma.included_kit_claims.count({ where: { kit_id: id } });
    if (claims > 0) {
      throw new ConflictException('This kit has user claims. Detach it from courses or mark it inactive instead.');
    }
    await this.prisma.kits.delete({ where: { id } }); // kit_items cascade; courses.kit_id becomes NULL
    return { deleted: true };
  }

  async setCourseKit(courseId: string, kitId?: string | null) {
    const id = toCourseId(courseId);
    const course = await this.prisma.courses.findUnique({ where: { id }, select: { id: true } });
    if (!course) throw new NotFoundException('Course not found');
    if (kitId) await this.findOne(kitId);
    await this.prisma.courses.update({ where: { id }, data: { kit_id: kitId ?? null } });
    return this.getCourseKit(courseId);
  }

  /** Public: what the website and app show on a course page. */
  async getCourseKit(courseId: string) {
    const course = await this.prisma.courses.findUnique({
      where: { id: toCourseId(courseId) },
      select: { id: true, is_free: true, price: true, kits: { include: KIT_INCLUDE } },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (!course.kits || course.kits.status !== 'active') {
      return { course_id: courseId, kit: null };
    }

    const isPaid = course.is_free === false && Number(course.price ?? 0) > 0;
    const items = await Promise.all(course.kits.kit_items.map(async (ki) => ({
      product_id: String(ki.product_id),
      title: ki.products.title,
      slug: ki.products.slug,
      quantity: ki.quantity,
      price: ki.products.price,
      image: await this.storage.createSignedImageUrl(ki.products.thumbnail_url ?? ki.products.images[0] ?? null),
      available:
        ki.products.in_stock !== false &&
        (ki.products.stock_quantity < 0 || ki.products.stock_quantity >= ki.quantity),
    })));

    return serialize({
      course_id: courseId,
      kit: {
        id: course.kits.id,
        name: course.kits.name,
        description: course.kits.description,
        items,
        all_available: items.every((i) => i.available),
      },
      kit_included: isPaid,
      kit_purchase_required: !isPaid,
      label: isPaid ? 'Kit included with course' : 'Kit available for purchase (not included free)',
    });
  }
}

function toCourseId(courseId: string) {
  if (!/^\d+$/.test(courseId)) throw new BadRequestException('Invalid course id');
  return BigInt(courseId);
}

/** Turns BigInt and Decimal into plain JSON values. */
function serialize<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)));
}