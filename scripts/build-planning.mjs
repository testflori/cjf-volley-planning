import { writeFileSync, mkdirSync } from 'fs';
import { seasonWeeks } from './lib/dateJour.mjs';
import { parseWeekHtml } from './lib/parseWeek.mjs';

const CLUB_ID = '0456420';
const SEASON_START = { year: 2026, month: 8, day: 17 };
const SEASON_END = { year: 2027, month: 6, day: 28 };
const DELAY_MS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function weekUrl(dateJour) {
  return `https://www.ffvbbeach.org/ffvbapp/resu/planning_club.php?aff_semaine=SUI&date_jour=${dateJour}&cnclub=${CLUB_ID}`;
}

async function fetchWeek(dateJour) {
  const res = await fetch(weekUrl(dateJour), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CJF-planning-bot/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for date_jour=${dateJour}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('latin1');
}

async function main() {
  const weeks = seasonWeeks(SEASON_START, SEASON_END);
  console.log(`Saison ${SEASON_START.year}/${SEASON_END.year} : ${weeks.length} semaines a recuperer.`);

  const allMatches = [];
  const weekSummaries = [];

  for (const week of weeks) {
    const monday = `${week.year}-${String(week.month).padStart(2, '0')}-${String(week.day).padStart(2, '0')}`;
    try {
      const html = await fetchWeek(week.dateJour);
      const matches = parseWeekHtml(html, week);
      for (const m of matches) allMatches.push({ ...m, weekStart: monday });
      weekSummaries.push({ weekStart: monday, dateJour: week.dateJour, matchCount: matches.length, status: 'ok' });
      console.log(`${monday}: ${matches.length} match(s)`);
    } catch (err) {
      weekSummaries.push({ weekStart: monday, dateJour: week.dateJour, matchCount: 0, status: 'error', error: String(err.message || err) });
      console.error(`${monday}: ERREUR - ${err.message || err}`);
    }
    await sleep(DELAY_MS);
  }

  allMatches.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.heure || '').localeCompare(b.heure || ''));

  const categories = [...new Map(
    allMatches.filter(m => m.categoryCode).map(m => [m.categoryCode, { code: m.categoryCode, label: m.categoryLabel }])
  ).values()].sort((a, b) => a.code.localeCompare(b.code));

  const db = {
    club: { id: CLUB_ID, nom: 'CERCLE JULES FERRY FLEURY' },
    saison: `${SEASON_START.year}/${SEASON_END.year}`,
    lastUpdated: new Date().toISOString(),
    categories,
    matches: allMatches,
    weeks: weekSummaries,
  };

  mkdirSync('data', { recursive: true });
  writeFileSync('data/matches.json', JSON.stringify(db, null, 2), 'utf8');
  console.log(`\nTermine : ${allMatches.length} match(s) sur ${weeks.length} semaines -> data/matches.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
