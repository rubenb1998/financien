const gutter = 10;
const gap = 6;

export function positionDropdown(popup: HTMLElement, trigger: HTMLElement, align: 'start' | 'end') {
  const anchor = trigger.getBoundingClientRect();
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const width = viewport?.width ?? document.documentElement.clientWidth;
  const height = viewport?.height ?? document.documentElement.clientHeight;
  const right = left + width;
  const bottom = top + height;

  const popupWidth = Math.min(Math.max(anchor.width, 224), width - 2 * gutter);
  const start = align === 'end' ? anchor.right - popupWidth : anchor.left;
  popup.style.width = `${popupWidth}px`;
  popup.style.left = `${Math.max(left + gutter, Math.min(start, right - gutter - popupWidth))}px`;

  popup.style.maxHeight = '';
  const above = Math.max(0, anchor.top - gap - top - gutter);
  const below = Math.max(0, bottom - anchor.bottom - gap - gutter);
  const openAbove = below < popup.offsetHeight && above > below;
  popup.style.top = `${openAbove ? anchor.top - gap : anchor.bottom + gap}px`;
  popup.style.translate = openAbove ? '0 -100%' : '';
  popup.style.maxHeight = `min(${openAbove ? above : below}px, var(--dropdown-max-height))`;
  popup.dataset.positioned = '';
}
