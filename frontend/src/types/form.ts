import type { ReactElement } from 'react';

export type FormData = Record<string, unknown>;

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
}

export interface FormViewProps {
  data: FormData;
  readOnly?: boolean;
  printScale?: number;
}

export interface FormComponent {
  formCode: string;
  metadata: FormMetadata;
  FormView: React.FC<FormViewProps>;
  FormEdit: React.FC<FormEditProps>;
  validate: (data: FormData) => ValidationErrors;
  initialData: () => FormData;
}
