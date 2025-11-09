export interface TemplateVariable {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string;
  placeholder?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  content: string;
  type?: string;
  category?: string;
  complexity?: string;
  tags?: string[];
  thumbnail?: string;
  preview?: string;
  isFavorite?: boolean;
  isPublic?: boolean;
  isOfficial?: boolean;
  rating?: number;
  ratingCount?: number;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
  version?: string;
  author?: {
    id?: string;
    name?: string;
    avatar?: string;
  };
  variables?: TemplateVariable[];
  dependencies?: string[];
}
