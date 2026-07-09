const DATA_URL = "./data/cold-storage-archive.json?v=2";
const US_POPULATION = 335_000_000;

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
  other_natural_cheese: "Other natural cheese",
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
  other_natural_cheese: "dairy",
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
};

function labelFor(key) {
  return COMMODITY_LABELS[key] || DEEP_CUT_LABELS[key] || key;
}

// Base commodities with no overlap — used for the honest "All" ranking.
const LEAF_KEYS = [
  "butter", "american_cheese", "swiss_cheese", "other_natural_cheese",
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
const DC_CURIOSITIES = [
  { label: "Boysenberries",  color: "lavender", copy: "Yes, specifically boysenberries. A dedicated line item in the national cold storage ledger." },
  { label: "Okra",           color: "kelp",     copy: "The South's frozen frontier — millions of pounds, quietly sitting in cold storage." },
  { label: "Hops",           color: "cobalt",   copy: "Beer's raw material, stored cold before it becomes your weekend. Supply chain secured." },
  { label: "Honey",          color: "sun",      copy: "Honey keeps for millennia on a shelf. In bulk, it gets the cold treatment anyway." },
  { label: "Buttermilk",     color: "paper",    copy: "Frozen buttermilk reserves. The pancake supply chain runs deeper than you think." },
  { label: "Pickles",        color: "coral",    copy: "Not frozen — refrigerated. But tracked with the same federal rigor as beef." },
];

const DC_SECTIONS = {
  meat: {
    tracked:   ["total_frozen_poultry", "total_chicken", "total_turkey", "total_frozen_red_meat", "total_beef", "total_pork", "pork_bellies", "pork_hams", "pork_ribs", "pork_loins", "pork_butts", "pork_trimmings", "beef_boneless", "beef_bone_in"],
    discovery: ["Veal", "Lamb & Mutton", "Ducks"],
  },
  dairy: {
    tracked:   ["butter", "total_natural_cheese", "american_cheese", "swiss_cheese", "other_natural_cheese"],
    discovery: ["Milk", "Buttermilk", "Whey", "Eggs"],
  },
  fruit: {
    tracked:   ["total_frozen_fruit", "strawberries", "blueberries", "raspberries", "cherries_tart"],
    discovery: ["Blackberries", "Boysenberries", "Apples", "Apricots", "Grapes", "Oranges", "Peaches", "Other Fruit"],
  },
  vegetables: {
    tracked:   ["total_frozen_vegetables", "total_frozen_potatoes", "sweet_corn_cut", "sweet_corn_cob", "beans_green", "peas_green", "carrots", "broccoli", "spinach"],
    discovery: ["Asparagus", "Brussels Sprouts", "Cauliflower", "Greens", "Okra", "Onions", "Peas & Carrots", "Squash", "Mixed Vegetables", "Other Vegetables"],
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
  { month: "2022-02", label: "Bird flu reaches US commercial flocks", filters: ["protein"] },
  { month: "2022-10", label: "Butter stocks scrape multi-year lows — shortage headlines", filters: ["dairy"] },
];

// Curated seasonal one-liners — only for famously seasonal commodities.
const SEASONAL_NOTES = {
  total_turkey: "Builds all summer — then Thanksgiving empties the freezer.",
  butter: "Swells through summer milk flush, drains through holiday baking.",
  strawberries: "The June harvest floods the freezer in one great wave.",
  total_frozen_fruit: "Stocks crest after the summer pack, then feed smoothies all winter.",
};

// ---------------------------------------------------------------------------
// Insight recipes: per-capita object equivalences
// ---------------------------------------------------------------------------
const INSIGHT_RECIPES = {
  butter:               { unit: "sticks",             one: "stick of butter",     lbPerUnit: 0.25 },
  total_natural_cheese: { unit: "1-lb blocks",        one: "1-lb block",          lbPerUnit: 1 },
  american_cheese:      { unit: "slices",             one: "slice",               lbPerUnit: 0.0625 },
  swiss_cheese:         { unit: "slices",             one: "slice",               lbPerUnit: 0.0625 },
  other_natural_cheese: { unit: "1-lb blocks",        one: "1-lb block",          lbPerUnit: 1 },
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
    commodities: ["butter", "american_cheese", "swiss_cheese", "other_natural_cheese", "total_natural_cheese"],
    aggregateKeys: ["butter", "total_natural_cheese"],
  },
  produce: {
    title: "Produce storage — fruit, vegetables, and frozen potatoes",
    rankingNote: "Sorted by latest produce storage volume",
    commodities: ["total_frozen_vegetables", "total_frozen_potatoes", "total_frozen_fruit"],
    aggregateKeys: ["total_frozen_fruit", "total_frozen_vegetables", "total_frozen_potatoes"],
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
      "pork_bellies",
    ],
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
      label: COMMODITY_LABELS[key] || key,
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
      label: "Meat + poultry reserve",
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
  const pts = values.map((v, i) => v == null ? null : ({
    x: pl + (i / (values.length - 1)) * (cssW - pl - padding),
    y: cssH - pb - ((v - min) / range) * (cssH - pb - padding),
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
    `Reporting on ${new Date(latest.observationDate + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`;
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
    releaseEl.textContent = `≈ ${est.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
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
function renderCave(data) {
  const cave = document.getElementById("cave-stack");
  const layers = [
    { key: "american_cheese", className: "american", label: "American" },
    { key: "swiss_cheese", className: "swiss", label: "Swiss" },
    { key: "other_natural_cheese", className: "other", label: "Other natural" },
    { key: "butter", className: "butter", label: "Butter" },
  ];
  const validLayers = layers.filter((item) => data.commodities[item.key]);
  if (!validLayers.length) { cave.innerHTML = ""; return; }
  const max = Math.max(...validLayers.map((item) => data.commodities[item.key].values.latest));

  cave.innerHTML = validLayers
    .map((item, index) => {
      const latest = data.commodities[item.key].values.latest;
      const width = 52 + (latest / max) * 48;
      const delay = index * 0.6;
      return `
        <div class="cave-layer cave-layer--${item.className}" style="width:${width}%; animation-delay:${delay}s;" data-commodity-key="${item.key}" role="button" tabindex="0" aria-label="${item.label}: ${formatCompact.format(latest * 1000)} lb — open detail">
          <div class="cave-layer-label">
            <span>${item.label}</span>
            <span>${formatCompact.format(latest * 1000)} lb</span>
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

function renderChartStrip(data, filter) {
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
  drawSparkline(canvas, values, opts);
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label",
    `${catDef?.title || "Total cold storage"} — 5-year trend, latest ${formatCompact.format((values.findLast((v) => v != null) || 0) * 1000)} lb`);
  bindChartHover(canvas, values, dates, opts);
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

function renderCompareGrid(data, filter) {
  const compareGrid = document.getElementById("compare-grid");
  const compareTitle = document.getElementById("compare-title");
  const series = getSeriesForFilter(data, filter);

  compareTitle.textContent = categoryDefinitions[filter].title;

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
function renderRanking(data, filter) {
  const rankingList = document.getElementById("ranking-list");
  const rankingNote = document.getElementById("ranking-note");

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
  rankingNote.textContent = categoryDefinitions[filter].rankingNote;

  rankingList.innerHTML = items
    .map((item) => {
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
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Render: Through Time — small multiples of all 15 commodities
// ---------------------------------------------------------------------------
const TT_COLORS = {
  dairy:   { line: "#8a6a22", bg: "dairy"   },
  produce: { line: "#2e5c1e", bg: "produce" },
  protein: { line: "#b84a1c", bg: "protein" },
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
        drawSparkline(canvas, series, opts);
        attachSparklineHover(canvas, series, dates, opts);
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
function seasonalTileSvg(index, { currentMonth = null, lineColor = "#3456d1" } = {}) {
  const W = 260, H = 110, padX = 10, padTop = 14, padBottom = 24;
  const valid = index.filter((v) => v != null);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const px = (m) => padX + (m / 11) * (W - padX * 2);
  const py = (v) => H - padBottom - ((v - min) / range) * (H - padTop - padBottom);

  let d = "";
  index.forEach((v, m) => {
    if (v == null) return;
    d += (d === "" ? "M" : "L") + px(m).toFixed(1) + " " + py(v).toFixed(1) + " ";
  });

  const { peak, trough } = peakTroughMonths(index);

  const monthTicks = MONTH_ABBR.map((abbr, m) =>
    `<text x="${px(m).toFixed(1)}" y="${H - 8}" class="seasonal-month${m === currentMonth ? " seasonal-month--now" : ""}" text-anchor="middle">${abbr[0]}</text>`,
  ).join("");

  const nowBand = currentMonth != null
    ? `<rect x="${(px(currentMonth) - 7).toFixed(1)}" y="${padTop - 6}" width="14" height="${H - padTop - padBottom + 12}" rx="7" class="seasonal-now-band"/>`
    : "";

  const peakDot = peak >= 0
    ? `<circle cx="${px(peak).toFixed(1)}" cy="${py(index[peak]).toFixed(1)}" r="4" fill="${lineColor}"/>`
    : "";
  const troughDot = trough >= 0
    ? `<circle cx="${px(trough).toFixed(1)}" cy="${py(index[trough]).toFixed(1)}" r="4" fill="none" stroke="${lineColor}" stroke-width="1.5"/>`
    : "";

  return `<svg viewBox="0 0 ${W} ${H}" class="seasonal-svg" aria-hidden="true">
    ${nowBand}
    <path d="${d.trim()}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
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

function renderDcDiscoveryChip(name) {
  return `<div class="dc-chip" title="USDA tracks ${name}; no monthly series shown here">
      <p class="dc-chip-eyebrow">Also tracked</p>
      <p class="dc-chip-name">${escapeHtml(name)}</p>
      <span class="dc-chip-baseline" aria-hidden="true"></span>
      <p class="dc-chip-note">No monthly series</p>
    </div>`;
}

function renderDcMixedSection(archive, containerId, { tracked, discovery }) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML =
    tracked.map((key) => renderDcTrackedTile(archive, key)).join("") +
    discovery.map((name) => renderDcDiscoveryChip(name)).join("");
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
        drawSparkline(canvas, series, opts);
        attachSparklineHover(canvas, series, dates, opts);
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

function renderDeepCuts(data) {
  const { archive } = data;

  // Curiosities
  const curiosEl = document.getElementById("dc-curiosities");
  if (curiosEl) {
    curiosEl.innerHTML = DC_CURIOSITIES.map(({ label, color, copy }) => `
      <div class="dc-curiosity-card dc-curiosity-card--${color}">
        <p class="dc-curiosity-eyebrow">USDA tracks this</p>
        <p class="dc-curiosity-name">${label}.</p>
        <p class="dc-curiosity-copy">${copy}</p>
      </div>`).join("");
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
        <p class="eyebrow">${group === "other" ? "Tracked commodity" : group === "protein" ? "Meat + poultry" : group} · ${shortMonthYear(known.date)}</p>
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
        <p class="mini-label">Seasonal rhythm — average month vs the commodity's mean</p>
        ${seasonalTileSvg(idx, { currentMonth: reportMonth, lineColor: colors.line })}
        ${SEASONAL_NOTES[key] ? `<p class="seasonal-tile-note">${SEASONAL_NOTES[key]}</p>` : ""}
      </div>` : ""}
  `;

  backdrop.hidden = false;
  document.body.style.overflow = "hidden";

  drawModalChart();
  document.getElementById("modal-close").addEventListener("click", closeCommodityModal);
  document.getElementById("modal-close").focus();
}

function drawModalChart() {
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
  drawSparkline(canvas, series, opts);
  attachSparklineHover(canvas, series, dates, opts);
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
const VALID_TABS = ["overview", "through-time", "seasonality", "deep-cuts"];

function bindTabRouter(data) {
  const tabs = document.querySelectorAll(".tab-pill[data-tab]");
  const views = document.querySelectorAll(".view-section");
  let ttBound = false;

  function activate(tabId) {
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

    // Re-render the activated view so canvases pick up current size + state
    if (tabId === "through-time") {
      if (!ttBound) { bindThroughTimeFilters(data); ttBound = true; }
      else renderThroughTime(data, state.ttFilter);
    }
    if (tabId === "seasonality") renderSeasonality(data);
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
// Filter binding (drives chart strip + narrative + comparison + ranking)
// ---------------------------------------------------------------------------
function bindFilters(data) {
  const pills = document.querySelectorAll(".filter-rail .filter-pill");

  function update(next) {
    state.overviewFilter = next;
    pills.forEach((pill) => {
      const active = pill.dataset.filter === next;
      pill.classList.toggle("is-active", active);
      pill.setAttribute("aria-pressed", String(active));
    });
    renderCompareGrid(data, next);
    renderRanking(data, next);
    renderChartStrip(data, next);
    renderNarrative(data, next);
  }

  pills.forEach((pill) => {
    pill.addEventListener("click", () => update(pill.dataset.filter));
  });

  update(state.overviewFilter);
}

// ---------------------------------------------------------------------------
// Per-American unit toggle
// ---------------------------------------------------------------------------
function bindUnitToggle(data) {
  const trigger = document.getElementById("hero-number-row");
  if (!trigger) return;
  const hint = document.getElementById("hero-tap-hint");
  const flip = () => {
    state.perCapita = !state.perCapita;
    trigger.classList.toggle("is-active", state.perCapita);
    trigger.setAttribute("aria-pressed", String(state.perCapita));
    if (hint) {
      hint.textContent = state.perCapita
        ? "Your share of the freezer. Click to zoom back out."
        : "Click the number to see your share of it.";
    }
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
  renderRanking(data, state.overviewFilter);
  if (state.tab === "through-time") renderThroughTime(data, state.ttFilter);
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
      if (state.tab === "overview") renderChartStrip(data, state.overviewFilter);
      if (state.tab === "through-time") renderThroughTime(data, state.ttFilter);
      if (state.tab === "seasonality") renderSeasonality(data);
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
  renderCave(data);
  bindFilters(data);
  bindTabRouter(data);
  bindUnitToggle(data);
  bindModal();
  bindResize(data);
}

init().catch((error) => {
  console.error("Dashboard load failed", error);
  const note = document.getElementById("hero-observation-date");
  if (note) note.textContent = "Data failed to load";
  const hero = document.getElementById("hero-value");
  if (hero) hero.textContent = "—";
  const narrative = document.getElementById("narrative-copy");
  if (narrative) narrative.textContent = "The cold storage archive could not be loaded. Check your connection and refresh to try again.";
  const grid = document.getElementById("compare-grid");
  if (grid) grid.innerHTML = `<p style="padding:1rem 0">Could not load the cold storage archive.</p>`;
});
