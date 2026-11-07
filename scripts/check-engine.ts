import { getPersonas } from '../src/lib/data/personas';
import { analyse, planForecast, safeDays, affordability } from '../src/lib/engine/analyse';
import { TODAY } from '../src/lib/engine/dates';
for (const p of getPersonas()) {
  const t0 = Date.now();
  const an = analyse(p.answers, p.txns, TODAY);
  const sel = an.actions.slice(0, 6);
  const pf = planForecast(an, sel);
  console.log(`\n=== ${p.name} (${p.txns.length} txns, ${Date.now()-t0}ms)`);
  console.log('in/out monthly', Math.round(an.summary.monthlyIn), Math.round(an.summary.monthlyOut), 'ess ratio', an.summary.essentialsRatio.toFixed(2), 'cv', an.summary.incomeWeeklyCV.toFixed(2));
  console.log('groups', an.groups.map(g=>g.label).join(', '));
  console.log('fingerprint', an.fingerprint.map(f=>`${f.label}:${f.score}`).join(' | '));
  console.log('recurring', an.recurring.map(r=>`${r.label}(${r.direction}${r.cadence==='monthly'?' m'+r.dayOfMonth:' '+r.everyDays+'d'} £${r.last.toFixed(0)})`).join('; '));
  console.log('problems', an.problems.map(x=>`${x.title}${x.annualCost?` [£${Math.round(x.annualCost)}/yr]`:''}`).join(' || '));
  console.log('premium/yr', Math.round(an.premiumAnnual), 'support £/m', an.supportMonthly, 'oneoff', an.supportOneOff);
  console.log('support', an.support.map(s=>s.title).join('; '));
  const f = an.forecast;
  console.log('base: firstRisk', f.firstRisk?.date, f.firstRisk?.p.toFixed(2), f.firstRisk?.trigger?.label, '| risk30', f.risk30.toFixed(2), '| max', f.maxRisk.date, f.maxRisk.p.toFixed(2), '| lowest', f.lowestP50.date, Math.round(f.lowestP50.value), '| end', Math.round(f.endP50));
  console.log('plan actions', sel.map(a=>`${a.title} (£${a.saveMonthly.toFixed(0)}/m)`).join('; '));
  console.log('plan: firstRisk', pf.firstRisk?.date, pf.firstRisk?.p.toFixed(2), '| risk30', pf.risk30.toFixed(2), '| max', pf.maxRisk.p.toFixed(2), '| end', Math.round(pf.endP50));
  console.log('safe days now', an.bufferDays.toFixed(1), 'in90 base', safeDays(an, f, p.answers.savings).toFixed(1), 'plan', safeDays(an, pf, p.answers.savings).toFixed(1));
  const t1=Date.now(); const af = affordability(an, 60, TODAY); console.log('afford £60 today', af.riskBefore.toFixed(2), '->', af.riskAfter.toFixed(2), 'safer', af.saferDate?.date, af.saferDate?.risk.toFixed(2), `${Date.now()-t1}ms`);
  console.log('upcoming', an.upcoming.slice(0,8).map(u=>`${u.date} ${u.label} ${Math.round(u.amount)}`).join('; '));
  if (an.tax) console.log('tax', an.tax);
}
