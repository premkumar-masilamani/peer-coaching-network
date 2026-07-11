/**
 * Helpers for the stylized, native-popup-free form validation used across the
 * app's forms (story 102).
 *
 * Instead of relying on the browser's default validation tooltips (which are
 * unstyled and clash with the app's dark-mode aesthetic), forms opt out with
 * the `noValidate` attribute and drive validation manually via
 * `form.checkValidity()`. When a field is invalid we surface its localized
 * `validationMessage` inline below the input.
 */

/** Map of form-control identifier -> localized validation message. */
export type FormErrors = Record<string, string>;

type ValidatableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isValidatable(el: Element): el is ValidatableElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  );
}

/**
 * Walk a form's controls and collect the localized validation message for each
 * invalid field, keyed by the field's `id` (falling back to `name`). Fields
 * without either identifier are skipped since there is nothing to anchor the
 * inline message to.
 */
export function collectValidationErrors(form: HTMLFormElement): FormErrors {
  const errors: FormErrors = {};
  for (const el of Array.from(form.elements)) {
    if (!isValidatable(el)) continue;
    if (el.validity.valid) continue;
    const key = el.id || el.name;
    if (key) errors[key] = el.validationMessage;
  }
  return errors;
}

/**
 * Return a copy of `errors` with the entry for `key` removed. Used by
 * `onChange` handlers to clear a field's error as soon as the user edits it.
 * Returns the same reference when there is nothing to clear so callers can
 * avoid needless re-renders.
 */
export function clearFieldError(errors: FormErrors, key: string): FormErrors {
  if (!errors[key]) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}
