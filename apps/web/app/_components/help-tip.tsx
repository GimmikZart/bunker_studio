'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/**
 * Contextual help for a field whose name assumes knowledge the reader may not
 * have.
 *
 * It is a disclosure, not a hover tooltip: hover-only help is unreachable by
 * keyboard and on touch, and it hides text people need in order to answer the
 * question in front of them. The trigger is a real button, the panel is linked
 * to it, and Escape or a click elsewhere closes it.
 */
export function HelpTip({ term, children }: { term: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Fields near the right edge would otherwise push the panel off screen.
  const [alignEnd, setAlignEnd] = useState(false);
  const panelId = useId();
  const container = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const rect = panel.current.getBoundingClientRect();
    setAlignEnd(rect.right > document.documentElement.clientWidth - 8);
  }, [open]);

  return (
    <span className="help-tip" ref={container}>
      <button
        type="button"
        className="help-tip-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        // The term is in the name so a screen reader announces which field the
        // help belongs to, not a row of identical "help" buttons.
        aria-label={open ? `Hide help for ${term}` : `What is ${term}?`}
        onClick={() => setOpen((current) => !current)}
      >
        ?
      </button>
      {open && (
        <span
          className={`help-tip-panel${alignEnd ? ' align-end' : ''}`}
          id={panelId}
          ref={panel}
          role="note"
        >
          {children}
        </span>
      )}
    </span>
  );
}

/**
 * A field label with its help attached, so a technical field cannot be added
 * without a plain-language explanation sitting next to it.
 */
export function FieldLabel({
  htmlFor,
  children,
  help,
}: {
  htmlFor: string;
  children: React.ReactNode;
  help?: React.ReactNode;
}) {
  const term = typeof children === 'string' ? children : htmlFor;
  return (
    <span className="field-label">
      <label htmlFor={htmlFor}>{children}</label>
      {help && <HelpTip term={term}>{help}</HelpTip>}
    </span>
  );
}
