const DATA_URL = "./data/cold-storage-archive.json";

// ---------------------------------------------------------------------------
// Commodity metadata (labels + groups, previously embedded in each JSON record)
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
  const get = (key) => data.commodities[key].values;
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
function drawSparkline(canvas, values, { lineColor = "#ffffff", fillOpacity = 0.12, padding = 10, lineWidth = 1.5 } = {}) {
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

  // Latest point dot
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = lineColor;
  ctx.fill();
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
    const sticksPerAmerican = (sticks / 335_000_000).toFixed(1);
    return `The US currently stores enough butter for every American to unwrap about <strong>${sticksPerAmerican} sticks</strong> — a reserve that swells in late summer and draws down through the holidays.`;
  }

  if (filter === "protein") {
    const chickenLb = data.commodities.total_chicken.values.latest * 1000;
    const wholeBirds = Math.round(chickenLb / 5);
    const birdsPerAmerican = (wholeBirds / 335_000_000).toFixed(1);
    return `US frozen chicken reserves represent roughly <strong>${birdsPerAmerican} whole birds per American</strong> — a buffer the system maintains regardless of what happens at the farm gate this week.`;
  }

  if (filter === "produce") {
    const vegLb = data.commodities.total_frozen_vegetables.values.latest * 1000;
    const servings = Math.round(vegLb / 0.5);
    const servingsPerAmerican = Math.round(servings / 335_000_000);
    return `Frozen vegetable stores alone hold the equivalent of <strong>${servingsPerAmerican} half-pound servings per American</strong> — about ${Math.round(servingsPerAmerican / 365 * 10) / 10} years of daily portions for every person in the country.`;
  }

  // all / default: grand total
  const grandTotal = computeGrandTotal(getLatestSnapshot(data.archive));
  const grandTotalLb = grandTotal * 1000;
  const cargoShips = Math.round(grandTotalLb / 154_000_000); // ~70k DWT ship ≈ 154M lb
  const lbPerAmerican = Math.round(grandTotalLb / 335_000_000);
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
    `Observed ${new Date(latest.observationDate + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
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
  document.getElementById("release-date").textContent = latest.releaseDate || data.meta.updated;
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
  const max = Math.max(...layers.map((item) => data.commodities[item.key].values.latest));

  cave.innerHTML = layers
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

  drawSparkline(canvas, values, {
    lineColor: "#fbf5ea",
    fillOpacity: 0.14,
    padding: 12,
    lineWidth: 2,
  });
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
  bindFilters(data);
}

init().catch((error) => {
  console.error("Dashboard load failed", error);
  const grid = document.getElementById("compare-grid");
  if (grid) grid.innerHTML = `<p style="padding:1rem">Could not load the cold storage archive.</p>`;
});
