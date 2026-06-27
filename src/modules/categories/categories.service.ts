import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import {
  ICreateCategory,
  IUpdateCategory,
  ICreateSubcategory,
  IUpdateSubcategory,
} from '../../interfaces/ICategory';

export const listCategories = async () => {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    include: {
      subcategories: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      },
    },
  });
};

export const getCategoryBySlug = async (slug: string) => {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      subcategories: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
    },
  });

  if (!category || !category.isActive) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  }

  return category;
};

export const createCategory = async (input: ICreateCategory) => {
  const existing = await prisma.category.findUnique({ where: { slug: input.slug } });
  if (existing) {
    throw new ApiError(409, 'SLUG_IN_USE', 'A category with this slug already exists.');
  }
  return prisma.category.create({ data: input });
};

export const updateCategory = async (id: string, input: IUpdateCategory) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  }
  return prisma.category.update({ where: { id }, data: input });
};

export const softDeleteCategory = async (id: string) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  }
  return prisma.category.update({ where: { id }, data: { isActive: false } });
};

export const createSubcategory = async (categoryId: string, input: ICreateSubcategory) => {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  }

  const existing = await prisma.subcategory.findFirst({
    where: { categoryId, slug: input.slug },
  });
  if (existing) {
    throw new ApiError(
      409,
      'SLUG_IN_USE',
      'A subcategory with this slug already exists in this category.',
    );
  }

  return prisma.subcategory.create({ data: { ...input, categoryId } });
};

export const updateSubcategory = async (id: string, input: IUpdateSubcategory) => {
  const subcategory = await prisma.subcategory.findUnique({ where: { id } });
  if (!subcategory) {
    throw new ApiError(404, 'SUBCATEGORY_NOT_FOUND', 'Subcategory not found.');
  }
  return prisma.subcategory.update({ where: { id }, data: input });
};

export const softDeleteSubcategory = async (id: string) => {
  const subcategory = await prisma.subcategory.findUnique({ where: { id } });
  if (!subcategory) {
    throw new ApiError(404, 'SUBCATEGORY_NOT_FOUND', 'Subcategory not found.');
  }
  return prisma.subcategory.update({ where: { id }, data: { isActive: false } });
};
