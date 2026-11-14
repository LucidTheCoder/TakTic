import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Sparkles, Trophy } from 'lucide-react';
import { useTakTic } from '../store/TakTicProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { AchievementIcon } from '../components/gamification/AchievementIcon';
import { TakTicMark } from '../components/brand/TakTicLogo';
import { ProgressBar } from '../components/ui/Feedback';
import { ACHIEVEMENTS } from '../services/gamification/achievements';
import { formatDateKey } from '../utils/date';

export function AchievementsPage() {
  const { state, stats } = useTakTic();

  const entries = useMemo(
    () =>
      ACHIEVEMENTS.map((definition) => {
        const unlock = state.achievements.find((item) => item.id === definition.id);
        const progress = definition.progress(state);
        return {
          definition,
          unlock,
          progress,
          ratio: progress.target === 0 ? 0 : Math.min(1, progress.current / progress.target),
        };
      }),
    [state],
  );

  const unlocked = entries
    .filter((entry) => entry.unlock)
    .sort((a, b) => (b.unlock?.unlockedAt ?? '').localeCompare(a.unlock?.unlockedAt ?? ''));
  const locked = entries
    .filter((entry) => !entry.unlock)
    .sort((a, b) => b.ratio - a.ratio);
  const achievementXp = unlocked.reduce((sum, entry) => sum + entry.definition.xpReward, 0);
  const next = locked[0] ?? null;

  return (
    <div>
      <PageHeader
        index="08"
        jp=""
        title="Achievements"
        description="Marks of real progress. Unlocks happen once, are never removed, and carry XP through the transaction ledger."
        actions={
          <Link
            to="/statistics"
            className="inline-flex items-center gap-1.5 border border-line px-3 py-2 text-[13px] text-muted hover:text-ink"
          >
            Statistics
            <ArrowRight size={12} aria-hidden />
          </Link>
        }
      />

      <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
        <div className="bg-paper px-4 py-4">
          <p className="eyebrow mb-1.5">Collected</p>
          <p className="font-mono text-[24px] leading-none text-ink">
            {unlocked.length}
            <span className="ml-1 text-[13px] text-muted">/ {ACHIEVEMENTS.length}</span>
          </p>
        </div>
        <div className="bg-paper px-4 py-4">
          <p className="eyebrow mb-1.5">XP from achievements</p>
          <p className="font-mono text-[24px] leading-none text-ink">{achievementXp}</p>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
            of {stats.xp} XP total
          </p>
        </div>
        <div className="bg-paper px-4 py-4">
          <p className="eyebrow mb-1.5">Closest next</p>
          <p className="truncate text-[15px] text-ink">{next ? next.definition.name : 'Everything unlocked'}</p>
          {next ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              {Math.min(next.progress.current, next.progress.target)} / {next.progress.target}
            </p>
          ) : null}
        </div>
      </div>

      {unlocked.length === 0 ? (
        <div className="mt-5 flex flex-col gap-4 border border-line bg-paper px-5 py-6 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center">
            <TakTicMark className="h-12 w-12" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">The first mark</p>
            <h2 className="mt-0.5 text-[19px]">Your collection is just getting started.</h2>
            <p className="mt-1 text-[13px] leading-5 text-muted">
              Complete one task or one focus session. The first achievement is designed to be
              reachable today.
            </p>
          </div>
          <Link
            to="/tasks"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 border border-accent bg-accent px-4 text-[13px] text-paper"
          >
            Find a first step
          </Link>
        </div>
      ) : null}

      {next ? (
        <section className="mt-5 border border-line bg-paper p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center border border-line text-accent">
              <AchievementIcon name={next.definition.icon} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">In progress</p>
              <p className="text-[14px] text-ink">
                {next.definition.name} — {next.definition.description}
              </p>
              <ProgressBar value={next.ratio * 100} height="sm" className="mt-2 max-w-sm" label="Achievement progress" />
            </div>
            <span className="font-mono text-[12px] text-muted">
              {Math.min(next.progress.current, next.progress.target)} / {next.progress.target}
            </span>
            <span className="font-mono text-[11px] text-accent">+{next.definition.xpReward} XP</span>
          </div>
        </section>
      ) : null}

      <section className="mt-7">
        <div className="mb-3 flex items-center gap-3">
          <p className="eyebrow">Unlocked</p>
          <span className="h-px flex-1 bg-line" aria-hidden />
          <span className="font-mono text-[11px] text-muted">{unlocked.length}</span>
        </div>
        {unlocked.length === 0 ? (
          <p className="border border-dashed border-line px-4 py-4 text-[13px] text-muted">
            Nothing unlocked yet. The grid below shows exactly what each mark requires.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {unlocked.map(({ definition, unlock }) => (
              <article
                key={definition.id}
                id={definition.id}
                className="scroll-mt-24 border border-line bg-paper p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center border border-accent/40 bg-accent-soft/40 text-accent">
                    <AchievementIcon name={definition.icon} size={18} />
                  </span>
                  <span className="inline-flex items-center gap-1 border border-sage/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-sage">
                    <Trophy size={8} aria-hidden /> unlocked
                  </span>
                </div>
                <h3 className="mt-3 text-[15px] leading-snug text-ink">{definition.name}</h3>
                <p className="mt-1 text-[13px] leading-5 text-muted">{definition.description}</p>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                  <span>
                    {unlock
                      ? formatDateKey(unlock.unlockedAt.slice(0, 10), {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : ''}
                  </span>
                  <span className="text-accent">+{definition.xpReward} XP</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center gap-3">
          <p className="eyebrow">Locked</p>
          <span className="h-px flex-1 bg-line" aria-hidden />
          <span className="font-mono text-[11px] text-muted">{locked.length}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {locked.map(({ definition, progress, ratio }) => (
            <article
              key={definition.id}
              id={definition.id}
              className="scroll-mt-24 border border-dashed border-line bg-paper/50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center border border-line text-muted">
                  <AchievementIcon name={definition.icon} size={18} />
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  <Lock size={8} aria-hidden /> locked
                </span>
              </div>
              <h3 className="mt-3 text-[15px] leading-snug text-ink/75">{definition.name}</h3>
              <p className="mt-1 text-[13px] leading-5 text-muted">{definition.description}</p>
              <div className="mt-3 border-t border-line pt-2">
                <div className="flex items-center gap-2">
                  <ProgressBar value={ratio * 100} height="sm" label="Achievement progress" />
                  <span className="shrink-0 font-mono text-[10px] text-muted">
                    {Math.min(progress.current, progress.target)}/{progress.target}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                  +{definition.xpReward} XP when earned
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-6 flex items-start gap-2 border-t border-line pt-4 text-[12px] leading-5 text-muted">
        <Sparkles size={12} className="mt-1 shrink-0 text-accent" aria-hidden />
        Achievements are evaluated by application logic from real events. The AI companion cannot
        award XP, unlock a mark, or edit progress. Reopening a completed task never removes an
        unlock.
      </p>
    </div>
  );
}
