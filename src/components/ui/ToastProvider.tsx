import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Info, Sparkles, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { uid } from '../../utils/id';

export type ToastTone = 'default' | 'success' | 'error' | 'xp';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
  action?: ToastAction;
}

interface ToastItem extends ToastInput {
  id: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, { border: string; icon: ReactNode }> = {
  default: {
    border: 'border-l-ink/30',
    icon: <Info size={15} className="text-muted" aria-hidden />,
  },
  success: {
    border: 'border-l-sage',
    icon: <Check size={15} className="text-sage" aria-hidden />,
  },
  error: {
    border: 'border-l-accent',
    icon: <AlertTriangle size={15} className="text-accent" aria-hidden />,
  },
  xp: {
    border: 'border-l-accent',
    icon: <Sparkles size={15} className="text-accent" aria-hidden />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = uid('toast');
      const item: ToastItem = {
        ...input,
        tone: input.tone ?? 'default',
        id,
      };
      setToasts((current) => [...current.slice(-4), item]);
      const duration = input.duration ?? 4600;
      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      currentTimers.forEach((timer) => window.clearTimeout(timer));
      currentTimers.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-24 right-4 z-[140] flex w-[min(calc(100vw-2rem),370px)] flex-col gap-2 sm:bottom-6 sm:right-6"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, transition: { duration: 0.18 } }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'pointer-events-auto border border-line border-l-2 bg-paper px-3.5 py-3 shadow-lift',
                toneStyles[item.tone].border,
              )}
              role="status"
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0">{toneStyles[item.tone].icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-5 text-ink">{item.title}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-[12px] leading-5 text-muted">{item.description}</p>
                  ) : null}
                  {item.action ? (
                    <button
                      type="button"
                      onClick={() => {
                        item.action?.onClick();
                        dismiss(item.id);
                      }}
                      className="mt-1.5 text-[12px] font-medium text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
                    >
                      {item.action.label}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="shrink-0 p-0.5 text-muted transition-colors hover:text-ink"
                  aria-label="Dismiss notification"
                >
                  <X size={13} aria-hidden />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }
  return context;
}
