/** Interaction preference, not a data-security boundary. */
export function restrictAppCopy(host: string, width: number): boolean {
  return host.toLowerCase().replace(/:\d+$/, "") === "app.ceyo.si" && width <= 860;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const field = target.closest('input, textarea, [contenteditable]');
  if (!field) return false;
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return !field.disabled && !field.readOnly;
  }
  return field.getAttribute('contenteditable') !== 'false';
}

export function appCopyRestricted(): boolean {
  return typeof window !== 'undefined' && restrictAppCopy(window.location.host, window.innerWidth);
}

export function installAppInteractionPolicy(): () => void {
  const media = window.matchMedia('(max-width: 860px)');
  const update = () => {
    document.documentElement.toggleAttribute('data-app-copy-restricted', appCopyRestricted());
  };
  const prevent = (event: Event) => {
    if (appCopyRestricted() && !isEditableTarget(event.target)) event.preventDefault();
  };
  const events = ['copy', 'cut', 'contextmenu', 'selectstart'] as const;
  update();
  media.addEventListener('change', update);
  events.forEach((name) => document.addEventListener(name, prevent, true));
  return () => {
    media.removeEventListener('change', update);
    events.forEach((name) => document.removeEventListener(name, prevent, true));
    document.documentElement.removeAttribute('data-app-copy-restricted');
  };
}