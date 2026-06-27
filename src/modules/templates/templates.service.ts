import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { getPaginationParams, buildPaginationMeta } from '../../utils/pagination';
import { uploadBufferToCloudinary, uploadImageToCloudinary } from '../../utils/uploadHelper';
import { IListTemplatesQuery, ICreateTemplate, IUpdateTemplate } from '../../interfaces/ITemplate';
import { Prisma } from '@prisma/client';

interface ListFilters extends IListTemplatesQuery {
  [key: string]: unknown;
}

export const listTemplates = async (filters: ListFilters) => {
  const { page, limit, skip } = getPaginationParams(filters);

  const where: Record<string, unknown> = { isActive: true };
  if (filters.class) where.templateClass = filters.class;
  if (filters.search) {
    where.title = { contains: filters.search, mode: 'insensitive' };
  }
  if (filters.subcategory) {
    where.subcategory = { slug: filters.subcategory };
  } else if (filters.category) {
    where.subcategory = { category: { slug: filters.category } };
  }

  const [items, total] = await Promise.all([
    prisma.template.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { subcategory: { include: { category: true } } },
    }),
    prisma.template.count({ where }),
  ]);

  return { items, meta: buildPaginationMeta(page, limit, total) };
};

export const getTemplateBySlug = async (slug: string) => {
  const template = await prisma.template.findUnique({
    where: { slug },
    include: { subcategory: { include: { category: true } } },
  });

  if (!template || !template.isActive) {
    throw new ApiError(404, 'TEMPLATE_NOT_FOUND', 'Template not found.');
  }

  const pricing = await prisma.pricingTier.findUnique({
    where: { templateClass: template.templateClass },
  });

  // The actual file is never exposed before checkout — only the metadata
  // and the current price for its class.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fileUrl, ...rest } = template;
  return { ...rest, price: pricing?.price ?? null };
};

/**
 * The core business rule: every download deducts the template's class price
 * from the organization/individual's wallet balance, atomically, alongside
 * a ledger entry. No premium flag, no subscription check — just balance.
 */
export const downloadTemplate = async (userId: string, templateId: string) => {
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template || !template.isActive) {
    throw new ApiError(404, 'TEMPLATE_NOT_FOUND', 'Template not found.');
  }

  const pricing = await prisma.pricingTier.findUnique({
    where: { templateClass: template.templateClass },
  });
  if (!pricing) {
    throw new ApiError(
      500,
      'PRICING_NOT_CONFIGURED',
      "This template's class has no price configured.",
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const price = Number(pricing.price);
  const balance = Number(user.walletBalance);

  if (balance < price) {
    throw new ApiError(
      402,
      'INSUFFICIENT_BALANCE',
      `This template costs $${price.toFixed(2)}, but your wallet balance is $${balance.toFixed(2)}. Please top up your wallet.`,
      { price, balance, amountNeeded: Number((price - balance).toFixed(2)) },
    );
  }

  const newBalance = Number((balance - price).toFixed(2));

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { walletBalance: newBalance },
    });

    const updatedTemplate = await tx.template.update({
      where: { id: templateId },
      data: { downloadCount: { increment: 1 } },
    });

    await tx.walletTransaction.create({
      data: {
        userId,
        type: 'DOWNLOAD_DEDUCTION',
        amount: price,
        balanceAfter: updatedUser.walletBalance,
        templateId,
      },
    });

    return updatedTemplate;
  });

  return {
    fileUrl: result.fileUrl,
    fileType: result.fileType,
    title: result.title,
    amountCharged: price,
    newBalance,
  };
};

export const updateTemplate = async (id: string, input: IUpdateTemplate) => {
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) {
    throw new ApiError(404, 'TEMPLATE_NOT_FOUND', 'Template not found.');
  }
  return prisma.template.update({ where: { id }, data: input });
};

export const softDeleteTemplate = async (id: string) => {
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) {
    throw new ApiError(404, 'TEMPLATE_NOT_FOUND', 'Template not found.');
  }
  return prisma.template.update({ where: { id }, data: { isActive: false } });
};

/**
 * Merged upload+create: streams the file (and optional preview image) to
 * Cloudinary, then immediately creates the template row with that URL.
 * One request, one response — no separate upload-proxy step.
 */
export const createTemplateWithUpload = async (
  input: ICreateTemplate,
  uploadedById: string,
  fileBuffer: Buffer,
  originalFilename: string,
  previewBuffer?: Buffer,
) => {
  const existing = await prisma.template.findUnique({ where: { slug: input.slug } });
  if (existing) {
    throw new ApiError(409, 'SLUG_IN_USE', 'A template with this slug already exists.');
  }

  const fileResult = await uploadBufferToCloudinary(fileBuffer, { originalFilename });

  let previewImageUrl: string | undefined;
  if (previewBuffer) {
    const previewResult = await uploadImageToCloudinary(previewBuffer);
    previewImageUrl = previewResult.url;
  }

  return prisma.template.create({
    data: {
      ...input,
      uploadedById,
      fileUrl: fileResult.url,
      fileType: fileResult.fileType,
      previewImageUrl,
    },
  });
};