// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { installAppInteractionPolicy, isEditableTarget, restrictAppCopy } from './appInteractionPolicy';

describe('phone-only app.ceyo.si copy preference', () => {
  it('restricts the requested host at phone widths, case insensitively', () => {
    expect(restrictAppCopy('app.Ceyo.si', 434)).toBe(true);
    expect(restrictAppCopy('app.ceyo.si', 860)).toBe(true);
  });
  it('keeps desktop copying available', () => expect(restrictAppCopy('app.ceyo.si', 1280)).toBe(false));
  it('does not restrict any other version', () => {
    for (const host of ['web.ceyo.si', 'ceyo.si', 'localhost:8080', 'app.ceyo.si.attacker.test', 'www.app.ceyo.si']) {
      expect(restrictAppCopy(host, 434)).toBe(false);
    }
  });
  it('allows only editable input areas', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'plaintext-only');
    const child = document.createElement('span');
    editor.append(child);
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(child)).toBe(true);
    input.readOnly = true;
    textarea.disabled = true;
    expect(isEditableTarget(input)).toBe(false);
    expect(isEditableTarget(textarea)).toBe(false);
    expect(isEditableTarget(document.createElement('p'))).toBe(false);
  });
  it('does not intercept clipboard events on other hosts', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ addEventListener() {}, removeEventListener() {} }) });
    const cleanup = installAppInteractionPolicy();
    const event = new Event('copy', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    cleanup();
    expect(document.documentElement.hasAttribute('data-app-copy-restricted')).toBe(false);
  });
});