import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface DropdownItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  hint?: string;
}

interface DropdownProps {
  items: DropdownItem[];
  label?: string;
  trigger?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({
  items,
  label = 'Open menu',
  trigger,
  align = 'right',
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex h-7 w-7 items-center justify-center text-muted transition-colors hover:bg-surface2 hover:text-ink"
      >
        {trigger ?? <MoreHorizontal size={16} aria-hidden />}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={menuId}
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -2, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16 }}
            className={cn(
              'scroll-thin absolute z-40 mt-1 max-h-[320px] min-w-[200px] overflow-y-auto border border-line bg-paper p-1 shadow-lift',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={`${item.label}-${index}`}>
                  {item.separatorBefore ? (
                    <div className="my-1 h-px bg-line" aria-hidden />
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (item.disabled) return;
                      setOpen(false);
                      item.onSelect();
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[12.5px] transition-colors disabled:opacity-40',
                      item.danger
                        ? 'text-accent hover:bg-accent-soft'
                        : 'text-ink/85 hover:bg-surface2 hover:text-ink',
                    )}
                  >
                    {Icon ? <Icon size={14} className="shrink-0 opacity-70" aria-hidden /> : null}
                    <span className="flex-1">{item.label}</span>
                    {item.hint ? (
                      <span className="font-mono text-[9px] text-muted">{item.hint}</span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
