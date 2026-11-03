import React, { Children, Fragment, cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./action-menu.css";

function actions(children) {
  return Children.toArray(children).flatMap(child => isValidElement(child) && child.type === Fragment ? actions(child.props.children) : [child]);
}

// Count only actions actually rendered for this row and role; retain single actions.
export default function ActionMenu({ children }) {
  const items = actions(children);
  const [open, setOpen] = useState(false), [position, setPosition] = useState(null);
  const trigger = useRef(null), panel = useRef(null), id = useId();
  function close(restore = false) { setOpen(false); if (restore) trigger.current?.focus(); }
  useLayoutEffect(() => {
    if (!open) return;
    const rect = trigger.current.getBoundingClientRect(), width = Math.min(240, window.innerWidth - 16);
    const height = panel.current?.offsetHeight || 0;
    const top = rect.bottom + 6 + height <= window.innerHeight - 8 ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
    setPosition({left:Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)), top, width});
    requestAnimationFrame(() => panel.current?.querySelector('button:not(:disabled), a[href]')?.focus({preventScroll:true}));
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) close(); };
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
      if (event.key === 'Tab') close();
      if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault();
        const buttons = [...panel.current.querySelectorAll('button:not(:disabled), a[href]')];
        const index = buttons.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    const scroll = event => {
      if (panel.current?.contains(event.target)) return;
      const rect = trigger.current.getBoundingClientRect(), width = Math.min(240, window.innerWidth - 16), height = panel.current?.offsetHeight || 0;
      if (rect.bottom < 0 || rect.top > window.innerHeight) { close(); return; }
      setPosition({left:Math.max(8,Math.min(rect.right-width,window.innerWidth-width-8)),top:rect.bottom+6+height<=window.innerHeight-8?rect.bottom+6:Math.max(8,rect.top-height-6),width});
    };
    document.addEventListener('pointerdown',outside); document.addEventListener('keydown',key);
    window.addEventListener('resize',outsideResize); window.addEventListener('scroll',scroll,true);
    function outsideResize() { close(); }
    return () => { document.removeEventListener('pointerdown',outside); document.removeEventListener('keydown',key); window.removeEventListener('resize',outsideResize); window.removeEventListener('scroll',scroll,true); };
  }, [open]);
  if (items.length <= 1) return <>{items}</>;
  return <><button type="button" ref={trigger} className="row-action-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={event => { event.stopPropagation(); setOpen(value => !value); }}>
    Thao tác <span aria-hidden="true">▾</span>
  </button>{open && createPortal(<div id={id} ref={panel} className="row-action-menu" role="menu" aria-label="Thao tác" style={{...position,visibility:position ? 'visible' : 'hidden'}}>
    {items.map((item,index) => isValidElement(item) ? cloneElement(item, {key:item.key || index, role:'menuitem', onClick:event => {close(); item.props.onClick?.(event);}}) : item)}
  </div>,document.body)}</>;
}
