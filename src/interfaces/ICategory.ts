export interface ICreateCategory {
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  displayOrder?: number;
}

export interface IUpdateCategory {
  name?: string;
  slug?: string;
  description?: string;
  iconUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface ICreateSubcategory {
  name: string;
  slug: string;
  displayOrder?: number;
}

export interface IUpdateSubcategory {
  name?: string;
  slug?: string;
  displayOrder?: number;
  isActive?: boolean;
}
