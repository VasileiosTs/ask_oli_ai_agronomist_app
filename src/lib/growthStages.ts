// FAO-based growth stage estimation by crop type and days since planting
// Source: FAO Crop Water Information + Mediterranean adjustments

export interface GrowthStageResult {
  stage: 'germination' | 'vegetative' | 'flowering' | 'fruiting' | 'maturity' | 'dormant';
  progress: number; // 0–100 within current stage
  daysInStage: number;
  totalDays: number;
}

// Approximate stage durations (days) per crop category
// [germination, vegetative, flowering, fruiting, maturity]
const CROP_STAGES: Record<string, number[]> = {
  // Row crops
  tomato:     [10, 25, 20, 35, 20],
  pepper:     [12, 30, 20, 40, 20],
  eggplant:   [12, 30, 20, 40, 20],
  cucumber:   [8,  20, 15, 30, 15],
  zucchini:   [8,  20, 15, 25, 15],
  melon:      [10, 25, 15, 30, 15],
  watermelon: [10, 25, 15, 35, 15],
  potato:     [15, 30, 20, 30, 20],
  onion:      [15, 30, 20, 30, 25],
  garlic:     [15, 40, 15, 20, 30],
  lettuce:    [8,  25, 10, 10, 10],
  cabbage:    [10, 35, 15, 20, 15],
  carrot:     [12, 30, 15, 25, 20],
  bean:       [8,  25, 15, 20, 15],
  pea:        [8,  20, 15, 20, 10],
  // Tree crops (annual cycle from bloom)
  olive:      [0, 60, 20, 90, 60],
  grape:      [0, 45, 15, 60, 30],
  citrus:     [0, 60, 20, 90, 60],
  apple:      [0, 40, 15, 80, 40],
  peach:      [0, 35, 15, 60, 30],
  cherry:     [0, 30, 15, 40, 20],
  fig:        [0, 40, 15, 50, 30],
  // Grains
  wheat:      [10, 40, 20, 30, 20],
  barley:     [10, 35, 20, 25, 20],
  corn:       [10, 30, 15, 35, 20],
  rice:       [10, 30, 20, 30, 20],
  // Industrial
  cotton:     [10, 35, 25, 40, 20],
  tobacco:    [12, 30, 20, 30, 15],
  sunflower:  [10, 30, 15, 25, 15],
  // Default
  default:    [10, 30, 20, 30, 20],
};

const STAGE_NAMES: GrowthStageResult['stage'][] = [
  'germination', 'vegetative', 'flowering', 'fruiting', 'maturity',
];

export function getGrowthStage(
  cropType: string | null,
  plantedAt: string | null | Date,
): GrowthStageResult | null {
  if (!plantedAt) return null;

  const planted = typeof plantedAt === 'string' ? new Date(plantedAt) : plantedAt;
  if (isNaN(planted.getTime())) return null;

  const totalDays = Math.floor((Date.now() - planted.getTime()) / 86400000);
  if (totalDays < 0) return null;

  const key = (cropType || 'default').toLowerCase().trim();
  const stages = CROP_STAGES[key] || CROP_STAGES.default;
  const totalCycleDays = stages.reduce((a, b) => a + b, 0);

  if (totalDays >= totalCycleDays) {
    return { stage: 'dormant', progress: 100, daysInStage: totalDays - totalCycleDays, totalDays };
  }

  let accumulated = 0;
  for (let i = 0; i < stages.length; i++) {
    if (totalDays < accumulated + stages[i]) {
      const daysInStage = totalDays - accumulated;
      const progress = Math.round((daysInStage / stages[i]) * 100);
      return { stage: STAGE_NAMES[i], progress, daysInStage, totalDays };
    }
    accumulated += stages[i];
  }

  return { stage: 'maturity', progress: 100, daysInStage: 0, totalDays };
}

export const STAGE_LABELS: Record<GrowthStageResult['stage'], { el: string; en: string }> = {
  germination: { el: 'Φύτρωμα', en: 'Germination' },
  vegetative:  { el: 'Βλαστική', en: 'Vegetative' },
  flowering:   { el: 'Ανθοφορία', en: 'Flowering' },
  fruiting:    { el: 'Καρποφορία', en: 'Fruiting' },
  maturity:    { el: 'Ωρίμανση', en: 'Maturity' },
  dormant:     { el: 'Λήθαργος', en: 'Dormant' },
};

export const STAGE_COLORS: Record<GrowthStageResult['stage'], string> = {
  germination: 'bg-yellow-400',
  vegetative:  'bg-green-400',
  flowering:   'bg-pink-400',
  fruiting:    'bg-orange-400',
  maturity:    'bg-amber-500',
  dormant:     'bg-muted',
};
