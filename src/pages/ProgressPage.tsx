import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { TabBar } from '../components/ui/Tabs';
import { StatisticsPage } from './StatisticsPage';
import { AchievementsPage } from './AchievementsPage';

type ProgressTab = 'statistics' | 'achievements';

const TABS: Array<{ value: ProgressTab; label: string }> = [
  { value: 'statistics', label: 'Statistics' },
  { value: 'achievements', label: 'Achievements' },
];

export function ProgressPage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('tab');
  const tab: ProgressTab = selected === 'achievements' ? 'achievements' : 'statistics';

  const changeTab = (value: ProgressTab) => {
    const next = new URLSearchParams(params);
    next.set('tab', value);
    next.delete('view');
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        index="06"
        title="Progress"
        description="A factual record of completed work, focus time and the marks you have earned. No comparisons and no invented trends."
      />

      <TabBar
        items={TABS}
        value={tab}
        onChange={changeTab}
        ariaLabel="Progress views"
        className="mb-6"
      />

      {tab === 'statistics' ? <StatisticsPage embedded /> : <AchievementsPage embedded />}
    </div>
  );
}
