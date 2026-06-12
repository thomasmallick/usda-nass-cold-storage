const DATA_URL = "./data/cold-storage-archive.json";
const US_POPULATION = 335_000_000;

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

// ---------------------------------------------------------------------------
// Deep Cuts v2 — full USDA inventory
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

// ---------------------------------------------------------------------------
// Insight recipes: per-capita object equivalences for insight badges
// ---------------------------------------------------------------------------
const INSIGHT_RECIPES = {
  butter:               { unit: "sticks",            lbPerUnit: 0.25  },
  total_natural_cheese: { unit: "1-lb blocks",        lbPerUnit: 1     },
  american_cheese:      { unit: "slices",             lbPerUnit: 0.0625 },
  total_chicken:        { unit: "whole birds",        lbPerUnit: 5     },
  total_turkey:         { unit: "whole turkeys",      lbPerUnit: 16    },
  total_frozen_poultry: { unit: "whole birds",        lbPerUnit: 5     },
  total_beef:           { unit: "burgers",            lbPerUnit: 0.25  },
  pork_bellies:         { unit: "BLTs worth of bacon", lbPerUnit: 0.125 },
  total_pork:           { unit: "pork chops",        lbPerUnit: 0.625 },
  pork_ribs:            { unit: "racks of ribs",     lbPerUnit: 3     },
  pork_hams:            { unit: "holiday hams",      lbPerUnit: 8     },
  total_frozen_fruit:   { unit: "pints of berries",  lbPerUnit: 0.75  },
  strawberries:         { unit: "pints of strawberries", lbPerUnit: 0.75 },
  blueberries:          { unit: "pints of blueberries",  lbPerUnit: 0.75 },
  total_frozen_vegetables: { unit: "servings of veg", lbPerUnit: 0.5  },
  sweet_corn_cut:       { unit: "ears of corn",      lbPerUnit: 0.5   },
  total_frozen_potatoes: { unit: "bags of fries",    lbPerUnit: 2     },
};

function computeInsight(commodity, archive) {
  const snapshots = archive.snapshots;
  if (!snapshots.length) return "";

  const latest = snapshots[snapshots.length - 1];
  const latestVal = latest.commodities[commodity];
  if (!latestVal) return "";

  // Rule 1: all-time extreme (requires ≥ 12 months)
  if (snapshots.length >= 12) {
    const vals = snapshots.map((s) => s.commodities[commodity] || 0).filter((v) => v > 0);
    const maxVal = Math.max(...vals);
    const minVal = Math.min(...vals);
    const monthsBack = snapshots.length;
    if (latestVal >= maxVal * 0.995) return `↑ Highest in ${Math.round(monthsBack / 12)}+ years`;
    if (latestVal <= minVal * 1.005) return `↓ Lowest in ${Math.round(monthsBack / 12)}+ years`;
  }

  // Rule 2: year-over-year shock (requires ≥ 13 months)
  if (snapshots.length >= 13) {
    const yearAgo = snapshots[snapshots.length - 13]?.commodities[commodity];
    if (yearAgo) {
      const yoy = ((latestVal - yearAgo) / yearAgo) * 100;
      if (Math.abs(yoy) >= 15) {
        const sign = yoy > 0 ? "↑ Up" : "↓ Down";
        return `${sign} ${Math.abs(Math.round(yoy))}% from last year`;
      }
    }
  }

  // Rule 3: per-capita object equivalence
  const recipe = INSIGHT_RECIPES[commodity];
  if (recipe) {
    const lb = latestVal * 1000;
    const perAmerican = lb / US_POPULATION / recipe.lbPerUnit;
    if (perAmerican >= 0.1) {
      const formatted = perAmerican >= 10
        ? Math.round(perAmerican).toLocaleString("en-US")
        : (Math.round(perAmerican * 10) / 10).toLocaleString("en-US");
      return `≈ ${formatted} ${recipe.unit} / American`;
    }
  }

  return "";
}

function renderInsightBadges(data) {
  const badges = [
    { id: "insight-butter",  key: "butter" },
    { id: "insight-poultry", key: "total_frozen_poultry" },
  ];
  for (const { id, key } of badges) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.textContent = computeInsight(key, data.archive);
  }
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
    rankingNote: "Sorted by latest storage volume across all categories",
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

function formatPounds(thousandLb) {
  return `${formatCompact.format(thousandLb * 1000)} lb`;
}

function formatPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded}%`;
}

function calculateChange(from, to) {
  if (!from) return 0;
  return ((to - from) / from) * 100;
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
 * Return the last nMonths values (1000 lb) for a given commodity key from the archive.
 */
function buildSparklineSeries(archive, commodityKey, nMonths = 60) {
  const snapshots = archive.snapshots.slice(-nMonths);
  return snapshots.map((s) => s.commodities[commodityKey] || 0);
}

/**
 * Aggregate sparkline for a category using non-overlapping keys.
 */
function buildCategorySparkline(archive, filter, nMonths = 60) {
  const keys = categoryDefinitions[filter]?.aggregateKeys || GRAND_TOTAL_KEYS;
  const snapshots = archive.snapshots.slice(-nMonths);
  return snapshots.map((s) => keys.reduce((sum, k) => sum + (s.commodities[k] || 0), 0));
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

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = rawValue * eased;
    el.textContent = formatter(value);
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function estimatedNextReleaseLabel(today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const target = new Date(year, month, 24);
  if (today > target) target.setMonth(target.getMonth() + 1);
  return target.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Sparkline canvas renderer
// ---------------------------------------------------------------------------
function drawSparkline(canvas, values, { lineColor = "#ffffff", fillOpacity = 0.12, padding = 10, lineWidth = 1.5, hoverIdx = null } = {}) {
  if (!values || values.length < 2) return;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.offsetWidth || 320;
  const cssH = canvas.offsetHeight || 80;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => ({
    x: padding + (i / (values.length - 1)) * (cssW - padding * 2),
    y: cssH - padding - ((v - min) / range) * (cssH - padding * 2),
  }));

  // Filled area
  ctx.beginPath();
  ctx.moveTo(pts[0].x, cssH - padding);
  pts.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, cssH - padding);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(lineColor, fillOpacity);
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  // Latest point dot (hidden when hovering)
  if (hoverIdx === null) {
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }

  // Hover indicator: vertical hairline + dot
  if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < pts.length) {
    const hp = pts[hoverIdx];
    // Hairline
    ctx.beginPath();
    ctx.moveTo(hp.x, padding);
    ctx.lineTo(hp.x, cssH - padding);
    ctx.strokeStyle = hexToRgba(lineColor, 0.35);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Outer dot
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    // Inner dot
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

// ---------------------------------------------------------------------------
// Narrative slab copy generator
// ---------------------------------------------------------------------------
function buildNarrativeCopy(data, filter) {
  const agg = buildAggregateSeries(data);

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
  return `The US cold chain holds <strong>${formatCompact.format(grandTotalLb)} lb</strong> of frozen food right now — about <strong>${lbPerAmerican} lb per American</strong>, or the equivalent cargo of roughly ${cargoShips} fully loaded container ships.`;
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

  animateNumber(
    document.getElementById("hero-value"),
    grandLatest * 1000,
    (v) => formatCompact.format(v),
  );

  document.getElementById("hero-observation-date").textContent =
    `Reporting on ${new Date(latest.observationDate + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`;
  document.getElementById("hero-mom").textContent = formatPercent(mom);
  document.getElementById("hero-mom").className = `delta ${mom >= 0 ? "delta--up" : "delta--down"}`;
  document.getElementById("hero-yoy").textContent = formatPercent(yoy);
  document.getElementById("hero-yoy").className = `delta ${yoy >= 0 ? "delta--up" : "delta--down"}`;

  // Butter stat tile
  const butter = data.commodities.butter;
  animateNumber(
    document.getElementById("butter-value"),
    butter.values.latest * 1000,
    (v) => formatCompact.format(v),
  );
  const butterMom = calculateChange(butter.values.previousMonth, butter.values.latest);
  const butterYoy = calculateChange(butter.values.yearAgo, butter.values.latest);
  document.getElementById("butter-mom").textContent = formatPercent(butterMom);
  document.getElementById("butter-mom").className = `delta ${butterMom >= 0 ? "delta--up" : "delta--down"}`;
  document.getElementById("butter-yoy").textContent = formatPercent(butterYoy);
  document.getElementById("butter-yoy").className = `delta ${butterYoy >= 0 ? "delta--up" : "delta--down"}`;

  // Poultry stat tile
  const poultry = data.commodities.total_frozen_poultry;
  animateNumber(
    document.getElementById("poultry-value"),
    poultry.values.latest * 1000,
    (v) => formatCompact.format(v),
  );
  const poultryMom = calculateChange(poultry.values.previousMonth, poultry.values.latest);
  document.getElementById("poultry-mom").textContent = formatPercent(poultryMom);
  document.getElementById("poultry-mom").className = `delta ${poultryMom >= 0 ? "delta--up" : "delta--down"}`;

  // Release metadata
  const publishIso = latest.releaseDate || data.meta.updated;
  document.getElementById("release-date").textContent = publishIso
    ? new Date(publishIso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "—";
  document.getElementById("next-release").textContent = estimatedNextReleaseLabel();
  const reportLink = document.getElementById("report-link");
  if (reportLink && latest.reportUrl) reportLink.href = latest.reportUrl;
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
        <div class="cave-layer cave-layer--${item.className}" style="width:${width}%; animation-delay:${delay}s;">
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
// Render: chart strip (5-year trend sparkline)
// ---------------------------------------------------------------------------
function renderChartStrip(data, filter) {
  const canvas = document.getElementById("trend-canvas");
  const label = document.getElementById("trend-label");
  const monthCount = document.getElementById("trend-months");
  if (!canvas) return;

  const values = buildCategorySparkline(data.archive, filter, 60);

  if (values.length < 2) {
    canvas.style.display = "none";
    if (label) label.textContent = "Historical archive building…";
    if (monthCount) monthCount.textContent = "Run scripts/fetch-usda.py --backfill 60 to populate";
    return;
  }

  canvas.style.display = "block";

  const catDef = categoryDefinitions[filter];
  if (label) label.textContent = catDef?.title || "Total cold storage trend";
  if (monthCount) monthCount.textContent = `${values.length} monthly snapshots`;

  const snapshots = data.archive.snapshots.slice(-values.length);
  const dates = snapshots.map((s) => s.observationDate);

  const opts = { lineColor: "#fbf5ea", fillOpacity: 0.14, padding: 12, lineWidth: 2 };
  drawSparkline(canvas, values, opts);
  bindChartHover(canvas, values, dates, opts);
}

function bindChartHover(canvas, values, dates, opts) {
  const tooltip = document.getElementById("chart-tooltip");
  if (!tooltip) return;

  // Remove previous listeners
  if (canvas._hoverCleanup) { canvas._hoverCleanup(); }

  const dateEl = tooltip.querySelector(".chart-tooltip-date");
  const valueEl = tooltip.querySelector(".chart-tooltip-value");
  const padding = opts.padding ?? 12;
  const n = values.length;

  function getIdx(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const step = (rect.width - padding * 2) / (n - 1);
    return Math.max(0, Math.min(n - 1, Math.round((x - padding) / step)));
  }

  function onMove(e) {
    const idx = getIdx(e.clientX);
    drawSparkline(canvas, values, { ...opts, hoverIdx: idx });

    const rect = canvas.getBoundingClientRect();
    const step = (rect.width - padding * 2) / (n - 1);
    const xPx = padding + idx * step;
    const xPct = (xPx / rect.width) * 100;

    tooltip.style.left = `${xPct}%`;
    tooltip.style.transform = xPct > 72 ? "translateX(-92%)" : "translateX(-8%)";
    tooltip.classList.add("chart-tooltip--visible");

    const d = new Date(dates[idx] + "T12:00:00Z");
    dateEl.textContent = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    valueEl.textContent = formatCompact.format(values[idx] * 1000) + " lb";
  }

  function onLeave() {
    drawSparkline(canvas, values, opts);
    tooltip.classList.remove("chart-tooltip--visible");
  }

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", onLeave);
  canvas._hoverCleanup = () => {
    canvas.removeEventListener("mousemove", onMove);
    canvas.removeEventListener("mouseleave", onLeave);
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
 * Attach point-in-time hover to any canvas sparkline.
 * Redraws via drawSparkline with hoverIdx and follows the cursor with a single
 * shared floating tooltip. Stores canvas._hoverCleanup so re-renders don't stack.
 */
function attachSparklineHover(canvas, values, dates, opts = {}) {
  if (!canvas || !values || values.length < 2) return;
  if (canvas._hoverCleanup) canvas._hoverCleanup();

  const tooltip = getSparkTooltip();
  const dateEl = tooltip.querySelector(".spark-tooltip-date");
  const valueEl = tooltip.querySelector(".spark-tooltip-value");
  const padding = opts.padding ?? 10;
  const n = values.length;

  function getIdx(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const step = (rect.width - padding * 2) / (n - 1);
    return Math.max(0, Math.min(n - 1, Math.round((x - padding) / step)));
  }

  function onMove(e) {
    const idx = getIdx(e.clientX);
    drawSparkline(canvas, values, { ...opts, hoverIdx: idx });

    const d = new Date(dates[idx] + "T12:00:00Z");
    dateEl.textContent = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    valueEl.textContent = formatCompact.format(values[idx] * 1000) + " lb";

    // Position: above-right of cursor, flip near viewport edges
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

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", onLeave);
  canvas._hoverCleanup = () => {
    canvas.removeEventListener("mousemove", onMove);
    canvas.removeEventListener("mouseleave", onLeave);
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
  const maxAcrossSeries = Math.max(
    ...series.flatMap((item) => [item.values.yearAgo, item.values.previousMonth, item.values.latest]),
  );

  compareTitle.textContent = categoryDefinitions[filter].title;

  compareGrid.innerHTML = series
    .map((item) => {
      const entries = [
        { label: "Year ago", key: "yearAgo", className: "year-ago" },
        { label: "Last month", key: "previousMonth", className: "previous" },
        { label: "Latest", key: "latest", className: "latest" },
      ];

      const bars = entries
        .map((entry) => {
          const value = item.values[entry.key];
          const height = Math.max(16, (value / maxAcrossSeries) * 100);
          return `
            <div class="compare-bar-wrap">
              <div class="compare-bar compare-bar--${entry.className}" style="height:${height}%"></div>
              <div class="compare-caption">
                <strong>${entry.label}</strong>
                <span>${formatCompact.format(value * 1000)} lb</span>
              </div>
            </div>`;
        })
        .join("");

      const delta = calculateChange(item.values.previousMonth, item.values.latest);

      return `
        <article class="compare-row">
          <div class="compare-head">
            <p class="compare-name">${item.label}</p>
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
  const items = getSeriesForFilter(data, filter)
    .map((item) => ({
      label: item.label,
      latest: item.values.latest,
      mom: calculateChange(item.values.previousMonth, item.values.latest),
    }))
    .sort((a, b) => b.latest - a.latest);

  const maxLatest = Math.max(...items.map((item) => item.latest));
  rankingNote.textContent = categoryDefinitions[filter].rankingNote;

  rankingList.innerHTML = items
    .map((item) => {
      const width = (item.latest / maxLatest) * 100;
      const deltaClass = item.mom >= 0 ? "delta--up" : "delta--down";
      return `
        <article class="ranking-row">
          <p class="ranking-name">${item.label}</p>
          <div class="ranking-bar-shell">
            <div class="ranking-bar-fill" style="width:${width}%"></div>
          </div>
          <p class="ranking-value">${formatCompact.format(item.latest * 1000)} lb</p>
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

  const snapshots = data.archive.snapshots;

  grid.innerHTML = keys.map((key) => {
    const label = COMMODITY_LABELS[key];
    const group = COMMODITY_GROUPS[key];
    const colors = TT_COLORS[group] || TT_COLORS.protein;
    const series = buildSparklineSeries(data.archive, key, 60);
    const latest = series[series.length - 1] || 0;
    const yearAgo = series.length >= 13 ? series[series.length - 13] : null;
    const yoy = yearAgo ? ((latest - yearAgo) / yearAgo) * 100 : null;
    const yoyText = yoy !== null ? `${yoy >= 0 ? "+" : ""}${Math.round(yoy)}% YoY` : "";
    const canvasId = `tt-canvas-${key}`;

    return `
      <div class="sparkline-tile sparkline-tile--${group}">
        <div class="sparkline-tile-top">
          <p class="sparkline-tile-label">${label}</p>
          <p class="sparkline-tile-value">${formatCompact.format(latest * 1000)}</p>
        </div>
        <div class="sparkline-tile-canvas-wrap">
          <canvas class="sparkline-tile-canvas" id="${canvasId}" aria-label="${label} 5-year trend"></canvas>
        </div>
        ${yoyText ? `<p class="sparkline-tile-yoy">${yoyText}</p>` : ""}
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
      if (series.length >= 2) {
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
  let active = "all";

  function update(next) {
    active = next;
    pills.forEach((p) => p.classList.toggle("is-active", p.dataset.ttFilter === next));
    renderThroughTime(data, next);
  }

  pills.forEach((p) => p.addEventListener("click", () => update(p.dataset.ttFilter)));
  update(active);
}

// ---------------------------------------------------------------------------
// Render: Deep Cuts — gallery grid by category
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Deep Cuts v2 render functions
// ---------------------------------------------------------------------------
function renderDcTrackedTile(archive, key) {
  const label = DEEP_CUT_LABELS[key] || COMMODITY_LABELS[key] || key;
  const series = buildSparklineSeries(archive, key, 60);
  const latest = series[series.length - 1] || 0;
  const canvasId = `dc-canvas-${key}`;
  const hasData = latest > 0;
  const insight = computeInsight(key, archive);
  return `
    <div class="dc-tile">
      <div class="dc-tile-top">
        <p class="dc-tile-label">${label}</p>
        ${hasData
          ? `<p class="dc-tile-value">${formatCompact.format(latest * 1000)}<span class="dc-tile-unit"> lb</span></p>`
          : `<p class="dc-tile-value" style="opacity:.3">—</p>`}
      </div>
      ${hasData && series.length >= 2
        ? `<div class="dc-tile-canvas-wrap"><canvas class="dc-tile-canvas" id="${canvasId}"></canvas></div>`
        : `<p class="dc-tile-no-data">No data for latest month</p>`}
      ${insight ? `<span class="insight-badge">${insight}</span>` : ""}
    </div>`;
}

function renderDcDiscoveryChip(name) {
  return `<div class="dc-chip" title="USDA tracks ${name}; no monthly series shown here">
      <p class="dc-chip-eyebrow">Also tracked</p>
      <p class="dc-chip-name">${name}</p>
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
      const series = buildSparklineSeries(archive, key, 60);
      if (series.length >= 2) {
        const dates = archive.snapshots.slice(-series.length).map((s) => s.observationDate);
        const opts = { lineColor: "#3456d1", fillOpacity: 0.1, lineWidth: 1.5, padding: 8 };
        drawSparkline(canvas, series, opts);
        attachSparklineHover(canvas, series, dates, opts);
      }
    });
  });
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
// Tab router (hash-based: #overview, #through-time, #deep-cuts)
// ---------------------------------------------------------------------------
function bindTabRouter(data) {
  const tabs = document.querySelectorAll(".tab-pill[data-tab]");
  const views = document.querySelectorAll(".view-section");
  let ttInitialized = false;
  let dcInitialized = false;

  function activate(tabId) {
    tabs.forEach((t) => t.classList.toggle("tab-pill--active", t.dataset.tab === tabId));
    views.forEach((v) => {
      const matches = v.id === `view-${tabId}`;
      v.classList.toggle("view-section--hidden", !matches);
    });

    if (tabId === "through-time" && !ttInitialized) {
      bindThroughTimeFilters(data);
      ttInitialized = true;
    }
    if (tabId === "deep-cuts" && !dcInitialized) {
      renderDeepCuts(data);
      dcInitialized = true;
    }
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
  const pills = document.querySelectorAll(".filter-pill");
  let active = "all";

  function update(next) {
    active = next;
    pills.forEach((pill) => {
      pill.classList.toggle("is-active", pill.dataset.filter === next);
    });
    renderCompareGrid(data, next);
    renderRanking(data, next);
    renderChartStrip(data, next);
    renderNarrative(data, next);
  }

  pills.forEach((pill) => {
    pill.addEventListener("click", () => update(pill.dataset.filter));
  });

  update(active);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  const response = await fetch(DATA_URL);
  const archive = await response.json();
  const data = buildCompatData(archive);
  renderHero(data);
  renderCave(data);
  renderInsightBadges(data);
  bindFilters(data);
  bindTabRouter(data);
}

init().catch((error) => {
  console.error("Dashboard load failed", error);
  const grid = document.getElementById("compare-grid");
  if (grid) grid.innerHTML = `<p style="padding:1rem">Could not load the cold storage archive.</p>`;
});
