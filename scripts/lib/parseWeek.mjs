import * as cheerio from 'cheerio';

function toIsoDate(dayMonth, weekMonday) {
  const [d, m] = dayMonth.split('/').map(Number);
  if (!d || !m) return null;
  const candidates = [weekMonday.year - 1, weekMonday.year, weekMonday.year + 1];
  let best = null;
  let bestDiff = Infinity;
  for (const y of candidates) {
    const candidate = Date.UTC(y, m - 1, d);
    const diff = Math.abs(candidate - Date.UTC(weekMonday.year, weekMonday.month - 1, weekMonday.day));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = { y, m, d };
    }
  }
  return `${best.y}-${String(best.m).padStart(2, '0')}-${String(best.d).padStart(2, '0')}`;
}

// Parses one planning_club.php response into a list of match objects for
// the club identified by clubName (matched case-insensitively against the
// domicile/exterieur cells to tag home/away).
export function parseWeekHtml(html, weekMonday) {
  const $ = cheerio.load(html);
  const matches = [];
  let currentCat = null;

  $('body').find('.titrepoule, .lienblanc').each((_, el) => {
    const cls = $(el).attr('class');
    if (cls === 'titrepoule') {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      const m = text.match(/^([A-Z0-9]+)\s*-\s*(.+)$/);
      currentCat = m ? { code: m[1], label: m[2].trim() } : { code: text, label: text };
      return;
    }
    // cls === 'lienblanc' -> a match row
    const tr = $(el).closest('tr');
    const tds = tr.children('td');
    const vals = [];
    tds.each((__, td) => vals.push($(td).text().trim().replace(/\s+/g, ' ')));
    if (vals.length < 9) return;

    const [niveau, code, dayMonth, heure, domicile, , exterieur, , lieu, ...rest] = vals;
    const scoreRaw = rest.filter(Boolean).join(' ').trim();

    matches.push({
      matchId: code,
      categoryCode: currentCat ? currentCat.code : null,
      categoryLabel: currentCat ? currentCat.label : null,
      niveau,
      date: toIsoDate(dayMonth, weekMonday),
      dateAffichee: dayMonth,
      heure: heure || null,
      domicile,
      exterieur,
      lieu: lieu || null,
      score: scoreRaw || null,
      statut: scoreRaw ? 'joue' : 'a_venir',
    });
  });

  return matches;
}
