const DATA_URL = "./data/cold-storage-archive.json?v=3";
const US_POPULATION = 335_000_000;
// USDA ERS: the average American eats ~1,996 lb of food a year (dairy, meat,
// grains, produce, sweeteners — everything). ~1 ton/person/yr, ≈ 5.5 lb/day.
// Used only for the "days of national eating" perspective, framed as an
// estimate; never mixed into the cold-storage totals themselves.
const ANNUAL_FOOD_LB_PER_PERSON = 1996;
const US_DAILY_FOOD_LB = US_POPULATION * (ANNUAL_FOOD_LB_PER_PERSON / 365);

// ---------------------------------------------------------------------------
// Global UI state — single source of truth for re-renders (resize, toggles)
// ---------------------------------------------------------------------------
const state = {
  data: null,
  tab: "overview",
  overviewFilter: "all",
  ttFilter: "all",
  perCapita: false,
  modalKey: null,
};

// ---------------------------------------------------------------------------
// Commodity metadata
// ---------------------------------------------------------------------------
const COMMODITY_LABELS = {
  butter: "Butter",
  american_cheese: "American cheese",
  swiss_cheese: "Swiss cheese",
  total_natural_cheese: "Total natural cheese",
  total_chicken: "Total chicken",
  total_turkey: "Total turkey",
  total_frozen_poultry: "Total frozen poultry",
  total_frozen_fruit: "Total frozen fruit",
  total_frozen_vegetables: "Total frozen vegetables",
  total_frozen_potatoes: "Total frozen potatoes",
  total_beef: "Total beef",
  pork_bellies: "Pork bellies",
  total_pork: "Total pork",
  total_frozen_red_meat: "Total frozen red meat",
};

const COMMODITY_GROUPS = {
  butter: "dairy",
  american_cheese: "dairy",
  swiss_cheese: "dairy",
  total_natural_cheese: "dairy",
  total_chicken: "protein",
  total_turkey: "protein",
  total_frozen_poultry: "protein",
  total_frozen_fruit: "produce",
  total_frozen_vegetables: "produce",
  total_frozen_potatoes: "produce",
  total_beef: "protein",
  pork_bellies: "protein",
  total_pork: "protein",
  total_frozen_red_meat: "protein",
  veal: "protein",
  lamb_mutton: "protein",
  ducks: "protein",
  boysenberries: "produce",
  okra: "produce",
  blackberries: "produce",
  apricots: "produce",
  brussels_sprouts: "produce",
  cauliflower: "produce",
  eggs: "dairy",
};

// Deep-cut commodity metadata
const DEEP_CUT_LABELS = {
  // Pork cuts
  pork_hams:       "Pork hams",
  pork_ribs:       "Pork ribs",
  pork_loins:      "Pork loins",
  pork_butts:      "Pork butts",
  pork_trimmings:  "Pork trimmings",
  // Beef cuts
  beef_boneless:   "Beef (boneless)",
  beef_bone_in:    "Beef (bone-in)",
  // Other meats (single latest value, no monthly trend surfaced)
  veal:            "Veal",
  lamb_mutton:     "Lamb & mutton",
  ducks:           "Ducks",
  // Frozen fruit
  strawberries:    "Strawberries",
  blueberries:     "Blueberries",
  raspberries:     "Raspberries",
  cherries_tart:   "Tart cherries",
  // Frozen vegetables
  sweet_corn_cut:  "Sweet corn (cut)",
  sweet_corn_cob:  "Sweet corn (cob)",
  beans_green:     "Green beans",
  carrots:         "Carrots",
  peas_green:      "Green peas",
  spinach:         "Spinach",
  broccoli:        "Broccoli",
  // Curiosity commodities — proof the ledger goes deeper than you'd guess
  boysenberries:   "Boysenberries",
  okra:            "Okra",
  blackberries:    "Blackberries",
  apricots:        "Apricots",
  brussels_sprouts: "Brussels sprouts",
  cauliflower:     "Cauliflower",
  eggs:            "Frozen eggs",
};

function labelFor(key) {
  return COMMODITY_LABELS[key] || DEEP_CUT_LABELS[key] || key;
}

// Base commodities with no overlap — used for the honest "All" ranking.
const LEAF_KEYS = [
  "butter", "american_cheese", "swiss_cheese",
  "total_chicken", "total_turkey",
  "total_frozen_fruit", "total_frozen_vegetables", "total_frozen_potatoes",
  "total_beef", "total_pork",
];

// Candidates for the dynamic "volume leader" tile — non-overlapping reserves.
const LEADER_KEYS = [
  "total_frozen_poultry", "total_frozen_red_meat", "total_natural_cheese",
  "total_frozen_vegetables", "total_frozen_potatoes", "total_frozen_fruit",
  "butter",
];

// ---------------------------------------------------------------------------
// Deep Cuts — full USDA inventory
// ---------------------------------------------------------------------------
// `reveal` is honest, not a stand-in for a number we don't have: none of
// these six are in USDA's Cold Storage commodity map (see COMMODITY_MAP in
// scripts/fetch-usda.py), so there's no monthly figure to count up. Clicking
// surfaces that context instead of faking a value.
// Every card is backed by a real archive series — tap to count it up.
const DC_CURIOSITIES = [
  { key: "boysenberries",    label: "Boysenberries",   color: "lavender", copy: "Yes, specifically boysenberries. A dedicated line item in the national cold storage ledger." },
  { key: "okra",             label: "Okra",            color: "kelp",     copy: "The South's frozen frontier — tens of millions of pounds, quietly waiting." },
  { key: "blackberries",     label: "Blackberries",    color: "cobalt",   copy: "Tracked two ways — loose and in barrels. Barrels of blackberries is its own federal statistic." },
  { key: "apricots",         label: "Apricots",        color: "sun",      copy: "A fruit most people forget exists gets a monthly federal headcount." },
  { key: "brussels_sprouts", label: "Brussels sprouts", color: "paper",   copy: "The vegetable you pushed around your plate is a matter of national record." },
  // USDA reports eggs by weight, not count — estimateUnit converts the
  // reported pounds into an actual egg count using INSIGHT_RECIPES' edible-
  // portion weight (~50g / 0.11 lb per large egg), and the card is honest
  // that the count is an estimate, not a USDA-reported figure.
  { key: "eggs",             label: "Frozen eggs",     color: "coral",    copy: "You can freeze eggs — bakeries run on the stuff, and USDA counts every pound.",
    estimateUnit: "eggs", estimateLabel: "estimated eggs in storage" },
];

const DC_SECTIONS = {
  meat: {
    tracked:   ["total_frozen_poultry", "total_chicken", "total_turkey", "total_frozen_red_meat", "total_beef", "total_pork", "pork_bellies", "pork_hams", "pork_ribs", "pork_loins", "pork_butts", "pork_trimmings", "beef_boneless", "beef_bone_in", "veal", "lamb_mutton", "ducks"],
    discovery: [],
  },
  dairy: {
    tracked:   ["butter", "total_natural_cheese", "american_cheese", "swiss_cheese", "eggs"],
    discovery: [],
  },
  fruit: {
    tracked:   ["total_frozen_fruit", "strawberries", "blueberries", "raspberries", "blackberries", "boysenberries", "cherries_tart", "apricots"],
    discovery: ["Apples", "Grapes", "Oranges", "Peaches", "Other Fruit"],
  },
  vegetables: {
    tracked:   ["total_frozen_vegetables", "total_frozen_potatoes", "sweet_corn_cut", "sweet_corn_cob", "beans_green", "peas_green", "carrots", "broccoli", "spinach", "brussels_sprouts", "cauliflower", "okra"],
    discovery: ["Asparagus", "Greens", "Onions", "Peas & Carrots", "Squash", "Mixed Vegetables", "Other Vegetables"],
  },
};

const DC_LEDGER_ITEMS = [
  "Barley", "Cake & Meal", "Canola", "Chickpeas", "Corn (Field)", "Flaxseed",
  "Hops", "Honey", "Lentils", "Millfeed", "Mustard Seed", "Oats",
  "Peanuts", "Pecans", "Pickles", "Rapeseed", "Rice", "Rye",
  "Safflower", "Sorghum", "Soybeans", "Sunflower Seed", "Wheat", "Whey",
];

// Keys surfaced in the Freezer Records section, in display order.
const RECORD_KEYS = [
  "butter", "total_frozen_poultry", "pork_bellies",
  "total_natural_cheese", "strawberries", "total_beef",
];

// ---------------------------------------------------------------------------
// Curated trend annotations — real, checkable events only.
// month matches the observationDate prefix; filters control which chart
// variants show the marker.
// ---------------------------------------------------------------------------
const TREND_EVENTS = [
  { month: "2022-02", label: "Bird flu reaches US commercial flocks", filters: ["all", "protein"] },
  { month: "2022-10", label: "Butter stocks scrape multi-year lows — shortage headlines", filters: ["dairy"] },
  { month: "2023-07", label: "California's Prop 12 animal-housing rules hit the pork market", filters: ["protein"] },
  { month: "2024-03", label: "H5N1 bird flu detected in US dairy cattle for the first time", filters: ["all", "dairy"] },
  { month: "2025-01", label: "USDA: cattle herd smallest since 1951 — beef supply tightens", filters: ["all", "protein"] },
];

// Curated seasonal one-liners. Every headline commodity gets one so the
// Seasons view and detail modal always explain the shape, not just show it.
const SEASONAL_NOTES = {
  butter: "Stocks swell through the spring–summer milk flush, then draw down hard into holiday baking.",
  american_cheese: "Aging pipelines keep it steady — a slow spring build, a gentle autumn drawdown.",
  swiss_cheese: "Long aging smooths the curve: a quiet late-winter peak, a slow summer slide.",
  total_natural_cheese: "Cheese aging cellars fill on the summer milk flush and empty toward year-end.",
  total_chicken: "Steady birds most of the year, then a late-fall build ahead of winter demand.",
  total_turkey: "Builds all summer as birds are processed — then Thanksgiving empties the freezer overnight.",
  total_frozen_poultry: "Turkey's Thanksgiving cliff drives the whole curve: summer build, November plunge.",
  total_beef: "Lowest in late summer grilling season, rebuilds into winter as demand cools.",
  pork_bellies: "The bacon barometer — stocks pile up in winter, then render down through BLT season.",
  total_pork: "Builds over winter slaughter, thins through summer as grills fire up.",
  total_frozen_red_meat: "Beef and pork together: a winter build, a summer grilling-season draw.",
  total_frozen_fruit: "Crests right after the summer harvest pack, then feeds smoothies and pies all winter.",
  total_frozen_vegetables: "Fills with the fall harvest, then draws down steadily until next season's pack.",
  total_frozen_potatoes: "Peaks after the autumn dig, drains slowly as fries ship out through the year.",
  // Deep-cut extras
  strawberries: "The June harvest floods the freezer in one great wave, then recedes all year.",
  blueberries: "A tight late-summer pack spikes stocks, which ebb through the winter.",
  sweet_corn_cut: "The fall pack fills the freezer; stocks slide until next year's harvest.",
  veal: "A small, steady reserve that moves with the dairy calendar more than the grill.",
  lamb_mutton: "Builds toward spring — lamb's biggest moments are Easter and holiday tables.",
  ducks: "Quiet most of the year, then a late-autumn build for holiday roasts.",
  boysenberries: "One short early-summer harvest stocks the whole year's supply.",
  blackberries: "The July pick fills the freezer; pies and smoothies drain it all winter.",
  apricots: "A brief early-summer window — miss the pack and there's no second chance.",
  brussels_sprouts: "A fall-harvest vegetable banked ahead of its Thanksgiving-table moment.",
  cauliflower: "The fall pack builds stocks; year-round demand pulls them steadily down.",
  okra: "A late-summer southern harvest, frozen at its peak and eaten through the year.",
  eggs: "Bakeries bank frozen egg ahead of holiday baking, then draw it down through spring.",
};

// ---------------------------------------------------------------------------
// Insight recipes: per-capita object equivalences
// ---------------------------------------------------------------------------
const INSIGHT_RECIPES = {
  butter:               { unit: "sticks",             one: "stick of butter",     lbPerUnit: 0.25 },
  total_natural_cheese: { unit: "1-lb blocks",        one: "1-lb block",          lbPerUnit: 1 },
  american_cheese:      { unit: "slices",             one: "slice",               lbPerUnit: 0.0625 },
  swiss_cheese:         { unit: "slices",             one: "slice",               lbPerUnit: 0.0625 },
  total_chicken:        { unit: "whole birds",        one: "whole bird",          lbPerUnit: 5 },
  total_turkey:         { unit: "whole turkeys",      one: "whole turkey",        lbPerUnit: 16 },
  total_frozen_poultry: { unit: "whole birds",        one: "whole bird",          lbPerUnit: 5 },
  total_beef:           { unit: "burgers",            one: "burger",              lbPerUnit: 0.25 },
  beef_boneless:        { unit: "burgers",            one: "burger",              lbPerUnit: 0.25 },
  beef_bone_in:         { unit: "T-bone steaks",      one: "T-bone steak",        lbPerUnit: 1 },
  total_frozen_red_meat: { unit: "burgers",           one: "burger",              lbPerUnit: 0.25 },
  pork_bellies:         { unit: "BLTs worth of bacon", one: "BLT worth of bacon", lbPerUnit: 0.125 },
  total_pork:           { unit: "pork chops",         one: "pork chop",           lbPerUnit: 0.625 },
  pork_loins:           { unit: "pork chops",         one: "pork chop",           lbPerUnit: 0.625 },
  pork_ribs:            { unit: "racks of ribs",      one: "rack of ribs",        lbPerUnit: 3 },
  pork_hams:            { unit: "holiday hams",       one: "holiday ham",         lbPerUnit: 8 },
  pork_butts:           { unit: "pulled-pork sandwiches", one: "pulled-pork sandwich", lbPerUnit: 0.33 },
  pork_trimmings:       { unit: "breakfast sausages", one: "breakfast sausage",   lbPerUnit: 0.06 },
  veal:                 { unit: "veal cutlets",       one: "veal cutlet",         lbPerUnit: 0.3 },
  lamb_mutton:          { unit: "lamb chops",         one: "lamb chop",           lbPerUnit: 0.3 },
  ducks:                { unit: "whole ducks",        one: "whole duck",          lbPerUnit: 5.5 },
  boysenberries:        { unit: "pints of boysenberries", one: "pint of boysenberries", lbPerUnit: 0.75 },
  blackberries:         { unit: "pints of blackberries",  one: "pint of blackberries",  lbPerUnit: 0.75 },
  apricots:             { unit: "apricots",           one: "apricot",             lbPerUnit: 0.25 },
  brussels_sprouts:     { unit: "servings of sprouts", one: "serving of sprouts",  lbPerUnit: 0.5 },
  cauliflower:          { unit: "heads of cauliflower", one: "head of cauliflower", lbPerUnit: 2 },
  okra:                 { unit: "servings of okra",   one: "serving of okra",     lbPerUnit: 0.5 },
  eggs:                 { unit: "eggs' worth",        one: "egg's worth",         lbPerUnit: 0.11 },
  total_frozen_fruit:   { unit: "pints of berries",   one: "pint of berries",     lbPerUnit: 0.75 },
  strawberries:         { unit: "pints of strawberries", one: "pint of strawberries", lbPerUnit: 0.75 },
  blueberries:          { unit: "pints of blueberries",  one: "pint of blueberries",  lbPerUnit: 0.75 },
  raspberries:          { unit: "pints of raspberries",  one: "pint of raspberries",  lbPerUnit: 0.75 },
  cherries_tart:        { unit: "cherry pies' worth",  one: "cherry pie's worth",  lbPerUnit: 1.5 },
  total_frozen_vegetables: { unit: "servings of veg",  one: "serving of veg",      lbPerUnit: 0.5 },
  sweet_corn_cut:       { unit: "ears of corn",        one: "ear of corn",         lbPerUnit: 0.5 },
  sweet_corn_cob:       { unit: "ears of corn",        one: "ear of corn",         lbPerUnit: 0.7 },
  beans_green:          { unit: "servings of green beans", one: "serving of green beans", lbPerUnit: 0.5 },
  peas_green:           { unit: "servings of peas",    one: "serving of peas",     lbPerUnit: 0.5 },
  carrots:              { unit: "servings of carrots", one: "serving of carrots",  lbPerUnit: 0.5 },
  spinach:              { unit: "servings of spinach", one: "serving of spinach",  lbPerUnit: 0.5 },
  broccoli:             { unit: "servings of broccoli", one: "serving of broccoli", lbPerUnit: 0.5 },
  total_frozen_potatoes: { unit: "bags of fries",      one: "bag of fries",        lbPerUnit: 2 },
};

/**
 * Per-capita equivalence badge text. Three rungs so every commodity gets one:
 * a count per American when it's ≥ ~1, an inverted "1 X per N Americans"
 * when the count is small, and plain lb/person as the last resort.
 */
function equivalenceText(key, thousandLb) {
  const lb = thousandLb * 1000;
  const recipe = INSIGHT_RECIPES[key];
  if (recipe) {
    const per = lb / US_POPULATION / recipe.lbPerUnit;
    if (per >= 0.75) return `≈ ${formatPerCapitaCount(per)} ${recipe.unit} / American`;
    const people = Math.round(1 / per);
    if (people <= 1000) return `≈ 1 ${recipe.one} per ${people} Americans`;
  }
  const perLb = lb / US_POPULATION;
  if (perLb >= 0.05) return `≈ ${formatPerCapitaCount(perLb)} lb / American`;
  return "";
}

/** Sentence form of the same equivalence, for the detail modal. */
function equivalenceSentence(key, thousandLb) {
  const lb = thousandLb * 1000;
  const recipe = INSIGHT_RECIPES[key];
  if (recipe) {
    const per = lb / US_POPULATION / recipe.lbPerUnit;
    if (per >= 0.75) {
      return `America is holding <strong>≈ ${formatPerCapitaCount(per)} ${recipe.unit}</strong> for every single person in the country.`;
    }
    const people = Math.round(1 / per);
    if (people <= 1000) {
      return `America is holding about <strong>one ${recipe.one} for every ${people} people</strong> in the country.`;
    }
  }
  const perLb = lb / US_POPULATION;
  if (perLb >= 0.05) {
    return `That works out to <strong>≈ ${formatPerCapitaCount(perLb)} lb per American</strong>.`;
  }
  return "";
}

// Non-overlapping keys used for the grand total.
const GRAND_TOTAL_KEYS = [
  "butter",
  "total_natural_cheese",
  "total_frozen_poultry",
  "total_frozen_fruit",
  "total_frozen_vegetables",
  "total_frozen_potatoes",
  "total_frozen_red_meat",
];

const categoryDefinitions = {
  all: {
    title: "Total cold storage — all categories",
    rankingNote: "Sorted by latest storage volume",
    aggregateKeys: GRAND_TOTAL_KEYS,
  },
  dairy: {
    title: "Dairy storage — from butter to aged natural cheese",
    rankingNote: "Sorted by latest dairy storage volume",
    commodities: ["butter", "american_cheese", "swiss_cheese", "total_natural_cheese"],
    aggregateKeys: ["butter", "total_natural_cheese"],
    // Eggs live in the dairy aisle but are NOT part of the dairy totals.
    components: ["eggs"],
    componentsNote: "Also in the dairy aisle",
  },
  produce: {
    title: "Produce storage — fruit, vegetables, and frozen potatoes",
    rankingNote: "Sorted by latest produce storage volume",
    commodities: ["total_frozen_vegetables", "total_frozen_potatoes", "total_frozen_fruit"],
    aggregateKeys: ["total_frozen_fruit", "total_frozen_vegetables", "total_frozen_potatoes"],
    components: [
      "strawberries", "blueberries", "raspberries", "blackberries", "boysenberries",
      "cherries_tart", "apricots", "sweet_corn_cut", "sweet_corn_cob", "beans_green",
      "peas_green", "carrots", "broccoli", "spinach", "brussels_sprouts", "cauliflower", "okra",
    ],
    componentsNote: "Components & cuts · already counted in the totals above",
  },
  protein: {
    title: "Protein storage — where freezer pressure actually sits",
    rankingNote: "Sorted by latest protein storage volume",
    commodities: [
      "total_frozen_poultry",
      "total_frozen_red_meat",
      "total_chicken",
      "total_turkey",
      "total_pork",
      "total_beef",
    ],
    components: [
      "pork_bellies", "pork_hams", "pork_loins", "pork_butts", "pork_ribs", "pork_trimmings",
      "beef_boneless", "beef_bone_in", "veal", "lamb_mutton", "ducks",
    ],
    componentsNote: "Components & cuts · already counted in the totals above",
    aggregateKeys: ["total_frozen_red_meat", "total_frozen_poultry"],
  },
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
const formatCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

// Escape any string interpolated into innerHTML. Labels are currently
// hardcoded, but archive JSON keys can fall through as labels — keep every
// data-derived string inert.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded}%`;
}

function calculateChange(from, to) {
  if (!from) return 0;
  return ((to - from) / from) * 100;
}

function shortMonthYear(isoDate) {
  const d = new Date(isoDate + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function formatPerCapitaCount(perAmerican) {
  if (perAmerican >= 10) return Math.round(perAmerican).toLocaleString("en-US");
  if (perAmerican >= 1) return (Math.round(perAmerican * 10) / 10).toLocaleString("en-US");
  return (Math.round(perAmerican * 100) / 100).toLocaleString("en-US");
}

/**
 * Headline number formatting that honours the global per-American toggle.
 * Returns { num, unit } strings.
 */
function formatHeadlineValue(key, thousandLb) {
  const lb = thousandLb * 1000;
  if (state.perCapita) {
    const recipe = INSIGHT_RECIPES[key];
    if (recipe) {
      const per = lb / US_POPULATION / recipe.lbPerUnit;
      // Below half a unit the equivalence stops being evocative ("0.06
      // turkeys") — plain pounds per person reads better.
      if (per >= 0.5) {
        return { num: formatPerCapitaCount(per), unit: `${recipe.unit} / American` };
      }
    }
    return { num: formatPerCapitaCount(lb / US_POPULATION), unit: "lb / American" };
  }
  return { num: formatCompact.format(lb), unit: "lb" };
}

// ---------------------------------------------------------------------------
// Archive helpers
// ---------------------------------------------------------------------------
function getLatestSnapshot(archive) {
  return archive.snapshots[archive.snapshots.length - 1];
}

function getPrevMonthSnapshot(archive) {
  const len = archive.snapshots.length;
  return archive.snapshots[Math.max(0, len - 2)];
}

function getYearAgoSnapshot(archive) {
  const latest = getLatestSnapshot(archive);
  const latestDate = new Date(latest.observationDate);
  const targetDate = new Date(latestDate);
  targetDate.setFullYear(targetDate.getFullYear() - 1);

  let closest = archive.snapshots[0];
  let minDiff = Infinity;
  for (const s of archive.snapshots) {
    const diff = Math.abs(new Date(s.observationDate) - targetDate);
    if (diff < minDiff) {
      minDiff = diff;
      closest = s;
    }
  }
  return closest;
}

/**
 * Most recent month with a real value for this key.
 * Returns { value, date, monthsStale } or null if the key has no data at all.
 */
function lastKnown(archive, key) {
  const snaps = archive.snapshots;
  for (let i = snaps.length - 1; i >= 0; i--) {
    const v = snaps[i].commodities[key];
    if (v) return { value: v, date: snaps[i].observationDate, monthsStale: snaps.length - 1 - i };
  }
  return null;
}

/**
 * Build a "compat" data object that matches the old single-snapshot shape,
 * so all existing renderXxx functions work with minimal changes.
 */
function buildCompatData(archive) {
  const latest = getLatestSnapshot(archive);
  const prevMonth = getPrevMonthSnapshot(archive);
  const yearAgo = getYearAgoSnapshot(archive);

  const commodities = {};
  for (const key of Object.keys(latest.commodities)) {
    commodities[key] = {
      label: labelFor(key),
      group: COMMODITY_GROUPS[key] || "other",
      values: {
        yearAgo: yearAgo.commodities[key] || 0,
        previousMonth: prevMonth.commodities[key] || 0,
        latest: latest.commodities[key] || 0,
      },
    };
  }

  return {
    meta: {
      ...archive.meta,
      observationDate: latest.observationDate,
      releaseDate: latest.releaseDate || archive.meta.updated,
      reportUrl: latest.reportUrl || "",
    },
    commodities,
    archive,
  };
}

function computeGrandTotal(snapshot, keys = GRAND_TOTAL_KEYS) {
  return keys.reduce((sum, key) => sum + (snapshot.commodities[key] || 0), 0);
}

function buildAggregateSeries(data) {
  const get = (key) => data.commodities[key]?.values;
  const sum = (keys, field) => keys.reduce((acc, key) => acc + (get(key)?.[field] || 0), 0);

  return {
    dairy_total: {
      label: "Dairy reserve",
      values: {
        yearAgo: sum(["butter", "total_natural_cheese"], "yearAgo"),
        previousMonth: sum(["butter", "total_natural_cheese"], "previousMonth"),
        latest: sum(["butter", "total_natural_cheese"], "latest"),
      },
    },
    produce_total: {
      label: "Produce reserve",
      values: {
        yearAgo: sum(["total_frozen_fruit", "total_frozen_vegetables", "total_frozen_potatoes"], "yearAgo"),
        previousMonth: sum(["total_frozen_fruit", "total_frozen_vegetables", "total_frozen_potatoes"], "previousMonth"),
        latest: sum(["total_frozen_fruit", "total_frozen_vegetables", "total_frozen_potatoes"], "latest"),
      },
    },
    protein_total: {
      label: "Meat reserve",
      values: {
        yearAgo: sum(["total_frozen_red_meat", "total_frozen_poultry"], "yearAgo"),
        previousMonth: sum(["total_frozen_red_meat", "total_frozen_poultry"], "previousMonth"),
        latest: sum(["total_frozen_red_meat", "total_frozen_poultry"], "latest"),
      },
    },
  };
}

/**
 * Last nMonths values (1000 lb) for a commodity. Missing months come back as
 * null — they render as gaps, never as zero.
 */
function buildSparklineSeries(archive, commodityKey, nMonths = 60) {
  const snapshots = archive.snapshots.slice(-nMonths);
  return snapshots.map((s) => s.commodities[commodityKey] || null);
}

/**
 * Aggregate sparkline for a category. A month missing any component key is
 * null — a partial sum would draw a false dip.
 */
function buildCategorySparkline(archive, filter, nMonths = 60) {
  const keys = categoryDefinitions[filter]?.aggregateKeys || GRAND_TOTAL_KEYS;
  const snapshots = archive.snapshots.slice(-nMonths);
  return snapshots.map((s) => {
    let sum = 0;
    for (const k of keys) {
      const v = s.commodities[k];
      if (!v) return null;
      sum += v;
    }
    return sum;
  });
}

// ---------------------------------------------------------------------------
// Seasonality math
// ---------------------------------------------------------------------------
/**
 * Average seasonal profile: for each calendar month, the mean of all observed
 * values, expressed as % of the commodity's overall mean (100 = average).
 */
function seasonalIndex(archive, key) {
  const byMonth = Array.from({ length: 12 }, () => []);
  const all = [];
  for (const s of archive.snapshots) {
    const v = s.commodities[key];
    if (!v) continue;
    const m = new Date(s.observationDate + "T12:00:00Z").getUTCMonth();
    byMonth[m].push(v);
    all.push(v);
  }
  if (all.length < 18) return null; // not enough history for a seasonal read
  const overall = all.reduce((a, b) => a + b, 0) / all.length;
  return byMonth.map((vals) =>
    vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length / overall) * 100 : null,
  );
}

function peakTroughMonths(index) {
  let peak = -1, trough = -1;
  for (let m = 0; m < 12; m++) {
    if (index[m] == null) continue;
    if (peak === -1 || index[m] > index[peak]) peak = m;
    if (trough === -1 || index[m] < index[trough]) trough = m;
  }
  return { peak, trough };
}

// ---------------------------------------------------------------------------
// Records math
// ---------------------------------------------------------------------------
function archiveExtreme(archive, key, kind) {
  let best = null;
  for (const s of archive.snapshots) {
    const v = s.commodities[key];
    if (!v) continue;
    if (!best || (kind === "max" ? v > best.value : v < best.value)) {
      best = { value: v, date: s.observationDate };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------
function computeInsight(commodity, archive) {
  const snapshots = archive.snapshots;
  if (!snapshots.length) return "";

  const known = lastKnown(archive, commodity);
  if (!known) return "";
  const latestVal = known.value;

  // Rule 1: all-time extreme (requires ≥ 12 months)
  if (snapshots.length >= 12 && known.monthsStale === 0) {
    const vals = snapshots.map((s) => s.commodities[commodity] || 0).filter((v) => v > 0);
    const maxVal = Math.max(...vals);
    const minVal = Math.min(...vals);
    const monthsBack = snapshots.length;
    if (latestVal >= maxVal * 0.995) return `↑ Highest in ${Math.round(monthsBack / 12)}+ years`;
    if (latestVal <= minVal * 1.005) return `↓ Lowest in ${Math.round(monthsBack / 12)}+ years`;
  }

  // Rule 2: year-over-year shock (requires ≥ 13 months)
  if (snapshots.length >= 13 && known.monthsStale === 0) {
    const yearAgo = snapshots[snapshots.length - 13]?.commodities[commodity];
    if (yearAgo) {
      const yoy = ((latestVal - yearAgo) / yearAgo) * 100;
      if (Math.abs(yoy) >= 15) {
        const sign = yoy > 0 ? "↑ Up" : "↓ Down";
        return `${sign} ${Math.abs(Math.round(yoy))}% from last year`;
      }
    }
  }

  // Rule 3: per-capita object equivalence (every commodity gets one)
  return equivalenceText(commodity, latestVal);
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------
function animateNumber(el, rawValue, formatter = formatCompact.format.bind(formatCompact)) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finalValue = formatter(rawValue);

  if (reducedMotion) {
    el.textContent = finalValue;
    return;
  }

  const duration = 900;
  const start = performance.now();
  let settled = false;

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = rawValue * eased;
    el.textContent = formatter(value);
    if (progress < 1) requestAnimationFrame(frame);
    else settled = true;
  }

  requestAnimationFrame(frame);

  // rAF is throttled (or paused entirely) in background tabs — make sure the
  // real number lands even if the animation never gets to run.
  setTimeout(() => {
    if (!settled) el.textContent = finalValue;
  }, duration + 200);
}

function estimatedNextReleaseLabel(today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const target = new Date(year, month, 24);
  if (today > target) target.setMonth(target.getMonth() + 1);
  return target.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Sparkline canvas renderer — null-aware: missing months render as gaps
// ---------------------------------------------------------------------------
function drawSparkline(canvas, values, {
  lineColor = "#ffffff", fillOpacity = 0.12, padding = 10, lineWidth = 1.5,
  hoverIdx = null, annotations = [], axes = null, padLeft = null, padBottom = null,
  grow = 1,
} = {}) {
  if (!values || values.filter((v) => v != null).length < 2) return;

  const dpr = window.devicePixelRatio || 1;
  // Measure the wrapper, not the canvas: the canvas carries inline width/height
  // from the previous draw, which would freeze it at a stale size after resize.
  const wrap = canvas.parentElement;
  const cssW = (wrap ? wrap.clientWidth : canvas.offsetWidth) || 320;
  const cssH = (wrap ? wrap.clientHeight : canvas.offsetHeight) || 80;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const valid = values.filter((v) => v != null);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  // Plot region: extra left/bottom gutters only when axes are drawn
  const pl = padLeft ?? padding;
  const pb = padBottom ?? padding;
  // grow (0→1) scales every point up from the baseline so the whole line
  // rises into place on first load. Axes stay put; the line rises to meet them.
  const pts = values.map((v, i) => v == null ? null : ({
    x: pl + (i / (values.length - 1)) * (cssW - pl - padding),
    y: cssH - pb - grow * ((v - min) / range) * (cssH - pb - padding),
  }));

  // Axes: recessive hairline gridlines + min/mid/max y labels + year x labels
  if (axes) {
    ctx.font = '10px "Avenir Next", "Helvetica Neue", Arial, sans-serif';
    const yTicks = [min, (min + max) / 2, max];
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const tick of yTicks) {
      const y = cssH - pb - ((tick - min) / range) * (cssH - pb - padding);
      ctx.strokeStyle = hexToRgba(lineColor, 0.14);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(cssW - padding, y);
      ctx.stroke();
      ctx.fillStyle = hexToRgba(lineColor, 0.6);
      ctx.fillText(formatCompact.format(tick * 1000), pl - 7, y);
    }
    if (axes.dates) {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = hexToRgba(lineColor, 0.6);
      axes.dates.forEach((d, i) => {
        if (!d || d.slice(5, 7) !== "01" || !pts[i]) return;
        const x = pts[i].x;
        if (x < pl + 14 || x > cssW - padding - 14) return;
        ctx.fillText(d.slice(0, 4), x, cssH - 5);
      });
    }
  }

  // Split into contiguous segments around gaps
  const segments = [];
  let current = [];
  for (const p of pts) {
    if (p) current.push(p);
    else if (current.length) { segments.push(current); current = []; }
  }
  if (current.length) segments.push(current);

  for (const seg of segments) {
    if (seg.length === 1) {
      // isolated point — draw a small dot so the month isn't invisible
      ctx.beginPath();
      ctx.arc(seg[0].x, seg[0].y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(lineColor, 0.7);
      ctx.fill();
      continue;
    }
    // Filled area
    ctx.beginPath();
    ctx.moveTo(seg[0].x, cssH - pb);
    seg.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(seg[seg.length - 1].x, cssH - pb);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(lineColor, fillOpacity);
    ctx.fill();
    // Line
    ctx.beginPath();
    seg.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Annotation markers: small open rings on the line
  for (const a of annotations) {
    const p = pts[a.idx];
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }

  // Latest point dot (hidden when hovering)
  const lastPt = [...pts].reverse().find((p) => p);
  if (hoverIdx === null && lastPt) {
    ctx.beginPath();
    ctx.arc(lastPt.x, lastPt.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }

  // Hover indicator: vertical hairline + dot
  if (hoverIdx !== null && pts[hoverIdx]) {
    const hp = pts[hoverIdx];
    ctx.beginPath();
    ctx.moveTo(hp.x, padding);
    ctx.lineTo(hp.x, cssH - pb);
    ctx.strokeStyle = hexToRgba(lineColor, 0.35);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(lineColor, 0.35);
    ctx.fill();
  }
}

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * Draw a sparkline that rises from the baseline on first paint, then run an
 * optional hover-binder. Honours reduced-motion (draws the final frame
 * immediately). A per-canvas token guards against overlapping animations.
 */
function animateSparkline(canvas, values, opts = {}, bindHover = null, { duration = 700 } = {}) {
  if (!canvas) return;
  const finish = () => {
    drawSparkline(canvas, values, { ...opts, grow: 1 });
    if (bindHover) bindHover();
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !values || values.filter((v) => v != null).length < 2) { finish(); return; }

  const token = (canvas._animToken || 0) + 1;
  canvas._animToken = token;
  const start = performance.now();

  function frame(now) {
    if (canvas._animToken !== token) return; // superseded by a newer draw
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    drawSparkline(canvas, values, { ...opts, grow: eased });
    if (t < 1) requestAnimationFrame(frame);
    else finish();
  }
  requestAnimationFrame(frame);
}

/** Animate an SVG <path> drawing itself on via stroke-dashoffset. */
function animateSvgPath(path, duration = 750) {
  if (!path || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const len = path.getTotalLength ? path.getTotalLength() : 0;
  if (!len) return;
  path.style.transition = "none";
  path.style.strokeDasharray = `${len}`;
  path.style.strokeDashoffset = `${len}`;
  // next frame: transition the offset to 0
  requestAnimationFrame(() => {
    path.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    path.style.strokeDashoffset = "0";
  });
}

/** Snap a clientX to the nearest index that actually has data. */
function nearestDataIdx(values, rawIdx) {
  if (values[rawIdx] != null) return rawIdx;
  for (let d = 1; d < values.length; d++) {
    if (values[rawIdx - d] != null) return rawIdx - d;
    if (values[rawIdx + d] != null) return rawIdx + d;
  }
  return rawIdx;
}

// ---------------------------------------------------------------------------
// Narrative slab copy generator
// ---------------------------------------------------------------------------
function buildNarrativeCopy(data, filter) {
  if (filter === "dairy") {
    const butterLb = data.commodities.butter.values.latest * 1000;
    const sticks = Math.round(butterLb / 0.25);
    const sticksPerAmerican = (sticks / US_POPULATION).toFixed(1);
    return `The US currently stores enough butter for every American to unwrap about <strong>${sticksPerAmerican} sticks</strong> — a reserve that swells in late summer and draws down through the holidays.`;
  }

  if (filter === "protein") {
    const chickenLb = data.commodities.total_chicken.values.latest * 1000;
    const wholeBirds = Math.round(chickenLb / 5);
    const birdsPerAmerican = (wholeBirds / US_POPULATION).toFixed(1);
    return `US frozen chicken reserves represent roughly <strong>${birdsPerAmerican} whole birds per American</strong> — a buffer the system maintains regardless of what happens at the farm gate this week.`;
  }

  if (filter === "produce") {
    const vegLb = data.commodities.total_frozen_vegetables.values.latest * 1000;
    const servings = Math.round(vegLb / 0.5);
    const servingsPerAmerican = Math.round(servings / US_POPULATION);
    return `Frozen vegetable stores alone hold the equivalent of <strong>${servingsPerAmerican} half-pound servings per American</strong> — about ${Math.round(servingsPerAmerican / 365 * 10) / 10} years of daily portions for every person in the country.`;
  }

  // all / default: grand total
  const grandTotal = computeGrandTotal(getLatestSnapshot(data.archive));
  const grandTotalLb = grandTotal * 1000;
  const cargoShips = Math.round(grandTotalLb / 154_000_000); // ~70k DWT ship ≈ 154M lb
  const lbPerAmerican = Math.round(grandTotalLb / US_POPULATION);
  return `Across these categories the US cold chain holds <strong>${formatCompact.format(grandTotalLb)} lb</strong> of frozen food right now — about <strong>${lbPerAmerican} lb per American</strong>, or the equivalent cargo of roughly ${cargoShips} fully loaded container ships.`;
}

// ---------------------------------------------------------------------------
// Render: the "nine missed meals" perspective — the whole frozen reserve
// measured against how much the country eats in a day. Generated from data
// so the day-count stays honest as the monthly total moves.
// ---------------------------------------------------------------------------
function renderPerspective(data) {
  const el = document.getElementById("why-perspective");
  if (!el) return;
  const grandTotalLb = computeGrandTotal(getLatestSnapshot(data.archive)) * 1000;
  const dailyBillions = (US_DAILY_FOOD_LB / 1e9).toFixed(1);
  const days = Math.round(grandTotalLb / US_DAILY_FOOD_LB);
  el.innerHTML =
    `Americans eat through roughly <strong>${dailyBillions} billion pounds</strong> of food a day. ` +
    `Nine missed meals is three days without it — and the nation's entire frozen reserve is only about ` +
    `<strong>${days} days&rsquo;</strong> worth.`;
}

// ---------------------------------------------------------------------------
// Render: hero (grand total cold storage)
// ---------------------------------------------------------------------------
function renderHero(data) {
  const latest = getLatestSnapshot(data.archive);
  const prevMonth = getPrevMonthSnapshot(data.archive);
  const yearAgo = getYearAgoSnapshot(data.archive);

  const grandLatest = computeGrandTotal(latest);
  const grandPrev = computeGrandTotal(prevMonth);
  const grandYear = computeGrandTotal(yearAgo);

  const mom = calculateChange(grandPrev, grandLatest);
  const yoy = calculateChange(grandYear, grandLatest);

  const heroEl = document.getElementById("hero-value");
  const heroUnitEl = document.getElementById("hero-unit");
  if (state.perCapita) {
    const perLb = (grandLatest * 1000) / US_POPULATION;
    animateNumber(heroEl, perLb, (v) => Math.round(v).toLocaleString("en-US"));
    if (heroUnitEl) heroUnitEl.textContent = "lb / American";
  } else {
    animateNumber(heroEl, grandLatest * 1000, (v) => formatCompact.format(v));
    if (heroUnitEl) heroUnitEl.textContent = "lb";
  }

  document.getElementById("hero-observation-date").textContent =
    `${new Date(latest.observationDate + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })} data`.toUpperCase();
  document.getElementById("hero-mom").textContent = formatPercent(mom);
  document.getElementById("hero-mom").className = `delta ${mom >= 0 ? "delta--up" : "delta--down"}`;
  document.getElementById("hero-yoy").textContent = formatPercent(yoy);
  document.getElementById("hero-yoy").className = `delta ${yoy >= 0 ? "delta--up" : "delta--down"}`;

  // Release metadata. If the snapshot doesn't carry its own release date,
  // estimate it: cold storage for month M lands around the 22nd of M+1.
  const releaseEl = document.getElementById("release-date");
  if (latest.releaseDate) {
    releaseEl.textContent = new Date(latest.releaseDate + "T12:00:00Z")
      .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  } else {
    const obs = new Date(latest.observationDate + "T12:00:00Z");
    const est = new Date(Date.UTC(obs.getUTCFullYear(), obs.getUTCMonth() + 1, 22));
    releaseEl.textContent = est.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  document.getElementById("next-release").textContent = estimatedNextReleaseLabel();
  const reportLink = document.getElementById("report-link");
  if (reportLink && latest.reportUrl) {
    // Only accept https USDA links from the data file — a poisoned archive
    // must not be able to plant a javascript: or off-site href.
    try {
      const url = new URL(latest.reportUrl);
      if (url.protocol === "https:" && (url.hostname === "usda.gov" || url.hostname.endsWith(".usda.gov"))) {
        reportLink.href = url.href;
      }
    } catch {
      /* malformed URL — keep the hardcoded fallback href */
    }
  }
}

// ---------------------------------------------------------------------------
// Render: dynamic editorial tiles (fast mover + volume leader)
// The headline copy is generated from the data so it can never go stale.
// ---------------------------------------------------------------------------
function pickFastestMover(data) {
  let best = null;
  for (const key of Object.keys(COMMODITY_LABELS)) {
    const c = data.commodities[key];
    if (!c || !c.values.latest || !c.values.previousMonth) continue;
    const mom = calculateChange(c.values.previousMonth, c.values.latest);
    if (!best || Math.abs(mom) > Math.abs(best.mom)) {
      best = { key, mom, yoy: calculateChange(c.values.yearAgo, c.values.latest), values: c.values };
    }
  }
  return best;
}

function pickVolumeLeader(data) {
  let best = null;
  for (const key of LEADER_KEYS) {
    const c = data.commodities[key];
    if (!c || !c.values.latest) continue;
    if (!best || c.values.latest > best.values.latest) {
      best = { key, values: c.values, mom: calculateChange(c.values.previousMonth, c.values.latest) };
    }
  }
  return best;
}

function moverHeadline(label, mom, yoy) {
  if (mom >= 8)  return `${label} is piling up.`;
  if (mom > 0 && yoy < 0) return `${label} snapped back.`;
  if (mom > 0)  return `${label} keeps climbing.`;
  if (mom <= -8) return `${label} is draining fast.`;
  return `${label} slipped.`;
}

function renderEditorialTiles(data) {
  const mover = pickFastestMover(data);
  const leader = pickVolumeLeader(data);

  if (mover) {
    const label = labelFor(mover.key).replace(/^Total /, "").replace(/^./, (c) => c.toUpperCase());
    document.getElementById("mover-title").textContent = moverHeadline(label, mover.mom, mover.yoy);
    const fmt = formatHeadlineValue(mover.key, mover.values.latest);
    document.getElementById("mover-value").textContent = fmt.num;
    document.getElementById("mover-unit").textContent = `${fmt.unit} in storage`;
    const momEl = document.getElementById("mover-mom");
    momEl.textContent = formatPercent(mover.mom);
    momEl.className = `delta ${mover.mom >= 0 ? "delta--up" : "delta--down"}`;
    const yoyEl = document.getElementById("mover-yoy");
    yoyEl.textContent = formatPercent(mover.yoy);
    yoyEl.className = `delta ${mover.yoy >= 0 ? "delta--up" : "delta--down"}`;
    const badge = document.getElementById("insight-mover");
    if (badge) badge.textContent = computeInsight(mover.key, data.archive);
  }

  if (leader) {
    const label = labelFor(leader.key).replace(/^Total /, "");
    const verb = /(vegetables|potatoes|bellies)$/i.test(label) ? "hold" : "holds";
    document.getElementById("leader-title").textContent =
      `${label.replace(/^./, (c) => c.toUpperCase())} ${verb} the most ground.`;
    const fmt = formatHeadlineValue(leader.key, leader.values.latest);
    document.getElementById("leader-value").textContent = fmt.num;
    document.getElementById("leader-unit").textContent =
      state.perCapita ? fmt.unit : `lb of ${/frozen/i.test(label) ? "" : "frozen "}${label.toLowerCase()}`;
    const momEl = document.getElementById("leader-mom");
    momEl.textContent = formatPercent(leader.mom);
    momEl.className = `delta ${leader.mom >= 0 ? "delta--up" : "delta--down"}`;
    const badge = document.getElementById("insight-leader");
    if (badge) badge.textContent = computeInsight(leader.key, data.archive);
  }
}

// ---------------------------------------------------------------------------
// Render: cheese cave art panel
// ---------------------------------------------------------------------------
// Bar gradients for the biggest-ticket stack (readable dark text on each).
const BIGGEST_FILLS = [
  "linear-gradient(90deg, #dcc55b, #f0dd87)", // sun
  "linear-gradient(90deg, #ef7132, #f39a55)", // coral
  "linear-gradient(90deg, #cda8ef, #e1c5f6)", // lavender
  "linear-gradient(90deg, #c8a06b, #ddc199)", // sand
  "linear-gradient(90deg, #7fa0f0, #a9c0f7)", // cobalt tint
  "linear-gradient(90deg, #9fc08c, #c2d9b4)", // kelp tint
  "linear-gradient(90deg, #e9dcc3, #f7efe0)", // paper
];

// Short display label for the big-ticket bars ("Total frozen vegetables" →
// "Vegetables"); keeps the bar label from truncating.
function shortCategoryLabel(key) {
  const label = COMMODITY_LABELS[key] || labelFor(key);
  const trimmed = label.replace(/^Total frozen /i, "").replace(/^Total /i, "");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// The All-Storage summary block: the biggest single categories in the entire
// US cold-storage system, as bars scaled to each one's share of the mountain.
function renderBiggestItems(data) {
  const stack = document.getElementById("cave-stack");
  if (!stack) return;
  const items = GRAND_TOTAL_KEYS
    .map((key) => ({ key, latest: data.commodities[key]?.values.latest || 0 }))
    .filter((item) => item.latest > 0)
    .sort((a, b) => b.latest - a.latest);
  if (!items.length) { stack.innerHTML = ""; return; }
  const max = items[0].latest;

  stack.innerHTML = items
    .map((item, index) => {
      const width = 52 + (item.latest / max) * 48;
      const label = shortCategoryLabel(item.key);
      const fill = BIGGEST_FILLS[index % BIGGEST_FILLS.length];
      return `
        <div class="cave-layer" style="width:${width}%; background:${fill}; animation-delay:${index * 0.5}s;" data-commodity-key="${item.key}" role="button" tabindex="0" aria-label="${escapeHtml(label)}: ${formatCompact.format(item.latest * 1000)} lb — open detail">
          <div class="cave-layer-label">
            <span>${escapeHtml(label)}</span>
            <span>${formatCompact.format(item.latest * 1000)} lb</span>
          </div>
        </div>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Render: narrative slab
// ---------------------------------------------------------------------------
function renderNarrative(data, filter) {
  const el = document.getElementById("narrative-copy");
  if (!el) return;
  el.innerHTML = buildNarrativeCopy(data, filter);
}

// ---------------------------------------------------------------------------
// Render: chart strip (5-year trend sparkline) with event annotations
// ---------------------------------------------------------------------------
function buildTrendAnnotations(values, dates, filter) {
  const annotations = [];

  // Curated events (only when relevant to the active filter)
  for (const ev of TREND_EVENTS) {
    if (!ev.filters.includes(filter)) continue;
    const idx = dates.findIndex((d) => d.startsWith(ev.month));
    if (idx >= 0 && values[idx] != null) annotations.push({ idx, label: ev.label });
  }

  // Data-derived: 5-year high and low of the displayed series
  let maxIdx = -1, minIdx = -1;
  values.forEach((v, i) => {
    if (v == null) return;
    if (maxIdx === -1 || v > values[maxIdx]) maxIdx = i;
    if (minIdx === -1 || v < values[minIdx]) minIdx = i;
  });
  if (maxIdx >= 0 && !annotations.some((a) => a.idx === maxIdx)) {
    annotations.push({ idx: maxIdx, label: "5-year high" });
  }
  if (minIdx >= 0 && !annotations.some((a) => a.idx === minIdx)) {
    annotations.push({ idx: minIdx, label: "5-year low" });
  }
  return annotations;
}

function renderChartStrip(data, filter, { animate = false } = {}) {
  const canvas = document.getElementById("trend-canvas");
  const label = document.getElementById("trend-label");
  const monthCount = document.getElementById("trend-months");
  if (!canvas) return;

  const values = buildCategorySparkline(data.archive, filter, 60);

  if (values.filter((v) => v != null).length < 2) {
    canvas.style.display = "none";
    if (label) label.textContent = "Historical archive building…";
    if (monthCount) monthCount.textContent = "Run scripts/fetch-usda.py --backfill 60 to populate";
    return;
  }

  canvas.style.display = "block";

  const catDef = categoryDefinitions[filter];
  if (label) label.textContent = catDef?.title || "Total cold storage trend";
  if (monthCount) monthCount.textContent = `${values.filter((v) => v != null).length} monthly snapshots`;

  const snapshots = data.archive.snapshots.slice(-values.length);
  const dates = snapshots.map((s) => s.observationDate);
  const annotations = buildTrendAnnotations(values, dates, filter);

  const opts = { lineColor: "#fbf5ea", fillOpacity: 0.14, padding: 12, lineWidth: 2, annotations, padLeft: 52, padBottom: 22, axes: { dates } };
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label",
    `${catDef?.title || "Total cold storage"} — 5-year trend, latest ${formatCompact.format((values.findLast((v) => v != null) || 0) * 1000)} lb`);
  const bind = () => bindChartHover(canvas, values, dates, opts);
  if (animate) animateSparkline(canvas, values, opts, bind, { duration: 850 });
  else { drawSparkline(canvas, values, opts); bind(); }
}

function bindChartHover(canvas, values, dates, opts) {
  const tooltip = document.getElementById("chart-tooltip");
  if (!tooltip) return;

  if (canvas._hoverCleanup) { canvas._hoverCleanup(); }

  const dateEl = tooltip.querySelector(".chart-tooltip-date");
  const valueEl = tooltip.querySelector(".chart-tooltip-value");
  const noteEl = tooltip.querySelector(".chart-tooltip-note");
  const padding = opts.padding ?? 12;
  const padL = opts.padLeft ?? padding;
  const n = values.length;
  const annotations = opts.annotations || [];

  function getIdx(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const step = (rect.width - padL - padding) / (n - 1);
    const raw = Math.max(0, Math.min(n - 1, Math.round((x - padL) / step)));
    return nearestDataIdx(values, raw);
  }

  function onMove(e) {
    const idx = getIdx(e.clientX);
    if (values[idx] == null) return;
    drawSparkline(canvas, values, { ...opts, hoverIdx: idx });

    const rect = canvas.getBoundingClientRect();
    const step = (rect.width - padL - padding) / (n - 1);
    const xPx = padL + idx * step;
    const xPct = (xPx / rect.width) * 100;

    tooltip.style.left = `${xPct}%`;
    tooltip.style.transform = xPct > 72 ? "translateX(-92%)" : "translateX(-8%)";
    tooltip.classList.add("chart-tooltip--visible");

    dateEl.textContent = shortMonthYear(dates[idx]);
    valueEl.textContent = formatCompact.format(values[idx] * 1000) + " lb";
    const note = annotations.find((a) => Math.abs(a.idx - idx) <= 0);
    if (noteEl) noteEl.textContent = note ? note.label : "";
  }

  function onLeave() {
    drawSparkline(canvas, values, opts);
    tooltip.classList.remove("chart-tooltip--visible");
  }

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas._hoverCleanup = () => {
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerdown", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
  };
}

// ---------------------------------------------------------------------------
// Shared floating sparkline tooltip (reused by all small tiles)
// ---------------------------------------------------------------------------
let _sparkTooltip = null;
function getSparkTooltip() {
  if (_sparkTooltip) return _sparkTooltip;
  const el = document.createElement("div");
  el.className = "spark-tooltip";
  el.innerHTML = `<p class="spark-tooltip-date"></p><p class="spark-tooltip-value"></p>`;
  document.body.appendChild(el);
  _sparkTooltip = el;
  return el;
}

/**
 * Attach point-in-time hover/touch scrubbing to any canvas sparkline.
 */
function attachSparklineHover(canvas, values, dates, opts = {}) {
  if (!canvas || !values || values.filter((v) => v != null).length < 2) return;
  if (canvas._hoverCleanup) canvas._hoverCleanup();

  const tooltip = getSparkTooltip();
  const dateEl = tooltip.querySelector(".spark-tooltip-date");
  const valueEl = tooltip.querySelector(".spark-tooltip-value");
  const padding = opts.padding ?? 10;
  const padL = opts.padLeft ?? padding;
  const n = values.length;

  function getIdx(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const step = (rect.width - padL - padding) / (n - 1);
    const raw = Math.max(0, Math.min(n - 1, Math.round((x - padL) / step)));
    return nearestDataIdx(values, raw);
  }

  function onMove(e) {
    const idx = getIdx(e.clientX);
    if (values[idx] == null) return;
    drawSparkline(canvas, values, { ...opts, hoverIdx: idx });

    dateEl.textContent = shortMonthYear(dates[idx]);
    valueEl.textContent = formatCompact.format(values[idx] * 1000) + " lb";

    tooltip.classList.add("spark-tooltip--visible");
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    let left = e.clientX + 14;
    let top = e.clientY - th - 12;
    if (left + tw > window.innerWidth - 8) left = e.clientX - tw - 14;
    if (top < 8) top = e.clientY + 16;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function onLeave() {
    drawSparkline(canvas, values, opts);
    tooltip.classList.remove("spark-tooltip--visible");
  }

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas._hoverCleanup = () => {
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
    tooltip.classList.remove("spark-tooltip--visible");
  };
}

// ---------------------------------------------------------------------------
// Render: comparison grid
// ---------------------------------------------------------------------------
function getSeriesForFilter(data, filter) {
  if (filter === "all") {
    const aggregates = buildAggregateSeries(data);
    return [
      { label: aggregates.dairy_total.label, values: aggregates.dairy_total.values },
      { label: aggregates.produce_total.label, values: aggregates.produce_total.values },
      { label: aggregates.protein_total.label, values: aggregates.protein_total.values },
    ];
  }

  return categoryDefinitions[filter].commodities.map((key) => ({
    key,
    label: data.commodities[key].label,
    values: data.commodities[key].values,
  }));
}

function renderCompareGrid(data, filter, {
  grid = document.getElementById("compare-grid"),
  title = document.getElementById("compare-title"),
} = {}) {
  const compareGrid = grid;
  const compareTitle = title;
  if (!compareGrid) return;
  const series = getSeriesForFilter(data, filter);

  if (compareTitle) compareTitle.textContent = categoryDefinitions[filter].title;

  compareGrid.innerHTML = series
    .map((item) => {
      const entries = [
        { label: "Year ago", key: "yearAgo", className: "year-ago" },
        { label: "Last month", key: "previousMonth", className: "previous" },
        { label: "Latest", key: "latest", className: "latest" },
      ];

      // Zero-baseline bars: heights are proportional to volume, so a 2%
      // move looks like a 2% move. The % caption carries the direction.
      const rowMax = Math.max(...entries.map((e) => item.values[e.key]));

      const bars = entries
        .map((entry) => {
          const value = item.values[entry.key];
          const height = rowMax > 0 ? Math.max(3, (value / rowMax) * 100) : 0;
          return `
            <div class="compare-bar-wrap">
              <div class="compare-bar-zone">
                <div class="compare-bar compare-bar--${entry.className}" style="height:${height}%"></div>
              </div>
              <div class="compare-caption">
                <strong>${entry.label}</strong>
                <span>${formatCompact.format(value * 1000)} lb</span>
              </div>
            </div>`;
        })
        .join("");

      const delta = calculateChange(item.values.previousMonth, item.values.latest);

      return `
        <article class="compare-row"${item.key ? ` data-commodity-key="${item.key}" role="button" tabindex="0"` : ""}>
          <div class="compare-head">
            <p class="compare-name">${escapeHtml(item.label)}</p>
            <p class="compare-values">${formatPercent(delta)} vs last month</p>
          </div>
          <div class="compare-bars">${bars}</div>
        </article>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Render: ranking list
// ---------------------------------------------------------------------------
function renderRanking(data, filter, {
  list = document.getElementById("ranking-list"),
  note = document.getElementById("ranking-note"),
} = {}) {
  const rankingList = list;
  const rankingNote = note;
  if (!rankingList) return;

  const source = filter === "all"
    ? LEAF_KEYS.map((key) => ({
        key,
        label: data.commodities[key]?.label || labelFor(key),
        values: data.commodities[key]?.values || { latest: 0, previousMonth: 0 },
      }))
    : getSeriesForFilter(data, filter);

  const items = source
    .map((item) => ({
      key: item.key,
      label: item.label,
      latest: item.values.latest,
      mom: calculateChange(item.values.previousMonth, item.values.latest),
    }))
    .filter((item) => item.latest > 0)
    .sort((a, b) => b.latest - a.latest);

  const maxLatest = Math.max(...items.map((item) => item.latest));
  if (rankingNote) rankingNote.textContent = categoryDefinitions[filter].rankingNote;

  const rowFor = (item) => {
    const width = (item.latest / maxLatest) * 100;
    const deltaClass = item.mom >= 0 ? "delta--up" : "delta--down";
    const fmt = formatHeadlineValue(item.key, item.latest);
    return `
      <article class="ranking-row"${item.key ? ` data-commodity-key="${item.key}" role="button" tabindex="0"` : ""}>
        <p class="ranking-name">${escapeHtml(item.label)}</p>
        <div class="ranking-bar-shell">
          <div class="ranking-bar-fill" style="width:${width}%"></div>
        </div>
        <p class="ranking-value">${fmt.num} ${fmt.unit}</p>
        <p class="ranking-change ${deltaClass}">${formatPercent(item.mom)}</p>
      </article>`;
  };

  // Deep-cut components ride below a divider — same bar scale, so a ham bar
  // can be honestly eyeballed against the total-pork bar it lives inside.
  let componentRows = "";
  const componentKeys = categoryDefinitions[filter].components || [];
  if (componentKeys.length) {
    const comps = componentKeys
      .map((key) => {
        const c = data.commodities[key];
        if (!c?.values?.latest) return null;
        return {
          key,
          label: labelFor(key),
          latest: c.values.latest,
          mom: calculateChange(c.values.previousMonth, c.values.latest),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.latest - a.latest);
    const shown = comps.slice(0, 8);
    if (shown.length) {
      const note = categoryDefinitions[filter].componentsNote || "Components & cuts";
      componentRows =
        `<p class="ranking-divider">${escapeHtml(note)}</p>` +
        shown.map(rowFor).join("") +
        (comps.length > shown.length
          ? `<p class="ranking-more">+ ${comps.length - shown.length} more in <button type="button" class="ranking-more-link" data-goto-tab="deep-cuts">The Weird Stuff&nbsp;↗</button></p>`
          : "");
    }
  }

  rankingList.innerHTML = items.map(rowFor).join("") + componentRows;
}

// ---------------------------------------------------------------------------
// Render: Through Time — small multiples of all 15 commodities
// ---------------------------------------------------------------------------
const TT_COLORS = {
  dairy:   { line: "#8a6a22", bg: "dairy"   },
  produce: { line: "#2e5c1e", bg: "produce" },
  protein: { line: "#3456d1", bg: "protein" },
};

function renderThroughTime(data, filter = "all") {
  const grid = document.getElementById("through-time-grid");
  if (!grid) return;

  const keys = filter === "all"
    ? Object.keys(COMMODITY_LABELS)
    : Object.keys(COMMODITY_LABELS).filter((k) => COMMODITY_GROUPS[k] === filter);

  grid.innerHTML = keys.map((key) => {
    const label = COMMODITY_LABELS[key];
    const group = COMMODITY_GROUPS[key];
    const series = buildSparklineSeries(data.archive, key, 60);
    const known = lastKnown(data.archive, key);
    const latest = known ? known.value : 0;
    // YoY against the same calendar month a year before the last known value
    const lastIdx = series.length - 1 - (known ? known.monthsStale : 0);
    const yearAgo = lastIdx >= 12 ? series[lastIdx - 12] : null;
    const yoy = yearAgo && latest ? ((latest - yearAgo) / yearAgo) * 100 : null;
    const yoyText = yoy !== null ? `${yoy >= 0 ? "+" : ""}${Math.round(yoy)}% YoY` : "";
    const asOf = known && known.monthsStale > 0 ? ` · as of ${shortMonthYear(known.date)}` : "";
    const canvasId = `tt-canvas-${key}`;
    const ttSnaps = data.archive.snapshots.slice(-series.length);
    const rangeRow = ttSnaps.length >= 2
      ? `<div class="spark-range" aria-hidden="true"><span>${ttSnaps[0].observationDate.slice(0, 4)}</span><span>${ttSnaps[ttSnaps.length - 1].observationDate.slice(0, 4)}</span></div>`
      : "";
    const fmt = formatHeadlineValue(key, latest);

    return `
      <div class="sparkline-tile sparkline-tile--${group}" data-commodity-key="${key}" role="button" tabindex="0" aria-label="${label}: ${fmt.num} ${fmt.unit} — open detail">
        <div class="sparkline-tile-top">
          <p class="sparkline-tile-label">${label}</p>
          <p class="sparkline-tile-value">${fmt.num}${state.perCapita ? `<span class="sparkline-tile-percap"> ${fmt.unit}</span>` : ""}</p>
        </div>
        <div class="sparkline-tile-canvas-wrap">
          <canvas class="sparkline-tile-canvas" id="${canvasId}" role="img" aria-label="${escapeHtml(label)} 5-year trend, latest ${formatCompact.format(latest * 1000)} lb"></canvas>
        </div>
        ${rangeRow}
        ${yoyText || asOf ? `<p class="sparkline-tile-yoy">${yoyText}${asOf}</p>` : ""}
      </div>`;
  }).join("");

  // Draw sparklines after DOM insertion
  requestAnimationFrame(() => {
    keys.forEach((key) => {
      const canvas = document.getElementById(`tt-canvas-${key}`);
      if (!canvas) return;
      const group = COMMODITY_GROUPS[key];
      const colors = TT_COLORS[group] || TT_COLORS.protein;
      const series = buildSparklineSeries(data.archive, key, 60);
      if (series.filter((v) => v != null).length >= 2) {
        const dates = data.archive.snapshots.slice(-series.length).map((s) => s.observationDate);
        const opts = { lineColor: colors.line, fillOpacity: 0.15, lineWidth: 1.5 };
        animateSparkline(canvas, series, opts, () => attachSparklineHover(canvas, series, dates, opts), { duration: 600 });
      }
    });
  });
}

function bindThroughTimeFilters(data) {
  const pills = document.querySelectorAll("[data-tt-filter]");

  function update(next) {
    state.ttFilter = next;
    pills.forEach((p) => {
      const active = p.dataset.ttFilter === next;
      p.classList.toggle("is-active", active);
      p.setAttribute("aria-pressed", String(active));
    });
    renderThroughTime(data, next);
  }

  pills.forEach((p) => p.addEventListener("click", () => update(p.dataset.ttFilter)));
  update(state.ttFilter);
}

// ---------------------------------------------------------------------------
// Render: Seasonality — "The freezer has seasons"
// ---------------------------------------------------------------------------
function seasonalTileSvg(index, { currentMonth = null, lineColor = "#3456d1", variant = "tile" } = {}) {
  const modal = variant === "modal";
  const W = modal ? 640 : 260;
  const H = modal ? 200 : 118;
  const padL = 30;                 // room for the "avg" / axis labels
  const padR = modal ? 44 : 12;    // room for peak/trough end labels
  const padTop = modal ? 26 : 16;
  const padBottom = 26;

  const valid = index.filter((v) => v != null);
  // Always keep 100 (the mean) inside the plotted range so the avg line shows.
  const min = Math.min(...valid, 100);
  const max = Math.max(...valid, 100);
  const range = max - min || 1;

  const px = (m) => padL + (m / 11) * (W - padL - padR);
  const py = (v) => H - padBottom - ((v - min) / range) * (H - padTop - padBottom);

  let d = "";
  index.forEach((v, m) => {
    if (v == null) return;
    d += (d === "" ? "M" : "L") + px(m).toFixed(1) + " " + py(v).toFixed(1) + " ";
  });

  const { peak, trough } = peakTroughMonths(index);

  const monthTicks = MONTH_ABBR.map((abbr, m) =>
    `<text x="${px(m).toFixed(1)}" y="${H - 8}" class="seasonal-month${m === currentMonth ? " seasonal-month--now" : ""}" text-anchor="middle">${modal ? abbr : abbr[0]}</text>`,
  ).join("");

  // Reference line at 100 (= this commodity's own yearly average)
  const avgY = py(100).toFixed(1);
  const avgLine =
    `<line x1="${padL}" y1="${avgY}" x2="${(W - padR).toFixed(1)}" y2="${avgY}" class="seasonal-avg-line"/>` +
    `<text x="${padL - 4}" y="${avgY}" class="seasonal-avg-label" text-anchor="end" dominant-baseline="middle">avg</text>`;

  const nowBand = currentMonth != null
    ? `<rect x="${(px(currentMonth) - 7).toFixed(1)}" y="${padTop - 6}" width="14" height="${H - padTop - padBottom + 12}" rx="7" class="seasonal-now-band"/>`
    : "";

  // Peak / trough dots with month + delta labels. Labels sit above their dot
  // (clamped below the top edge) and anchor-flip near the left/right edges so
  // they never clip the tile or collide with the month row.
  const extremeLabel = (m, delta) => {
    const x = px(m);
    let anchor = "middle", lx = x;
    if (x < padL + 24) { anchor = "start"; lx = x - 4; }
    else if (x > W - padR - 24) { anchor = "end"; lx = x + 4; }
    const y = Math.max(padTop + 2, py(index[m]) - 7);
    const sign = delta > 0 ? "+" : "";
    return `<text x="${lx.toFixed(1)}" y="${y.toFixed(1)}" class="seasonal-extreme-label" text-anchor="${anchor}">${MONTH_ABBR[m]} ${sign}${delta}%</text>`;
  };
  const peakDot = peak >= 0
    ? `<circle cx="${px(peak).toFixed(1)}" cy="${py(index[peak]).toFixed(1)}" r="4" fill="${lineColor}"/>` +
      extremeLabel(peak, Math.round(index[peak] - 100))
    : "";
  const troughDot = trough >= 0
    ? `<circle cx="${px(trough).toFixed(1)}" cy="${py(index[trough]).toFixed(1)}" r="4" fill="none" stroke="${lineColor}" stroke-width="1.5"/>` +
      extremeLabel(trough, Math.round(index[trough] - 100))
    : "";

  return `<svg viewBox="0 0 ${W} ${H}" class="seasonal-svg${modal ? " seasonal-svg--modal" : ""}" aria-hidden="true">
    ${nowBand}
    ${avgLine}
    <path d="${d.trim()}" class="seasonal-line" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${peakDot}${troughDot}${monthTicks}
  </svg>`;
}

function renderSeasonality(data) {
  const grid = document.getElementById("seasonality-grid");
  const headline = document.getElementById("seasonality-now");
  if (!grid) return;

  const latest = getLatestSnapshot(data.archive);
  const reportMonth = new Date(latest.observationDate + "T12:00:00Z").getUTCMonth();

  // Dynamic "right now" line: biggest seasonal climber + faller for this month
  let climber = null, faller = null;
  for (const key of Object.keys(COMMODITY_LABELS)) {
    const idx = seasonalIndex(data.archive, key);
    if (!idx) continue;
    const prev = idx[(reportMonth + 11) % 12];
    const cur = idx[reportMonth];
    if (prev == null || cur == null) continue;
    const delta = cur - prev;
    if (!climber || delta > climber.delta) climber = { key, delta };
    if (!faller || delta < faller.delta) faller = { key, delta };
  }
  if (headline && climber && faller) {
    const monthName = MONTH_NAMES[reportMonth];
    headline.innerHTML =
      `In a typical <strong>${monthName}</strong>, ` +
      `<strong>${labelFor(climber.key).toLowerCase()}</strong> is building fastest ` +
      `and <strong>${labelFor(faller.key).toLowerCase()}</strong> is drawing down hardest.`;
  }

  const keys = Object.keys(COMMODITY_LABELS);
  grid.innerHTML = keys.map((key) => {
    const idx = seasonalIndex(data.archive, key);
    if (!idx) return "";
    const group = COMMODITY_GROUPS[key];
    const colors = TT_COLORS[group] || TT_COLORS.protein;
    const { peak, trough } = peakTroughMonths(idx);
    const swing = peak >= 0 && trough >= 0 ? Math.round(idx[peak] - idx[trough]) : 0;
    const note = SEASONAL_NOTES[key]
      || (peak >= 0 && trough >= 0
        ? `Peaks in ${MONTH_NAMES[peak]} · lowest in ${MONTH_NAMES[trough]}.`
        : "");
    const swingClass = swing >= 30 ? "seasonal-swing--big" : swing >= 12 ? "seasonal-swing--mid" : "";

    return `
      <div class="seasonal-tile sparkline-tile--${group}" data-commodity-key="${key}" role="button" tabindex="0" aria-label="${labelFor(key)} seasonal pattern — peaks in ${peak >= 0 ? MONTH_NAMES[peak] : "n/a"}, lowest in ${trough >= 0 ? MONTH_NAMES[trough] : "n/a"}">
        <div class="seasonal-tile-top">
          <p class="seasonal-tile-label">${labelFor(key)}</p>
          ${swing ? `<span class="seasonal-swing ${swingClass}">±${swing}%</span>` : ""}
        </div>
        ${seasonalTileSvg(idx, { currentMonth: reportMonth, lineColor: colors.line })}
        <p class="seasonal-tile-note">${note}</p>
      </div>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// Render: This month in the freezer — seasonal script vs. actual tape
// ---------------------------------------------------------------------------
function renderMonthInFreezer(data) {
  const wrap = document.getElementById("month-cards");
  if (!wrap) return;
  const latest = getLatestSnapshot(data.archive);
  const m = new Date(latest.observationDate + "T12:00:00Z").getUTCMonth();
  const monthName = MONTH_NAMES[m];
  const note = document.getElementById("month-note");
  if (note) note.textContent = `${monthName} · what should move vs. what did`;

  const rows = [];
  for (const key of Object.keys(COMMODITY_LABELS)) {
    const idx = seasonalIndex(data.archive, key);
    if (!idx) continue;
    const prevIdx = idx[(m + 11) % 12];
    const curIdx = idx[m];
    if (prevIdx == null || curIdx == null) continue;
    const values = data.commodities[key]?.values;
    if (!values?.previousMonth || !values?.latest) continue;
    // Expected MoM move, in points of the commodity's own average (≈ %)
    const expected = ((curIdx - prevIdx) / prevIdx) * 100;
    const actual = calculateChange(values.previousMonth, values.latest);
    rows.push({ key, expected, actual, deviation: actual - expected });
  }
  if (rows.length < 3) return;

  const climber = rows.reduce((a, b) => (b.expected > a.expected ? b : a));
  const faller = rows.reduce((a, b) => (b.expected < a.expected ? b : a));
  const offScript = rows
    .filter((r) => r.key !== climber.key && r.key !== faller.key)
    .reduce((a, b) => (Math.abs(b.deviation) > Math.abs(a.deviation) ? b : a));

  const fmtScript = (v) => `${v >= 0 ? "+" : ""}${Math.round(v)}%`;
  const verdictFor = (r) => {
    const sameDirection = (r.expected >= 0) === (r.actual >= 0);
    if (Math.abs(r.deviation) < 3) return "right on script.";
    if (sameDirection) return r.deviation > 0 ? "on script, running hot." : "on script, running cool.";
    return "breaking the script.";
  };

  const card = (r, tag, tagClass) => {
    const why = SEASONAL_NOTES[r.key] || "";
    const deltaClass = r.actual >= 0 ? "delta--up" : "delta--down";
    return `
      <article class="month-card" data-commodity-key="${r.key}" role="button" tabindex="0" aria-label="${labelFor(r.key)} — typical ${monthName} ${fmtScript(r.expected)}, this year ${formatPercent(r.actual)}">
        <p class="month-card-tag ${tagClass}">${tag}</p>
        <h3 class="month-card-name">${escapeHtml(labelFor(r.key))}</h3>
        ${why ? `<p class="month-card-why">${why}</p>` : ""}
        <p class="month-card-verdict">Typical ${monthName}: <strong>${fmtScript(r.expected)}</strong> · this year: <strong class="${deltaClass}">${formatPercent(r.actual)}</strong> — ${verdictFor(r)}</p>
      </article>`;
  };

  wrap.innerHTML =
    card(climber, "The builder", "month-card-tag--build") +
    card(faller, "The drainer", "month-card-tag--drain") +
    card(offScript, "Off script", "month-card-tag--off");
}

// Delegated cross-tab jump: any element with [data-goto-tab] activates that
// tab and scrolls to top. Covers the "why" strip's cheese-caves teaser, the
// "+ N more in The Weird Stuff" ranking link, and anything added later.
function bindTabJumps() {
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-goto-tab], #why-caves-link");
    if (!trigger) return;
    const tab = trigger.dataset.gotoTab || "deep-cuts";
    document.querySelector(`[data-tab="${tab}"]`)?.click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ---------------------------------------------------------------------------
// Render: Deep Cuts
// ---------------------------------------------------------------------------
function renderDcTrackedTile(archive, key) {
  const label = labelFor(key);
  const known = lastKnown(archive, key);
  const canvasId = `dc-canvas-${key}`;
  const dcSnaps = archive.snapshots;
  const dcRange = dcSnaps.length >= 2
    ? `<div class="spark-range" aria-hidden="true"><span>${dcSnaps[Math.max(0, dcSnaps.length - 60)].observationDate.slice(0, 4)}</span><span>${dcSnaps[dcSnaps.length - 1].observationDate.slice(0, 4)}</span></div>`
    : "";
  const insight = computeInsight(key, archive);

  if (!known) {
    return `
      <div class="dc-tile">
        <div class="dc-tile-top">
          <p class="dc-tile-label">${escapeHtml(label)}</p>
          <p class="dc-tile-value" style="opacity:.3">—</p>
        </div>
        <p class="dc-tile-no-data">Not yet captured in this archive</p>
      </div>`;
  }

  const fmt = formatHeadlineValue(key, known.value);
  const asOf = known.monthsStale > 0
    ? `<p class="dc-tile-asof">as of ${shortMonthYear(known.date)}</p>`
    : "";

  return `
    <div class="dc-tile" data-commodity-key="${key}" role="button" tabindex="0" aria-label="${label}: ${fmt.num} ${fmt.unit} — open detail">
      <div class="dc-tile-top">
        <p class="dc-tile-label">${escapeHtml(label)}</p>
        <p class="dc-tile-value">${fmt.num}<span class="dc-tile-unit"> ${fmt.unit}</span></p>
        ${asOf}
      </div>
      <div class="dc-tile-canvas-wrap"><canvas class="dc-tile-canvas" id="${canvasId}" role="img" aria-label="${escapeHtml(label)} 5-year trend"></canvas></div>
      ${dcRange}
      ${insight ? `<span class="insight-badge">${insight}</span>` : ""}
    </div>`;
}

// Discovery names that map to a real archive key — once the pipeline collects
// them, the chip upgrades from "no series" to a click-to-reveal amount.
// (Veal, Lamb & Mutton, and Ducks graduated to full tracked tiles.)
const DISCOVERY_KEYS = {};

// Count a number up from 0 to `targetLb` (raw lb) inside `el`, formatting each
// frame with formatCompact. Honors reduced-motion by jumping to the final value.
function animateCountUp(el, targetLb, { duration = 900 } = {}) {
  const finalText = formatCompact.format(targetLb);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = finalText;
    return;
  }
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = formatCompact.format(targetLb * ease(t));
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = finalText;
  }
  requestAnimationFrame(frame);
}

function renderDcDiscoveryChip(archive, name) {
  const key = DISCOVERY_KEYS[name];
  const known = key ? lastKnown(archive, key) : null;

  // Real value, but no headline trend — keep it a hidden-feature reveal: the
  // amount stays hidden until the user taps, then counts up. `data-commodity-key`
  // is intentionally omitted here and only added after the reveal (see
  // bindDiscoveryReveal) so the first tap animates instead of opening the modal.
  if (known) {
    const asOf = known.monthsStale > 0 ? `as of ${shortMonthYear(known.date)}` : "latest month";
    const lb = known.value * 1000;
    return `<div class="dc-chip dc-chip--valued dc-chip--reveal" data-reveal-lb="${lb}" data-reveal-key="${key}" role="button" tabindex="0" aria-expanded="false" aria-label="${escapeHtml(name)} — tap to reveal amount in cold storage">
        <p class="dc-chip-eyebrow">Also tracked</p>
        <p class="dc-chip-name">${escapeHtml(name)}</p>
        <p class="dc-chip-value" aria-hidden="true"><span class="dc-chip-value-num">0</span><span class="dc-tile-unit"> lb</span></p>
        <p class="dc-chip-prompt">Tap to reveal ↑</p>
        <p class="dc-chip-note">${asOf}</p>
      </div>`;
  }

  return `<div class="dc-chip" title="USDA tracks ${escapeHtml(name)}; no monthly series shown here">
      <p class="dc-chip-eyebrow">Also tracked</p>
      <p class="dc-chip-name">${escapeHtml(name)}</p>
      <span class="dc-chip-baseline" aria-hidden="true"></span>
      <p class="dc-chip-note">No monthly series</p>
    </div>`;
}

// First tap on a valued discovery chip reveals + counts up the amount; once
// revealed it gains data-commodity-key so a further tap opens the full modal.
function bindDiscoveryReveal(container) {
  container.querySelectorAll(".dc-chip--reveal").forEach((chip) => {
    const reveal = () => {
      if (chip.classList.contains("is-revealed")) return;
      chip.classList.add("is-revealed");
      chip.setAttribute("aria-expanded", "true");
      animateCountUp(chip.querySelector(".dc-chip-value-num"), Number(chip.dataset.revealLb));
      chip.dataset.commodityKey = chip.dataset.revealKey; // enable modal on next tap
    };
    chip.addEventListener("click", (e) => {
      if (!chip.classList.contains("is-revealed")) { e.stopPropagation(); reveal(); }
    });
    chip.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !chip.classList.contains("is-revealed")) {
        e.preventDefault(); e.stopPropagation(); reveal();
      }
    });
  });
}

function renderDcMixedSection(archive, containerId, { tracked, discovery }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML =
    tracked.map((key) => renderDcTrackedTile(archive, key)).join("") +
    discovery.map((name) => renderDcDiscoveryChip(archive, name)).join("");
  bindDiscoveryReveal(container);
  // Draw sparklines after paint
  requestAnimationFrame(() => {
    tracked.forEach((key) => {
      const canvas = document.getElementById(`dc-canvas-${key}`);
      if (!canvas) return;
      const known = lastKnown(archive, key);
      let series = buildSparklineSeries(archive, key, 60);
      // Trim trailing missing months so the line ends at the last real value
      if (known && known.monthsStale > 0) series = series.slice(0, series.length - known.monthsStale);
      if (series.filter((v) => v != null).length >= 2) {
        const dates = archive.snapshots.slice(-buildSparklineSeries(archive, key, 60).length)
          .map((s) => s.observationDate).slice(0, series.length);
        const opts = { lineColor: "#3456d1", fillOpacity: 0.1, lineWidth: 1.5, padding: 8 };
        animateSparkline(canvas, series, opts, () => attachSparklineHover(canvas, series, dates, opts), { duration: 600 });
      }
    });
  });
}

function renderFreezerRecords(archive) {
  const container = document.getElementById("dc-records");
  if (!container) return;

  const cards = [];
  for (const key of RECORD_KEYS) {
    const hi = archiveExtreme(archive, key, "max");
    const lo = archiveExtreme(archive, key, "min");
    if (!hi || !lo) continue;
    const known = lastKnown(archive, key);
    const nearHigh = known && known.value >= hi.value * 0.97;
    const nearLow = known && known.value <= lo.value * 1.03;
    cards.push(`
      <div class="record-card" data-commodity-key="${key}" role="button" tabindex="0">
        <p class="record-card-label">${labelFor(key)}</p>
        <div class="record-card-rows">
          <div class="record-card-row">
            <span class="record-kind record-kind--high">High</span>
            <span class="record-value">${formatCompact.format(hi.value * 1000)} lb</span>
            <span class="record-date">${shortMonthYear(hi.date)}</span>
          </div>
          <div class="record-card-row">
            <span class="record-kind record-kind--low">Low</span>
            <span class="record-value">${formatCompact.format(lo.value * 1000)} lb</span>
            <span class="record-date">${shortMonthYear(lo.date)}</span>
          </div>
        </div>
        ${nearHigh ? `<span class="insight-badge">Currently near its 5-year high</span>` : ""}
        ${nearLow ? `<span class="insight-badge">Currently near its 5-year low</span>` : ""}
      </div>`);
  }
  container.innerHTML = cards.join("");
}

// Toggle a curiosity card open/closed to reveal the honest "why no number"
// line. Click and keyboard both work; cards are independent.
function bindCuriosityCards(container) {
  container.querySelectorAll(".dc-curiosity-card").forEach((card) => {
    const activate = (e) => {
      // First tap: reveal the amount with a count-up. The card only gains
      // data-commodity-key after the reveal, so the second tap opens the modal
      // via the global delegation instead of re-animating.
      if (card.classList.contains("dc-curiosity-card--reveal") && !card.classList.contains("is-open")) {
        e.stopPropagation();
        card.classList.add("is-open");
        card.setAttribute("aria-expanded", "true");
        animateCountUp(card.querySelector(".dc-curiosity-value-num"), Number(card.dataset.revealNum));
        card.dataset.commodityKey = card.dataset.revealKey;
      }
    };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(e); }
    });
  });
}

function renderDeepCuts(data) {
  const { archive } = data;

  // Curiosities — every card backed by a real series; tap to count it up
  const curiosEl = document.getElementById("dc-curiosities");
  if (curiosEl) {
    curiosEl.innerHTML = DC_CURIOSITIES.map(({ key, label, color, copy, estimateUnit, estimateLabel }) => {
      const known = key ? lastKnown(archive, key) : null;
      if (!known) {
        return `
          <div class="dc-curiosity-card dc-curiosity-card--${color}">
            <p class="dc-curiosity-eyebrow">USDA tracks this</p>
            <p class="dc-curiosity-name">${label}.</p>
            <p class="dc-curiosity-copy">${copy}</p>
            <p class="dc-curiosity-note">Still being counted — check back after the next data pull.</p>
          </div>`;
      }
      const lb = known.value * 1000;
      const stale = known.monthsStale > 0 ? ` as of ${shortMonthYear(known.date)}` : "";
      // Most cards count up in raw pounds. Eggs are the exception: USDA reports
      // them by weight, so we convert to a real egg count using the per-egg
      // edible weight (INSIGHT_RECIPES) and label the result an estimate.
      const perEgg = INSIGHT_RECIPES[key]?.lbPerUnit || 1;
      const revealNum = estimateUnit ? Math.round(lb / perEgg) : lb;
      const unitText = estimateUnit
        ? `${estimateLabel}${stale}`
        : (known.monthsStale > 0 ? `lb as of ${shortMonthYear(known.date)}` : "lb in storage right now");
      return `
        <div class="dc-curiosity-card dc-curiosity-card--${color} dc-curiosity-card--reveal" data-reveal-num="${revealNum}" data-reveal-key="${key}" role="button" tabindex="0" aria-expanded="false" aria-label="${escapeHtml(label)} — tap to reveal the stored amount">
          <p class="dc-curiosity-eyebrow">USDA tracks this</p>
          <p class="dc-curiosity-name">${label}.</p>
          <p class="dc-curiosity-copy">${copy}</p>
          <p class="dc-curiosity-value" aria-hidden="true"><span class="dc-curiosity-value-num">0</span> <span class="dc-curiosity-value-unit">${unitText}</span></p>
          <p class="dc-curiosity-note dc-curiosity-note--after">Tap again for the full chart →</p>
          <p class="dc-curiosity-prompt">Tap to count it</p>
        </div>`;
    }).join("");
    bindCuriosityCards(curiosEl);
  }

  // Cheese caves story — live tie-in to today's natural cheese stocks
  const caveNow = document.getElementById("cave-story-now");
  if (caveNow) {
    const cheese = data.commodities.total_natural_cheese?.values.latest;
    caveNow.textContent = cheese ? formatCompact.format(cheese * 1000) : "—";
  }

  renderFreezerRecords(archive);

  // Mixed sections
  renderDcMixedSection(archive, "dc-meat-full",   DC_SECTIONS.meat);
  renderDcMixedSection(archive, "dc-dairy-full",  DC_SECTIONS.dairy);
  renderDcMixedSection(archive, "dc-fruit-full",  DC_SECTIONS.fruit);
  renderDcMixedSection(archive, "dc-veg-full",    DC_SECTIONS.vegetables);

  // Grand Ledger
  const ledger = document.getElementById("dc-ledger");
  if (ledger) {
    ledger.innerHTML = DC_LEDGER_ITEMS.map((name) =>
      `<p class="dc-ledger-item">${name}</p>`
    ).join("");
  }
}

// ---------------------------------------------------------------------------
// Commodity detail modal
// ---------------------------------------------------------------------------
function openCommodityModal(key) {
  const data = state.data;
  if (!data || !labelFor(key)) return;
  const archive = data.archive;
  const known = lastKnown(archive, key);
  if (!known) return;

  state.modalKey = key;
  const backdrop = document.getElementById("commodity-modal");
  const body = document.getElementById("modal-body");
  if (!backdrop || !body) return;

  const label = labelFor(key);
  const group = COMMODITY_GROUPS[key] || "other";
  const series = buildSparklineSeries(archive, key, archive.snapshots.length);
  const lastIdx = series.length - 1 - known.monthsStale;
  const prev = lastIdx >= 1 ? series[lastIdx - 1] : null;
  const yearAgo = lastIdx >= 12 ? series[lastIdx - 12] : null;
  const mom = prev ? calculateChange(prev, known.value) : null;
  const yoy = yearAgo ? calculateChange(yearAgo, known.value) : null;
  const hi = archiveExtreme(archive, key, "max");
  const lo = archiveExtreme(archive, key, "min");
  const idx = seasonalIndex(archive, key);
  const reportMonth = new Date(getLatestSnapshot(archive).observationDate + "T12:00:00Z").getUTCMonth();

  const sentence = equivalenceSentence(key, known.value);
  const equivalence = sentence ? `<p class="modal-equivalence">${sentence}</p>` : "";

  const colors = TT_COLORS[group] || { line: "#3456d1" };

  body.innerHTML = `
    <div class="modal-head">
      <div>
        <p class="eyebrow">${group === "other" ? "Tracked commodity" : group === "protein" ? "Meat" : group} · ${shortMonthYear(known.date)}</p>
        <h2 class="modal-title">${escapeHtml(label)}</h2>
      </div>
      <button class="modal-close" id="modal-close" aria-label="Close detail view">✕</button>
    </div>
    <div class="modal-hero-row">
      <p class="modal-number">${formatCompact.format(known.value * 1000)}<span class="modal-number-unit"> lb</span></p>
      <div class="modal-deltas">
        ${mom !== null ? `<div><p class="mini-label">MoM</p><span class="delta ${mom >= 0 ? "delta--up" : "delta--down"}">${formatPercent(mom)}</span></div>` : ""}
        ${yoy !== null ? `<div><p class="mini-label">YoY</p><span class="delta ${yoy >= 0 ? "delta--up" : "delta--down"}">${formatPercent(yoy)}</span></div>` : ""}
      </div>
    </div>
    ${equivalence}
    <div class="modal-chart-wrap">
      <canvas id="modal-canvas" class="modal-canvas" role="img" aria-label="${label} full history"></canvas>
    </div>
    <div class="modal-meta-row">
      ${hi ? `<div><p class="mini-label">Archive high</p><p class="modal-meta-value">${formatCompact.format(hi.value * 1000)} lb · ${shortMonthYear(hi.date)}</p></div>` : ""}
      ${lo ? `<div><p class="mini-label">Archive low</p><p class="modal-meta-value">${formatCompact.format(lo.value * 1000)} lb · ${shortMonthYear(lo.date)}</p></div>` : ""}
    </div>
    ${idx ? `
      <div class="modal-seasonal">
        <p class="mini-label">Seasonal rhythm — a typical year</p>
        <p class="modal-seasonal-sub">Each point averages that calendar month across the archive. <strong>100 = this item's own yearly average</strong>; the shaded band marks the month being reported.</p>
        ${seasonalTileSvg(idx, { currentMonth: reportMonth, lineColor: colors.line, variant: "modal" })}
        ${SEASONAL_NOTES[key] ? `<p class="seasonal-tile-note">${SEASONAL_NOTES[key]}</p>` : ""}
      </div>` : ""}
  `;

  backdrop.hidden = false;
  document.body.style.overflow = "hidden";

  // Draw after the modal is visible so the canvas has real dimensions, and
  // animate the line + seasonal curve rising in.
  requestAnimationFrame(() => {
    drawModalChart({ animate: true });
    const seasonalPath = body.querySelector(".seasonal-svg .seasonal-line");
    if (seasonalPath) animateSvgPath(seasonalPath);
  });
  document.getElementById("modal-close").addEventListener("click", closeCommodityModal);
  document.getElementById("modal-close").focus();
}

function drawModalChart({ animate = false } = {}) {
  const key = state.modalKey;
  if (!key || !state.data) return;
  const canvas = document.getElementById("modal-canvas");
  if (!canvas) return;
  const archive = state.data.archive;
  const known = lastKnown(archive, key);
  let series = buildSparklineSeries(archive, key, archive.snapshots.length);
  if (known && known.monthsStale > 0) series = series.slice(0, series.length - known.monthsStale);
  const dates = archive.snapshots.map((s) => s.observationDate).slice(0, series.length);
  const group = COMMODITY_GROUPS[key];
  const colors = TT_COLORS[group] || { line: "#3456d1" };
  const opts = { lineColor: colors.line, fillOpacity: 0.12, lineWidth: 2, padding: 12, padLeft: 52, padBottom: 22, axes: { dates } };
  if (animate) animateSparkline(canvas, series, opts, () => attachSparklineHover(canvas, series, dates, opts), { duration: 800 });
  else { drawSparkline(canvas, series, opts); attachSparklineHover(canvas, series, dates, opts); }
}

function closeCommodityModal() {
  const backdrop = document.getElementById("commodity-modal");
  if (!backdrop) return;
  backdrop.hidden = true;
  state.modalKey = null;
  document.body.style.overflow = "";
}

function bindModal() {
  const backdrop = document.getElementById("commodity-modal");
  if (!backdrop) return;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeCommodityModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.modalKey) closeCommodityModal();
  });

  // Delegated open: any element with data-commodity-key
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-commodity-key]");
    if (!target) return;
    // Don't hijack canvas scrubbing inside the modal itself
    if (target.closest("#commodity-modal")) return;
    openCommodityModal(target.dataset.commodityKey);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const target = e.target.closest?.("[data-commodity-key]");
    if (!target || target.closest("#commodity-modal")) return;
    e.preventDefault();
    openCommodityModal(target.dataset.commodityKey);
  });
}

// ---------------------------------------------------------------------------
// Tab router (hash-based: #overview, #through-time, #seasonality, #deep-cuts)
// ---------------------------------------------------------------------------
const VALID_TABS = ["overview", "rhythm", "deep-cuts"];
// Legacy hashes from the old four-tab layout still resolve to the merged tab.
const TAB_ALIASES = { "through-time": "rhythm", seasonality: "rhythm" };

// Set by bindStickyFilterRail so the tab router can re-evaluate the pin.
let syncFilterRailPin = null;

function bindTabRouter(data) {
  const tabs = document.querySelectorAll(".tab-pill[data-tab]");
  const views = document.querySelectorAll(".view-section");
  const filterRail = document.querySelector(".filter-rail");
  let ttBound = false;

  function activate(tabId) {
    tabId = TAB_ALIASES[tabId] || tabId;
    if (!VALID_TABS.includes(tabId)) tabId = "overview";
    state.tab = tabId;
    tabs.forEach((t) => {
      const active = t.dataset.tab === tabId;
      t.classList.toggle("tab-pill--active", active);
      t.setAttribute("aria-selected", String(active));
    });
    views.forEach((v) => {
      const matches = v.id === `view-${tabId}`;
      v.classList.toggle("view-section--hidden", !matches);
    });
    filterRail?.classList.toggle("view-section--hidden", tabId !== "overview");
    syncFilterRailPin?.();

    // The Rhythm tab holds both the seasonal shape and the full archive.
    if (tabId === "rhythm") {
      renderSeasonality(data);
      if (!ttBound) { bindThroughTimeFilters(data); ttBound = true; }
      else renderThroughTime(data, state.ttFilter);
    }
    if (tabId === "deep-cuts") renderDeepCuts(data);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      history.pushState(null, "", `#${tab.dataset.tab}`);
      activate(tab.dataset.tab);
    });
  });

  window.addEventListener("popstate", () => {
    const hash = location.hash.replace("#", "") || "overview";
    activate(hash);
  });

  // Honour hash on load
  const initial = location.hash.replace("#", "") || "overview";
  activate(initial);
}

// ---------------------------------------------------------------------------
// Sticky filter rail. The rail shares the topbar's tagline line, so it can't
// use position:sticky (it would scroll away with its grid parent). Instead we
// pin it to the viewport once the header passes, freezing its grid row height
// so removing it from flow shifts nothing.
// ---------------------------------------------------------------------------
const PINNED_CLASS = "filter-rail--pinned";

function bindStickyFilterRail() {
  const rail = document.querySelector(".filter-rail");
  const topbar = document.querySelector(".topbar");
  if (!rail || !topbar) return;

  let rowHeight = 0;

  // Two different boxes: unpinned the rail sits in a grid column (carrying a
  // top margin), pinned it is full-bleed with its own padding — and may wrap to
  // a different number of lines. Measure each in its own state.
  // `--pinned-rail-h` drives scroll-margin-top so jump targets clear the bar.
  function measure() {
    const wasPinned = rail.classList.contains(PINNED_CLASS);

    rail.classList.remove(PINNED_CLASS);
    topbar.style.removeProperty("--rail-row-h");
    rowHeight = rail.offsetHeight + (parseFloat(getComputedStyle(rail).marginTop) || 0);

    rail.classList.add(PINNED_CLASS);
    document.documentElement.style.setProperty("--pinned-rail-h", `${rail.offsetHeight}px`);

    rail.classList.toggle(PINNED_CLASS, wasPinned);
  }

  function update() {
    // The rail is the topbar's last row, so its top edge sits rowHeight above
    // the header's bottom. Once that crosses the viewport top, pin.
    const pin =
      state.tab === "overview" &&
      topbar.getBoundingClientRect().bottom - rowHeight <= 0;

    rail.classList.toggle(PINNED_CLASS, pin);
    if (pin) topbar.style.setProperty("--rail-row-h", `${rowHeight}px`);
    else topbar.style.removeProperty("--rail-row-h");
  }

  syncFilterRailPin = update;

  measure();
  update();

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", () => {
    measure();
    update();
  });
}

// ---------------------------------------------------------------------------
// Weighted scroll reveal. Panels arrive as they enter the viewport; chapter
// beats travel further and settle slower than supporting panels, so the page
// reads as paced instead of uniform. One-shot — nothing re-hides on scroll up.
// ---------------------------------------------------------------------------
let revealObserver = null;
const pendingReveals = new Set();

function revealPanel(el, delay = 0) {
  if (el.classList.contains("is-inview")) return;
  el.style.setProperty("--reveal-delay", `${delay}ms`);
  el.classList.add("is-inview");
  pendingReveals.delete(el);
  revealObserver?.unobserve(el);
}

// A panel can go from below the fold to above it inside a single frame — a
// fast flick, a filter-pill jump, or a restored scroll position. It never
// registers as intersecting, so without this sweep it would stay invisible
// for good. Anything already scrolled past is shown outright (it is
// off-screen, so there is no animation to miss).
function sweepPassedReveals() {
  if (!pendingReveals.size) return;
  [...pendingReveals].forEach((el) => {
    if (el.getBoundingClientRect().bottom <= 0) revealPanel(el);
  });
}

function initScrollReveal() {
  // No IntersectionObserver (or reduced motion) — drop the gate and show
  // everything as plain static content.
  if (!("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.remove("js-reveal");
    return;
  }

  revealObserver = new IntersectionObserver((entries) => {
    // Entries arrive in document order within a batch; stagger them so a row
    // entering together cascades rather than popping as one block.
    let staggerIndex = 0;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      revealPanel(entry.target, Math.min(staggerIndex++, 3) * 70);
    });
  }, {
    // Start the reveal a little before the panel's top edge clears the fold,
    // so it is already settling by the time it is properly in view.
    rootMargin: "0px 0px -12% 0px",
    threshold: 0.01,
  });

  observeReveals(document);
  window.addEventListener("scroll", sweepPassedReveals, { passive: true });
}

// Register any not-yet-revealed targets under `root` (used again after the
// category sections are injected).
function observeReveals(root) {
  if (!revealObserver) return;
  root.querySelectorAll("[data-reveal]:not(.is-inview)").forEach((el) => {
    pendingReveals.add(el);
    revealObserver.observe(el);
  });
}

// ---------------------------------------------------------------------------
// Overview: continuous scroll — "All storage" mosaic, then one band per
// subcategory. The filter rail is a jump nav, not an in-place swap.
// ---------------------------------------------------------------------------
const OVERVIEW_SECTIONS = [
  { filter: "dairy",   eyebrow: "Dairy" },
  { filter: "produce", eyebrow: "Produce" },
  { filter: "protein", eyebrow: "Meat" },
];

function buildCategorySections() {
  const host = document.getElementById("category-sections");
  if (!host || host.dataset.built) return;
  host.dataset.built = "1";

  const teasers = OVERVIEW_SECTIONS.map(({ filter, eyebrow }) => `
    <button type="button" class="category-teaser" id="teaser-${filter}" data-filter="${filter}"
            aria-expanded="false" aria-controls="detail-${filter}">
      <span class="category-teaser-eyebrow">${eyebrow}</span>
      <span class="category-teaser-total" id="teaser-total-${filter}">—</span>
      <span class="category-teaser-unit" id="teaser-unit-${filter}">lb in cold storage</span>
      <span class="category-teaser-lead" id="teaser-lead-${filter}"></span>
      <span class="category-teaser-foot">
        <span class="delta category-teaser-mom" id="teaser-mom-${filter}"></span>
      </span>
    </button>`).join("");

  const detailMosaic = (filter, eyebrow) => `
    <div class="category-mosaic">
      <section class="editorial-panel editorial-panel--cobalt chart-panel">
        <div class="panel-top"><div>
          <p class="eyebrow eyebrow--light">5-year trend</p>
          <h2 class="panel-title panel-title--light">${eyebrow} in cold storage</h2>
        </div></div>
        <div class="chart-strip-wrap">
          <canvas class="trend-canvas" id="cat-canvas-${filter}" role="img" aria-label="${eyebrow} 5-year trend"></canvas>
        </div>
      </section>
      <section class="editorial-panel editorial-panel--paper compare-panel">
        <div class="panel-top"><div>
          <p class="eyebrow">Year ago · last month · latest</p>
          <h2 class="panel-title" id="cat-compare-title-${filter}">Storage mix</h2>
        </div></div>
        <div class="compare-grid" id="cat-compare-grid-${filter}"></div>
        <p class="attribution">Bars scale from zero — the % badge carries the story.</p>
      </section>
      <section class="editorial-panel editorial-panel--ink ranking-panel">
        <div class="panel-top">
          <div>
            <p class="eyebrow eyebrow--light">Operations list</p>
            <h2 class="panel-title panel-title--light">${eyebrow}, ranked</h2>
          </div>
          <p class="mini-note mini-note--light" id="cat-ranking-note-${filter}"></p>
        </div>
        <div class="ranking-list" id="cat-ranking-list-${filter}"></div>
      </section>
    </div>`;

  const details = OVERVIEW_SECTIONS.map(({ filter, eyebrow }) => `
    <section class="category-detail" id="detail-${filter}" data-filter="${filter}" hidden>
      <div class="category-detail-head">
        <h2 class="view-title">${escapeHtml(categoryDefinitions[filter].title)}</h2>
        <button type="button" class="category-detail-close" data-close-filter="${filter}" aria-label="Collapse ${eyebrow}">Close ✕</button>
      </div>
      ${detailMosaic(filter, eyebrow)}
    </section>`).join("");

  host.innerHTML = `
    <div class="category-teasers-head" id="by-category" data-reveal="chapter">
      <p class="eyebrow">By category</p>
      <h2 class="view-title">Three aisles of the frozen mountain.</h2>
      <p class="view-subtitle">Dairy, produce, and meat — the headline number for each. Open one for its full trend, storage mix, and ranked breakdown.</p>
    </div>
    <div class="category-teasers">${teasers}</div>
    <div class="category-details">${details}</div>`;

  observeReveals(host);
}

// Plain lb (or per-American) formatter for a category total — no single
// commodity key, so it can't use INSIGHT_RECIPES equivalences.
function formatCategoryTotal(thousandLb) {
  const lb = thousandLb * 1000;
  if (state.perCapita) return { num: formatPerCapitaCount(lb / US_POPULATION), unit: "lb / American" };
  return { num: formatCompact.format(lb), unit: "lb in cold storage" };
}

// Fill a teaser card's standout numbers (total, MoM, biggest single item).
function renderCategoryTeaser(data, filter) {
  const agg = buildAggregateSeries(data)[`${filter}_total`];
  const totalEl = document.getElementById(`teaser-total-${filter}`);
  if (agg && totalEl) {
    const fmt = formatCategoryTotal(agg.values.latest);
    totalEl.textContent = fmt.num;
    const unitEl = document.getElementById(`teaser-unit-${filter}`);
    if (unitEl) unitEl.textContent = fmt.unit;
    const mom = calculateChange(agg.values.previousMonth, agg.values.latest);
    const momEl = document.getElementById(`teaser-mom-${filter}`);
    if (momEl) {
      momEl.textContent = `${formatPercent(mom)} MoM`;
      momEl.className = `delta category-teaser-mom ${mom >= 0 ? "delta--up" : "delta--down"}`;
    }
  }
  const leadEl = document.getElementById(`teaser-lead-${filter}`);
  if (leadEl) {
    const leader = getSeriesForFilter(data, filter)
      .filter((s) => s.values.latest > 0)
      .sort((a, b) => b.values.latest - a.values.latest)[0];
    if (leader) {
      const lf = formatHeadlineValue(leader.key, leader.values.latest);
      leadEl.innerHTML = `Biggest: <strong>${escapeHtml(leader.label)}</strong> · ${lf.num} ${lf.unit}`;
    }
  }
}

function renderCategorySection(data, filter, { animate = false } = {}) {
  const canvas = document.getElementById(`cat-canvas-${filter}`);
  if (canvas) {
    const values = buildCategorySparkline(data.archive, filter, 60);
    const dates = data.archive.snapshots.slice(-values.length).map((s) => s.observationDate);
    const opts = { lineColor: "#fbf5ea", fillOpacity: 0.14, padding: 12, lineWidth: 2, padLeft: 52, padBottom: 22, axes: { dates } };
    const bind = () => attachSparklineHover(canvas, values, dates, opts);
    if (animate) animateSparkline(canvas, values, opts, bind, { duration: 800 });
    else { drawSparkline(canvas, values, opts); bind(); }
  }
  renderCompareGrid(data, filter, {
    grid: document.getElementById(`cat-compare-grid-${filter}`),
    title: document.getElementById(`cat-compare-title-${filter}`),
  });
  renderRanking(data, filter, {
    list: document.getElementById(`cat-ranking-list-${filter}`),
    note: document.getElementById(`cat-ranking-note-${filter}`),
  });
}

function renderAllStorageSection(data, { animate = false } = {}) {
  renderCompareGrid(data, "all");
  renderRanking(data, "all");
  renderChartStrip(data, "all", { animate });
  renderNarrative(data, "all");
}

// Which category details have had their (expensive) mosaic rendered. A detail
// canvas can't be measured while hidden, so we render lazily on first open.
const renderedCategoryDetails = new Set();

function bindFilters(data) {
  state.overviewFilter = "all";
  const pills = document.querySelectorAll(".filter-rail .filter-pill");

  renderAllStorageSection(data, { animate: true });
  buildCategorySections();
  OVERVIEW_SECTIONS.forEach(({ filter }) => renderCategoryTeaser(data, filter));

  const setActivePill = (filter) => {
    state.overviewFilter = filter;
    pills.forEach((p) => {
      const active = p.dataset.filter === filter;
      p.classList.toggle("is-active", active);
      p.setAttribute("aria-pressed", String(active));
    });
  };

  // Single-open accordion: opening one category collapses the others.
  const setOpen = (filter, open) => {
    const detail = document.getElementById(`detail-${filter}`);
    const teaser = document.getElementById(`teaser-${filter}`);
    if (!detail || !teaser) return;
    detail.hidden = !open;
    teaser.classList.toggle("is-open", open);
    teaser.setAttribute("aria-expanded", String(open));
    if (!open) return;
    // Lazy first render (chart rises); later opens just redraw at current size.
    renderCategorySection(data, filter, { animate: !renderedCategoryDetails.has(filter) });
    renderedCategoryDetails.add(filter);
  };

  const openCategory = (filter, { scroll = true } = {}) => {
    const wasOpen = !document.getElementById(`detail-${filter}`)?.hidden;
    OVERVIEW_SECTIONS.forEach(({ filter: f }) => setOpen(f, false));
    if (!wasOpen) {
      setOpen(filter, true);
      setActivePill(filter);
      if (scroll) document.getElementById(`teaser-${filter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setActivePill("all");
    }
  };

  // Teaser cards toggle their own detail.
  OVERVIEW_SECTIONS.forEach(({ filter }) => {
    document.getElementById(`teaser-${filter}`)?.addEventListener("click", () => openCategory(filter));
  });

  // Close buttons inside each detail.
  document.querySelectorAll("[data-close-filter]").forEach((btn) => {
    btn.addEventListener("click", () => { setOpen(btn.dataset.closeFilter, false); setActivePill("all"); });
  });

  // Top filter rail: "All storage" jumps to the top summary; a category pill
  // opens that category's breakdown.
  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const f = pill.dataset.filter;
      if (f === "all") {
        setActivePill("all");
        document.querySelector(".editorial-dashboard-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        openCategory(f);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Per-American unit toggle
// ---------------------------------------------------------------------------
function bindUnitToggle(data) {
  const trigger = document.getElementById("hero-number-row");
  if (!trigger) return;
  const flip = () => {
    state.perCapita = !state.perCapita;
    trigger.classList.toggle("is-active", state.perCapita);
    trigger.setAttribute("aria-pressed", String(state.perCapita));
    rerenderForState(data);
  };
  trigger.addEventListener("click", flip);
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); }
  });
}

function rerenderForState(data) {
  renderHero(data);
  renderEditorialTiles(data);
  // The overview scroll shows every category at once — refresh the "all"
  // ranking plus each category band so per-capita values stay in sync.
  renderRanking(data, "all");
  renderBiggestItems(data);
  OVERVIEW_SECTIONS.forEach(({ filter }) => {
    renderCategoryTeaser(data, filter);
    // Only re-rank a category detail that's actually been opened/rendered.
    if (document.getElementById(`cat-ranking-list-${filter}`)?.children.length) {
      renderRanking(data, filter, {
        list: document.getElementById(`cat-ranking-list-${filter}`),
        note: document.getElementById(`cat-ranking-note-${filter}`),
      });
    }
  });
  if (state.tab === "rhythm") renderThroughTime(data, state.ttFilter);
  if (state.tab === "deep-cuts") renderDeepCuts(data);
}

// ---------------------------------------------------------------------------
// Resize: charts re-render so canvases never go stale
// ---------------------------------------------------------------------------
function bindResize(data) {
  let timer = null;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (state.tab === "overview") {
        renderChartStrip(data, "all");
        // Redraw only the open category detail (a hidden canvas has zero width).
        OVERVIEW_SECTIONS.forEach(({ filter }) => {
          const detail = document.getElementById(`detail-${filter}`);
          const canvas = document.getElementById(`cat-canvas-${filter}`);
          if (detail && !detail.hidden && canvas && canvas._hoverCleanup) {
            renderCategorySection(data, filter, { animate: false });
          }
        });
      }
      if (state.tab === "rhythm") { renderSeasonality(data); renderThroughTime(data, state.ttFilter); }
      if (state.tab === "deep-cuts") renderDeepCuts(data);
      if (state.modalKey) drawModalChart();
    }, 150);
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  const response = await fetch(DATA_URL);
  const archive = await response.json();
  const data = buildCompatData(archive);
  state.data = data;
  renderHero(data);
  renderEditorialTiles(data);
  renderBiggestItems(data);
  renderPerspective(data);
  renderMonthInFreezer(data);
  // Before bindFilters: buildCategorySections registers its own reveal targets.
  initScrollReveal();
  bindFilters(data);
  bindTabRouter(data);
  bindStickyFilterRail();
  bindUnitToggle(data);
  bindTabJumps();
  bindModal();
  bindResize(data);
}

init().catch((error) => {
  console.error("Dashboard load failed", error);
  // Drop the reveal gate: if we failed before the observer started, every
  // tagged panel would still be at opacity:0 and the page would read blank.
  document.documentElement.classList.remove("js-reveal");
  const note = document.getElementById("hero-observation-date");
  if (note) note.textContent = "Data failed to load";
  const hero = document.getElementById("hero-value");
  if (hero) hero.textContent = "—";
  const narrative = document.getElementById("narrative-copy");
  if (narrative) narrative.textContent = "The cold storage archive could not be loaded. Check your connection and refresh to try again.";
  const grid = document.getElementById("compare-grid");
  if (grid) grid.innerHTML = `<p style="padding:1rem 0">Could not load the cold storage archive.</p>`;
});
