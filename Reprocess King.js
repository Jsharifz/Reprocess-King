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

// New recovery control refs
const btnRecovery50 = $('btnRecovery50');
const btnRecovery906 = $('btnRecovery906');
const recoveryCustomEl = $('recoveryCustom');
const btnRecoveryApply = $('btnRecoveryApply');

// Tooltip element
let tooltipEl;

// Ratio filter refs
const ratioCustomEl = $('ratioCustom');
const taxRateEl = $('taxRate');

// Data maps
let typeNameToId = new Map();
let typeIdToName = new Map(); // For reverse lookups
let typeMaterials = new Map();

// New mappings for ammo detection (via group->category)
let typeIdToGroupId = new Map();
let groupIdToCategoryId = new Map();

// Toggles/state
let recoveryRate = BASE_RECOVERY; // currently selected recovery (0..1)
let taxRate = 0;                // currently selected tax rate (0..1)
let taxApplication = 'minerals'; // 'minerals', 'item', 'both'
let ignoreAmmo = false;         // skip items in Charge category
let showOnlyReprocess = false;  // show only items with diff > 0
let minRatioFilter = 0;         // minimum value ratio to show
let sortColumn = 'diff';        // Column to sort by
let sortDirection = 'desc';     // 'asc' or 'desc'
let lastSide = 'buy';
let currentRows = [];           // Holds the currently displayed data

const taxToggleOrder = ['minerals', 'item', 'both'];
const taxToggleText = {
    'minerals': 'Tax on: Minerals',
    'item': 'Tax on: Item Value',
    'both': 'Tax on: Both'
};


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

// New utility to check for bombs
function isBomb(typeID) {
    const groupID = typeIdToGroupId.get(typeID);
    // Group ID for bombs in EVE
    return groupID === 90;
}

// New utility to check for condensers
function isCondenser(typeID) {
    const groupID = typeIdToGroupId.get(typeID);
    // Group ID for condensers in EVE
    return groupID === 1775;
}

// New utility to check for Triglavian (Entropic Disintegrator) charges
function isTriglavianCharge(typeID) {
    const groupID = typeIdToGroupId.get(typeID);
    // Group IDs for Entropic Disintegrator charges (e.g., Meson, Baryon, Tetryon)
    const triglavianChargeGroupIDs = [1864, 1865, 1866];
    return triglavianChargeGroupIDs.includes(groupID);
}

// New utility to check for Vorton Projector charges
function isVortonProjectorCharge(typeID) {
    const groupID = typeIdToGroupId.get(typeID);
    // Group IDs for Vorton Projector charges (based on EVE SDE data)
    const vortonProjectorChargeGroupIDs = [1919, 1920, 1921];
    return vortonProjectorChargeGroupIDs.includes(groupID);
}

// Get tooltip normalization factor based on item name and groupID
function getTooltipNormalizationFactor(typeID, itemName) {
    const groupID = typeIdToGroupId.get(typeID);
    const lowerName = itemName.toLowerCase();
    
    // Debug logging
    console.log(`Tooltip normalization check: ${itemName} - TypeID: ${typeID}, GroupID: ${groupID}`);
    
    // Check by group ID first
    if (groupID === 90) {
        console.log(`Found bomb by groupID: ${itemName}`);
        return 5; // Bombs: multiply by 5 (was 20, now reduced by 4x)
    }
    if (groupID === 1775) {
        console.log(`Found condenser by groupID: ${itemName}`);
        return 0.2; // Condensers: divide by 5 (multiply by 0.2)
    }
    if ([1864, 1865, 1866].includes(groupID)) {
        console.log(`Found Triglavian charge by groupID: ${itemName}`);
        return 0.02; // Triglavian: divide by 50 (multiply by 0.02)
    }
    if ([1919, 1920, 1921].includes(groupID)) {
        console.log(`Found Vorton charge by groupID: ${itemName}`);
        return 0.2; // Vorton: divide by 5 (multiply by 0.2)
    }
    
    // Fallback: check by name patterns if group ID detection fails
    if (lowerName.includes('bomb')) {
        console.log(`Found bomb by name: ${itemName}`);
        return 5; // Bombs: multiply by 5 (was 20, now reduced by 4x)
    }
    if (lowerName.includes('condenser')) {
        console.log(`Found condenser by name: ${itemName}`);
        return 0.2; // Condensers: divide by 5
    }
    if (lowerName.includes('meson') || lowerName.includes('baryon') || lowerName.includes('tetryon')) {
        console.log(`Found Triglavian by name: ${itemName}`);
        return 0.02; // Triglavian: divide by 50
    }
    // Enhanced Scarab Breacher Pod detection
    if ((lowerName.includes('scarab') && lowerName.includes('breacher')) || 
        lowerName.includes('scarab breacher pod')) {
        console.log(`Found Scarab Breacher Pod by name: ${itemName}`);
        return 5; // Scarab Breacher Pods: multiply by 5
    }
    
    return 1; // No normalization
}

// New utility to check for batch-reprocessed charges
function isBatchReprocessedCharge(typeID) {
    // All ammo (categoryID 8) is reprocessed in batches of 100, except for Frequency Crystals (groupID 86).
    if (!isAmmo(typeID)) {
        return false;
    }

    const groupID = typeIdToGroupId.get(typeID);
    const isCrystal = groupID === 86; // Group ID for all Frequency Crystals

    return !isCrystal;
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

    // Validates freshness by standard headers (Age, Last-Modified, Date)
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
            typeIdToName.set(typeID, typeName); // Populate reverse map
            if (Number.isFinite(groupID)) typeIdToGroupId.set(typeID, groupID);
        });

        // Data patch for incorrect names from the dump
        const megacyteBadName = '000 - molocath vynneve';
        if (typeNameToId.has(megacyteBadName)) {
            const typeID = typeNameToId.get(megacyteBadName);
            typeIdToName.set(typeID, 'Megacyte');
            typeNameToId.delete(megacyteBadName);
            typeNameToId.set('megacyte', typeID);
        }

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
        recoveryCustomEl.value = (recoveryRate * 100).toFixed(1);
    }
}

function applyRecoveryAndRecalc(activeTag) {
    updateRecoveryUI(activeTag);
    if (currentRows.length > 0) {
        recalculateWithNewRates();
        renderTable();
    }
}

function setRecovery906() {
    if (busy) return;
    recoveryRate = BASE_RECOVERY;
    applyRecoveryAndRecalc('906');
}

function setRecovery50() {
    if (busy) return;
    recoveryRate = 0.5;
    applyRecoveryAndRecalc('50');
}

function applyCustomRecovery() {
    if (busy) return;
    const raw = parseFloat(recoveryCustomEl?.value);
    const pct = Number.isFinite(raw) ? clampPct(raw) : 100;
    recoveryRate = pct / 100;
    applyRecoveryAndRecalc('custom');
}

// ---- Tax controls ----
function applyTaxRate() {
    const taxInput = document.getElementById('taxRate');
    let rate = parseFloat(taxInput.value);
    if (isNaN(rate) || rate < 0) {
        rate = 0;
    }
    taxRate = rate / 100;
    taxInput.value = rate; // Set back the cleaned value
    if (currentRows.length > 0) {
        recalculateWithNewRates();
        renderTable();
    }
}

function setTaxApplication(application) {
    if (busy) return;
    taxApplication = application;

    // Update button UI
    document.getElementById('tax-on-minerals').setAttribute('aria-pressed', application === 'minerals');
    document.getElementById('tax-on-item').setAttribute('aria-pressed', application === 'item');
    document.getElementById('tax-on-both').setAttribute('aria-pressed', application === 'both');

    if (currentRows.length > 0) {
        recalculateWithNewRates();
        renderTable();
    }
}

// ---- Rendering ----
function renderTable() {
    const isBuy = lastSide === 'buy';
    let priceHeader = isBuy ? 'Jita Buy Price (ISK' : 'Jita Sell Price (ISK';
    const diffHeader = isBuy ? 'Difference (Reprocess - Buy)' : 'Difference (Reprocess - Sell)';
    let rpHeader = `Reprocess Value (ISK, ${(recoveryRate * 100).toFixed(1)}% Recovery`;

    // Add tax info to Reprocess Value header if applicable
    if (taxRate > 0 && (taxApplication === 'minerals' || taxApplication === 'both')) {
        rpHeader += `, ${(taxRate * 100).toFixed(1)}% Tax`;
    }
    rpHeader += ')';

    // Add tax info to Jita Price header if applicable
    if (taxRate > 0 && (taxApplication === 'item' || taxApplication === 'both')) {
        priceHeader += `, ${(taxRate * 100).toFixed(1)}% Tax`;
    }
    priceHeader += ')';

    // Apply filters
    let filtered = [...currentRows];
    if (ignoreAmmo) {
        filtered = filtered.filter(r => !isAmmo(r.typeID));
    }
    if (showOnlyReprocess) {
        filtered = filtered.filter(r => r.diff > 0);
    }
    if (minRatioFilter > 0) {
        filtered = filtered.filter(r => r.ratio >= minRatioFilter);
    }

    // Sort by the selected column and direction
    filtered.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        const isAsc = sortDirection === 'asc';

        if (typeof valA === 'string') {
            return isAsc ? valA.localeCompare(valA) : valB.localeCompare(valA);
        }
        return isAsc ? valA - valB : valB - valA;
    });

    if (filtered.length === 0) {
        outputEl.innerHTML = '<p class="error">No items match the current filters.</p>';
        return;
    }

    // Calculate totals from the filtered data
    const totalItemPrice = filtered.reduce((sum, r) => sum + r.displayItemPrice, 0);
    const totalReprocessValue = filtered.reduce((sum, r) => sum + r.reprocessValue, 0);
    const totalDiff = filtered.reduce((sum, r) => sum + r.diff, 0);
    const totalRatio = totalItemPrice > 0 ? totalReprocessValue / totalItemPrice : 0;

    // Aggregate total materials for the footer tooltip
    const totalMaterials = new Map();
    for (const r of filtered) {
        for (const d of r.reprocessDetails) {
            if (totalMaterials.has(d.name)) {
                totalMaterials.get(d.name).quantity += d.quantity;
            } else {
                totalMaterials.set(d.name, { ...d });
            }
        }
    }
    const totalTooltipText = Array.from(totalMaterials.values())
        .sort((a, b) => b.price * b.quantity - a.price * a.quantity) // Sort by value desc
        .map(d => `${d.name} x ${formatNumber(d.quantity)} = ${formatNumber(d.price * d.quantity)} ISK`)
        .join('\n');

    // Helper to generate sortable table headers
    const th = (key, title) => {
        const arrow = sortColumn === key ? (sortDirection === 'asc' ? '▲' : '▼') : '';
        return `<th style="cursor:pointer" onclick="setSort('${key}')">${title} ${arrow}</th>`;
    };

    // Build table HTML
    let html = `<table><thead><tr>
        ${th('name', 'Item')}
        ${th('displayItemPrice', priceHeader)}
        ${th('reprocessValue', rpHeader)}
        ${th('diff', diffHeader)}
        ${th('ratio', 'Ratio')}
        ${th('recommend', 'Recommendation')}
    </tr></thead><tbody>`;

    for (const r of filtered) {
        const tooltipText = r.reprocessDetails
            .map(d => `${d.name} x ${formatNumber(d.quantity)} = ${formatNumber(d.price * d.quantity)} ISK`)
            .join('\n');

        html += `<tr>
            <td style="text-align:left">${r.name}</td>
            <td>${formatNumber(r.displayItemPrice)}</td>
            <td data-tooltip="${tooltipText}">${formatNumber(r.reprocessValue)}</td>
            <td>${formatNumber(r.diff)}</td>
            <td>${r.ratio > 0 ? formatNumber(r.ratio) + 'x' : 'N/A'}</td>
            <td class="${r.recClass}">${r.recommend}</td>
        </tr>`;
    }
    html += `</tbody><tfoot>
        <tr>
            <td style="text-align:left; font-weight: bold;">Total</td>
            <td style="font-weight: bold;">${formatNumber(totalItemPrice)}</td>
            <td style="font-weight: bold;" data-tooltip="${totalTooltipText}">${formatNumber(totalReprocessValue)}</td>
            <td style="font-weight: bold;">${formatNumber(totalDiff)}</td>
            <td style="font-weight: bold;">${totalRatio > 0 ? formatNumber(totalRatio) + 'x' : 'N/A'}</td>
            <td></td>
        </tr>
    </tfoot></table>`;

    outputEl.innerHTML = html;
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

        // Parse and dedupe item names, aggregating quantities.
        const itemMap = new Map(); // lowerName -> { displayName: string, quantity: number }
        for (const rawLine of input.split('\n')) {
            let line = rawLine.trim();
            if (!line) continue;

            // Handle EVE's "List" format (Name > Qty > Group > ... > Price)
            // Find the first numeric-only part, which is likely the quantity.
            // The item name is everything before it.
            const parts = line.split(/\s+/);
            let qtyIndex = -1;
            for (let i = 1; i < parts.length; i++) {
                if (/^\d+$/.test(parts[i]) && isNaN(parseFloat(parts[i-1]))) {
                    qtyIndex = i;
                    break;
                }
            }

            let name;
            let quantity = 1; // Default to 1 if not specified

            if (qtyIndex > 0) {
                // If a quantity was found, the name is the text before it.
                name = parts.slice(0, qtyIndex).join(' ').trim();
                quantity = parseInt(parts[qtyIndex], 10);
            } else {
                // Fallback for simple lists or lines without a clear quantity.
                // This removes trailing numbers (like quantity) or 'x'.
                const simplifiedParts = line.split(/\s+/);
                if (!isNaN(parseFloat(simplifiedParts[simplifiedParts.length - 1]))) simplifiedParts.pop();
                if ((simplifiedParts[simplifiedParts.length - 1] || '').toLowerCase() === 'x') simplifiedParts.pop();
                name = simplifiedParts.join(' ').trim();
            }

            if (!name) continue;
            const lower = name.toLowerCase();
            if (itemMap.has(lower)) {
                itemMap.get(lower).quantity += quantity;
            } else {
                itemMap.set(lower, { displayName: name, quantity });
            }
        }

        // Build item list and gather all required typeIDs to price (items + mats)
        const items = [];
        const idsToPrice = new Set();
        for (const [lowerName, { displayName, quantity }] of itemMap) {
            const typeID = typeNameToId.get(lowerName);
            if (!typeID) continue;
            const mats = typeMaterials.get(typeID) || [];
            if (mats.length === 0) continue; // non-reprocessable
            // Ammo filtering is now done in renderTable, not here
            items.push({ name: displayName, typeID, mats, quantity });
            idsToPrice.add(typeID);
            for (const m of mats) idsToPrice.add(m.matID);
        }

        if (items.length === 0) {
            outputEl.innerHTML = '<p class="error">No valid items found.</p>';
            currentRows = [];
            return;
        }

        // Fetch market aggregates (ensure freshness)
        const marketJson = await fetchJsonFresh(AGGREGATES_URL(Array.from(idsToPrice)));

        const isBuy = side === 'buy';
        const sideKey = isBuy ? 'buy' : 'sell';
        const statKey = isBuy ? 'max' : 'min';
        const sellText = isBuy ? 'Sell to Buy Orders' : 'List as Sell Order';

        // Compute rows
        currentRows = items.map(it => {
            const itemPrice = (+marketJson[it.typeID]?.[sideKey]?.[statKey] || 0) * it.quantity;
            let reprocessValueRaw = 0;
            const reprocessMaterials = [];

            // Determine the correct batch size for reprocessing
            let batchSize = 1;
            if (isBatchReprocessedCharge(it.typeID)) {
                batchSize = 100;
            }
            
            let singleBatchReprocessValue = 0;
            for (const mat of it.mats) {
                const matPrice = +marketJson[mat.matID]?.[sideKey]?.[statKey] || 0;
                if (matPrice > 0) {
                    // SDE data for all ammo is for a batch of 100.
                    // Triglavian charges reprocess individually, so we must divide the batch material quantity by 100.
                    const matQtyPerBatch = isTriglavianCharge(it.typeID) ? mat.qty / 100 : mat.qty;
                    singleBatchReprocessValue += matPrice * matQtyPerBatch;
                    reprocessMaterials.push({
                        name: typeIdToName.get(mat.matID) || `Unknown ID ${mat.matID}`,
                        baseQuantity: matQtyPerBatch, // Store base qty per batch
                        price: matPrice,
                    });
                }
            }
            // The raw reprocess value is the value of one batch, times the number of batches.
            const numBatches = it.quantity / batchSize;
            reprocessValueRaw = singleBatchReprocessValue * numBatches;

            // Store raw values, apply rates later
            return { name: `${it.name} x ${it.quantity}`, typeID: it.typeID, itemPrice, reprocessValueRaw, reprocessMaterials, quantity: it.quantity, batchSize };
        });

        recalculateWithNewRates(); // Apply initial rates
        renderTable();

    } catch (err) {
        console.error(err);
        outputEl.innerHTML = '<p class="error">Error fetching up-to-date market data (≤ 1 day). Please try again.</p>';
        currentRows = [];
    } finally {
        setLoading(false);
        busy = false;
    }
}

// ---- Recalculation ----
function recalculateWithNewRates() {
    currentRows.forEach(r => {
        // Get tooltip normalization factor for this item
        const normalizationFactor = getTooltipNormalizationFactor(r.typeID, r.name);
        
        // Apply normalization to the raw reprocess value BEFORE applying recovery rate
        const normalizedReprocessValueRaw = r.reprocessValueRaw * normalizationFactor;
        const grossMineralValue = normalizedReprocessValueRaw * recoveryRate;
        
        let taxOnMineral = 0;
        let taxOnItem = 0;

        if (taxApplication === 'minerals' || taxApplication === 'both') {
            taxOnMineral = grossMineralValue * taxRate;
        }
        if (taxApplication === 'item' || taxApplication === 'both') {
            taxOnItem = r.itemPrice * taxRate;
        }

        const reprocessValue = grossMineralValue - taxOnMineral;
        const displayItemPrice = r.itemPrice - taxOnItem; // FIXED: Changed from + to -
        const diff = reprocessValue - displayItemPrice;
        const ratio = displayItemPrice > 0 ? reprocessValue / displayItemPrice : 0;
        const recommend = diff > 0 ? 'Reprocess' : (lastSide === 'buy' ? 'Sell to Buy Orders' : 'List as Sell Order');
        const recClass = diff > 0 ? 'recommend-reprocess' : 'recommend-sell';

        // Update tooltip details with current recovery rate and normalization
        const reprocessDetails = r.reprocessMaterials.map(m => {
            const numBatches = r.quantity / r.batchSize;
            let recoveredQty = Math.floor(m.baseQuantity * numBatches * recoveryRate);

            // Apply normalization factor for tooltip display
            recoveredQty = Math.floor(recoveredQty * normalizationFactor);

            return {
                name: m.name,
                quantity: recoveredQty,
                price: m.price,
            };
        });

        Object.assign(r, { reprocessValue, displayItemPrice, diff, ratio, recommend, recClass, reprocessDetails });
    });
}

// ---- Reset ----
function resetAll() {
    if (busy) return;

    inputEl.value = '';
    outputEl.innerHTML = '';
    loadingEl.style.display = 'none';
    currentRows = [];

    recoveryRate = BASE_RECOVERY; // reset to 90.6%
    taxRate = 0;
    taxApplication = 'minerals';
    ignoreAmmo = false;
    showOnlyReprocess = false;
    minRatioFilter = 0;
    sortColumn = 'diff';
    sortDirection = 'desc';
    lastSide = 'buy';

    // Recovery UI reset
    if (recoveryCustomEl) recoveryCustomEl.value = (BASE_RECOVERY * 100).toFixed(1);
    updateRecoveryUI('906');

    // Tax UI reset
    if (taxRateEl) taxRateEl.value = '0';
    setTaxApplication('minerals');


    toggleAmmoBtn.textContent = 'Ignore Ammunition: Off';
    toggleAmmoBtn.setAttribute('aria-pressed', 'false');

    toggleShowReprocessBtn.textContent = 'Show Only Reprocess: Off';
    toggleShowReprocessBtn.setAttribute('aria-pressed', 'false');

    // Ratio filter UI reset
    if (ratioCustomEl) ratioCustomEl.value = '';
    updateRatioUI(0);
}

// ---- UI Updates and Handlers ----
function updateRatioUI(activeRatio) {
    const ratios = [0, 1, 2, 5, 10];
    ratios.forEach(r => {
        const btnId = `btnRatio${r === 0 ? 'All' : r}`;
        const btn = $(btnId);
        if (btn) btn.setAttribute('aria-pressed', activeRatio === r ? 'true' : 'false');
    });
    // If custom is active, no preset button is active
    if (!ratios.includes(activeRatio)) {
        document.querySelectorAll('.ratio-filters button[id^="btnRatio"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
        if (ratioCustomEl) ratioCustomEl.value = activeRatio;
    }
}

function setRatioFilter(ratio) {
    if (busy) return;
    minRatioFilter = ratio;
    updateRatioUI(ratio);
    if (ratioCustomEl) ratioCustomEl.value = '';
    if (currentRows.length > 0) renderTable();
}

function applyCustomRatioFilter() {
    if (busy) return;
    const raw = parseFloat(ratioCustomEl?.value);
    minRatioFilter = Number.isFinite(raw) && raw >= 0 ? raw : 0;
    updateRatioUI(minRatioFilter);
    if (currentRows.length > 0) renderTable();
}

// Expose functions for inline handlers
window.calculate = calculate;
window.toggleIgnoreAmmo = toggleIgnoreAmmo;
window.toggleShowOnlyReprocess = toggleShowOnlyReprocess;
window.setSort = setSort;
window.resetAll = resetAll;
window.setRatioFilter = setRatioFilter;
window.applyCustomRatioFilter = applyCustomRatioFilter;

// Recovery handlers
window.setRecovery906 = setRecovery906;
window.setRecovery50 = setRecovery50;
window.applyCustomRecovery = applyCustomRecovery;

// Tax handler
window.applyTaxRate = applyTaxRate;
window.setTaxApplication = setTaxApplication;

// Add event listeners for Enter key on custom inputs
document.addEventListener('DOMContentLoaded', () => {
    // Create and append the tooltip element once
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tooltip';
    document.body.appendChild(tooltipEl);

    // Tooltip event delegation from the output container
    outputEl.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (target && target.dataset.tooltip) {
            tooltipEl.textContent = target.dataset.tooltip;
            tooltipEl.style.opacity = '1';
        }
    });

    outputEl.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            tooltipEl.style.opacity = '0';
        }
    });

    outputEl.addEventListener('mousemove', (e) => {
        if (tooltipEl.style.opacity === '1') {
            const tooltipHeight = tooltipEl.offsetHeight;
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - e.clientY;
            const offset = 15; // Distance from cursor

            let top;

            // If there isn't enough space below the cursor, show the tooltip above it.
            if (spaceBelow < (tooltipHeight + offset)) {
                top = e.pageY - tooltipHeight - offset;
            } else {
                // Otherwise, show it below.
                top = e.pageY + offset;
            }

            tooltipEl.style.left = `${e.pageX + offset}px`;
            tooltipEl.style.top = `${top}px`;
        }
    });

    if (recoveryCustomEl) {
        recoveryCustomEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyCustomRecovery();
            }
        });
    }
    if (ratioCustomEl) {
        ratioCustomEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyCustomRatioFilter();
            }
        });
    }
    if (taxRateEl) {
        taxRateEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyTaxRate();
            }
        });
    }
});

// ---- UI toggles ----
function toggleIgnoreAmmo() {
    if (busy) return;
    ignoreAmmo = !ignoreAmmo;
    toggleAmmoBtn.textContent = `Ignore Ammunition: ${ignoreAmmo ? 'On' : 'Off'}`;
    toggleAmmoBtn.setAttribute('aria-pressed', ignoreAmmo ? 'true' : 'false');
    if (currentRows.length > 0) renderTable();
}

function toggleShowOnlyReprocess() {
    if (busy) return;
    showOnlyReprocess = !showOnlyReprocess;
    toggleShowReprocessBtn.textContent = `Show Only Reprocess: ${showOnlyReprocess ? 'On' : 'Off'}`;
    toggleShowReprocessBtn.setAttribute('aria-pressed', showOnlyReprocess ? 'true' : 'false');
    if (currentRows.length > 0) renderTable();
}

function setSort(column) {
    if (busy) return;
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        // Default to ascending for string columns, descending for numeric columns
        const isStringColumn = column === 'name' || column === 'recommend';
        sortDirection = isStringColumn ? 'asc' : 'desc';
    }
    if (currentRows.length > 0) renderTable();
}