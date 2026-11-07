'use client';

import { CategoryIcon } from '@/components/CategoryIcon';
import { Card, Money, Muted, NoProfile, Row, SectionTitle, TopBar, Why } from '@/components/ui';
import { gbp, niceDate } from '@/lib/engine/dates';
import { cadenceLabel, nextDates } from '@/lib/engine/recurring';
import { addDays } from '@/lib/engine/dates';
import { useMoney } from '@/lib/hooks';

export default function Subscriptions() {
  const money = useMoney();
  if (!money) return <NoProfile />;
  const { an } = money;
  const subs = an.recurring.filter((r) => r.category === 'subscriptions' && r.direction === 'out').sort((a, z) => z.last - a.last);
  const monthly = subs.reduce((sum, r) => sum + (r.cadence === 'monthly' ? r.last : (r.last * 30.4) / (r.everyDays || 30)), 0);

  return (
    <div className="space-y-3">
      <TopBar title="Subscriptions" back="/more" />
      {subs.length > 0 && (
        <Card>
          <div className="text-sm text-mut">You pay about</div>
          <div className="font-display text-[34px] font-semibold leading-tight tracking-tight">
            <Money value={monthly} /> <span className="font-sans text-base font-medium">a month</span>
          </div>
          <Muted className="mt-0.5">From {subs.length} regular {subs.length === 1 ? 'payment' : 'payments'} in your transactions.</Muted>
        </Card>
      )}

      <Card>
        <SectionTitle>Found in your transactions</SectionTitle>
        <div className="mt-1 divide-y divide-hair">
          {subs.map((r) => {
            const next = nextDates(r, addDays(an.today, -1), addDays(an.today, 400))[0];
            return <Row key={r.key} icon={<CategoryIcon category={r.category} />} title={r.label} sub={next ? `Next ${niceDate(next)}` : cadenceLabel(r)} right={gbp(r.last, 2)} />;
          })}
          {!subs.length && <Muted className="py-3">None spotted yet. They show up here once a statement has a couple of payments to the same place.</Muted>}
        </div>
        <Why label="Is one missing or wrong?">
          <p>We look for repeating payments to the same place. You can change any payment’s category under Spending, in Transactions.</p>
        </Why>
      </Card>
    </div>
  );
}
