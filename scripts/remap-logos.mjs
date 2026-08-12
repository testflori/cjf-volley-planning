import { readdirSync, statSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import sharp from 'sharp';

const SOURCE_DIR = 'F:/CJF/Site internet/site/public/Logo club';
const PROJECT_LOGOS = 'logos';

const EXISTING_SLUGS = {
  'CERCLE JULES FERRY FLEURY': 'cjf',
  'BOURGES VOLLEY-BALL': 'bourges',
  'ETUDIANT CLUB ORLEANAIS': 'eco',
  'JOUE VOLLEY-BALL': 'joue-les-tours',
  'MONTS VOLLEY-BALL': 'monts',
  'NEUVILLE SPORTS': 'neuville',
  'AS NOGENTAISE DE VOLLEY-BALL': 'nogent',
  "C'CHARTRES VOLLEY": 'chartres',
  'U.S.ORLEANS VOLLEY-BALL': 'orleans',
};

// Manually identified: filename gives no clue, but the crest reads "USV -
// Vendome Volley-Ball".
const MANUAL_MATCH = {
  'croppedimage-61141aff92084ebcaab844cd3f78690b.png': 'UNION SP VENDOMOISE',
};

// Same real-world club/organisation appearing under different name
// variants across categories/weeks in the FFVB data.
const ALIASES = {
  'US CHAMBRAY-SAINT CYR VOLLEY-BALL': 'UNION SPORTIVE CHAMBRAY LES TOURS',
  'MONTLOUIS 1': 'ALERTE SPORTIVE MONTLOUIS',
  'MONTLOUIS 2': 'ALERTE SPORTIVE MONTLOUIS',
};

function normalize(s) {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.']/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function slugify(s) {
  return normalize(s).toLowerCase().replace(/\s+/g, '-');
}

const db = JSON.parse(readFileSync('data/matches.json', 'utf8'));
const clubNames = new Set();
for (const m of db.matches) { clubNames.add(m.domicile); clubNames.add(m.exterieur); }
clubNames.add('CERCLE JULES FERRY FLEURY');
clubNames.delete('xxxxx');

const byNorm = new Map();
for (const name of clubNames) byNorm.set(normalize(name), name);

function collectCandidates(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const full = dir + '/' + f;
    if (statSync(full).isDirectory()) continue;
    if (!/\.(png|jpg|jpeg|jfif|webp)$/i.test(f)) continue;
    out.push({ file: f, full, base: f.replace(/\.[^.]+$/, '') });
  }
  return out;
}

const candidates = [...collectCandidates(SOURCE_DIR), ...collectCandidates(PROJECT_LOGOS)];

const matched = new Map(); // clubName -> candidate
for (const c of candidates) {
  const manual = MANUAL_MATCH[c.file];
  if (manual && clubNames.has(manual)) { matched.set(manual, c); continue; }
  const norm = normalize(c.base);
  const club = byNorm.get(norm);
  if (club) matched.set(club, c);
}

console.log('Matched', matched.size, 'of', clubNames.size, 'clubs:');
for (const [club, c] of matched) console.log(' ', club, '<-', c.file);
console.log('\nUnmatched clubs:');
for (const club of clubNames) if (!matched.has(club)) console.log(' ', club);

const mapping = {};

// Preserve previously confirmed slugs whose optimized files already exist
// in logos/ from earlier work (their source candidate names don't match
// the full club name, so the scan above wouldn't have found them).
for (const [club, slug] of Object.entries(EXISTING_SLUGS)) {
  mapping[club] = `logos/${slug}.png`;
}

for (const [club, c] of matched) {
  const slug = EXISTING_SLUGS[club] || slugify(club);
  const outPath = `${PROJECT_LOGOS}/${slug}.png`;
  const buf = await sharp(c.full)
    .resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 85, compressionLevel: 9 })
    .toBuffer();
  writeFileSync(outPath, buf);
  mapping[club] = `logos/${slug}.png`;
}

for (const [alias, target] of Object.entries(ALIASES)) {
  if (mapping[target] && clubNames.has(alias)) mapping[alias] = mapping[target];
}

writeFileSync('data/club-logos.json', JSON.stringify(mapping, null, 2) + '\n');
console.log('\nWrote data/club-logos.json with', Object.keys(mapping).length, 'entries.');
