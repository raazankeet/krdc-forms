import type { ComponentType } from 'react';

export type FormData = Record<string, unknown>;

export interface FieldComment {
  id: number;
  field_name: string;
  user_id: number;
  user_name: string;
  comment: string;
  comment_type: string;
  created_at: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export type ValidationErrors = ValidationError[];

export interface FormMetadata {
  name: string;
  description: string;
  icon: string;
  instructions?: {
    summary: string;
    sections: Array<{
      title: string;
      items: string[];
    }>;
  };
}

export interface FormEditProps {
  data: FormData;
  onChange: (data: FormData) => void;
  onLiveChange?: (data: FormData) => void;
  errors: ValidationErrors;
  onBlur: (fieldName: string) => void;
  touched: Set<string>;
  fieldComments?: FieldComment[];
  onAddFieldComment?: (fieldName: string, comment: string) => void | Promise<void>;
}

export interface FormViewProps {
  data: FormData;
  readOnly?: boolean;
  printScale?: number;
  fieldComments?: FieldComment[];
  onAddFieldComment?: (fieldName: string, comment: string) => void | Promise<void>;
  addingCommentField?: string | null;
}

export interface FormComponent {
  formCode: string;
  metadata: FormMetadata;
  FormView: ComponentType<FormViewProps>;
  FormEdit: ComponentType<FormEditProps>;
  validate: (data: FormData) => ValidationErrors;
  initialData: () => FormData;
}
