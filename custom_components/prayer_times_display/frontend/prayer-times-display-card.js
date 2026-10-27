// Prayer Times Display card
// Served and registered automatically by the prayer_times_display integration.
// Reads the location's "Weekly schedule" sensor, so no entity IDs are configured:
// - device_id: which location to show (defaults to the first one set up)
// - days: how many days to show, 1 (today only) to 7
// - design: table | focus | timeline | now_next | ring
// - rendering_style: vertical | horizontal
// - alignment: left | center | right | stretch (content fills the card's width)

const DOMAIN = "prayer_times_display";
const CARD_TYPE = "prayer-times-display-card";
const EDITOR_TYPE = "prayer-times-display-card-editor";
const DEFAULT_TITLE = "Prayer Times";
const MAX_DAYS = 7;
const EMPTY = "—";
const DESIGNS = ["table", "focus", "timeline", "now_next", "ring"];
// Designs that show only the current and next prayer: "Days to show" doesn't apply
const NOW_NEXT_DESIGNS = ["now_next", "ring"];
// How often the current/next prayer and countdown are re-checked
const TICK_MS = 30000;

// [key, label, short label, icon]
const PRAYERS = [
  ["imsak", "Suhoor Ends", "Suhoor", "mdi:food-off"],
  ["fajr", "Fajr", "Fajr", "mdi:weather-sunset-up"],
  ["sunrise", "Sunrise", "Sunrise", "mdi:weather-sunny"],
  ["dhuhr", "Dhuhr", "Dhuhr", "mdi:white-balance-sunny"],
  ["asr", "Asr", "Asr", "mdi:weather-partly-cloudy"],
  ["maghrib", "Maghrib", "Maghrib", "mdi:weather-sunset-down"],
  ["isha", "Isha", "Isha", "mdi:weather-night"],
];
// Only these can be the current or next prayer; Suhoor and Sunrise are markers
const SALAH = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const MINOR = ["imsak", "sunrise"];
const prayer = (key) => PRAYERS.find((p) => p[0] === key);

const STYLES = `
  :host {
    display: block;
    --ptd-now: var(--success-color, #43a047);
    --ptd-next: var(--primary-color, #03a9f4);
    --ptd-now-soft: color-mix(in srgb, var(--ptd-now) 16%, transparent);
    --ptd-next-soft: color-mix(in srgb, var(--ptd-next) 16%, transparent);
    --ptd-line: var(--divider-color, rgba(127, 127, 127, 0.2));
    --ptd-muted: var(--secondary-text-color);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 8px 16px;
    padding: 16px 16px 4px;
  }
  .title { font-weight: 600; font-size: 16px; }
  .sub { display: block; font-weight: 400; font-size: 13px; color: var(--ptd-muted); }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 14px;
    padding: 3px 12px 3px 8px;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  .pill.now { background: var(--ptd-now-soft); color: var(--ptd-now); }
  .pill.next { background: var(--ptd-next-soft); color: var(--ptd-next); }
  .pill ha-icon { --mdc-icon-size: 16px; }
  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ptd-now);
    box-shadow: 0 0 0 3px var(--ptd-now-soft);
  }
  .body { padding: 8px 16px 16px; display: flex; overflow-x: auto; }
  .align-left { justify-content: flex-start; }
  .align-center { justify-content: center; }
  .align-right { justify-content: flex-end; }
  /* Full width: each design's content fills the card */
  .align-stretch > * { flex: 1 1 auto; min-width: 0; }
  .align-stretch table { width: 100%; }
  .align-stretch .focus.horizontal .rows { flex: 1 1 auto; }
  .align-stretch .chip { flex: 1 1 0; }
  ha-icon { --mdc-icon-size: 20px; color: var(--ptd-muted); }

  .tag {
    display: inline-block;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: 6px;
    padding: 1px 5px;
    line-height: 1.4;
    color: var(--text-primary-color, #fff);
  }
  .tag.now { background: var(--ptd-now); }
  .tag.next { background: var(--ptd-next); }

  /* table */
  table { border-collapse: collapse; }
  th, td {
    padding: 7px 12px;
    border-top: 1px solid var(--ptd-line);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    text-align: left;
    vertical-align: top;
  }
  tr:first-child th, tr:first-child td { border-top: 0; }
  th { font-weight: 600; }
  td.name ha-icon { margin-right: 8px; }
  th.col { text-align: center; }
  .colicon { display: flex; justify-content: center; margin-bottom: 4px; }
  td.t { text-align: center; }
  td .tag { display: block; width: max-content; margin: 3px auto 0; }
  .past { opacity: 0.45; }
  td.current { background: var(--ptd-now-soft); color: var(--ptd-now); font-weight: 700; border-radius: 6px; opacity: 1; }
  td.next { background: var(--ptd-next-soft); color: var(--ptd-next); font-weight: 700; border-radius: 6px; }

  /* focus */
  .focus { display: flex; gap: 22px; align-items: flex-start; }
  .focus.vertical { flex-direction: column; gap: 10px; align-items: stretch; }
  .hero {
    background: var(--ptd-next-soft);
    border: 1px solid color-mix(in srgb, var(--ptd-next) 30%, transparent);
    border-radius: 12px;
    padding: 12px 16px;
    min-width: 240px;
  }
  .hero-now {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ptd-now);
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--ptd-line);
  }
  .hero-now .dot { margin-right: 4px; }
  .hero-now span { color: var(--ptd-muted); }
  .hero-label { color: var(--ptd-next); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
  .hero-main { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
  .hero-main ha-icon { --mdc-icon-size: 32px; color: var(--ptd-next); }
  .hero-name { font-size: 26px; font-weight: 700; }
  .hero-time { font-size: 26px; font-weight: 300; margin-left: auto; padding-left: 16px; font-variant-numeric: tabular-nums; }
  .hero-count { color: var(--ptd-muted); margin: 0 0 10px 42px; }
  .bar { height: 6px; border-radius: 3px; background: var(--ptd-line); overflow: hidden; }
  .fill { height: 100%; border-radius: 3px; background: var(--ptd-next); }
  .bar-labels { display: flex; justify-content: space-between; gap: 16px; margin-top: 5px; font-size: 11.5px; color: var(--ptd-muted); }
  .li { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-top: 1px solid var(--ptd-line); font-variant-numeric: tabular-nums; }
  .li:first-child { border-top: 0; }
  .li .time { margin-left: auto; padding-left: 32px; }
  .li.current { background: var(--ptd-now-soft); color: var(--ptd-now); font-weight: 700; border-radius: 6px; }
  .li.next { background: var(--ptd-next-soft); color: var(--ptd-next); font-weight: 700; border-radius: 6px; }
  .li.current ha-icon { color: var(--ptd-now); }
  .li.next ha-icon { color: var(--ptd-next); }
  table.mini { margin-top: 6px; font-size: 13px; }
  table.mini th, table.mini td { padding: 5px 10px; }
  table.mini td { color: var(--ptd-muted); }
  .rows { display: flex; flex-direction: column; gap: 8px; }
  .chiprow { display: flex; align-items: center; gap: 8px; }
  .rowlabel { width: 100px; flex: none; font-weight: 600; }
  .chip {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 76px;
    padding: 8px 6px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
    font-variant-numeric: tabular-nums;
  }
  .chip .tag { position: absolute; top: -8px; }
  .chip .name { font-size: 12px; color: var(--ptd-muted); }
  .chip .time { font-weight: 600; }
  .chip.current { background: var(--ptd-now-soft); outline: 1px solid var(--ptd-now); }
  .chip.next { background: var(--ptd-next-soft); outline: 1px solid var(--ptd-next); }
  .chip.current .name, .chip.current .time, .chip.current ha-icon { color: var(--ptd-now); }
  .chip.next .name, .chip.next .time, .chip.next ha-icon { color: var(--ptd-next); }
  .chiprow.small .chip { padding: 4px 6px; background: transparent; }
  .chiprow.small .time { font-weight: 400; font-size: 13px; }
  .chiprow.small .rowlabel { font-weight: 500; color: var(--ptd-muted); }

  /* now and next */
  .nownext { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr); min-width: 260px; }
  .nownext.horizontal { grid-template-columns: repeat(2, minmax(0, 1fr)); min-width: 420px; }
  .panel { border-radius: 12px; padding: 12px 16px; }
  .now-panel {
    background: var(--ptd-now-soft);
    border: 1px solid color-mix(in srgb, var(--ptd-now) 30%, transparent);
    color: var(--ptd-now);
  }
  .now-panel ha-icon { color: var(--ptd-now); }
  .now-panel.empty { background: transparent; border: 1px dashed var(--ptd-line); color: var(--ptd-muted); }
  .next-panel {
    background: var(--ptd-next-soft);
    border: 1px solid color-mix(in srgb, var(--ptd-next) 30%, transparent);
  }
  .next-panel .panel-label, .next-panel ha-icon { color: var(--ptd-next); }
  .panel-label { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
  .panel-main { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
  .panel-main ha-icon { --mdc-icon-size: 28px; }
  .panel-name { font-size: 24px; font-weight: 700; }
  .horizontal .panel-name { font-size: 22px; }
  .panel-time { font-size: 24px; font-weight: 300; margin-left: auto; padding-left: 16px; font-variant-numeric: tabular-nums; }
  .panel-sub { font-size: 13px; margin: 2px 0 0 38px; color: var(--ptd-muted); }
  .now-panel .panel-sub { color: inherit; }
  .now-panel.empty .panel-sub { margin-left: 0; }
  .next-panel .bar { margin-top: 10px; }

  /* countdown ring */
  .hero.ring.vertical { text-align: center; }
  .hero.ring.vertical .hero-now { justify-content: center; }
  .hero.ring.horizontal { display: flex; align-items: center; gap: 18px; }
  .hero.ring svg { flex: none; margin: 0 auto; }
  .ring-side { flex: 1; min-width: 0; }
  .ring-track { fill: none; stroke: var(--ptd-line); stroke-width: 9; }
  .ring-arc { fill: none; stroke: var(--ptd-next); stroke-width: 9; stroke-linecap: round; }
  svg .ring-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; fill: var(--ptd-next); }
  svg .ring-name { font-size: 22px; font-weight: 700; }
  svg .ring-time { font-size: 13px; fill: var(--ptd-muted); }
  svg .ring-big { font-size: 24px; font-weight: 700; }
  .ring-count { font-size: 15px; font-weight: 600; margin-top: 4px; }
  .hero-now.empty, .hero-now.empty b { color: var(--ptd-muted); }
  .hero-now.empty .dot { background: var(--ptd-muted); box-shadow: none; }

  /* timeline */
  .timeline { max-width: 100%; }
  svg { display: block; max-width: 100%; height: auto; overflow: visible; }
  svg text { font-family: inherit; fill: var(--primary-text-color); }
  svg .axis { fill: var(--ptd-muted); font-size: 11px; }
  svg .grid { stroke: var(--ptd-line); stroke-dasharray: 2 4; }
  svg .day { font-weight: 600; font-size: 13.5px; }
  svg .daysub { fill: var(--ptd-muted); font-size: 11.5px; }
  svg .track { stroke: color-mix(in srgb, var(--primary-text-color) 22%, transparent); stroke-width: 2; }
  svg .daylight { fill: rgba(255, 193, 7, 0.2); }
  svg .span { stroke: var(--ptd-now); stroke-width: 5; stroke-linecap: round; opacity: 0.75; }
  svg .mark { fill: var(--primary-text-color); stroke: var(--card-background-color, #fff); stroke-width: 2; }
  svg .mark.minor { fill: var(--card-background-color, #fff); stroke: var(--ptd-muted); stroke-width: 1.5; }
  svg .mark.current { fill: var(--ptd-now); }
  svg .mark.next { fill: var(--ptd-next); }
  svg .lbl { font-size: 11.5px; font-weight: 600; }
  svg .tm { font-size: 11px; fill: var(--ptd-muted); font-variant-numeric: tabular-nums; }
  svg .past { opacity: 0.45; }
  svg .lbl.current, svg .tm.current { fill: var(--ptd-now); font-weight: 700; }
  svg .lbl.next, svg .tm.next { fill: var(--ptd-next); font-weight: 700; }
  svg .svgtag { font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em; }
  svg .svgtag.current { fill: var(--ptd-now); }
  svg .svgtag.next { fill: var(--ptd-next); }
  svg .nowline { stroke: var(--error-color, #ff7043); stroke-width: 2; }
  svg .nowlbl { fill: var(--error-color, #ff7043); font-size: 11px; font-weight: 600; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; font-size: 12px; color: var(--ptd-muted); }
  .legend i { display: inline-block; vertical-align: -1px; margin-right: 6px; }
  .lg-daylight { width: 18px; height: 8px; border-radius: 4px; background: rgba(255, 193, 7, 0.35); }
  .lg-span { width: 18px; height: 5px; border-radius: 3px; background: var(--ptd-now); }
  .lg-next { width: 9px; height: 9px; border-radius: 50%; background: var(--ptd-next); }
  .lg-now { width: 2px; height: 12px; background: var(--error-color, #ff7043); }
`;

// ---------- helpers ----------

// Returns the integration's entities as { "schedule": "sensor.x", ... } for
// one device. When no device is given, the first device found is used.
function findEntities(hass, deviceId) {
  const map = {};
  let device = deviceId;
  for (const entry of Object.values(hass.entities || {})) {
    if (entry.platform !== DOMAIN || !entry.translation_key) continue;
    if (!device) device = entry.device_id;
    if (entry.device_id === device) map[entry.translation_key] = entry.entity_id;
  }
  return { deviceId: device, entities: map };
}

function firstDeviceId(hass) {
  return findEntities(hass).deviceId;
}

function el(tag, cls, ...children) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  for (const child of children) if (child != null && child !== false) node.append(child);
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
}

function icon(name) {
  const node = document.createElement("ha-icon");
  node.icon = name;
  node.setAttribute("icon", name);
  return node;
}

// "1h 12m" or "12m"
function duration(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

function tagFor(state) {
  if (state === "current") return el("span", "tag now", "Now");
  if (state === "next") return el("span", "tag next", "Next");
  return null;
}

// Works out which prayer we're in and which comes next, across all known days.
// The current prayer is the last one that has started, except that Fajr's time
// ends at sunrise, leaving no current prayer until Dhuhr. Before today's Fajr
// there is no current prayer either, as yesterday isn't in the schedule.
function prayerStatus(days, now) {
  const events = [];
  days.forEach((day, index) => {
    for (const [key] of PRAYERS) {
      const at = day[key] && new Date(day[key]);
      if (at && !isNaN(at)) events.push({ index, key, at });
    }
  });
  events.sort((a, b) => a.at - b.at);

  const started = events.filter((e) => e.at <= now);
  const salahStarted = started.filter((e) => SALAH.includes(e.key));
  let current = salahStarted[salahStarted.length - 1] || null;
  if (current?.key === "fajr") {
    const sunrise = events.find((e) => e.index === current.index && e.key === "sunrise");
    if (sunrise && sunrise.at <= now) current = null;
  }
  const next = events.find((e) => e.at > now && SALAH.includes(e.key)) || null;
  // The progress bar runs from the last prayer or sunrise to the next prayer
  const since = [...started].reverse().find((e) => e.key !== "imsak") || null;
  return { current, next, since };
}

// ---------- card ----------

class PrayerTimesDisplayCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    const design = (config.design || "table").toLowerCase();
    if (!DESIGNS.includes(design)) {
      throw new Error(`design must be one of: ${DESIGNS.join(", ")}`);
    }

    const style = (config.rendering_style || "vertical").toLowerCase();
    if (!["vertical", "horizontal"].includes(style)) {
      throw new Error("rendering_style must be 'vertical' or 'horizontal'");
    }

    const alignment = (config.alignment || "left").toLowerCase();
    if (!["left", "center", "right", "stretch"].includes(alignment)) {
      throw new Error("alignment must be 'left', 'center', 'right', or 'stretch'");
    }

    const days = Number(config.days ?? 1);
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
      throw new Error(`days must be a whole number from 1 to ${MAX_DAYS}`);
    }

    this._config = {
      device_id: config.device_id,
      design,
      rendering_style: style,
      alignment,
      days,
      title: config.title ?? DEFAULT_TITLE,
    };
    this._lookup = null;
    this._render();
  }

  set hass(hass) {
    const previous = this._hass;
    this._hass = hass;
    if (!previous || previous.entities !== hass.entities) this._lookup = null;
    if (this._needsRender(previous)) this._render();
  }

  connectedCallback() {
    // Keeps the current/next prayer and countdown moving between state updates
    this._timer = setInterval(() => this._render(), TICK_MS);
    // The timeline is drawn to fit the card's width. Redraw on the next frame,
    // not inside the observer, so the redraw can't re-trigger it in a loop.
    this._resize = new ResizeObserver(() => {
      if (this._config?.design !== "timeline") return;
      if (Math.abs(this.clientWidth - (this._drawnWidth || 0)) <= 8) return;
      cancelAnimationFrame(this._resizeFrame);
      this._resizeFrame = requestAnimationFrame(() => this._render());
    });
    this._resize.observe(this);
    this._render();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    cancelAnimationFrame(this._resizeFrame);
    this._resize?.disconnect();
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TYPE);
  }

  static getStubConfig(hass) {
    return {
      device_id: firstDeviceId(hass),
      title: DEFAULT_TITLE,
      days: 1,
      design: "table",
      rendering_style: "vertical",
      alignment: "left",
    };
  }

  getCardSize() {
    if (!this._config) return 6;
    const { design, rendering_style: style, days } = this._config;
    if (design === "now_next") return style === "vertical" ? 5 : 3;
    if (design === "ring") return style === "vertical" ? 6 : 4;
    if (design === "focus") return style === "vertical" ? (days > 1 ? 13 : 9) : 4 + days;
    if (style === "horizontal") return 2 + days;
    return design === "timeline" ? 8 : 7;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  get _entities() {
    if (!this._lookup) this._lookup = findEntities(this._hass, this._config.device_id);
    return this._lookup.entities;
  }

  // Only re-render when something the card displays has changed
  _needsRender(previous) {
    if (!this._config) return false;
    if (!previous || !this._lookup) return true;
    if (previous.locale !== this._hass.locale) return true;
    return Object.values(this._entities).some(
      (entityId) => previous.states[entityId] !== this._hass.states[entityId]
    );
  }

  // Every day in the sensor (used to find the next prayer even past the shown days)
  _allDays() {
    const entityId = this._entities.schedule;
    const days = entityId && this._hass.states[entityId]?.attributes?.days;
    return Array.isArray(days) ? days : [];
  }

  // One entry per configured day; missing data gives an empty object
  _shownDays(all) {
    return Array.from({ length: this._config.days }, (_, i) => all[i] || {});
  }

  _timeZone() {
    const locale = this._hass.locale || {};
    return locale.time_zone === "local" ? undefined : this._hass.config?.time_zone;
  }

  _time(value) {
    const time = value && new Date(value);
    if (!time || isNaN(time)) return EMPTY;
    const locale = this._hass.locale || {};
    const options = { hour: "numeric", minute: "2-digit", timeZone: this._timeZone() };
    if (locale.time_format === "12") options.hour12 = true;
    if (locale.time_format === "24") options.hour12 = false;
    const language = locale.time_format === "system" ? undefined : locale.language;
    return new Intl.DateTimeFormat(language, options).format(time);
  }

  // Formats a "YYYY-MM-DD" date; returns null when it can't be parsed
  _date(value, options) {
    const match = value && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
    return new Intl.DateTimeFormat(this._hass.locale?.language, {
      ...options,
      timeZone: "UTC",
    }).format(date);
  }

  _dayLabel(index, day, short = false) {
    if (index === 0) return "Today";
    if (index === 1) return "Tomorrow";
    return this._date(day.date, { weekday: short ? "short" : "long" }) ?? EMPTY;
  }

  // Minutes from the start of the day's date to a time, in the display time
  // zone; more than 1440 when the time falls after midnight
  _minutes(day, value) {
    const time = new Date(value);
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      timeZone: this._timeZone(),
    }).formatToParts(time);
    const part = (type) => parts.find((p) => p.type === type).value;
    const date = `${part("year")}-${part("month")}-${part("day")}`;
    const dayOffset = day.date ? Math.round((Date.parse(date) - Date.parse(day.date)) / 86400000) : 0;
    return dayOffset * 1440 + +part("hour") * 60 + +part("minute");
  }

  _state(status, index, key, day) {
    if (status.current && status.current.index === index && status.current.key === key) return "current";
    if (status.next && status.next.index === index && status.next.key === key) return "next";
    const at = day[key] && new Date(day[key]);
    return at && at <= this._now ? "past" : "upcoming";
  }

  _render() {
    if (!this._config || !this._hass) return;
    this._now = new Date();

    const style = el("style", null, STYLES);
    const card = document.createElement("ha-card");

    if (!this._entities.schedule) {
      const alert = document.createElement("ha-alert");
      alert.alertType = "warning";
      alert.textContent = this._config.device_id
        ? "The selected prayer times location was not found."
        : "No prayer times found. Add the Prayer Times Display integration first.";
      card.append(alert);
      this.shadowRoot.replaceChildren(style, card);
      return;
    }

    const all = this._allDays();
    const days = this._shownDays(all);
    const status = prayerStatus(all, this._now);
    const vertical = this._config.rendering_style === "vertical";

    const body = el("div", `body align-${this._config.alignment}`);
    if (this._config.design === "focus") {
      body.append(this._renderFocus(days, status, vertical));
    } else if (this._config.design === "timeline") {
      body.append(this._renderTimeline(days, status, vertical));
    } else if (this._config.design === "now_next") {
      body.append(this._renderNowNext(status, vertical));
    } else if (this._config.design === "ring") {
      body.append(this._renderRing(status, vertical));
    } else {
      body.append(this._renderTable(days, status, vertical));
    }

    // Designs that already show now and next don't repeat them as header badges
    const pills = !["focus", ...NOW_NEXT_DESIGNS].includes(this._config.design);
    card.append(this._renderHead(days[0], status, pills), body);
    this.shadowRoot.replaceChildren(style, card);
  }

  _renderHead(today, status, pills) {
    const subtitle = [this._date(today.date, { dateStyle: "medium" }), today.hijri_date]
      .filter(Boolean)
      .join(" · ");
    const head = el("div", "head", el("div", "title", this._config.title, subtitle && el("span", "sub", subtitle)));
    if (pills) {
      const group = el("div", "pills");
      if (status.current) {
        group.append(el("div", "pill now", el("i", "dot"), `${prayer(status.current.key)[1]} now`));
      }
      if (status.next) {
        group.append(
          el("div", "pill next", icon("mdi:clock-outline"), `${prayer(status.next.key)[1]} in ${duration(status.next.at - this._now)}`)
        );
      }
      head.append(group);
    }
    return head;
  }

  // ----- design: table -----

  _renderTable(days, status, vertical) {
    const table = el("table");
    if (vertical) {
      const header = table.insertRow();
      header.append(el("th"));
      days.forEach((day, i) => {
        header.append(
          el("th", "col", this._dayLabel(i, day),
            el("span", "sub", this._date(day.date, { dateStyle: "medium" }) ?? EMPTY),
            el("span", "sub", day.hijri_date ?? EMPTY))
        );
      });
      for (const [key, label, , iconName] of PRAYERS) {
        const row = table.insertRow();
        row.append(el("td", "name", icon(iconName), label));
        days.forEach((day, i) => {
          const state = this._state(status, i, key, day);
          row.append(el("td", `t ${state}`, this._time(day[key]), tagFor(state)));
        });
      }
    } else {
      const header = table.insertRow();
      header.append(el("th"));
      for (const [, label, , iconName] of PRAYERS) header.append(el("th", "col", el("div", "colicon", icon(iconName)), label));
      days.forEach((day, i) => {
        const row = table.insertRow();
        const date = this._date(day.date, { dateStyle: "medium" }) ?? EMPTY;
        row.append(el("th", null, this._dayLabel(i, day), el("span", "sub", `${date} · ${day.hijri_date ?? EMPTY}`)));
        for (const [key] of PRAYERS) {
          const state = this._state(status, i, key, day);
          row.append(el("td", `t ${state}`, this._time(day[key]), tagFor(state)));
        }
      });
    }
    return table;
  }

  // ----- design: focus -----

  // How far through the time from the last prayer (or sunrise) to the next
  // one we are, 0–100; null when either end is unknown
  _progress(status) {
    if (!status.since || !status.next) return null;
    const total = status.next.at - status.since.at;
    return Math.min(100, Math.max(0, ((this._now - status.since.at) / total) * 100));
  }

  // Why no prayer is current: Fajr's time ends at sunrise, and before Fajr
  // there's nothing from today yet
  _noCurrentNote(status) {
    if (status.since?.key === "sunrise") return `Fajr ended at sunrise, ${this._time(status.since.at)}`;
    return "Before Fajr";
  }

  _nextLabel(status) {
    return status.next && status.next.index > 0 ? "Next prayer · tomorrow" : "Next prayer";
  }

  // "Now: Dhuhr · since 1:02 pm (1h 5m ago)", or a muted note when no prayer is current
  _nowLine(status) {
    if (!status.current) {
      return el("div", "hero-now empty", el("i", "dot"), el("b", null, "No prayer time"),
        el("span", null, ` · ${this._noCurrentNote(status)}`));
    }
    return el("div", "hero-now", el("i", "dot"), "Now: ", el("b", null, prayer(status.current.key)[1]),
      el("span", null, ` · since ${this._time(status.current.at)} (${duration(this._now - status.current.at)} ago)`));
  }

  _renderHero(status) {
    const hero = el("div", "hero");
    if (status.current) hero.append(this._nowLine(status));
    hero.append(el("div", "hero-label", "Next prayer"));
    if (!status.next) {
      hero.append(el("div", "hero-main", el("span", "hero-name", EMPTY)));
      return hero;
    }
    const [, name, , iconName] = prayer(status.next.key);
    hero.append(
      el("div", "hero-main", icon(iconName), el("span", "hero-name", name), el("span", "hero-time", this._time(status.next.at))),
      el("div", "hero-count", `in ${duration(status.next.at - this._now)}`)
    );
    if (status.since) {
      const fill = el("div", "fill");
      fill.style.width = `${this._progress(status)}%`;
      hero.append(
        el("div", "bar", fill),
        el("div", "bar-labels",
          el("span", null, `${prayer(status.since.key)[1]} ${this._time(status.since.at)}`),
          el("span", null, `${name} ${this._time(status.next.at)}`))
      );
    }
    return hero;
  }

  _renderFocus(days, status, vertical) {
    const wrap = el("div", `focus ${vertical ? "vertical" : "horizontal"}`, this._renderHero(status));
    const today = days[0];

    if (vertical) {
      const list = el("div", "list");
      for (const [key, label, , iconName] of PRAYERS) {
        const state = this._state(status, 0, key, today);
        list.append(el("div", `li ${state}`, icon(iconName), el("span", null, label), tagFor(state), el("span", "time", this._time(today[key]))));
      }
      wrap.append(list);
      if (days.length > 1) {
        const table = el("table", "mini");
        const header = table.insertRow();
        header.append(el("th", null, "Coming days"));
        days.slice(1).forEach((day, j) => {
          header.append(el("th", null, this._dayLabel(j + 1, day, true), el("span", "sub", this._date(day.date, { day: "numeric", month: "short" }) ?? EMPTY)));
        });
        for (const [key, label] of PRAYERS) {
          const row = table.insertRow();
          row.append(el("td", null, label));
          days.slice(1).forEach((day, j) => {
            const state = this._state(status, j + 1, key, day);
            row.append(el("td", state === "next" ? "next" : null, this._time(day[key])));
          });
        }
        wrap.append(table);
      }
      return wrap;
    }

    const rows = el("div", "rows");
    days.forEach((day, i) => {
      const date = i ? this._date(day.date, { day: "numeric", month: "short" }) : null;
      const row = el("div", `chiprow${i ? " small" : ""}`, el("div", "rowlabel", this._dayLabel(i, day), date && el("span", "sub", date)));
      for (const [key, label, short, iconName] of PRAYERS) {
        const state = this._state(status, i, key, day);
        row.append(
          el("div", `chip ${state}`, tagFor(state), i === 0 ? icon(iconName) : null,
            el("span", "name", i === 0 ? label : short), el("span", "time", this._time(day[key])))
        );
      }
      rows.append(row);
    });
    wrap.append(rows);
    return wrap;
  }

  // ----- design: now and next -----

  _renderNowNext(status, vertical) {
    const wrap = el("div", `nownext ${vertical ? "vertical" : "horizontal"}`);

    const now = el("div", "panel now-panel", el("div", "panel-label", "Now"));
    if (status.current) {
      const [, name, , iconName] = prayer(status.current.key);
      const started = this._time(status.current.at);
      const ago = `${duration(this._now - status.current.at)} ago`;
      now.append(
        el("div", "panel-main", icon(iconName), el("span", "panel-name", name),
          vertical ? el("span", "panel-time", started) : null),
        el("div", "panel-sub", vertical ? ago : `${started} · ${ago}`)
      );
    } else {
      now.classList.add("empty");
      now.append(
        el("div", "panel-main", el("span", "panel-name", "No prayer time")),
        el("div", "panel-sub", this._noCurrentNote(status))
      );
    }

    const next = el("div", "panel next-panel", el("div", "panel-label", this._nextLabel(status)));
    if (!status.next) {
      next.append(el("div", "panel-main", el("span", "panel-name", EMPTY)));
    } else {
      const [, name, , iconName] = prayer(status.next.key);
      const at = this._time(status.next.at);
      const until = `in ${duration(status.next.at - this._now)}`;
      next.append(
        el("div", "panel-main", icon(iconName), el("span", "panel-name", name),
          vertical ? el("span", "panel-time", at) : null),
        el("div", "panel-sub", vertical ? until : `${at} · ${until}`)
      );
      const progress = this._progress(status);
      if (progress !== null) {
        const fill = el("div", "fill");
        fill.style.width = `${progress}%`;
        next.append(el("div", "bar", fill));
        if (vertical) {
          next.append(
            el("div", "bar-labels",
              el("span", null, `${prayer(status.since.key)[1]} ${this._time(status.since.at)}`),
              el("span", null, `${name} ${at}`))
          );
        }
      }
    }

    wrap.append(now, next);
    return wrap;
  }

  // ----- design: countdown ring -----

  // A ring whose arc shows how far through the wait for the next prayer we
  // are, with lines of text centred inside: [text, class, y] in a 140×140 box
  _ringSvg(progress, size, lines) {
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const svg = svgEl("svg", { width: size, height: size, viewBox: "0 0 140 140" });
    svg.append(
      svgEl("circle", { cx: 70, cy: 70, r: radius, class: "ring-track" }),
      svgEl("circle", {
        cx: 70, cy: 70, r: radius, class: "ring-arc",
        "stroke-dasharray": `${(circumference * (progress ?? 0)) / 100} ${circumference}`,
        transform: "rotate(-90 70 70)",
      })
    );
    for (const [text, cls, y] of lines) {
      svg.append(svgEl("text", { x: 70, y, class: cls, "text-anchor": "middle" }, text));
    }
    return svg;
  }

  _renderRing(status, vertical) {
    const hero = el("div", `hero ring ${vertical ? "vertical" : "horizontal"}`);
    const progress = this._progress(status);
    const next = status.next && prayer(status.next.key);
    const until = status.next ? duration(status.next.at - this._now) : EMPTY;

    if (vertical) {
      hero.append(
        this._nowLine(status),
        this._ringSvg(progress, 160, [
          [this._nextLabel(status).toUpperCase(), "ring-label", 50],
          [next ? next[1] : EMPTY, "ring-name", 78],
          [status.next ? this._time(status.next.at) : "", "ring-time", 98],
        ]),
        el("div", "ring-count", status.next ? `in ${until}` : EMPTY)
      );
      return hero;
    }

    const side = el("div", "ring-side", this._nowLine(status), el("div", "hero-label", this._nextLabel(status)));
    side.append(
      next
        ? el("div", "hero-main", icon(next[3]), el("span", "hero-name", next[1]), el("span", "hero-time", this._time(status.next.at)))
        : el("div", "hero-main", el("span", "hero-name", EMPTY))
    );
    hero.append(
      this._ringSvg(progress, 112, [
        [until, "ring-big", 76],
        [status.next ? "to go" : "", "ring-time", 98],
      ]),
      side
    );
    return hero;
  }

  // ----- design: timeline -----

  // Hour range covering every shown time, padded to whole hours
  _timelineRange(days) {
    let low = Infinity;
    let high = -Infinity;
    for (const day of days) {
      for (const [key] of PRAYERS) {
        if (!day[key]) continue;
        const m = this._minutes(day, day[key]);
        low = Math.min(low, m);
        high = Math.max(high, m);
      }
    }
    if (!isFinite(low)) return [180, 1260];
    return [Math.floor((low - 30) / 180) * 180, Math.ceil((high + 30) / 180) * 180];
  }

  _hourLabel(minutes) {
    const date = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60) % 24));
    return new Intl.DateTimeFormat(this._hass.locale?.language, {
      hour: "numeric",
      hour12: this._hass.locale?.time_format === "24" ? false : this._hass.locale?.time_format === "12" ? true : undefined,
      timeZone: "UTC",
    }).format(date);
  }

  _renderTimeline(days, status, vertical) {
    const [start, end] = this._timelineRange(days);
    const svg = vertical ? this._timelineVertical(days, status, start, end) : this._timelineHorizontal(days, status, start, end);
    const n = days.length;
    const legend = el("div", "legend",
      el("span", null, el("i", "lg-daylight"), "Daylight"),
      status.current ? el("span", null, el("i", "lg-span"), "Current prayer") : null,
      status.next ? el("span", null, el("i", "lg-next"), "Next prayer") : null,
      el("span", null, el("i", "lg-now"), "Now"),
      n > 2 ? el("span", null, vertical ? "Top to bottom: Suhoor, Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha" : "Names on the first row; later rows show times") : null);
    return el("div", "timeline", svg, legend);
  }

  _timeText(day, key) {
    return this._time(day[key]).replace(/\s/g, "");
  }

  // Draws an SVG at its natural size; it only shrinks if the card is narrower
  _svg(width, height) {
    return svgEl("svg", { width, height, viewBox: `0 0 ${width} ${height}` });
  }

  _timelineHorizontal(days, status, start, end) {
    const n = days.length;
    const left = 120;
    // Fit the track to the card (minus padding), keeping it readable
    this._drawnWidth = this.clientWidth;
    const width = Math.max(420, (this.clientWidth || 900) - 32 - left - 20);
    const rowHeight = 74;
    const top = 46;
    const x = (m) => left + ((m - start) / (end - start)) * width;
    const svg = this._svg(left + width + 20, top + rowHeight * n + 14);

    for (let m = start; m <= end; m += 180) {
      svg.append(svgEl("line", { x1: x(m), x2: x(m), y1: top - 8, y2: top + rowHeight * n, class: "grid" }));
      svg.append(svgEl("text", { x: x(m), y: top - 14, class: "axis", "text-anchor": "middle" }, this._hourLabel(m)));
    }

    days.forEach((day, i) => {
      const y = top + rowHeight * i + rowHeight / 2;
      svg.append(svgEl("text", { x: 0, y: y - 4, class: "day" }, this._dayLabel(i, day)));
      svg.append(svgEl("text", { x: 0, y: y + 13, class: "daysub" }, this._date(day.date, { day: "numeric", month: "short" }) ?? ""));
      if (day.sunrise && day.maghrib) {
        const a = x(this._minutes(day, day.sunrise));
        svg.append(svgEl("rect", { x: a, y: y - 5, width: x(this._minutes(day, day.maghrib)) - a, height: 10, rx: 5, class: "daylight" }));
      }
      svg.append(svgEl("line", { x1: x(start), x2: x(end), y1: y, y2: y, class: "track" }));
      this._appendSpan(svg, day, i, status, end, (a, b) => ({ x1: x(a), x2: x(b), y1: y, y2: y }));

      PRAYERS.forEach(([key, , short], j) => {
        if (!day[key]) return;
        const cx = x(this._minutes(day, day[key]));
        const state = this._state(status, i, key, day);
        const minor = MINOR.includes(key);
        svg.append(svgEl("circle", { cx, cy: y, r: minor ? 3.5 : state === "current" || state === "next" ? 7 : 5.5, class: `mark ${state}${minor ? " minor" : ""}` }));
        const above = j % 2 === 1;
        const ty = above ? y - 13 : y + 22;
        // Suhoor's label ends at its dot so it doesn't run into Sunrise's
        const anchor = key === "imsak" ? "end" : "middle";
        const lx = key === "imsak" ? cx + 4 : cx;
        if (i === 0 || n <= 2) {
          svg.append(svgEl("text", { x: lx, y: above ? ty - 12 : ty, class: `lbl ${state}`, "text-anchor": anchor }, short));
          svg.append(svgEl("text", { x: lx, y: above ? ty : ty + 12, class: `tm ${state}`, "text-anchor": anchor }, this._timeText(day, key)));
          if (state === "current" || state === "next") {
            svg.append(svgEl("text", { x: cx, y: above ? ty - 25 : ty + 25, class: `svgtag ${state}`, "text-anchor": "middle" }, state === "current" ? "NOW" : "NEXT"));
          }
        } else {
          svg.append(svgEl("text", { x: lx, y: above ? y - 11 : y + 20, class: `tm ${state}`, "text-anchor": anchor }, this._timeText(day, key)));
        }
      });
      this._appendNow(svg, day, (m) => ({ x1: x(m), x2: x(m), y1: y - 30, y2: y + 30 }), (m) => ({ x: x(m) + 4, y: y - 26 }));
    });
    return svg;
  }

  _timelineVertical(days, status, start, end) {
    const n = days.length;
    const height = 560;
    const top = 70;
    const left = 56;
    // At full width the day columns spread across the card
    let colWidth = n >= 5 ? 150 : 200;
    if (this._config.alignment === "stretch") {
      this._drawnWidth = this.clientWidth;
      colWidth = Math.max(colWidth, ((this.clientWidth || 0) - 32 - left - 10) / n);
    }
    const y = (m) => top + ((m - start) / (end - start)) * height;
    const svg = this._svg(left + colWidth * n + 10, top + height + 24);

    for (let m = start; m <= end; m += 180) {
      svg.append(svgEl("line", { x1: left - 6, x2: left + colWidth * n, y1: y(m), y2: y(m), class: "grid" }));
      svg.append(svgEl("text", { x: left - 10, y: y(m) + 4, class: "axis", "text-anchor": "end" }, this._hourLabel(m)));
    }

    days.forEach((day, i) => {
      const cx = left + colWidth * i + colWidth / 2;
      svg.append(svgEl("text", { x: cx, y: 24, class: "day", "text-anchor": "middle" }, this._dayLabel(i, day, n >= 5)));
      svg.append(svgEl("text", { x: cx, y: 42, class: "daysub", "text-anchor": "middle" }, this._date(day.date, { day: "numeric", month: "short" }) ?? ""));
      if (day.sunrise && day.maghrib) {
        const a = y(this._minutes(day, day.sunrise));
        svg.append(svgEl("rect", { x: cx - 5, y: a, width: 10, height: y(this._minutes(day, day.maghrib)) - a, rx: 5, class: "daylight" }));
      }
      svg.append(svgEl("line", { x1: cx, x2: cx, y1: y(start), y2: y(end), class: "track" }));
      this._appendSpan(svg, day, i, status, end, (a, b) => ({ x1: cx, x2: cx, y1: y(a), y2: y(b) }));

      PRAYERS.forEach(([key, , short], j) => {
        if (!day[key]) return;
        const cy = y(this._minutes(day, day[key]));
        const state = this._state(status, i, key, day);
        const minor = MINOR.includes(key);
        svg.append(svgEl("circle", { cx, cy, r: minor ? 3.5 : state === "current" || state === "next" ? 7 : 5.5, class: `mark ${state}${minor ? " minor" : ""}` }));
        const right = j % 2 === 1;
        const tx = right ? cx + 12 : cx - 12;
        const anchor = right ? "start" : "end";
        const label = n > 2 ? this._timeText(day, key) : `${short} ${this._timeText(day, key)}`;
        svg.append(svgEl("text", { x: tx, y: cy + 4, class: `${n > 2 ? "tm" : "lbl"} ${state}`, "text-anchor": anchor }, label));
        if (state === "current" || state === "next") {
          svg.append(svgEl("text", { x: tx, y: cy + 17, class: `svgtag ${state}`, "text-anchor": anchor }, state === "current" ? "NOW" : "NEXT"));
        }
      });
      this._appendNow(svg, day, (m) => ({ x1: cx - 34, x2: cx + 34, y1: y(m), y2: y(m) }));
    });
    return svg;
  }

  // Highlights the current prayer's time, up to the next prayer, on its day.
  // After Isha the next prayer is tomorrow, so the span runs to the track's end.
  _appendSpan(svg, day, index, status, end, coords) {
    const { current, next } = status;
    if (!current || !next || current.index !== index) return;
    const to = Math.min(this._minutes(day, next.at), end);
    svg.append(svgEl("line", { ...coords(this._minutes(day, current.at), to), class: "span" }));
  }

  // Marks the current time on the track of the day it falls in
  _appendNow(svg, day, lineCoords, labelCoords) {
    if (!day.date) return;
    const m = this._minutes(day, this._now);
    if (m < 0 || m >= 1440) return;
    svg.append(svgEl("line", { ...lineCoords(m), class: "nowline" }));
    if (labelCoords) svg.append(svgEl("text", { ...labelCoords(m), class: "nowlbl" }, "now"));
  }
}

// ---------- editor ----------

class PrayerTimesDisplayCardEditor extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  setConfig(config) {
    this._config = { ...config };

    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this._build();
    }

    const design = (this._config.design ?? "table").toLowerCase();
    // "Days to show" is only offered for designs that use it
    if (this._schemaDesign !== design) {
      this._form.schema = this._schema(design);
      this._schemaDesign = design;
    }

    // Update form data without rebuilding the DOM (keeps the dialog open)
    this._form.data = {
      device_id: this._config.device_id,
      title: this._config.title ?? DEFAULT_TITLE,
      days: this._config.days ?? 1,
      design,
      rendering_style: (this._config.rendering_style ?? "vertical").toLowerCase(),
      alignment: (this._config.alignment ?? "left").toLowerCase(),
    };
  }

  _schema(design) {
    const select = (options) => ({ select: { options, mode: "dropdown" } });
    return [
      { name: "device_id", selector: { device: { integration: DOMAIN } } },
      { name: "title", selector: { text: {} } },
      NOW_NEXT_DESIGNS.includes(design)
        ? null
        : { name: "days", selector: { number: { min: 1, max: MAX_DAYS, step: 1, mode: "slider" } } },
      {
        name: "design",
        selector: select([
          { value: "table", label: "Table" },
          { value: "focus", label: "Next prayer focus" },
          { value: "timeline", label: "Timeline" },
          { value: "now_next", label: "Now and next" },
          { value: "ring", label: "Countdown ring" },
        ]),
      },
      {
        name: "rendering_style",
        selector: select([
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ]),
      },
      {
        name: "alignment",
        selector: select([
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
          { value: "stretch", label: "Full width" },
        ]),
      },
    ].filter(Boolean);
  }

  _build() {
    this._form = document.createElement("ha-form");
    this._form.hass = this._hass;

    const labels = {
      device_id: "Location",
      title: "Title",
      days: "Days to show",
      design: "Design",
      rendering_style: "Rendering style",
      alignment: "Alignment",
    };
    const helpers = {
      days: "1 shows today only, 2 adds tomorrow, up to 7 days.",
      design: "Table: times in a grid. Next prayer focus: a large countdown to the next prayer. Timeline: each day drawn as a line through the day. Now and next, Countdown ring: only the current and next prayer.",
      alignment: "Where the content sits when the card is wider than it. Full width stretches it to fill the card.",
    };
    this._form.computeLabel = (schema) => labels[schema.name] ?? schema.name;
    this._form.computeHelper = (schema) => helpers[schema.name];

    this._form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._config = { ...this._config, ...ev.detail.value };
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: this._config },
          bubbles: true,
          composed: true,
        })
      );
    });

    this.shadowRoot.append(this._form);
  }
}

// Guard against double registration if the module is loaded twice
if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, PrayerTimesDisplayCard);
  customElements.define(EDITOR_TYPE, PrayerTimesDisplayCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD_TYPE,
    name: "Prayer Times Display",
    description:
      "Up to a week of prayer times as a table, a next-prayer countdown or a timeline, or just the current and next prayer.",
    preview: true,
    documentationURL: "https://github.com/rifazrifky/home-assistant-prayer-times-display",
  });
}
