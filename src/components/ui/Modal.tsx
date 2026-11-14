import {
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from './Button';

type ModalWidth = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: ModalWidth;
  preventClose?: boolean;
  className?: string;
}

const widths: Record<ModalWidth, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  width = 'md',
  preventClose = false,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first =
      Array.from(focusable ?? []).find((element) => element.getAttribute('data-autofocus') === 'true') ??
      focusable?.[0];
    window.setTimeout(() => first?.focus(), 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (!preventClose) onClose();
        return;
      }
      if (event.key !== 'Tab' || !focusable || focusable.length === 0) return;
      const list = Array.from(focusable);
      const currentIndex = list.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey) {
        if (currentIndex <= 0) {
          event.preventDefault();
          list[list.length - 1].focus();
        }
      } else if (currentIndex === list.length - 1) {
        event.preventDefault();
        list[0].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [open, onClose, preventClose]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Close dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => {
              if (!preventClose) onClose();
            }}
            className="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[1px]"
            tabIndex={-1}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.16 } }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative flex max-h-[94dvh] w-full flex-col overflow-hidden border border-line bg-paper shadow-lift sm:max-h-[88vh]',
              'rounded-t-[18px] border-b-0 sm:rounded-[16px] sm:border-b',
              widths[width],
              className,
            )}
          >
            {title || eyebrow ? (
              <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                <div className="min-w-0">
                  {eyebrow ? (
                    <p className="eyebrow mb-2 flex items-center gap-2">
                      <span className="h-px w-4 bg-line" aria-hidden />
                      {eyebrow}
                    </p>
                  ) : null}
                  {title ? (
                    <h2 className="text-balance text-[23px] leading-snug text-ink sm:text-[26px]">
                      {title}
                    </h2>
                  ) : null}
                  {description ? (
                    <p className="mt-2 text-[14px] leading-6 text-muted">{description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="-mr-1 -mt-1 rounded-[8px] p-2 text-muted transition-colors hover:bg-surface2 hover:text-ink"
                  aria-label="Close dialog"
                >
                  <X size={18} aria-hidden />
                </button>
              </header>
            ) : null}
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:py-6">
              {children}
            </div>
            {footer ? (
              <footer className="flex flex-col gap-2 border-t border-line bg-paper px-6 py-4 [&>button]:w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:[&>button]:w-auto">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      eyebrow="Please confirm"
      preventClose={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      {description ? (
        <p className="text-[15px] leading-7 text-ink/85">{description}</p>
      ) : null}
      {children}
    </Modal>
  );
}
