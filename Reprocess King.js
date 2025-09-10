// ---- Constants and shared state ----
const STATION_ID = 60003760; // Jita IV - Moon 4 - Caldari Navy Assembly Plant
const CSV_BASE = 'https://www.fuzzwork.co.uk/dump/latest';
const MAX_MARKET_AGE_MS = 24 * 60 * 60 * 1000; // 1 day
const AGGREGATES_URL = (ids) => `https://market.fuzzwork.co.uk/aggregates/?station=${STATION_ID}&types=${ids.join(',')}`;

// Base reprocessing recovery (e.g., skills/structure). Default to 90.6%.
const BASE_RECOVERY = 0.906;

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

let busy = false;

// DOM refs (script is loaded at end of body)
const inputEl = $('input');
const outputEl = $('output');
const loadingEl = $('loading');
const toggleAmmoBtn = $('toggleAmmoBtn');
const toggleShowReprocessBtn = $('toggleShowReprocessBtn');
const toggleSortBtn = $('toggleSortBtn');

// New recovery control refs
const btnRecovery50 = $('btnRecovery50');
const btnRecovery906 = $('btnRecovery906');
const recoveryCustomEl = $('recoveryCustom');
const btnRecoveryApply = $('btnRecoveryApply');

// Data maps
let typeNameToId = new Map();
let typeMaterials = new Map();

// New mappings for ammo detection (via group->category)
let typeIdToGroupId = new Map();
let groupIdToCategoryId = new Map();

// Toggles/state
let recoveryFactor = BASE_RECOVERY; // currently selected recovery (0..1)
let ignoreAmmo = false;         // skip items in Charge category
let showOnlyReprocess = false;  // show only items with diff > 0
let sortDiffAsc = false;        // difference sort order (false = Desc by default)
let lastSide = 'buy';

// ---- Utilities ----
function setLoading(isLoading) {
    loadingEl.style.display = isLoading ? 'flex' : 'none';
    // disable/enable all buttons while loading to avoid double runs
    document.querySelectorAll('button').forEach(b => b.disabled = isLoading);
}

function formatNumber(n) { return nf.format(n); }

function isAmmo(typeID) {
    const groupID = typeIdToGroupId.get(typeID);
    if (!groupID) return false;
    const categoryID = groupIdToCategoryId.get(groupID);
    // EVE ammunition/charges (including missiles, crystals, scripts) are in categoryID 8
    return categoryID === 8;
}

// Robust CSV line parser (handles quotes, commas, and escaped quotes "")
function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { // escaped quote
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            out.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    out.push(cur);
    return out;
}

// Fetch JSON ensuring response freshness (≤ 1 day) and bypass caches
async function fetchJsonFresh(url, maxAgeMs = MAX_MARKET_AGE_MS) {
    const u = new URL(url);
    u.searchParams.set('ts', Date.now().toString());
    const res = await fetch(u.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch market data');

    // Validate freshness by standard headers (Age, Last-Modified, Date)
    const now = Date.now();
    const ageHeader = res.headers.get('age');
    if (ageHeader) {
        const ageMs = parseInt(ageHeader, 10) * 1000;
        if (!Number.isNaN(ageMs) && ageMs > maxAgeMs) {
            throw new Error('Market data is older than 1 day (Age header).');
        }
    }
    const lastModified = res.headers.get('last-modified');
    if (lastModified) {
        const lm = Date.parse(lastModified);
        if (!Number.isNaN(lm) && (now - lm) > maxAgeMs) {
            throw new Error('Market data is older than 1 day (Last-Modified).');
        }
    } else {
        const dateHdr = res.headers.get('date');
        if (dateHdr) {
            const dt = Date.parse(dateHdr);
            if (!Number.isNaN(dt) && (now - dt) > maxAgeMs) {
                throw new Error('Market data response is older than 1 day (Date header).');
            }
        }
    }

    return res.json();
}

// ---- Static data loading (parallel) ----
let staticLoaded = false;
async function loadStaticData() {
    if (staticLoaded) return;
    try {
        const [typesText, matsText, groupsText] = await Promise.all([
            fetch(`${CSV_BASE}/invTypes.csv`, { cache: 'no-store' }).then(r => {
                if (!r.ok) throw new Error('Failed to load invTypes.csv');
                return r.text();
            }),
            fetch(`${CSV_BASE}/invTypeMaterials.csv`, { cache: 'no-store' }).then(r => {
                if (!r.ok) throw new Error('Failed to load invTypeMaterials.csv');
                return r.text();
            }),
            fetch(`${CSV_BASE}/invGroups.csv`, { cache: 'no-store' }).then(r => {
                if (!r.ok) throw new Error('Failed to load invGroups.csv');
                return r.text();
            })
        ]);

        // invTypes: typeID,groupID,typeName,...
        typesText.split('\n').slice(1).forEach(line => {
            if (!line) return;
            const parts = parseCsvLine(line.replace(/\r$/, ''));
            if (parts.length < 3) return;
            const typeID = parseInt(parts[0], 10);
            const groupID = parseInt(parts[1], 10);
            const typeName = (parts[2] || '').trim().replace(/^"|"$/g, '');
            if (!Number.isFinite(typeID)) return;
            typeNameToId.set(typeName.toLowerCase(), typeID);
            if (Number.isFinite(groupID)) typeIdToGroupId.set(typeID, groupID);
        });

        // invTypeMaterials: typeID,materialTypeID,quantity
        matsText.split('\n').slice(1).forEach(line => {
            if (!line) return;
            const parts = parseCsvLine(line.replace(/\r$/, ''));
            if (parts.length < 3) return;
            const typeID = parseInt(parts[0], 10);
            const matID = parseInt(parts[1], 10);
            const qty = parseInt(parts[2], 10);
            if (!Number.isFinite(typeID) || !Number.isFinite(matID) || !Number.isFinite(qty)) return;
            if (!typeMaterials.has(typeID)) typeMaterials.set(typeID, []);
            typeMaterials.get(typeID).push({ matID, qty });
        });

        // invGroups: groupID,categoryID,...
        groupsText.split('\n').slice(1).forEach(line => {
            if (!line) return;
            const parts = parseCsvLine(line.replace(/\r$/, ''));
            if (parts.length < 2) return;
            const groupID = parseInt(parts[0], 10);
            const categoryID = parseInt(parts[1], 10);
            if (Number.isFinite(groupID) && Number.isFinite(categoryID)) {
                groupIdToCategoryId.set(groupID, categoryID);
            }
        });

        staticLoaded = true;
    } catch (err) {
        console.error(err);
        outputEl.innerHTML = '<p class="error">Error loading static data. Please try again later.</p>';
        throw err;
    }
}

// ---- Recovery controls (new) ----
function clampPct(p) {
    return Math.max(0, Math.min(100, p));
}

function updateRecoveryUI(active) {
    // active: '906' | '50' | 'custom'
    if (btnRecovery906) btnRecovery906.setAttribute('aria-pressed', active === '906' ? 'true' : 'false');
    if (btnRecovery50) btnRecovery50.setAttribute('aria-pressed', active === '50' ? 'true' : 'false');
    // Keep the input value in sync with the current factor for convenience
    if (recoveryCustomEl) {
        recoveryCustomEl.value = (recoveryFactor * 100).toFixed(1);
    }
}

function applyRecoveryAndRecalc(activeTag) {
    updateRecoveryUI(activeTag);
    if (inputEl.value.trim()) {
        calculate(lastSide);
    }
}

function setRecovery906() {
    if (busy) return;
    recoveryFactor = BASE_RECOVERY;
    applyRecoveryAndRecalc('906');
}

function setRecovery50() {
    if (busy) return;
    recoveryFactor = 0.5;
    applyRecoveryAndRecalc('50');
}

function applyCustomRecovery() {
    if (busy) return;
    const raw = parseFloat(recoveryCustomEl?.value);
    const pct = Number.isFinite(raw) ? clampPct(raw) : 100;
    recoveryFactor = pct / 100;
    applyRecoveryAndRecalc('custom');
}

// ---- Core calculation ----
async function calculate(side = 'buy') {
    if (busy) return;
    busy = true;
    lastSide = side;

    setLoading(true);
    outputEl.innerHTML = '';

    try {
        await loadStaticData();

        const input = inputEl.value.trim();
        if (!input) {
            outputEl.innerHTML = '<p class="error">Please enter at least one item.</p>';
            return;
        }

        // Parse and dedupe item names (ignore trailing quantity or "x")
        const itemMap = new Map(); // lowerName -> display name
        for (const rawLine of input.split('\n')) {
            const line = rawLine.trim();
            if (!line) continue;
            const parts = line.split(/\s+/);
            if (!isNaN(parseFloat(parts[parts.length - 1]))) parts.pop();
            if ((parts[parts.length - 1] || '').toLowerCase() === 'x') parts.pop();
            const name = parts.join(' ').trim();
            if (!name) continue;
            const lower = name.toLowerCase();
            if (!itemMap.has(lower)) itemMap.set(lower, name);
        }

        // Build item list and gather all required typeIDs to price (items + mats)
        const items = [];
        const idsToPrice = new Set();
        for (const [lowerName, display] of itemMap) {
            const typeID = typeNameToId.get(lowerName);
            if (!typeID) continue;
            const mats = typeMaterials.get(typeID) || [];
            if (mats.length === 0) continue; // non-reprocessable
            if (ignoreAmmo && isAmmo(typeID)) continue;
            items.push({ name: display, typeID, mats });
            idsToPrice.add(typeID);
            for (const m of mats) idsToPrice.add(m.matID);
        }

        if (items.length === 0) {
            outputEl.innerHTML = '<p class="error">No valid items found.</p>';
            return;
        }

        // Fetch market aggregates (ensure freshness)
        const marketJson = await fetchJsonFresh(AGGREGATES_URL(Array.from(idsToPrice)));

        const isBuy = side === 'buy';
        const sideKey = isBuy ? 'buy' : 'sell';
        const statKey = isBuy ? 'max' : 'min';

        const priceHeader = isBuy ? 'Jita Buy Price (ISK)' : 'Jita Sell Price (ISK)';
        const diffHeader = isBuy ? 'Difference (Reprocess - Buy)' : 'Difference (Reprocess - Sell)';
        const sellText = isBuy ? 'Sell to Buy Orders' : 'List as Sell Order';
        const rpHeader = `Reprocess Value (ISK, ${(recoveryFactor * 100).toFixed(1)}% Recovery)`;

        // Compute rows
        const rows = items.map(it => {
            const itemPrice = +marketJson[it.typeID]?.[sideKey]?.[statKey] || 0;
            let reprocessValue = 0;
            for (const mat of it.mats) {
                const matPrice = +marketJson[mat.matID]?.[sideKey]?.[statKey] || 0;
                if (matPrice > 0) reprocessValue += matPrice * mat.qty * recoveryFactor;
            }
            const diff = reprocessValue - itemPrice;
            const recommend = diff > 0 ? 'Reprocess' : sellText;
            const recClass = diff > 0 ? 'recommend-reprocess' : 'recommend-sell';
            return { name: it.name, itemPrice, reprocessValue, diff, recommend, recClass };
        });

        // Optional filter: show only positive diff (reprocess)
        const filtered = showOnlyReprocess ? rows.filter(r => r.diff > 0) : rows;

        // Sort by difference
        filtered.sort((a, b) => sortDiffAsc ? (a.diff - b.diff) : (b.diff - a.diff));

        if (filtered.length === 0) {
            outputEl.innerHTML = '<p class="error">No items match the current filters.</p>';
            return;
        }

        // Build table HTML
        let html = `<table><tr>
            <th>Item</th>
            <th>${priceHeader}</th>
            <th>${rpHeader}</th>
            <th style="cursor:pointer" onclick="toggleSortDiff()">${diffHeader} ${sortDiffAsc ? '▲' : '▼'}</th>
            <th>Recommendation</th>
        </tr>`;

        for (const r of filtered) {
            html += `<tr>
                <td style="text-align:left">${r.name}</td>
                <td>${formatNumber(r.itemPrice)}</td>
                <td>${formatNumber(r.reprocessValue)}</td>
                <td>${formatNumber(r.diff)}</td>
                <td class="${r.recClass}">${r.recommend}</td>
            </tr>`;
        }
        html += '</table>';

        outputEl.innerHTML = html;
    } catch (err) {
        console.error(err);
        outputEl.innerHTML = '<p class="error">Error fetching up-to-date market data (≤ 1 day). Please try again.</p>';
    } finally {
        setLoading(false);
        busy = false;
    }
}

// ---- Reset ----
function resetAll() {
    if (busy) return;

    inputEl.value = '';
    outputEl.innerHTML = '';
    loadingEl.style.display = 'none';

    recoveryFactor = BASE_RECOVERY; // reset to 90.6%
    ignoreAmmo = false;
    showOnlyReprocess = false;
    sortDiffAsc = false;
    lastSide = 'buy';

    // Recovery UI reset
    if (recoveryCustomEl) recoveryCustomEl.value = (BASE_RECOVERY * 100).toFixed(1);
    updateRecoveryUI('906');

    toggleAmmoBtn.textContent = 'Ignore Ammunition: Off';
    toggleAmmoBtn.setAttribute('aria-pressed', 'false');

    toggleShowReprocessBtn.textContent = 'Show Only Reprocess: Off';
    toggleShowReprocessBtn.setAttribute('aria-pressed', 'false');

    toggleSortBtn.textContent = 'Sort Difference: Desc ▼';
    toggleSortBtn.setAttribute('aria-pressed', 'false');
}

// Expose functions for inline handlers
window.calculate = calculate;
window.toggleIgnoreAmmo = toggleIgnoreAmmo;
window.toggleShowOnlyReprocess = toggleShowOnlyReprocess;
window.toggleSortDiff = toggleSortDiff;
window.resetAll = resetAll;

// Recovery handlers
window.setRecovery906 = setRecovery906;
window.setRecovery50 = setRecovery50;
window.applyCustomRecovery = applyCustomRecovery;

// ---- UI toggles (unchanged except recovery removed) ----
function toggleIgnoreAmmo() {
    if (busy) return;
    ignoreAmmo = !ignoreAmmo;
    toggleAmmoBtn.textContent = `Ignore Ammunition: ${ignoreAmmo ? 'On' : 'Off'}`;
    toggleAmmoBtn.setAttribute('aria-pressed', ignoreAmmo ? 'true' : 'false');
    if (inputEl.value.trim()) calculate(lastSide);
}

function toggleShowOnlyReprocess() {
    if (busy) return;
    showOnlyReprocess = !showOnlyReprocess;
    toggleShowReprocessBtn.textContent = `Show Only Reprocess: ${showOnlyReprocess ? 'On' : 'Off'}`;
    toggleShowReprocessBtn.setAttribute('aria-pressed', showOnlyReprocess ? 'true' : 'false');
    if (inputEl.value.trim()) calculate(lastSide);
}

function toggleSortDiff() {
    if (busy) return;
    sortDiffAsc = !sortDiffAsc;
    toggleSortBtn.textContent = `Sort Difference: ${sortDiffAsc ? 'Asc ▲' : 'Desc ▼'}`;
    toggleSortBtn.setAttribute('aria-pressed', sortDiffAsc ? 'true' : 'false');
    if (inputEl.value.trim()) calculate(lastSide);
}