/**
 * Prix du marché (« baromètre ») : matériaux sous leurs noms d'ici et prix au voyage selon la taille du camion,
 * comme les clients béninois achètent. Un indice vaut pour une semaine (du lundi au dimanche) ;
 * la tendance est calculée par rapport à l'indice précédent du même matériau et du même camion.
 */
const { query } = require('../config/database');
const { AppError } = require('../middlewares/error.middleware');

// Matériaux proposés à la commande ; « voyage » : vendus au camion, donc suivis par les prix du marché
const MATERIALS = [
  { key: 'sable_lagunaire', name: 'Sable lagunaire', voyage: true },
  { key: 'sable_fin', name: 'Sable fin', voyage: true },
  { key: 'sable_carriere', name: 'Sable de carrière', voyage: true },
  { key: 'gravier_5_15', name: 'Gravier 5/15', voyage: true },
  { key: 'gravier_15_25', name: 'Gravier 15/25', voyage: true },
  { key: 'caillou', name: 'Caillou (moellons)', voyage: true },
  { key: 'terre_de_barre', name: 'Terre de barre', voyage: true },
  { key: 'laterite', name: 'Latérite (terre rouge)', voyage: true },
  { key: 'ciment', name: 'Ciment (sac de 50 kg)', voyage: false },
  { key: 'agglos', name: 'Agglos (parpaings)', voyage: false },
  { key: 'fer', name: 'Fer à béton', voyage: false },
];

// Tailles de camion telles qu'on les nomme au Bénin, et les bennes BenneGo qui y correspondent
const TRUCKS = [
  { key: '6_roues', name: 'Camion 6 roues', truck_types: ['simple_benne', 'pickup'] },
  { key: '10_roues', name: 'Camion 10 roues', truck_types: ['double_benne', 'plateau'] },
  { key: '12_roues', name: 'Camion 12 roues', truck_types: ['semi_remorque', 'grue'] },
];

// Écart minimal (en %) pour parler de hausse ou de baisse
const TREND_THRESHOLD = 0.02;

const materialOf = (key) => MATERIALS.find((m) => m.key === key);
const truckOf = (key) => TRUCKS.find((t) => t.key === key);

/** Lundi de la semaine d'une date (AAAA-MM-JJ). */
const mondayOf = (isoDate) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new AppError('Date invalide', 400);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const addDays = (isoDate, n) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const trendOf = (current, previous) => {
  if (!previous) return 'stable';
  const change = (current - previous) / previous;
  if (change >= TREND_THRESHOLD) return 'up';
  if (change <= -TREND_THRESHOLD) return 'down';
  return 'stable';
};

const catalog = () => ({
  materials: MATERIALS.map(({ key, name, voyage }) => ({ key, name, voyage })),
  trucks: TRUCKS.map(({ key, name, truck_types: truckTypes }) => ({ key, name, truck_types: truckTypes })),
});

/**
 * Publie (ou corrige) l'indice d'une semaine pour un matériau et une taille de camion.
 * @returns l'indice enregistré, avec sa tendance
 */
async function publish({ material_key: materialKey, truck_size: truckSize, price_min: min, price_avg: avg, price_max: max, week_start: weekStart }) {
  const material = materialOf(materialKey);
  if (!material || !material.voyage) throw new AppError('Matériau inconnu ou non vendu au voyage', 400);
  if (!truckOf(truckSize)) throw new AppError('Taille de camion inconnue', 400);
  const [low, mid, high] = [min, avg, max].map((v) => Math.round(Number(v)));
  if (![low, mid, high].every((v) => Number.isFinite(v) && v > 0)) throw new AppError('Prix invalides', 400);
  if (!(low <= mid && mid <= high)) throw new AppError('Prix : le plus bas ≤ le prix courant ≤ le plus haut', 400);
  const monday = mondayOf(weekStart);

  const { rows: before } = await query(
    `SELECT price_avg::float AS price_avg FROM btp_price_barometer
     WHERE material_key = $1 AND truck_size = $2 AND week_start < $3
     ORDER BY week_start DESC LIMIT 1`,
    [materialKey, truckSize, monday]
  );
  const trend = trendOf(mid, before[0]?.price_avg);
  const { rows } = await query(
    `INSERT INTO btp_price_barometer
       (material_key, material_name, truck_size, week_start, price_min, price_avg, price_max, trend)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (material_key, truck_size, week_start) WHERE week_start IS NOT NULL
     DO UPDATE SET price_min = EXCLUDED.price_min, price_avg = EXCLUDED.price_avg,
                   price_max = EXCLUDED.price_max, trend = EXCLUDED.trend, material_name = EXCLUDED.material_name
     RETURNING id`,
    [materialKey, material.name, truckSize, monday, low, mid, high, trend]
  );
  // Une correction peut changer la tendance de la semaine suivante déjà publiée
  await query(
    `UPDATE btp_price_barometer b SET trend = CASE
        WHEN b.price_avg >= $1 * (1 + $4::float) THEN 'up'
        WHEN b.price_avg <= $1 * (1 - $4::float) THEN 'down' ELSE 'stable' END
     WHERE b.id = (SELECT id FROM btp_price_barometer WHERE material_key = $2 AND truck_size = $3 AND week_start > $5
                   ORDER BY week_start LIMIT 1)`,
    [mid, materialKey, truckSize, TREND_THRESHOLD, monday]
  );
  return (await latest({ id: rows[0].id }))[0];
}

/** Dernier indice publié de chaque matériau et taille de camion (ou un indice précis). */
async function latest({ id } = {}) {
  const { rows } = await query(
    `SELECT b.id, b.material_key, b.material_name, b.truck_size, to_char(b.week_start, 'YYYY-MM-DD') AS week_start,
        b.price_min::float AS price_min, b.price_avg::float AS price_avg, b.price_max::float AS price_max, b.trend,
        (SELECT p.price_avg::float FROM btp_price_barometer p
         WHERE p.material_key = b.material_key AND p.truck_size = b.truck_size AND p.week_start < b.week_start
         ORDER BY p.week_start DESC LIMIT 1) AS previous_avg
     FROM btp_price_barometer b
     WHERE b.week_start IS NOT NULL ${id ? 'AND b.id = $1' : `AND b.week_start = (
       SELECT MAX(x.week_start) FROM btp_price_barometer x WHERE x.material_key = b.material_key AND x.truck_size = b.truck_size)`}`,
    id ? [id] : []
  );
  const order = (row) => MATERIALS.findIndex((m) => m.key === row.material_key) * 10 + TRUCKS.findIndex((t) => t.key === row.truck_size);
  return rows.sort((a, b) => order(a) - order(b)).map((row) => ({
    ...row,
    truck_name: truckOf(row.truck_size)?.name || row.truck_size,
    week_end: addDays(row.week_start, 6),
    change: row.previous_avg ? (row.price_avg - row.previous_avg) / row.previous_avg : null,
  }));
}

module.exports = { MATERIALS, TRUCKS, catalog, publish, latest, mondayOf, trendOf };
