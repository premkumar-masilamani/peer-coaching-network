import { describe, it, expect } from 'vitest';
import { collectValidationErrors, clearFieldError } from '../formValidation';

describe('formValidation', () => {
  describe('collectValidationErrors', () => {
    it('returns empty errors for form with no elements', () => {
      const form = document.createElement('form');
      expect(collectValidationErrors(form)).toEqual({});
    });

    it('ignores non-validatable elements', () => {
      const form = document.createElement('form');
      const button = document.createElement('button');
      button.id = 'btn-id';
      form.appendChild(button);

      expect(collectValidationErrors(form)).toEqual({});
    });

    it('collects errors for invalid elements using id or name', () => {
      const form = document.createElement('form');

      // Valid input
      const inputValid = document.createElement('input');
      inputValid.id = 'input-valid';
      inputValid.required = true;
      inputValid.value = 'has value';
      form.appendChild(inputValid);

      // Invalid input with id
      const inputInvalidId = document.createElement('input');
      inputInvalidId.id = 'input-invalid-id';
      inputInvalidId.required = true;
      inputInvalidId.value = '';
      form.appendChild(inputInvalidId);

      // Invalid input with name (no id)
      const inputInvalidName = document.createElement('input');
      inputInvalidName.name = 'input-invalid-name';
      inputInvalidName.required = true;
      inputInvalidName.value = '';
      form.appendChild(inputInvalidName);

      // Invalid select
      const selectInvalid = document.createElement('select');
      selectInvalid.id = 'select-invalid';
      selectInvalid.required = true;
      selectInvalid.value = '';
      form.appendChild(selectInvalid);

      // Invalid textarea
      const textareaInvalid = document.createElement('textarea');
      textareaInvalid.id = 'textarea-invalid';
      textareaInvalid.required = true;
      textareaInvalid.value = '';
      form.appendChild(textareaInvalid);

      // Invalid input with no id/name (should be skipped)
      const inputNoIdName = document.createElement('input');
      inputNoIdName.required = true;
      inputNoIdName.value = '';
      form.appendChild(inputNoIdName);

      const errors = collectValidationErrors(form);
      expect(errors['input-invalid-id']).toBeDefined();
      expect(errors['input-invalid-name']).toBeDefined();
      expect(errors['select-invalid']).toBeDefined();
      expect(errors['textarea-invalid']).toBeDefined();
      expect(errors['input-valid']).toBeUndefined();
      expect(Object.keys(errors)).toHaveLength(4);
    });
  });

  describe('clearFieldError', () => {
    it('returns the same errors object if the key does not exist', () => {
      const errors = { a: 'error a' };
      const next = clearFieldError(errors, 'b');
      expect(next).toBe(errors);
    });

    it('returns a new errors object with the key removed if it exists', () => {
      const errors = { a: 'error a', b: 'error b' };
      const next = clearFieldError(errors, 'a');
      expect(next).not.toBe(errors);
      expect(next).toEqual({ b: 'error b' });
    });
  });
});
