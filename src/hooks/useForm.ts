import { useState, useCallback } from 'react';

interface FormState {
  [key: string]: unknown;
}

interface FormMeta {
  touched: { [key: string]: boolean };
  errors: { [key: string]: string };
}

interface ChangeEventPayload {
  target: {
    name: string;
    value: unknown;
    type?: string;
    checked?: boolean;
  };
}

interface UseFormReturn {
  values: FormState;
  meta: FormMeta;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | ChangeEventPayload) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setFieldValue: (field: string, value: unknown) => void;
  setFieldError: (field: string, error: string) => void;
  resetForm: () => void;
}

export const useForm = (
  initialValues: FormState,
  onSubmit?: (values: FormState) => void | Promise<void>,
  validate?: (values: FormState) => { [key: string]: string }
): UseFormReturn & { handleSubmit: (e: React.FormEvent) => void } => {
  const [values, setValues] = useState(initialValues);
  const [meta, setMeta] = useState<FormMeta>({
    touched: {},
    errors: {},
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | ChangeEventPayload) => {
      const target = e.target;
      const { name, value, type } = target;
      const checked = 'checked' in target ? target.checked : undefined;
      setValues((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    },
    []
  );

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    setMeta((prev) => ({
      ...prev,
      touched: { ...prev.touched, [name]: true },
    }));
  }, []);

  const setFieldValue = useCallback((field: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setFieldError = useCallback((field: string, error: string) => {
    setMeta((prev) => ({
      ...prev,
      errors: { ...prev.errors, [field]: error },
    }));
  }, []);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setMeta({ touched: {}, errors: {} });
  }, [initialValues]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (validate) {
        const errors = validate(values);
        if (Object.keys(errors).length > 0) {
          setMeta((prev) => ({ ...prev, errors }));
          return;
        }
      }
      if (onSubmit) {
        await onSubmit(values);
      }
    },
    [values, onSubmit, validate]
  );

  return {
    values,
    meta,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    resetForm,
    handleSubmit,
  };
};