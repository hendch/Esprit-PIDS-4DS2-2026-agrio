export type CropOption = {
  label: string;
  value: string;
};

export const CANONICAL_GOVERNORATES = [
  "Tunis",
  "Ariana",
  "Ben Arous",
  "Manouba",
  "Bizerte",
  "Beja",
  "Jendouba",
  "Kef",
  "Siliana",
  "Kairouan",
  "Kasserine",
  "Sidi Bouzid",
  "Sousse",
  "Monastir",
  "Mahdia",
  "Sfax",
  "Gabes",
  "Medenine",
  "Tataouine",
  "Gafsa",
  "Tozeur",
  "Kebili",
  "Zaghouan",
  "Nabeul",
] as const;

export const SUPPORTED_CROPS: CropOption[] = [
  { label: "Almonds", value: "almonds" },
  { label: "Apples", value: "apples" },
  { label: "Apricots", value: "apricots" },
  { label: "Artichokes", value: "artichokes" },
  { label: "Avocados", value: "avocados" },

  { label: "Barley", value: "barley" },
  { label: "Beans", value: "beans" },
  { label: "Broad beans", value: "broad_beans_and_horse_beans" },
  { label: "Horse beans", value: "broad_beans_and_horse_beans" },

  { label: "Cabbages", value: "cabbages" },
  { label: "Cantaloupes", value: "cantaloupes_and_other_melons" },
  { label: "Melons", value: "cantaloupes_and_other_melons" },

  { label: "Carrots", value: "carrots_and_turnips" },
  { label: "Turnips", value: "carrots_and_turnips" },

  { label: "Cauliflower", value: "cauliflowers_and_broccoli" },
  { label: "Broccoli", value: "cauliflowers_and_broccoli" },

  { label: "Cereals", value: "cereals" },
  { label: "Cherries", value: "cherries" },
  { label: "Chickpeas", value: "chick_peas" },

  { label: "Chillies", value: "chillies_and_peppers" },
  { label: "Peppers", value: "chillies_and_peppers" },

  {
    label: "Other berries (e.g. blueberries, raspberries, blackberries)",
    value: "other_berries_and_fruits",
  },

  { label: "Cucumbers", value: "cucumbers_and_gherkins" },
  { label: "Gherkins", value: "cucumbers_and_gherkins" },

  { label: "Dates", value: "dates" },

  { label: "Eggplants", value: "eggplants_aubergines" },
  { label: "Aubergines", value: "eggplants_aubergines" },

  { label: "Figs", value: "figs" },
  { label: "Grapes", value: "grapes" },
  { label: "Garlic", value: "green_garlic" },
  { label: "Hazelnuts", value: "hazelnuts" },
  { label: "Kiwi", value: "kiwi_fruit" },

  { label: "Lemons", value: "lemons_and_limes" },
  { label: "Limes", value: "lemons_and_limes" },

  { label: "Lentils", value: "lentils" },

  { label: "Lettuce", value: "lettuce_and_chicory" },
  { label: "Chicory", value: "lettuce_and_chicory" },

  { label: "Linseed", value: "linseed" },
  { label: "Carobs", value: "locust_beans_carobs" },
  { label: "Oats", value: "oats" },
  { label: "Olives", value: "olives" },

  { label: "Onions", value: "onions_and_shallots" },
  { label: "Shallots", value: "onions_and_shallots" },

  { label: "Oranges", value: "oranges" },
  { label: "Other beans", value: "other_beans" },
  { label: "Other citrus fruit", value: "other_citrus_fruit" },
  { label: "Other fruits", value: "other_fruits" },
  {
    label: "Other nuts",
    value: "other_nuts_excluding_wild_edible_nuts_and_groundnuts",
  },
  { label: "Other pulses", value: "other_pulses" },
  {
    label: "Other spice or aromatic crops",
    value: "other_stimulant_spice_and_aromatic_crops",
  },
  { label: "Other stone fruits", value: "other_stone_fruits" },
  { label: "Other tropical fruits", value: "other_tropical_fruits" },
  { label: "Other fresh vegetables", value: "other_vegetables_fresh" },

  { label: "Peaches", value: "peaches_and_nectarines" },
  { label: "Nectarines", value: "peaches_and_nectarines" },

  { label: "Pears", value: "pears" },
  { label: "Peas", value: "peas" },
  { label: "Pistachios", value: "pistachios" },

  { label: "Plums", value: "plums_and_sloes" },
  { label: "Sloes", value: "plums_and_sloes" },

  { label: "Pomelos", value: "pomelos_and_grapefruits" },
  { label: "Grapefruits", value: "pomelos_and_grapefruits" },

  { label: "Potatoes", value: "potatoes" },

  { label: "Pumpkins", value: "pumpkins_squash_and_gourds" },
  { label: "Squash", value: "pumpkins_squash_and_gourds" },
  { label: "Gourds", value: "pumpkins_squash_and_gourds" },

  { label: "Pyrethrum", value: "pyrethrum_dried_flowers" },
  { label: "Quinces", value: "quinces" },
  { label: "Rape seed", value: "rape_or_colza_seed" },
  { label: "Colza seed", value: "rape_or_colza_seed" },
  { label: "Cotton", value: "seed_cotton_unginned" },
  { label: "Sorghum", value: "sorghum" },
  { label: "Mixed spices", value: "spices_mixed" },
  { label: "Spinach", value: "spinach" },
  { label: "Strawberries", value: "strawberries" },
  { label: "Sugar beet", value: "sugar_beet" },
  { label: "Sunflower", value: "sunflower_seed" },

  { label: "Tangerines", value: "tangerines_mandarins_clementines" },
  { label: "Mandarins", value: "tangerines_mandarins_clementines" },
  { label: "Clementines", value: "tangerines_mandarins_clementines" },

  { label: "Tomatoes", value: "tomatoes" },
  { label: "Triticale", value: "triticale" },
  { label: "Tobacco", value: "unmanufactured_tobacco" },
  { label: "Vetches", value: "vetches" },
  { label: "Watermelons", value: "watermelons" },
  { label: "Wheat", value: "wheat" },
];

const GOVERNORATE_ALIAS_MAP: Record<string, string> = {
  tunis: "Tunis",
  ariana: "Ariana",
  "ben arous": "Ben Arous",
  manouba: "Manouba",
  bizerte: "Bizerte",
  beja: "Beja",
  jendouba: "Jendouba",
  kef: "Kef",
  siliana: "Siliana",
  kairouan: "Kairouan",
  kasserine: "Kasserine",
  "kasserine governorate": "Kasserine",
  "sidi bouzid": "Sidi Bouzid",
  sousse: "Sousse",
  monastir: "Monastir",
  mahdia: "Mahdia",
  sfax: "Sfax",
  gabes: "Gabes",
  medenine: "Medenine",
  tataouine: "Tataouine",
  gafsa: "Gafsa",
  tozeur: "Tozeur",
  kebili: "Kebili",
  zaghouan: "Zaghouan",
  nabeul: "Nabeul",
};

const CROP_ALIAS_MAP: Record<string, string> = {
  almonds: "almonds",
  almond: "almonds",
  apples: "apples",
  apricots: "apricots",
  artichokes: "artichokes",
  avocados: "avocados",
  barley: "barley",
  beans: "beans",
  "broad beans": "broad_beans_and_horse_beans",
  "horse beans": "broad_beans_and_horse_beans",
  cabbages: "cabbages",
  cantaloupes: "cantaloupes_and_other_melons",
  melons: "cantaloupes_and_other_melons",
  carrots: "carrots_and_turnips",
  turnips: "carrots_and_turnips",
  cauliflower: "cauliflowers_and_broccoli",
  broccoli: "cauliflowers_and_broccoli",
  cereals: "cereals",
  cherries: "cherries",
  chickpeas: "chick_peas",
  chillies: "chillies_and_peppers",
  peppers: "chillies_and_peppers",
  cucumbers: "cucumbers_and_gherkins",
  gherkins: "cucumbers_and_gherkins",
  dates: "dates",
  eggplants: "eggplants_aubergines",
  aubergines: "eggplants_aubergines",
  figs: "figs",
  grapes: "grapes",
  garlic: "green_garlic",
  hazelnuts: "hazelnuts",
  kiwi: "kiwi_fruit",
  lemons: "lemons_and_limes",
  limes: "lemons_and_limes",
  lentils: "lentils",
  lettuce: "lettuce_and_chicory",
  chicory: "lettuce_and_chicory",
  linseed: "linseed",
  carobs: "locust_beans_carobs",
  oats: "oats",
  olives: "olives",
  onions: "onions_and_shallots",
  shallots: "onions_and_shallots",
  oranges: "oranges",
  "other beans": "other_beans",
  "other citrus fruit": "other_citrus_fruit",
  "other fruits": "other_fruits",
  "other nuts": "other_nuts_excluding_wild_edible_nuts_and_groundnuts",
  "other pulses": "other_pulses",
  "other spice or aromatic crops": "other_stimulant_spice_and_aromatic_crops",
  "other stone fruits": "other_stone_fruits",
  "other tropical fruits": "other_tropical_fruits",
  "other fresh vegetables": "other_vegetables_fresh",
  "other berries": "other_berries_and_fruits",
  peaches: "peaches_and_nectarines",
  nectarines: "peaches_and_nectarines",
  pears: "pears",
  peas: "peas",
  pistachios: "pistachios",
  plums: "plums_and_sloes",
  sloes: "plums_and_sloes",
  pomelos: "pomelos_and_grapefruits",
  grapefruits: "pomelos_and_grapefruits",
  potatoes: "potatoes",
  pumpkins: "pumpkins_squash_and_gourds",
  squash: "pumpkins_squash_and_gourds",
  gourds: "pumpkins_squash_and_gourds",
  pyrethrum: "pyrethrum_dried_flowers",
  quinces: "quinces",
  "rape seed": "rape_or_colza_seed",
  "colza seed": "rape_or_colza_seed",
  cotton: "seed_cotton_unginned",
  sorghum: "sorghum",
  "mixed spices": "spices_mixed",
  spinach: "spinach",
  strawberries: "strawberries",
  "sugar beet": "sugar_beet",
  sunflower: "sunflower_seed",
  tangerines: "tangerines_mandarins_clementines",
  mandarins: "tangerines_mandarins_clementines",
  clementines: "tangerines_mandarins_clementines",
  tomatoes: "tomatoes",
  triticale: "triticale",
  tobacco: "unmanufactured_tobacco",
  vetches: "vetches",
  watermelons: "watermelons",
  wheat: "wheat",
};

function normalizeBasic(value?: string | null): string {
  if (!value) return "";

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[()/,]+/g, " ")
    .replace(/\bgovernorate\b/gi, "")
    .replace(/\bgouvernorat\b/gi, "")
    .replace(/\bولاية\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeGovernorateName(value?: string | null): string {
  const normalized = normalizeBasic(value);
  return GOVERNORATE_ALIAS_MAP[normalized] || value?.trim() || "";
}

export function normalizeCropName(value?: string | null): string {
  const normalized = normalizeBasic(value);
  return CROP_ALIAS_MAP[normalized] || value?.trim().toLowerCase() || "";
}

const PREFERRED_CROP_LABELS: Record<string, string> = {
  almonds: "Almonds",
  apples: "Apples",
  apricots: "Apricots",
  artichokes: "Artichokes",
  avocados: "Avocados",
  barley: "Barley",
  beans: "Beans",
  broad_beans_and_horse_beans: "Broad beans / Horse beans",
  cabbages: "Cabbages",
  cantaloupes_and_other_melons: "Cantaloupes / Melons",
  carrots_and_turnips: "Carrots / Turnips",
  cauliflowers_and_broccoli: "Cauliflower / Broccoli",
  cereals: "Cereals",
  cherries: "Cherries",
  chick_peas: "Chickpeas",
  chillies_and_peppers: "Chillies / Peppers",
  cucumbers_and_gherkins: "Cucumbers / Gherkins",
  dates: "Dates",
  eggplants_aubergines: "Eggplants / Aubergines",
  figs: "Figs",
  grapes: "Grapes",
  green_garlic: "Garlic",
  hazelnuts: "Hazelnuts",
  kiwi_fruit: "Kiwi",
  lemons_and_limes: "Lemons / Limes",
  lentils: "Lentils",
  lettuce_and_chicory: "Lettuce / Chicory",
  linseed: "Linseed",
  locust_beans_carobs: "Carobs",
  oats: "Oats",
  olives: "Olives",
  onions_and_shallots: "Onions / Shallots",
  oranges: "Oranges",
  other_beans: "Other beans",
  other_berries_and_fruits: "Other berries",
  other_citrus_fruit: "Other citrus fruit",
  other_fruits: "Other fruits",
  other_nuts_excluding_wild_edible_nuts_and_groundnuts: "Other nuts",
  other_pulses: "Other pulses",
  other_stimulant_spice_and_aromatic_crops: "Other spice / aromatic crops",
  other_stone_fruits: "Other stone fruits",
  other_tropical_fruits: "Other tropical fruits",
  other_vegetables_fresh: "Other fresh vegetables",
  peaches_and_nectarines: "Peaches / Nectarines",
  pears: "Pears",
  peas: "Peas",
  pistachios: "Pistachios",
  plums_and_sloes: "Plums / Sloes",
  pomelos_and_grapefruits: "Pomelos / Grapefruits",
  potatoes: "Potatoes",
  pumpkins_squash_and_gourds: "Pumpkins / Squash / Gourds",
  pyrethrum_dried_flowers: "Pyrethrum",
  quinces: "Quinces",
  rape_or_colza_seed: "Rape seed / Colza seed",
  seed_cotton_unginned: "Cotton",
  sorghum: "Sorghum",
  spices_mixed: "Mixed spices",
  spinach: "Spinach",
  strawberries: "Strawberries",
  sugar_beet: "Sugar beet",
  sunflower_seed: "Sunflower",
  tangerines_mandarins_clementines: "Tangerines / Mandarins / Clementines",
  tomatoes: "Tomatoes",
  triticale: "Triticale",
  unmanufactured_tobacco: "Tobacco",
  vetches: "Vetches",
  watermelons: "Watermelons",
  wheat: "Wheat",
};

export function cropValueToLabel(value?: string | null): string {
  if (!value) return "Unknown crop";
  return PREFERRED_CROP_LABELS[value] || value.replace(/_/g, " ");
}
