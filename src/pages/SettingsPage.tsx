import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  RotateCcw,
  Trash2,
  Upload,
  UserRound,
  Volume2,
} from 'lucide-react';
import { useTakTic } from '../store/TakTicProvider';
import { useToast } from '../components/ui/ToastProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Field, Input, Select, Toggle } from '../components/ui/Form';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { Segmented } from '../components/ui/Tabs';
import { InlineNote } from '../components/ui/Feedback';
import {
  SCHEMA_VERSION,
  exportPayload,
  parseImport,
} from '../services/storage/storage';
import {
  browserNotificationsSupported,
  notificationPermission,
  requestNotificationPermission,
} from '../services/notifications';
import {
  describeAiError,
  managedAiEnabled,
  testOpenRouterConnection,
} from '../services/ai/client';
import { DEFAULT_AI_MODEL } from '../services/ai/models';
import { playChime, unlockAudio } from '../services/audio';
import { defaultSettings } from '../services/gamification/xp';
import type {
  AccentName,
  AppSettings,
  NotificationSettings,
  TakTicState,
} from '../types';
import { formatDateKey, todayKey } from '../utils/date';
import { cn } from '../utils/cn';

const SECTIONS = [
  { id: 'appearance', index: '01', label: 'Appearance' },
  { id: 'focus', index: '02', label: 'Focus' },
  { id: 'ai', index: '03', label: 'AI connection' },
  { id: 'profile', index: '04', label: 'Profile' },
  { id: 'notifications', index: '05', label: 'Notifications' },
  { id: 'shortcuts', index: '06', label: 'Shortcuts' },
  { id: 'data', index: '07', label: 'Data & demo' },
];

const ACCENTS: Array<{ value: AccentName; label: string; hex: string }> = [
  { value: 'vermilion', label: 'Vermilion', hex: '#B94B3A' },
  { value: 'indigo', label: 'Indigo', hex: '#41556F' },
  { value: 'matcha', label: 'Matcha', hex: '#5F7355' },
  { value: 'ochre', label: 'Ochre', hex: '#A4772F' },
];

const AVATARS = ['', 'T', 'S', 'A', 'M'];

export function SettingsPage() {
  const {
    state,
    dispatch,
    captureSnapshot,
    offerUndo,
  } = useTakTic();
  const { toast } = useToast();
  const settings = state.settings;
  const managedAi = managedAiEnabled();

  const [nameDraft, setNameDraft] = useState(state.profile.displayName);
  const [nameError, setNameError] = useState('');
  const [apiKeyDraft, setApiKeyDraft] = useState(settings.ai.apiKey);
  const [modelDraft, setModelDraft] = useState(settings.ai.model);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [permission, setPermission] = useState(notificationPermission());
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [importName, setImportName] = useState('');
  const [pendingImport, setPendingImport] = useState<TakTicState | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [demoDialog, setDemoDialog] = useState<'load' | 'remove' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameDraft(state.profile.displayName);
  }, [state.profile.displayName]);

  useEffect(() => {
    setApiKeyDraft(settings.ai.apiKey);
  }, [settings.ai.apiKey]);

  useEffect(() => {
    setModelDraft(settings.ai.model);
  }, [settings.ai.model]);

  const updateFocus = (patch: Partial<AppSettings['focus']>) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      patch: { focus: { ...settings.focus, ...patch } },
    });
  };

  const updateNotifications = (patch: Partial<NotificationSettings>) => {
    dispatch({
      type: 'UPDATE_SETTINGS',
      patch: { notifications: { ...settings.notifications, ...patch } },
    });
  };

  const updateAi = (patch: Partial<AppSettings['ai']>) => {
    dispatch({ type: 'UPDATE_SETTINGS', patch: { ai: { ...settings.ai, ...patch } } });
  };

  const saveConnection = () => {
    if (!modelDraft.trim()) return;
    updateAi({ apiKey: apiKeyDraft.trim(), model: modelDraft.trim() });
    toast({ title: 'AI connection saved locally', tone: 'success' });
  };

  const removeKey = () => {
    updateAi({ apiKey: '' });
    setApiKeyDraft('');
    setTestResult(null);
    toast({ title: 'OpenRouter key removed', tone: 'default' });
  };

  const testConnection = async () => {
    if (!managedAi && !apiKeyDraft.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const message = await testOpenRouterConnection({
        apiKey: managedAi ? '' : apiKeyDraft.trim(),
        model: managedAi ? DEFAULT_AI_MODEL : modelDraft.trim(),
      });
      setTestResult({ tone: 'success', message });
    } catch (error) {
      setTestResult({ tone: 'error', message: describeAiError(error) });
    } finally {
      setTesting(false);
    }
  };

  const toggleBrowserNotifications = async (next: boolean) => {
    if (!next) {
      updateNotifications({ browser: false });
      return;
    }
    if (!browserNotificationsSupported()) {
      toast({
        title: 'Browser notifications are unavailable',
        description: 'This browser does not expose the Notification API.',
        tone: 'error',
      });
      return;
    }
    setPermissionBusy(true);
    const result = await requestNotificationPermission();
    setPermission(result);
    setPermissionBusy(false);
    if (result === 'granted') {
      updateNotifications({ browser: true });
      toast({ title: 'Browser notifications enabled', tone: 'success' });
    } else {
      updateNotifications({ browser: false });
      toast({
        title: 'Browser permission not granted',
        description:
          result === 'denied'
            ? 'You can allow notifications later from the browser’s site settings. In-app notifications still work.'
            : 'Permission was dismissed. In-app notifications still work.',
        tone: 'error',
        duration: 7000,
      });
    }
  };

  const exportData = () => {
    try {
      const blob = new Blob([exportPayload(state)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `taktic-backup-${todayKey()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast({
        title: 'Backup exported',
        description: 'The JSON file contains projects, tasks, sessions, XP and settings.',
        tone: 'success',
      });
    } catch {
      toast({
        title: 'Could not export',
        description: 'The browser blocked the download. Try again.',
        tone: 'error',
      });
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError('');
    setImportName(file.name);
    if (file.size > 5_000_000) {
      setImportError('That file is larger than 5 MB and is unlikely to be a TakTic backup.');
      return;
    }
    try {
      const text = await file.text();
      const result = parseImport(text);
      if (!result.ok) {
        setImportError(result.error);
        toast({ title: 'Import rejected', description: result.error, tone: 'error' });
        return;
      }
      setPendingImport(result.state);
      setImportOpen(true);
    } catch {
      setImportError('The file could not be read. Try exporting a fresh backup.');
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    const snapshot = captureSnapshot();
    dispatch({ type: 'IMPORT_STATE', state: pendingImport });
    setImportOpen(false);
    setPendingImport(null);
    setImportName('');
    offerUndo('Imported backup', snapshot, 'Your previous workspace can be restored.');
    toast({ title: 'Backup imported', tone: 'success' });
  };

  const handleReset = () => {
    if (resetPhrase !== 'RESET') return;
    const snapshot = captureSnapshot();
    dispatch({ type: 'RESET' });
    setResetOpen(false);
    setResetPhrase('');
    offerUndo('Workspace reset', snapshot, 'The previous workspace can still be restored.');
    toast({ title: 'Workspace reset', tone: 'default' });
  };

  const handleDemo = () => {
    if (!demoDialog) return;
    const snapshot = captureSnapshot();
    dispatch({ type: demoDialog === 'load' ? 'LOAD_DEMO' : 'REMOVE_DEMO' });
    setDemoDialog(null);
    if (demoDialog === 'load') {
      offerUndo('Demo workspace loaded', snapshot, 'Your previous workspace can be restored.');
      toast({ title: 'Demo workspace loaded', tone: 'success' });
    } else {
      offerUndo('Demo content removed', snapshot, 'Removing demo content can be undone.');
      toast({ title: 'Demo content removed', tone: 'default' });
    }
  };

  const restoreDashboard = () => {
    const defaults = defaultSettings().dashboard;
    dispatch({
      type: 'UPDATE_SETTINGS',
      patch: { dashboard: { order: defaults.order, hidden: defaults.hidden, customized: false } },
    });
    toast({ title: 'Dashboard layout restored', tone: 'success' });
  };

  const aiDirty =
    apiKeyDraft.trim() !== settings.ai.apiKey || modelDraft.trim() !== settings.ai.model;
  const hiddenWidgets = settings.dashboard.hidden.length;
  const storageKb = (JSON.stringify(state).length / 1024).toFixed(1);
  const demoOn = state.demoLoaded;

  return (
    <div>
      <PageHeader
        index="09"
        jp=""
        title="Settings"
        description="Adjust the workspace to fit you. Everything is stored locally in this browser; nothing is sent anywhere except the AI requests you explicitly make."
      />

      <div className="grid gap-7 lg:grid-cols-[178px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="h-fit lg:sticky lg:top-8">
          <p className="eyebrow mb-2 hidden lg:block">Contents</p>
          <div className="flex gap-1 overflow-x-auto border-b border-line pb-2 lg:flex-col lg:border-b-0 lg:pb-0">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="group flex shrink-0 items-baseline gap-2 px-2 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface2 hover:text-ink lg:px-2.5"
              >
                <span className="font-mono text-[10px] tracking-[0.12em] text-muted/70 group-hover:text-accent">
                  {section.index}
                </span>
                {section.label}
              </a>
            ))}
          </div>
          <p className="mt-3 hidden border-t border-line pt-3 font-mono text-[10px] uppercase leading-4 tracking-[0.1em] text-muted lg:block">
            Schema v{SCHEMA_VERSION}
            <br />
            {storageKb} KB stored
          </p>
        </nav>

        <div className="min-w-0 space-y-5">
          <SettingsSection
            id="appearance"
            index="01"
            jp=""
            title="Appearance"
            description="The Japanese editorial light theme is the default. Dark mode keeps the same paper logic rather than inverting to neon."
          >
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink/80">Theme</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <ThemeCard
                  label="Light"
                  note="Warm ivory paper"
                  active={state.profile.preferences.theme === 'light'}
                  onClick={() =>
                    dispatch({ type: 'UPDATE_PREFERENCES', patch: { theme: 'light' } })
                  }
                  swatches={['#F5F1E8', '#FCFAF5', '#B94B3A', '#292B29']}
                />
                <ThemeCard
                  label="Dark"
                  note="Charcoal reading room"
                  active={state.profile.preferences.theme === 'dark'}
                  onClick={() =>
                    dispatch({ type: 'UPDATE_PREFERENCES', patch: { theme: 'dark' } })
                  }
                  swatches={['#232522', '#2C2E2A', '#C96A56', '#E8E2D4']}
                />
              </div>
            </div>

            <div className="border-t border-line pt-4">
              <p className="mb-2 text-[13px] font-medium text-ink/80">Accent colour</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ACCENTS.map((accent) => {
                  const active = state.profile.preferences.accent === accent.value;
                  return (
                    <button
                      key={accent.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        dispatch({
                          type: 'UPDATE_PREFERENCES',
                          patch: { accent: accent.value, accentChanged: true },
                        })
                      }
                      className={cn(
                        'flex items-center gap-2 border px-2.5 py-2 text-left transition-colors',
                        active
                          ? 'border-ink/40 bg-surface2'
                          : 'border-line hover:border-ink/25 hover:bg-surface2',
                      )}
                    >
                      <span
                        className="h-5 w-5 shrink-0 border border-ink/10"
                        style={{ backgroundColor: accent.hex }}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] text-ink">{accent.label}</span>
                        <span className="block font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
                          {accent.hex}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-line pt-2">
              <Toggle
                checked={state.profile.preferences.reducedMotion}
                onChange={(checked) =>
                  dispatch({
                    type: 'UPDATE_PREFERENCES',
                    patch: { reducedMotion: checked },
                  })
                }
                label="Reduce motion"
                description="Turns off celebration, page and progress animations. The system setting is respected by default."
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <div>
                <p className="text-[13px] font-medium text-ink/80">Dashboard layout</p>
                <p className="mt-0.5 text-[13px] leading-5 text-muted">
                  {hiddenWidgets > 0
                    ? `${hiddenWidgets} widget${hiddenWidgets === 1 ? '' : 's'} hidden.`
                    : 'All widgets are visible.'}{' '}
                  Reordering and visibility live on the dashboard itself.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/"
                  className="inline-flex h-8 items-center gap-1.5 border border-line bg-paper px-3 text-[13px] text-ink hover:border-ink/30"
                >
                  <LayoutDashboard size={13} aria-hidden /> Open dashboard
                </Link>
                <Button size="sm" variant="ghost" onClick={restoreDashboard}>
                  <RotateCcw size={12} aria-hidden /> Restore default
                </Button>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            id="focus"
            index="02"
            jp=""
            title="Focus room"
            description="Default session lengths and ambient sound. Changes apply to the next session; a running timer is never altered mid-session."
          >
            {state.activeSession ? (
              <InlineNote tone="accent">
                A session is currently {state.activeSession.status}. Its length stays fixed until
                it ends.
              </InlineNote>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <NumberSetting
                id="focus-minutes"
                label="Focus"
                value={settings.focus.focusMinutes}
                min={5}
                max={120}
                step={5}
                suffix="min"
                onChange={(value) => updateFocus({ focusMinutes: value })}
              />
              <NumberSetting
                id="short-break"
                label="Short break"
                value={settings.focus.shortBreakMinutes}
                min={1}
                max={30}
                suffix="min"
                onChange={(value) => updateFocus({ shortBreakMinutes: value })}
              />
              <NumberSetting
                id="long-break"
                label="Long break"
                value={settings.focus.longBreakMinutes}
                min={5}
                max={60}
                step={5}
                suffix="min"
                onChange={(value) => updateFocus({ longBreakMinutes: value })}
              />
              <NumberSetting
                id="long-break-after"
                label="Long break after"
                value={settings.focus.sessionsBeforeLongBreak}
                min={1}
                max={8}
                suffix="sessions"
                onChange={(value) => updateFocus({ sessionsBeforeLongBreak: value })}
              />
            </div>

            <div className="grid gap-4 border-t border-line pt-3 sm:grid-cols-2">
              <Field label="Ambient sound" htmlFor="ambient" hint="Synthesised locally; no audio files are downloaded.">
                <Select
                  id="ambient"
                  value={settings.focus.ambient}
                  onChange={(event) =>
                    updateFocus({
                      ambient: event.target.value as AppSettings['focus']['ambient'],
                    })
                  }
                >
                  <option value="silent">Silent</option>
                  <option value="brown">Brown noise</option>
                  <option value="rain">Soft rain</option>
                </Select>
              </Field>
              <div className="sm:pt-5">
                <Toggle
                  checked={settings.focus.sound}
                  onChange={(checked) => updateFocus({ sound: checked })}
                  label="Sound effects"
                  description="Quiet tones for starting, finishing and completing tasks."
                />
                <div className="mt-3 border border-line bg-ivory/50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="sound-volume" className="text-[13px] text-ink">
                      Volume
                    </label>
                    <span className="font-mono text-[12px] text-muted">
                      {Math.round(settings.focus.soundVolume * 100)}%
                    </span>
                  </div>
                  <input
                    id="sound-volume"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(settings.focus.soundVolume * 100)}
                    onChange={(event) => {
                      unlockAudio();
                      updateFocus({ soundVolume: Number(event.target.value) / 100 });
                    }}
                    className="mt-2 h-2 w-full cursor-pointer accent-[rgb(var(--accent))]"
                    aria-label="Sound volume"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() => {
                      unlockAudio();
                      playChime('test', settings.focus.soundVolume);
                    }}
                  >
                    <Volume2 size={12} aria-hidden /> Test sound
                  </Button>
                </div>
                <Toggle
                  checked={settings.focus.autoStartBreaks}
                  onChange={(checked) => updateFocus({ autoStartBreaks: checked })}
                  label="Start breaks automatically"
                  description="Breaks begin as soon as a focus session finishes."
                />
              </div>
            </div>

            <div className="border-t border-line pt-3">
              <Toggle
                checked={settings.focus.distractionFree}
                onChange={(checked) => updateFocus({ distractionFree: checked })}
                label="Prefer distraction-free mode"
                description="Opens the focus room in its quiet layout by default. You can still leave it at any time."
              />
            </div>

            <div className="border-t border-line pt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  updateFocus(defaultSettings().focus);
                  toast({ title: 'Focus settings restored', tone: 'success' });
                }}
              >
                <RotateCcw size={12} aria-hidden /> Restore focus defaults
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection
            id="ai"
            index="03"
            jp=""
            title="AI connection"
            description={
              managedAi
                ? 'AI is provided by this deployment through a server-side OpenRouter key. Visitors never need their own key, and every request uses zero-cost free models.'
                : 'TakTic uses OpenRouter for AI features. The key is stored in this browser only. Manual tasks, focus sessions and statistics work without it.'
            }
          >
            {managedAi ? (
              <div className="border border-line bg-surface2/40 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                  <Lock size={13} className="text-accent" aria-hidden /> AI is provided by this
                  deployment
                </p>
                <p className="mt-1 text-[13px] leading-5 text-ink/75">
                  The owner’s OpenRouter key stays in the server function and is never sent to
                  visitors. Every AI request uses zero-cost free models with automatic fallbacks.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={testConnection}
                    disabled={testing}
                  >
                    {testing ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
                    {testing ? 'Testing…' : 'Test deployment connection'}
                  </Button>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                    Server-side key · free models
                  </span>
                </div>
              </div>
            ) : null}

            {!managedAi ? (
              <>
            <div className="border-l-2 border-accent/70 bg-accent-soft/30 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <KeyRound size={13} className="text-accent" aria-hidden /> Browser-side keys are for a
                local prototype
              </p>
              <p className="mt-1 text-[13px] leading-5 text-ink/75">
                A key saved in LocalStorage is readable by anyone with access to this browser. For a
                deployed version, send AI requests through a small server or Worker and keep the key
                out of the browser. Never commit a key to source control.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="OpenRouter API key"
                htmlFor="openrouter-key"
                hint="Stored with your local workspace. Not included in AI prompts."
              >
                <div className="relative">
                  <Input
                    id="openrouter-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyDraft}
                    onChange={(event) => setApiKeyDraft(event.target.value)}
                    placeholder="sk-or-v1-…"
                    autoComplete="off"
                    spellCheck={false}
                    className="pr-10 font-mono text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((current) => !current)}
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink"
                  >
                    {showKey ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
                  </button>
                </div>
              </Field>
              <Field
                label="Model"
                htmlFor="openrouter-model"
                hint="Defaults to a fast zero-cost model, with other free models as fallbacks."
              >
                <Input
                  id="openrouter-model"
                  value={modelDraft}
                  onChange={(event) => setModelDraft(event.target.value)}
                  placeholder={DEFAULT_AI_MODEL}
                  spellCheck={false}
                  className="font-mono text-[13px]"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModelDraft(DEFAULT_AI_MODEL)}
                title={DEFAULT_AI_MODEL}
                className={cn(
                  'border px-2 py-1 font-mono text-[11px] transition-colors',
                  modelDraft === DEFAULT_AI_MODEL
                    ? 'border-accent/50 bg-accent-soft/40 text-accent'
                    : 'border-line text-muted hover:border-ink/25 hover:text-ink',
                )}
              >
                Free default
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                Zero cost · free fallbacks · no reasoning overhead
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Button
                variant="primary"
                size="sm"
                onClick={saveConnection}
                disabled={!aiDirty || !modelDraft.trim()}
              >
                Save connection
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={testConnection}
                disabled={testing || !apiKeyDraft.trim()}
              >
                {testing ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
                {testing ? 'Testing…' : 'Test connection'}
              </Button>
              {settings.ai.apiKey ? (
                <Button variant="danger" size="sm" onClick={removeKey}>
                  <Trash2 size={12} aria-hidden /> Remove key
                </Button>
              ) : null}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer noopener"
                className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted underline decoration-line underline-offset-2 hover:text-ink"
              >
                OpenRouter keys <ExternalLink size={10} aria-hidden />
              </a>
            </div>
              </>
            ) : null}

            {testResult ? (
              <InlineNote tone={testResult.tone === 'success' ? 'sage' : 'accent'}>
                {testResult.message}
              </InlineNote>
            ) : (
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                {managedAi
                  ? 'Server-managed key · AI features available to every visitor'
                  : settings.ai.apiKey
                    ? 'A key is saved · AI features available'
                    : 'No key saved · AI features show a setup note, manual features continue'}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <div>
                <p className="text-[13px] font-medium text-ink/80">Companion style</p>
                <p className="mt-0.5 text-[12px] leading-5 text-muted">
                  Changes tone only. It never changes the data the companion is allowed to see.
                </p>
              </div>
              <Segmented
                items={[
                  { value: 'concise', label: 'Concise' },
                  { value: 'warm', label: 'Warm' },
                  { value: 'direct', label: 'Direct' },
                ]}
                value={settings.ai.companionStyle}
                onChange={(value) =>
                  updateAi({ companionStyle: value as AppSettings['ai']['companionStyle'] })
                }
              />
            </div>
          </SettingsSection>

          <SettingsSection
            id="profile"
            index="04"
            jp=""
            title="Profile"
            description="The name and mark used in the sidebar and greetings. No account exists; this profile lives only in this browser."
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-line bg-surface2 font-serif text-[27px] text-ink">
                {state.profile.avatar || initials(state.profile.displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <Field
                  label="Display name"
                  htmlFor="display-name"
                  error={nameError || undefined}
                  hint="Between 1 and 40 characters."
                >
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="display-name"
                      value={nameDraft}
                      maxLength={40}
                      onChange={(event) => {
                        setNameDraft(event.target.value);
                        if (nameError) setNameError('');
                      }}
                      className="min-w-[180px] flex-1"
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!nameDraft.trim() || nameDraft.trim() === state.profile.displayName}
                      onClick={() => {
                        if (!nameDraft.trim()) {
                          setNameError('Enter a name.');
                          return;
                        }
                        dispatch({
                          type: 'UPDATE_PROFILE',
                          patch: { displayName: nameDraft.trim() },
                        });
                        toast({ title: 'Display name updated', tone: 'success' });
                      }}
                    >
                      Save name
                    </Button>
                  </div>
                </Field>
                <p className="mt-3 text-[12px] text-muted">
                  Member since{' '}
                  {formatDateKey(state.profile.createdAt.slice(0, 10), {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}{' '}
                  · Level {state.profile.level} · {state.profile.xp} XP
                </p>
              </div>
            </div>

            <div className="border-t border-line pt-3">
              <p className="mb-1 text-[13px] font-medium text-ink/80">Avatar mark</p>
              <p className="mb-2 text-[12px] leading-5 text-muted">
                A single character, in the spirit of a personal seal. Initials are used if none is
                chosen.
              </p>
              <div className="flex flex-wrap gap-2">
                {AVATARS.map((avatar) => {
                  const active = (state.profile.avatar ?? '') === avatar;
                  return (
                    <button
                      key={avatar || 'initials'}
                      type="button"
                      aria-pressed={active}
                      aria-label={avatar ? `Use ${avatar} as avatar` : 'Use initials as avatar'}
                      onClick={() =>
                        dispatch({ type: 'UPDATE_PROFILE', patch: { avatar } })
                      }
                      className={cn(
                        'flex h-11 w-11 items-center justify-center border font-serif text-[18px] transition-colors',
                        active
                          ? 'border-accent bg-accent-soft/30 text-accent'
                          : 'border-line bg-paper text-ink hover:border-ink/30',
                      )}
                    >
                      {avatar || initials(state.profile.displayName)}
                    </button>
                  );
                })}
              </div>
            </div>

            <InlineNote>
              <UserRound size={11} className="mr-1 inline" aria-hidden />
              No password, email or account is required. Clearing browser site data also clears this
              profile, so export a backup if the workspace matters.
            </InlineNote>
          </SettingsSection>

          <SettingsSection
            id="notifications"
            index="05"
            jp=""
            title="Notifications"
            description="Quiet, optional nudges. TakTic never uses guilt, countdown pressure or streak-loss warnings."
          >
            <div className="divide-y divide-line">
              <Toggle
                checked={settings.notifications.inApp}
                onChange={(checked) => updateNotifications({ inApp: checked })}
                label="In-app notifications"
                description="Small toasts for completions, achievements, deadlines and timer endings."
              />
              <Toggle
                checked={settings.notifications.browser}
                onChange={toggleBrowserNotifications}
                disabled={permissionBusy || permission === 'unsupported'}
                label={permissionBusy ? 'Requesting permission…' : 'Browser notifications'}
                description={
                  permission === 'unsupported'
                    ? 'This browser does not support notifications.'
                    : permission === 'denied'
                      ? 'Permission is blocked in this browser. In-app notifications still work.'
                      : 'Only sent after you explicitly allow them. No marketing, no guilt.'
                }
              />
              <Toggle
                checked={settings.notifications.deadlines}
                onChange={(checked) => updateNotifications({ deadlines: checked })}
                label="Deadline reminders"
                description="One reminder when a deadline is within a day. Nothing repeated."
              />
              <Toggle
                checked={settings.notifications.focus}
                onChange={(checked) => updateNotifications({ focus: checked })}
                label="Focus and break endings"
                description="A browser alert when a timer finishes while you are in another tab."
              />
              <Toggle
                checked={settings.notifications.achievements}
                onChange={(checked) => updateNotifications({ achievements: checked })}
                label="Achievement unlocks"
                description="A single notice when a new mark is earned."
              />
            </div>
            <p className="border-t border-line pt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              Browser permission: {permission} · never requested without a click
            </p>
          </SettingsSection>

          <SettingsSection
            id="shortcuts"
            index="06"
            jp=""
            title="Keyboard"
            description="Shortcuts stay out of the way: they never fire while you are typing in a field, and can be turned off entirely."
          >
            <Toggle
              checked={settings.shortcutsEnabled}
              onChange={(checked) =>
                dispatch({ type: 'UPDATE_SETTINGS', patch: { shortcutsEnabled: checked } })
              }
              label="Enable keyboard shortcuts"
              description="Global shortcuts are ignored while focus is inside an input, textarea or select."
            />

            <div className="divide-y divide-line border-t border-line">
              {[
                { keys: 'Ctrl / ⌘ + K', label: 'Open command palette' },
                { keys: 'N', label: 'Create a task' },
                { keys: 'Space', label: 'Pause or resume the focus timer' },
                { keys: 'Escape', label: 'Close a dialog or menu' },
              ].map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between gap-4 py-2.5"
                >
                  <span className="text-[14px] text-ink/85">{shortcut.label}</span>
                  <kbd className="border border-line bg-surface2 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>

            <InlineNote>
              <Lock size={11} className="mr-1 inline" aria-hidden />
              Shortcuts do not override browser shortcuts, and `Space` only acts when the focus room
              is the current page.
            </InlineNote>
          </SettingsSection>

          <SettingsSection
            id="data"
            index="07"
            jp=""
            title="Data and demonstration"
            description="The workspace is a single LocalStorage record. Export before clearing site data, switching browsers or resetting."
          >
            <div className="grid gap-px border border-line bg-line sm:grid-cols-4">
              {[
                { label: 'Projects', value: state.projects.length },
                { label: 'Tasks', value: state.tasks.length },
                { label: 'Sessions', value: state.focusSessions.length },
                { label: 'Approx. size', value: `${storageKb} KB` },
              ].map((item) => (
                <div key={item.label} className="bg-paper px-3 py-3">
                  <p className="eyebrow mb-1">{item.label}</p>
                  <p className="font-mono text-[15px] text-ink">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={exportData}>
                <Download size={13} aria-hidden /> Export JSON
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={13} aria-hidden /> Import JSON
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  void handleImportFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </div>
            {importName ? (
              <p className="font-mono text-[11px] text-muted">Selected: {importName}</p>
            ) : null}
            {importError ? (
              <InlineNote tone="accent">
                <AlertTriangle size={11} className="mr-1 inline" aria-hidden />
                {importError}
              </InlineNote>
            ) : (
              <p className="text-[12px] leading-5 text-muted">
                Import validates the whole file before changing anything. A malformed backup is
                rejected without touching the current workspace.
              </p>
            )}

            <div className="border-t border-line pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink/80">Demonstration workspace</p>
                  <p className="mt-0.5 max-w-md text-[12px] leading-5 text-muted">
                    {demoOn
                      ? 'The Mika demo workspace is active. The header marks it as a demonstration, and its projects, tasks, sessions and XP carry demo markers.'
                      : 'Load a coherent example — the Biology Research Assignment — to explore adaptation, focus and progression immediately.'}
                  </p>
                </div>
                {demoOn ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDemoDialog('remove')}
                  >
                    Remove demo content
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDemoDialog('load')}
                  >
                    Load demo workspace
                  </Button>
                )}
              </div>
              {demoOn ? (
                <InlineNote tone="sage" className="mt-2">
                  The workspace is marked as a demonstration in the app header. Removing demo content
                  leaves your own later work intact.
                </InlineNote>
              ) : null}
            </div>

            <div className="border-t border-line pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink/80">Reset the workspace</p>
                  <p className="mt-0.5 max-w-md text-[12px] leading-5 text-muted">
                    Removes projects, tasks, sessions, XP, achievements, adaptations and settings
                    from this browser. Undo is offered once in the confirmation toast.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setResetPhrase('');
                    setResetOpen(true);
                  }}
                >
                  <Trash2 size={12} aria-hidden /> Reset…
                </Button>
              </div>
            </div>

            <p className="border-t border-line pt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              Local only · no account · no remote database · export available at any time
            </p>
          </SettingsSection>
        </div>
      </div>

      <ConfirmDialog
        open={demoDialog !== null}
        title={demoDialog === 'remove' ? 'Remove the demo content?' : 'Load the demo workspace?'}
        description={
          demoDialog === 'remove' ? (
            <>
              Demo projects, tasks, sessions, achievements and XP will be removed. Your own work is
              preserved. This can be undone from the toast.
            </>
          ) : state.tasks.length > 0 || state.projects.length > 0 ? (
            <>
              Loading the demo replaces the current projects, tasks, sessions and XP with the
              demonstration workspace. Export a backup first if you want to keep the current data.
              Settings and appearance are preserved.
            </>
          ) : (
            <>
              This fills the workspace with the Mika demonstration: a Biology assignment, revision
              tasks, focus history, XP and achievements. It is clearly marked and removable.
            </>
          )
        }
        confirmLabel={demoDialog === 'remove' ? 'Remove demo content' : 'Load demo workspace'}
        tone={demoDialog === 'remove' ? 'danger' : 'default'}
        onConfirm={handleDemo}
        onClose={() => setDemoDialog(null)}
      />

      <ConfirmDialog
        open={importOpen}
        title="Replace this workspace with the backup?"
        description={
          pendingImport ? (
            <>
              The file “{importName}” contains {pendingImport.projects.length} projects,{' '}
              {pendingImport.tasks.length} tasks, {pendingImport.focusSessions.length} focus
              sessions and {pendingImport.profile.xp} XP. Importing replaces the current workspace.
              You can undo immediately afterwards.
            </>
          ) : (
            'This will replace the current workspace.'
          )
        }
        confirmLabel="Import backup"
        onConfirm={confirmImport}
        onClose={() => {
          setImportOpen(false);
          setPendingImport(null);
        }}
      />

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset the workspace?"
        eyebrow="Destructive action"
        description="There is no remote copy. Export first if anything here matters."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={resetPhrase !== 'RESET'}
              onClick={handleReset}
            >
              <Trash2 size={13} aria-hidden /> Reset workspace
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[14px] leading-6 text-ink/85">
            This clears the LocalStorage record for TakTic in this browser: projects, tasks,
            subtasks, sessions, XP, achievements, adaptation history, preferences and the AI key.
          </p>
          <Field
            label="Type RESET to confirm"
            htmlFor="reset-confirmation"
            hint="Case-sensitive."
          >
            <Input
              id="reset-confirmation"
              value={resetPhrase}
              onChange={(event) => setResetPhrase(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono tracking-[0.2em]"
              placeholder="RESET"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function SettingsSection({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  jp: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border border-line bg-paper"
      aria-labelledby={`${id}-title`}
    >
      <header className="border-b border-line px-4 py-4 sm:px-5">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] tracking-[0.16em] text-accent">{index}</span>
          <span className="h-px flex-1 bg-line" aria-hidden />
        </div>
        <h2 id={`${id}-title`} className="mt-1.5 text-[19px] leading-snug">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted">{description}</p>
        ) : null}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

function ThemeCard({
  label,
  note,
  active,
  onClick,
  swatches,
}: {
  label: string;
  note: string;
  active: boolean;
  onClick: () => void;
  swatches: string[];
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'group border p-2.5 text-left transition-colors',
        active ? 'border-ink/40 bg-surface2' : 'border-line hover:border-ink/25',
      )}
    >
      <div className="flex gap-1">
        {swatches.map((hex) => (
          <span
            key={hex}
            className="h-7 flex-1 border border-ink/10"
            style={{ backgroundColor: hex }}
            aria-hidden
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-ink">{label}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">{note}</p>
        </div>
        {active ? (
          <span className="flex h-4 w-4 items-center justify-center border border-accent bg-accent text-paper">
            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden>
              <path
                d="M1.5 5l2 2L8.5 2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        ) : null}
      </div>
    </button>
  );
}

function NumberSetting({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
          className="pr-16 font-mono text-[14px]"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
          {suffix}
        </span>
      </div>
    </Field>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
