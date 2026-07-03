export type TemplateClass = 'A' | 'B' | 'C';
export type TemplateFileType = 'docx' | 'xlsx' | 'pdf' | 'pptx';


export interface IListTemplatesQuery {
  category?: string;
  subcategory?: string;
  class?: TemplateClass;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

// File arrives via multipart, not in this object — these are just the
// accompanying text fields for the merged upload+create endpoint.
export interface ICreateTemplate {
  subcategoryId: string;
  title: string;
  slug: string;
  description?: string;
  templateClass: TemplateClass;
}

export interface IUpdateTemplate {
  subcategoryId?: string;
  title?: string;
  slug?: string;
  description?: string;
  templateClass?: TemplateClass;
  isActive?: boolean;
}

export interface TemplateDownloadDto {
  fileUrl: string;
  fileType: string;
  title: string;
  amountCharged: number | string;
  newBalance: number | string;
}
