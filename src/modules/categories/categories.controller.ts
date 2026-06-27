import { Request, Response, NextFunction } from 'express';
import { ResponseService } from '../../utils/response';
import * as categoriesService from './categories.service';

export const listCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await categoriesService.listCategories();
    return ResponseService({ data: categories, status: 200, success: true, res });
  } catch (error) {
    next(error);
  }
};

export const getCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categoriesService.getCategoryBySlug(req.params.slug);
    return ResponseService({ data: category, status: 200, success: true, res });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categoriesService.createCategory(req.body);
    return ResponseService({
      data: category,
      status: 201,
      success: true,
      message: 'Category created',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categoriesService.updateCategory(req.params.id, req.body);
    return ResponseService({
      data: category,
      status: 200,
      success: true,
      message: 'Category updated',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await categoriesService.softDeleteCategory(req.params.id);
    return ResponseService({
      data: null,
      status: 200,
      success: true,
      message: 'Category deleted',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const createSubcategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subcategory = await categoriesService.createSubcategory(req.params.id, req.body);
    return ResponseService({
      data: subcategory,
      status: 201,
      success: true,
      message: 'Subcategory created',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubcategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subcategory = await categoriesService.updateSubcategory(req.params.id, req.body);
    return ResponseService({
      data: subcategory,
      status: 200,
      success: true,
      message: 'Subcategory updated',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSubcategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await categoriesService.softDeleteSubcategory(req.params.id);
    return ResponseService({
      data: null,
      status: 200,
      success: true,
      message: 'Subcategory deleted',
      res,
    });
  } catch (error) {
    next(error);
  }
};
