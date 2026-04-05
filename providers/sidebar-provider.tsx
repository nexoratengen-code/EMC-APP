import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback } from 'react';

export interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

export const [SidebarProvider, useSidebar] = createContextHook<SidebarState>(() => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, toggle, open, close };
});
