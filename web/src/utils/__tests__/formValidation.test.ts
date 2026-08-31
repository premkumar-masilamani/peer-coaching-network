// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { collectValidationErrors, clearFieldError } from '../formValidation';

describe('formValidation', () => {
  it('collects validation errors from invalid inputs keyed by id/name', () => {
    const form = document.createElement('form');
    const input1 = document.createElement('input');
    input1.id = 'field1';
    input1.required = true;
    input1.value = '';

    const input2 = document.createElement('input');
    input2.name = 'field2';
    input2.type = 'email';
    input2.value = 'invalid-email';

    const input3 = document.createElement('input');
    input3.id = 'field3';
    input3.value = 'valid text';

    form.appendChild(input1);
    form.appendChild(input2);
    form.appendChild(input3);
    document.body.appendChild(form);

    const errors = collectValidationErrors(form);
    expect(errors).toHaveProperty('field1');
    expect(errors).toHaveProperty('field2');
    expect(errors).not.toHaveProperty('field3');

    document.body.removeChild(form);
  });

  it('clearFieldError returns modified copy when key exists, or same object if not', () => {
    const initial = { field1: 'Required', field2: 'Invalid' };
    const updated = clearFieldError(initial, 'field1');
    expect(updated).toEqual({ field2: 'Invalid' });

    const same = clearFieldError(initial, 'nonExistent');
    expect(same).toBe(initial);
  });
});
