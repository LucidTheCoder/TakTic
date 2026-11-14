import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useTakTic } from '../../store/TakTicProvider';
import { levelInfo } from '../../services/gamification/xp';

export function LevelUpOverlay() {
  const { levelUp, dismissLevelUp, state } = useTakTic();
  const level = levelUp ? levelInfo(state.profile.xp) : null;

  return (
    <AnimatePresence>
      {levelUp && level ? (
        <motion.div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-ivory/85 px-6 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Level ${levelUp} reached`}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md border border-line bg-paper px-8 py-10 text-center shadow-lift"
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-accent" aria-hidden />
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-[14px] border border-accent font-serif text-[26px] text-accent"
            >
              T
            </motion.span>
            <p className="eyebrow mt-5">Level reached</p>
            <p className="mt-2 font-mono text-[64px] leading-none tracking-[-0.04em] text-ink">
              {String(levelUp).padStart(2, '0')}
            </p>
            <p className="mt-3 font-serif text-[21px] text-ink">{level.title}</p>
            <p className="mx-auto mt-2 max-w-[280px] text-[14px] leading-6 text-muted">
              One step at a time. The next level needs {level.forNext} XP.
            </p>
            <div className="mt-7 flex items-center justify-center">
              <button
                type="button"
                onClick={dismissLevelUp}
                className="inline-flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.16em] text-accent"
              >
                Continue
                <ArrowRight size={13} aria-hidden />
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
