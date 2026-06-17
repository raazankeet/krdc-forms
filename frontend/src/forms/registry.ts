import type { FormComponent } from '../types/form';
import MPAIForm from './MPAIForm';

export const formRegistry: Record<string, FormComponent> = {
  MPAI: MPAIForm,
};

export function getFormComponent(formCode: string): FormComponent | undefined {
  return formRegistry[formCode];
}

export function getAllFormMetadata() {
  return Object.entries(formRegistry).map(([code, form]) => ({
    formCode: code,
    ...form.metadata,
  }));
}
