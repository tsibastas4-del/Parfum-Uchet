const CONFIG_KEYS = {
    PRICES: 'perfumePrices',
    FLACONS: 'flaconCosts',
    VOLUMES: 'flaconVolumes',
    MARKUPS: 'markupPresets',
    SOURCES: 'salesSources',
    TRANSACTIONS: 'transactions',
    EXPENSES: 'expenses',
    INVENTORY: 'perfumeStock',
    BOTTLE_STOCK: 'bottleStock', // NEW: Whole bottles configuration key
    TASKS: 'userTasks',
    COMPLETED_ORDERS: 'perfumeflow_completed_orders',
    THEME: 'themePreference'
};

// ==========================================
//  НАЛАШТУВАННЯ ТЕКСТУ ЗАМОВЛЕННЯ
// ==========================================
const MY_PAYMENT_INFO = `💳 Оплата:
Монобанк: 4441 1111 5956 0303 
`;

const MY_DELIVERY_INFO = `- Олх доставкою, на будь-яку пошту (Комісія OLX: 3% + 35 грн.);
- Повна передоплата на карту, будь яка пошта (нова пошта роблю мінімальну ціну
доставки);`;
// ==========================================

// --- GLOBAL DATA ---
let PERFUME_PRICES = {};
let FLACON_COSTS = { 5: 12, 10: 15, 15: 18, 20: 20, 30: 25, 50: 30, 100: 40 };
let FLACON_VOLUMES = [5, 10, 15, 20, 30, 50, 100];
let MARKUP_PRESETS = { 'Базова': 0.12, 'Стандарт': 0.20, 'Преміум': 0.25 };
let SALES_SOURCES = ['Instagram', 'Viber', 'Telegram', 'OLX', 'Особиста зустріч'];
let PERFUME_STOCK = {};
let BOTTLE_STOCK = {}; // NEW: Whole bottle stock storage
let CURRENT_ORDER_LIST = [];
let TASKS = [];
let IS_EDITING_ORDER = null;


// --- GLOBAL FILTERS ---
let CATALOG_FILTERS = {
    gender: 'all',
    season: 'all'
};
let STOCK_FILTER_GENDER = 'all';
let CURRENT_WEEK_OFFSET = 0;


// --- LOYALTY LOGIC ---
function getClientStats(clientName) {
    if (!clientName) return { totalSpend: 0, level: 'Новачок', discount: 0 };
    const txs = getTransactions().filter(t => t.clientName.toLowerCase() === clientName.toLowerCase());
    const totalSpend = txs.reduce((acc, t) => acc + t.revenue, 0);

    let level = 'Новачок';
    let discount = 0;

    if (totalSpend >= 20000) { level = '💎 VIP Platinum'; discount = 0.10; }
    else if (totalSpend >= 10000) { level = '🥇 Gold'; discount = 0.05; }
    else if (totalSpend >= 5000) { level = '🥈 Silver'; discount = 0.03; }

    return { totalSpend, level, discount };
}

window.checkClientLoyalty = function (input) {
    const name = input.value.trim();
    if (!name) return;
    const stats = getClientStats(name);
    if (stats.discount > 0) {
        showToast(`🌟 Клієнт: ${stats.level} (Витрати: ${stats.totalSpend} ₴)`, 'success');
        const discountSelect = document.getElementById('discountSelectOrder');
        if (discountSelect) {
            discountSelect.style.borderColor = 'var(--secondary)';
            discountSelect.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
            // Auto-suggest max discount based on logic or just highlight? User asked to "choose", so we just highlight.
            // But we can suggest:
            // discountSelect.value = (stats.discount * 100).toFixed(0); 
        }
    }
}

// --- UTILITIES ---
function saveToLocalStorage(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function getFromLocalStorage(key, defaultValue) { return JSON.parse(localStorage.getItem(key) || JSON.stringify(defaultValue)); }
function showToast(message, type = 'primary') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid fa-info-circle"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- THEME ---
function initTheme() {
    if (localStorage.getItem(CONFIG_KEYS.THEME) === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-icon').className = 'fa-solid fa-sun';
    }
}
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem(CONFIG_KEYS.THEME, isDark ? 'dark' : 'light');
    document.getElementById('theme-icon').className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// --- DATA LOAD ---
function loadPerfumePrices() { PERFUME_PRICES = getFromLocalStorage(CONFIG_KEYS.PRICES, {}); }
function savePerfumePrices() { saveToLocalStorage(CONFIG_KEYS.PRICES, PERFUME_PRICES); }
function loadFlaconData() {
    FLACON_COSTS = getFromLocalStorage(CONFIG_KEYS.FLACONS, FLACON_COSTS);
    FLACON_VOLUMES = getFromLocalStorage(CONFIG_KEYS.VOLUMES, FLACON_VOLUMES);
}
function loadMarkupPresets() { MARKUP_PRESETS = getFromLocalStorage(CONFIG_KEYS.MARKUPS, MARKUP_PRESETS); }
function loadSalesSources() { SALES_SOURCES = getFromLocalStorage(CONFIG_KEYS.SOURCES, SALES_SOURCES); }
function loadInventory() {
    PERFUME_STOCK = JSON.parse(localStorage.getItem(CONFIG_KEYS.INVENTORY) || '{}');
    Object.keys(PERFUME_PRICES).forEach(name => { if (PERFUME_STOCK[name] === undefined) PERFUME_STOCK[name] = 0; });
    Object.keys(PERFUME_STOCK).forEach(name => { if (PERFUME_PRICES[name] === undefined) delete PERFUME_STOCK[name]; });
    saveInventory();
}

function loadBottleStock() {
    BOTTLE_STOCK = getFromLocalStorage(CONFIG_KEYS.BOTTLE_STOCK, {});
}
function getFromLocalStorage(key, defaultVal) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultVal;
    } catch (e) { return defaultVal; }
}

function saveToLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function saveInventory() { saveToLocalStorage(CONFIG_KEYS.INVENTORY, PERFUME_STOCK); }
function saveBottleStock() { saveToLocalStorage(CONFIG_KEYS.BOTTLE_STOCK, BOTTLE_STOCK); }

function findBottleForPerfume(perfumeName) {
    let result = [];
    for (const bottleName in BOTTLE_STOCK) {
        const bottleData = BOTTLE_STOCK[bottleName];
        if (bottleData.linkedPerfume === perfumeName && bottleData.qty > 0) {
            result.push({ name: bottleName, ...bottleData });
        }
    }
    return result;
}

function getTransactions() { return getFromLocalStorage(CONFIG_KEYS.TRANSACTIONS, []); }
function saveTransactions(txs) { saveToLocalStorage(CONFIG_KEYS.TRANSACTIONS, txs); }
function getExpenses() { return getFromLocalStorage(CONFIG_KEYS.EXPENSES, []); }
function saveExpenses(exps) { saveToLocalStorage(CONFIG_KEYS.EXPENSES, exps); }

// --- PARSER LOGIC (FIXED) ---
window.parseOrderText = function () {
    const text = document.getElementById('pasteArea').value;
    if (!text) return;

    // 1. Phone Finder (Fixed: handles spaces, dashes, parentheses)
    // Removes non-digit characters first to find the pattern
    const cleanPhoneText = text.replace(/[\s\-\(\)]/g, '');
    const phoneMatch = cleanPhoneText.match(/(?:\+38)?(0\d{9})/);
    if (phoneMatch) {
        document.getElementById('phoneSingle').value = phoneMatch[1] || phoneMatch[0];
    }

    // 2. Volume Finder (Fixed: handles numbers without 'ml' better)
    let foundVolume = null;

    // Check for strict "number + ml" first (e.g. "100ml")
    for (let v of FLACON_VOLUMES) {
        if (text.toLowerCase().includes(v + 'ml') || text.toLowerCase().includes(v + ' мл')) {
            foundVolume = v;
            break;
        }
    }

    // If not found, check just numbers, but skip if it looks like phone or post office
    if (!foundVolume) {
        // simple regex to find isolated volume numbers like " 100 " 
        for (let v of FLACON_VOLUMES) {
            const regex = new RegExp(`(^|\\s)${v}($|\\s)`);
            if (regex.test(text)) {
                foundVolume = v;
                break;
            }
        }
    }

    if (foundVolume) {
        document.getElementById('flaconVolume').value = foundVolume;
    }

    // 3. Perfume Name Finder (Fixed: Finds LONGEST match)
    // This prevents "Chanel" matching when text is "Chanel Chance"
    const textLower = text.toLowerCase();
    let foundPerfume = "";

    // Sort keys by length descending (longest first)
    const dbNames = Object.keys(PERFUME_PRICES).sort((a, b) => b.length - a.length);

    for (let name of dbNames) {
        if (textLower.includes(name.toLowerCase())) {
            foundPerfume = name;
            break;
        }
    }

    if (foundPerfume) {
        document.getElementById('perfumeName').value = foundPerfume;
    }

    // 4. Try to find City and Post Office (Bonus)
    // City often starts with capital letter, Post Office usually near "№" or "відділення"
    const officeMatch = text.match(/(?:№|відділення|від)\.?\s*(\d+)/i);
    if (officeMatch) {
        document.getElementById('postOfficeSingle').value = officeMatch[1];
    }

    // Simple city guess (Kyiv, Odessa, Lviv, Dnipro, Kharkiv)
    const commonCities = ["Київ", "Львів", "Одеса", "Дніпро", "Харків", "Запоріжжя"];
    for (let city of commonCities) {
        if (text.includes(city)) {
            document.getElementById('citySingle').value = city;
            break;
        }
    }

    showToast("🔍 Текст проаналізовано!", "success");
}

// (Legacy TASK LOGIC section removed)

// --- CALC LOGIC ---
function calculateCost(perfumeName, volume, markupTier) {
    const pData = PERFUME_PRICES[perfumeName];
    const flaconCost = FLACON_COSTS[volume] || 0;
    const markup = MARKUP_PRESETS[markupTier] || MARKUP_PRESETS['Стандарт'];
    if (!pData) return null;
    let costPerML = pData.basePrice;
    // if (volume >= pData.discountVolume && pData.discountPrice) costPerML = pData.discountPrice;
    const perfumeCostTotal = volume * costPerML;
    const costTotal = perfumeCostTotal + flaconCost;
    const profit = costTotal * markup;
    const revenue = costTotal + profit;
    return { costTotal, profit, revenue, flaconCost, perfumeCostTotal };
}

// --- INVENTORY ---
window.addStock = function () {
    const name = document.getElementById('inventoryPerfumeName').value.trim();
    const volume = parseFloat(document.getElementById('inventoryVolume').value);
    if (!name || isNaN(volume) || volume === 0) return;
    if (!PERFUME_PRICES[name]) { showToast("Спочатку додайте парфум у довідник!", "error"); return; }
    PERFUME_STOCK[name] = (PERFUME_STOCK[name] || 0) + volume;
    saveInventory(); renderInventoryList(); updateDashboard();
    document.getElementById('inventoryPerfumeName').value = '';
    document.getElementById('inventoryVolume').value = '';
    showToast(`Склад оновлено: ${name}`, "success");
}
window.scanBarcodeForStock = function (barcodeValue) {
    if (!barcodeValue) return;
    const barcodeToFind = barcodeValue.trim();
    let perfumeName = null;
    for (const name in PERFUME_PRICES) {
        if (PERFUME_PRICES[name].barcode === barcodeToFind) { perfumeName = name; break; }
    }
    if (perfumeName) {
        PERFUME_STOCK[perfumeName] = (PERFUME_STOCK[perfumeName] || 0) + 500;
        saveInventory(); renderInventoryList(); updateDashboard();
        showToast(`✅ ${perfumeName} (+500 мл) додано!`, "success");
    } else {
        showToast(`⚠️ Штрих-код ${barcodeToFind} не знайдено.`, "error");
        document.getElementById('inventoryPerfumeName').value = `Code: ${barcodeToFind}`;
        document.getElementById('inventoryVolume').value = 500;
    }
}

// --- ADMIN ---
window.addOrUpdatePerfume = function () {
    const name = document.getElementById('adminPerfumeName').value.trim();
    const basePrice = document.getElementById('adminBasePrice').value.trim();
    const discountVolume = document.getElementById('adminDiscountVolume').value.trim();
    const discountPrice = document.getElementById('adminDiscountPrice').value.trim();
    const barcode = document.getElementById('adminBarcode').value.trim();
    const gender = document.getElementById('adminGender').value;
    const seasons = Array.from(document.querySelectorAll('input[name="adminSeason"]:checked')).map(el => el.value);
    const tags = document.getElementById('adminTags').value.split(',').map(t => t.trim()).filter(t => t);

    const pyramid = document.getElementById('adminPyramid').value.trim();
    const description = document.getElementById('adminDescription').value.trim();

    if (!name || !basePrice) { showToast("Заповніть назву та ціну", "error"); return; }
    PERFUME_PRICES[name] = {
        basePrice: parseFloat(basePrice),
        discountVolume: parseFloat(discountVolume) || 5,
        discountPrice: parseFloat(discountPrice) || null,
        barcode: barcode || null,
        gender: gender || null,
        seasons: seasons,
        tags: tags,
        pyramid: pyramid || null,
        description: description || null
    };
    if (PERFUME_STOCK[name] === undefined) PERFUME_STOCK[name] = 0;
    savePerfumePrices(); saveInventory(); renderPerfumeList(); populateFormOptions();
    showToast(`Збережено: ${name}`, "success");
    document.getElementById('adminPerfumeName').value = '';
    document.getElementById('adminBasePrice').value = '';
    document.getElementById('adminBarcode').value = '';
    document.getElementById('adminGender').value = '';
    document.querySelectorAll('input[name="adminSeason"]').forEach(el => el.checked = false);
    document.getElementById('adminTags').value = '';
    document.getElementById('adminPyramid').value = '';
    document.getElementById('adminDescription').value = '';
}

window.autoFillPerfumeData = async function () {
    const name = document.getElementById('adminPerfumeName').value.trim();
    if (!name) { showToast("⚠️ Спочатку введіть назву парфуму!", "warning"); return; }

    const btn = document.querySelector('button[onclick="autoFillPerfumeData()"]');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const prompt = `
            Ти — експерт-парфумер. Надай дані для парфуму "${name}" у строгому форматі JSON (без зайвого тексту).
            Формат відповіді:
            {
                "gender": "Жіночий" | "Чоловічий" | "Унісекс",
                "seasons": ["Літо", "Зима"], 
                "tags": ["свіжий", "квітковий", "мускусний"],
                "pyramid": "текст піраміди",
                "description": "короткий професійний опис"
            }
            Дані мають бути українською мовою. "seasons" може містити одне або обидва значення. "tags" — масив з 3-5 ключових характеристик.
        `;

        const responseText = await callGemini(prompt);
        // Clean markdown if AI included it
        const jsonStr = responseText.replace(/```json|```/g, '').trim();
        const data = JSON.parse(jsonStr);

        if (data.gender) document.getElementById('adminGender').value = data.gender;
        if (data.seasons) {
            document.querySelectorAll('input[name="adminSeason"]').forEach(el => {
                el.checked = data.seasons.includes(el.value);
            });
        }
        if (data.tags) document.getElementById('adminTags').value = data.tags.join(', ');
        if (data.pyramid) document.getElementById('adminPyramid').value = data.pyramid;
        if (data.description) document.getElementById('adminDescription').value = data.description;

        showToast("✨ Дані заповнено за допомогою AI!", "success");
    } catch (err) {
        console.error("AutoFill Error:", err);
        showToast("❌ Не вдалося отримати дані від AI", "error");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}
window.editPerfume = function (name) {
    const pData = PERFUME_PRICES[name];
    if (!pData) return;
    document.getElementById('adminPerfumeName').value = name;
    document.getElementById('adminBasePrice').value = pData.basePrice;
    document.getElementById('adminDiscountVolume').value = pData.discountVolume || 5;
    document.getElementById('adminDiscountPrice').value = pData.discountPrice || '';
    document.getElementById('adminBarcode').value = pData.barcode || '';
    document.getElementById('adminGender').value = pData.gender || '';
    const seasons = pData.seasons || [];
    document.querySelectorAll('input[name="adminSeason"]').forEach(el => el.checked = seasons.includes(el.value));
    document.getElementById('adminTags').value = (pData.tags || []).join(', ');
    document.getElementById('adminPyramid').value = pData.pyramid || '';
    document.getElementById('adminDescription').value = pData.description || '';
    document.getElementById('adminPerfumeName').focus();
}
window.renderPerfumeList = function () {
    const tbody = document.getElementById('perfume-list-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    const search = document.getElementById('perfumeSearchInput').value.toLowerCase();
    Object.keys(PERFUME_PRICES).sort().forEach(name => {
        const pData = PERFUME_PRICES[name];

        // Filtering
        if (CATALOG_FILTERS.gender !== 'all' && pData.gender !== CATALOG_FILTERS.gender) return;
        if (CATALOG_FILTERS.season !== 'all' && !(pData.seasons || []).includes(CATALOG_FILTERS.season)) return;
        if (search && !name.toLowerCase().includes(search) && (!pData.barcode || !pData.barcode.includes(search)) && !(pData.tags || []).some(t => t.toLowerCase().includes(search))) return;

        const barcodeDisplay = pData.barcode ? `<span style="font-size:0.75rem; color:var(--text-muted); display:block;">Код: ${pData.barcode}</span>` : '';

        const genderClass = pData.gender === 'Чоловічий' ? 'gender-male' : (pData.gender === 'Жіночий' ? 'gender-female' : 'gender-unisex');
        const genderBadge = pData.gender ? `<span class="badge-gender ${genderClass}">${pData.gender[0]}</span>` : '';

        const seasonBadges = (pData.seasons || []).map(s => `<span class="season-badge">${s === 'Літо' ? '☀️' : '❄️'}</span>`).join('');
        const tagsHtml = (pData.tags || []).map(t => `<span class="tag-badge">${t}</span>`).join('');

        tbody.innerHTML += `<tr><td>${genderBadge}${seasonBadges}<span class="text-bold">${name}</span>${barcodeDisplay}${tagsHtml}</td><td class="text-right">${pData.basePrice.toFixed(2)} ₴</td><td class="text-right"><button class="btn-sm btn-warning" onclick="editPerfume('${name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-edit"></i></button> <button class="btn-sm btn-danger" onclick="deletePerfume('${name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    });
}
window.setCatalogFilter = function (type, value, el) {
    CATALOG_FILTERS[type] = value;
    // Update active state
    const container = el.parentElement;
    container.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
    renderPerfumeList();
}
window.deletePerfume = function (name) {
    if (confirm('Видалити?')) { delete PERFUME_PRICES[name]; delete PERFUME_STOCK[name]; savePerfumePrices(); saveInventory(); renderPerfumeList(); renderInventoryList(); populateFormOptions(); }
}
window.renderInventoryList = function () {
    const tbody = document.getElementById('inventory-list-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    let lowStockCount = 0;
    const search = (document.getElementById('inventorySearchInput')?.value || '').toLowerCase();
    Object.keys(PERFUME_STOCK).sort().forEach(name => {
        const pData = PERFUME_PRICES[name] || {};
        if (STOCK_FILTER_GENDER !== 'all' && pData.gender !== STOCK_FILTER_GENDER) return;
        if (search && !name.toLowerCase().includes(search)) return;

        const stock = PERFUME_STOCK[name];
        if (stock <= 15) lowStockCount++;

        const genderClass = pData.gender === 'Чоловічий' ? 'gender-male' : (pData.gender === 'Жіночий' ? 'gender-female' : 'gender-unisex');
        const genderBadge = pData.gender ? `<span class="badge-gender ${genderClass}" style="font-size:0.6rem; padding: 1px 4px;">${pData.gender[0]}</span>` : '';

        tbody.innerHTML += `<tr><td>${genderBadge}${name}</td><td class="text-right" ${stock <= 15 ? 'style="color:var(--danger);font-weight:bold;"' : ''}>${stock} мл</td><td class="text-right"><button class="btn-sm btn-danger" onclick="PERFUME_STOCK['${name.replace(/'/g, "\\'")}']=0;saveInventory();renderInventoryList();updateDashboard();"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    });
    const dashLowStock = document.getElementById('dash-low-stock-count-value');
    if (dashLowStock) dashLowStock.textContent = lowStockCount;
}

// === NEW: WHOLE BOTTLES ADMIN LOGIC ===
window.renderBottleList = function () {
    const tbody = document.getElementById('bottle-list-table');
    if (!tbody) return;
    const tbodyEl = tbody.getElementsByTagName('tbody')[0];
    if (!tbodyEl) return;

    tbodyEl.innerHTML = '';

    Object.keys(BOTTLE_STOCK).sort().forEach(bottleName => {
        const data = BOTTLE_STOCK[bottleName];
        tbodyEl.innerHTML += `
            <tr>
                <td>${bottleName}</td>
                <td>${data.linkedPerfume}</td>
                <td class="text-right">${data.qty}</td>
                <td class="text-right">
                    <button class="btn-sm btn-danger" onclick="removeWholeBottle('${bottleName.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

window.addWholeBottle = function () {
    const bottleName = document.getElementById('adminBottleName').value.trim();
    const linkedPerfume = document.getElementById('adminBottleLinked').value.trim();
    const qty = parseInt(document.getElementById('adminBottleQty').value, 10);

    if (!bottleName || !linkedPerfume || isNaN(qty) || qty <= 0) {
        showToast("Будь ласка, заповніть всі поля коректно.", "error");
        return;
    }

    if (!PERFUME_PRICES[linkedPerfume]) {
        showToast("Такого парфуму немає в довіднику. Виберіть існуючий.", "error");
        return;
    }

    BOTTLE_STOCK[bottleName] = {
        qty: qty,
        linkedPerfume: linkedPerfume
    };

    saveBottleStock();
    renderBottleList();

    document.getElementById('adminBottleName').value = '';
    document.getElementById('adminBottleLinked').value = '';
    document.getElementById('adminBottleQty').value = '1';

    showToast(`Флакон "${bottleName}" успішно додано!`, "success");
}

window.removeWholeBottle = function (bottleName) {
    if (confirm(`Ви впевнені, що хочете видалити ${bottleName}?`)) {
        delete BOTTLE_STOCK[bottleName];
        saveBottleStock();
        renderBottleList();
        showToast(`Флакон "${bottleName}" видалено!`, "success");
    }
}
// ======================================

window.generateStockForecast = async function () {
    const btn = document.querySelector('button[onclick="generateStockForecast()"]');
    const originalContent = btn.innerHTML;
    const resDiv = document.getElementById('stockForecastResult');
    const contentDiv = document.getElementById('stockForecastContent');

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Аналізую...';
    btn.disabled = true;
    resDiv.style.display = 'block';
    contentDiv.innerHTML = 'Завантаження аналітики за останні 30 днів...';

    try {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentTxs = getTransactions().filter(t => t.timestamp >= thirtyDaysAgo);

        // Structure stock and sales data for the prompt
        let analysisData = [];
        Object.keys(PERFUME_PRICES).forEach(name => {
            const stock = PERFUME_STOCK[name] || 0;
            const sales = recentTxs.filter(t => t.perfumeName === name).reduce((acc, t) => acc + t.quantityML, 0);
            analysisData.push({ name, stock, sales30d: sales });
        });

        const prompt = `
            Ти — аналітик складу парфумерії. Проаналізуй дані про залишки та продажі (за останні 30 днів) і надай змістовний звіт українською мовою.
            
            ДАНІ:
            ${JSON.stringify(analysisData)}
            
            ТВОЄ ЗАВДАННЯ:
            1. Виділи "ГАРЯЧІ" позиції: високі продажі та низький залишок. Порекомендуй, скільки мл докупити.
            2. Виділи "МЕРТВИЙ ВАНТАЖ": позиції, які не продавалися 30 днів, але мають залишки. Порекомендуй зробити на них знижку.
            3. Загальний стан: чи достатньо запасів на наступний місяць?
            
            Форматуй відповідь гарно, використовуючи списки, жирний текст та емодзі. Не використовуй технічний JSON у відповіді.
        `;

        const responseText = await callGemini(prompt);

        // Simple Markdown to HTML conversion
        const html = responseText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n- (.*?)/g, '<br>• $1')
            .replace(/\n/g, '<br>');

        contentDiv.innerHTML = html;
        showToast("📈 ШІ Аналіз готовий!", "success");

    } catch (err) {
        console.error(err);
        contentDiv.innerHTML = "❌ Помилка аналізу: " + err.message;
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}
window.filterStockByGender = function (value, el) {
    STOCK_FILTER_GENDER = value;
    const container = el.parentElement;
    container.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
    renderInventoryList();
}

// --- NAVIGATION ---
function showSection(sectionId, element) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (element) { document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active')); element.classList.add('active'); }
    if (sectionId === 'multi-calculator') renderOrderList();
    if (sectionId === 'transactions') renderTransactionHistory();
    if (sectionId === 'admin-panel') { renderPerfumeList(); renderInventoryList(); renderBottleList(); }
    if (sectionId === 'expenses') renderExpenseList();
    if (sectionId === 'dashboard') updateDashboard();
    if (sectionId === 'tasks') renderTasks();
}

function populateFormOptions() {
    const markupSelects = document.querySelectorAll('#saleMarkupTierSingle, #saleMarkupTierOrder, #calcMarkupTier, #priceListMarkup');
    const sourceSelects = document.querySelectorAll('#saleSourceSingle, #saleSourceOrder, #historyFilterSource');
    const flaconSelects = document.querySelectorAll('#flaconVolume, #orderFlaconVolume, #calcFlaconVolume');
    markupSelects.forEach(s => s.innerHTML = '');
    sourceSelects.forEach(s => s.innerHTML = '<option value="">Всі</option>');
    flaconSelects.forEach(s => s.innerHTML = '');
    Object.keys(MARKUP_PRESETS).forEach(name => { markupSelects.forEach(s => { const option = document.createElement('option'); option.value = name; option.textContent = `${name} (+${(MARKUP_PRESETS[name] * 100).toFixed(0)}%)`; s.appendChild(option); }); });
    FLACON_VOLUMES.sort((a, b) => a - b).forEach(vol => { flaconSelects.forEach(s => { const option = document.createElement('option'); option.value = vol; option.textContent = `${vol} мл (${FLACON_COSTS[vol] || 0} грн)`; s.appendChild(option); }); });
    SALES_SOURCES.forEach(source => { sourceSelects.forEach(s => { const option = document.createElement('option'); option.value = source; option.textContent = source; s.appendChild(option); }); });
    const perfumeList = document.getElementById('perfumeList'); perfumeList.innerHTML = '';
    Object.keys(PERFUME_PRICES).sort().forEach(name => { const option = document.createElement('option'); option.value = name; perfumeList.appendChild(option); });
    const clientList = document.getElementById('clientList'); clientList.innerHTML = '';
    const clients = new Set(getTransactions().map(t => t.clientName).filter(Boolean));
    clients.forEach(name => { const option = document.createElement('option'); option.value = name; clientList.appendChild(option); });

    // Populate SMM perfume selector
    const smmSelect = document.getElementById('smmPerfumeSelect');
    if (smmSelect) {
        smmSelect.innerHTML = '<option value="">-- Оберіть парфум --</option>';
        Object.keys(PERFUME_PRICES).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            smmSelect.appendChild(option);
        });
    }
}

// --- ORDER ACTIONS ---
// REMOVED: addSale function

window.addItemToOrder = function () {
    const name = document.getElementById('orderPerfumeName').value.trim();
    const volume = parseFloat(document.getElementById('orderFlaconVolume').value);
    const markup = document.getElementById('saleMarkupTierOrder').value;
    // Recalculate whole list to update total with discount?
    // Actually we update totals in renderOrderList
    if (!name || !volume) return;
    const calc = calculateCost(name, volume, markup);
    if (!calc) return;
    CURRENT_ORDER_LIST.push({ ...calc, name: name, vol: volume, markup: markup });
    renderOrderList(); document.getElementById('orderPerfumeName').value = '';
}
// Add listener to discount change
document.addEventListener('DOMContentLoaded', () => {
    const ds = document.getElementById('discountSelectOrder');
    if (ds) ds.addEventListener('change', renderOrderList);
});

window.removeItemFromOrder = function (index) { CURRENT_ORDER_LIST.splice(index, 1); renderOrderList(); }

// --- PERFUME SELECTOR MODAL ---
let SELECTOR_FILTER_CATEGORY = 'all';

window.openPerfumeSelector = function () {
    const modal = document.getElementById('perfumeSelectorModal');
    if (!modal) return;
    modal.style.display = 'block';
    document.getElementById('perfumeSelectorSearch').value = '';
    SELECTOR_FILTER_CATEGORY = 'all';

    // Reset category chips
    const chips = modal.querySelectorAll('.filter-chip');
    if (chips.length > 0) {
        chips.forEach(c => c.classList.remove('active'));
        chips[0].classList.add('active');
    }

    renderPerfumeSelector();

    // Auto-focus search input (mostly useful on desktop, on mobile it might pop keyboard immediately)
    setTimeout(() => {
        const searchInput = document.getElementById('perfumeSelectorSearch');
        if (searchInput) searchInput.focus();
    }, 100);
}

window.closePerfumeSelector = function () {
    const modal = document.getElementById('perfumeSelectorModal');
    if (modal) modal.style.display = 'none';
}

window.filterPerfumeSelectorCategory = function (category, el) {
    SELECTOR_FILTER_CATEGORY = category;
    const container = el.parentElement;
    container.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
    renderPerfumeSelector();
}

window.renderPerfumeSelector = function () {
    const table = document.getElementById('perfume-selector-table');
    if (!table) return;
    const tbody = table.getElementsByTagName('tbody')[0];
    if (!tbody) return;

    tbody.innerHTML = '';
    const searchInput = document.getElementById('perfumeSelectorSearch');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let entries = Object.keys(PERFUME_PRICES).sort();

    entries.forEach(name => {
        const pData = PERFUME_PRICES[name];

        // Apply category filter
        if (SELECTOR_FILTER_CATEGORY !== 'all' && pData.gender !== SELECTOR_FILTER_CATEGORY) return;

        // Apply search filter
        if (search) {
            const matchesName = name.toLowerCase().includes(search);
            const matchesBarcode = pData.barcode && pData.barcode.toLowerCase().includes(search);
            const matchesTag = pData.tags && pData.tags.some(t => t.toLowerCase().includes(search));
            if (!matchesName && !matchesBarcode && !matchesTag) return;
        }

        const stock = PERFUME_STOCK[name] || 0;

        const genderClass = pData.gender === 'Чоловічий' ? 'gender-male' : (pData.gender === 'Жіночий' ? 'gender-female' : 'gender-unisex');
        const genderBadge = pData.gender ? `<span class="badge-gender ${genderClass}" style="font-size:0.6rem; padding: 1px 4px;">${pData.gender[0]}</span>` : '';
        const stockStyle = stock <= 15 ? 'color: var(--danger); font-weight: bold; font-size: 0.8rem;' : 'color: var(--text-muted); font-size: 0.8rem;';

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = function () {
            const input = document.getElementById('orderPerfumeName');
            if (input) input.value = name;
            closePerfumeSelector();
        };

        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 5px;">
                    ${genderBadge}
                    <span class="text-bold" style="font-size: 0.95rem;">${name}</span>
                </div>
                <div style="${stockStyle} margin-top: 4px;">📦 Залишок: ${stock} мл</div>
            </td>
            <td class="text-right" style="vertical-align: middle;">
                <span style="font-weight: 700; color: var(--primary);">${pData.basePrice.toFixed(2)}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.renderOrderList = function () {
    const tbody = document.getElementById('order-list-table').getElementsByTagName('tbody')[0];
    const totalDiv = document.getElementById('orderTotalSection');
    const summaryText = document.getElementById('orderSummaryOutput');

    tbody.innerHTML = '';
    let totalRev = 0;

    CURRENT_ORDER_LIST.forEach((item, index) => {
        totalRev += item.revenue;
        tbody.innerHTML += `<tr><td>${item.name}</td><td class="text-right">${item.vol} мл</td><td class="text-right">${item.revenue.toFixed(2)}</td><td class="text-right"><button class="btn-sm btn-danger" onclick="removeItemFromOrder(${index})"><i class="fa-solid fa-times"></i></button></td></tr>`;
    });

    totalDiv.textContent = `Разом: ${totalRev.toFixed(2)} ₴`;

    // NEW: Check for Stock Warnings
    const warningsDiv = document.getElementById('order-stock-warnings');
    warningsDiv.innerHTML = '';

    // 1. Calculate required volumes per perfume
    let requiredVolumes = {};
    CURRENT_ORDER_LIST.forEach(item => {
        requiredVolumes[item.name] = (requiredVolumes[item.name] || 0) + item.vol;
    });

    // 2. Compare against stock
    for (const perfumeName in requiredVolumes) {
        const required = requiredVolumes[perfumeName];
        const currentStock = PERFUME_STOCK[perfumeName] || 0;

        if (required > currentStock) {
            // Not enough decant stock. Check whole bottles.
            const matchingBottles = findBottleForPerfume(perfumeName);

            const alertBox = document.createElement('div');
            alertBox.style.padding = '10px';
            alertBox.style.borderRadius = '8px';
            alertBox.style.marginTop = '10px';
            alertBox.style.fontSize = '0.9rem';

            if (matchingBottles.length > 0) {
                // Formulate the bottle names
                const bottleNames = matchingBottles.map(b => b.name).join(' або ');
                alertBox.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                alertBox.style.border = '1px solid var(--warning)';
                alertBox.style.color = '#b45309'; // Darker amber for readability
                alertBox.innerHTML = `<strong>⚠️ Увага:</strong> Не вистачає розливного парфуму <em>${perfumeName}</em>.<br>✅ <strong>Є цілий флакон</strong> → «Відкрийте флакон: ${bottleNames}»`;
            } else {
                alertBox.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                alertBox.style.border = '1px solid var(--danger)';
                alertBox.style.color = '#b91c1c'; // Darker red for readability
                alertBox.innerHTML = `<strong>❌ Помилка:</strong> Недостатньо парфуму <em>${perfumeName}</em> і цілих флаконів немає!`;
            }
            warningsDiv.appendChild(alertBox);
        }
    }

    // CLEAN ORDER TEXT
    if (CURRENT_ORDER_LIST.length > 0) {
        const discountPercent = parseInt(document.getElementById('discountSelectOrder').value) || 0;
        const discountAmount = totalRev * (discountPercent / 100);
        const finalTotal = totalRev - discountAmount;

        let text = "Ваше замовлення:\n\n";
        CURRENT_ORDER_LIST.forEach((item, i) => { text += `${i + 1}. ${item.name} (${item.vol} мл) — ${item.revenue.toFixed(0)} грн\n`; });
        if (discountPercent > 0) {
            text += `\nЗнижка ${discountPercent}%: -${discountAmount.toFixed(0)} грн\n`;
        }
        text += `\n${MY_DELIVERY_INFO}\n\n`;
        text += `${MY_PAYMENT_INFO}\n\n`;
        text += `До сплати: ${finalTotal.toFixed(0)} грн`;
        summaryText.value = text;
        totalDiv.innerHTML = `Сума: ${totalRev.toFixed(0)} ₴ <br> ${discountPercent > 0 ? `<span style='color:var(--secondary)'>Знижка: -${discountAmount.toFixed(0)} ₴</span> <br>` : ''} Разом: ${finalTotal.toFixed(0)} ₴`;
    } else { summaryText.value = ''; totalDiv.textContent = ''; }
}

window.clearOrder = function () { CURRENT_ORDER_LIST = []; renderOrderList(); IS_EDITING_ORDER = null; const btn = document.getElementById('processOrderBtn'); btn.innerHTML = '<i class="fa-solid fa-cash-register"></i> Оформити'; btn.classList.remove('btn-warning'); btn.classList.add('btn-success'); }
window.revertOrderStock = function (orderId) {
    const txsToRevert = getTransactions().filter(t => t.orderId === orderId);
    let totalVolume = {};
    txsToRevert.forEach(item => { totalVolume[item.perfumeName] = (totalVolume[item.perfumeName] || 0) + item.quantityML; });
    for (const name in totalVolume) { PERFUME_STOCK[name] = (PERFUME_STOCK[name] || 0) + totalVolume[name]; }
    saveInventory();
}
window.deleteOrder = function (orderId, showToastMessage = true) {
    if (showToastMessage && !confirm(`Видалити замовлення?`)) return;
    revertOrderStock(orderId);
    saveTransactions(getTransactions().filter(t => t.orderId !== orderId));
    // deleteTaskByRelatedId(orderId); // Removed as tasks are now auto-generated from transactions
    if (showToastMessage) showToast(`Замовлення видалено.`, "error");
    renderTransactionHistory(); updateDashboard();
}
window.startEditOrder = function (orderId) {
    const txs = getTransactions().filter(t => t.orderId === orderId);
    if (txs.length === 0) return;
    IS_EDITING_ORDER = orderId; CURRENT_ORDER_LIST.length = 0;
    txs.forEach(t => { const calc = calculateCost(t.perfumeName, t.quantityML, t.markupTier); if (calc) CURRENT_ORDER_LIST.push({ ...calc, name: t.perfumeName, vol: t.quantityML, markup: t.markupTier }); });
    const first = txs[0];
    document.getElementById('clientNameOrder').value = first.clientName || '';
    document.getElementById('saleSourceOrder').value = first.source || '';
    document.getElementById('ttnNumberOrder').value = first.ttnNumber || '';
    // const task = getTasks().find(t => t.relatedId === orderId); // Removed as tasks are now auto-generated from transactions
    // if (task) {
    //     document.getElementById('phoneOrder').value = task.phone;
    //     document.getElementById('fullNameOrder').value = task.fullName;
    //     document.getElementById('cityOrder').value = task.city;
    //     document.getElementById('postOfficeOrder').value = task.postOffice;
    // }
    // Restore discount if available in transaction
    const firstTx = txs[0];
    if (firstTx.discountPercent) {
        document.getElementById('discountSelectOrder').value = firstTx.discountPercent;
    } else {
        document.getElementById('discountSelectOrder').value = 0;
    }
    renderOrderList();
    const btn = document.getElementById('processOrderBtn');
    btn.innerHTML = '<i class="fa-solid fa-save"></i> Зберегти';
    btn.classList.remove('btn-success'); btn.classList.add('btn-warning');
    showSection('multi-calculator', document.querySelector('.navbar-links .nav-btn:nth-child(3)'));
}
window.processOrder = function () {
    if (CURRENT_ORDER_LIST.length === 0) return;
    const client = document.getElementById('clientNameOrder').value.trim() || 'Клієнт';
    const markup = document.getElementById('saleMarkupTierOrder').value;
    const source = document.getElementById('saleSourceOrder').value;
    const ttn = document.getElementById('ttnNumberOrder').value.trim() || null;
    const phone = document.getElementById('phoneOrder').value.trim();
    const fullName = document.getElementById('fullNameOrder').value.trim();
    const city = document.getElementById('cityOrder').value.trim();
    const postOffice = document.getElementById('postOfficeOrder').value.trim();
    const comments = document.getElementById('commentsOrder').value.trim();
    if (!source) { showToast("Оберіть джерело!", "error"); return; }
    if (IS_EDITING_ORDER) { deleteOrder(IS_EDITING_ORDER, false); IS_EDITING_ORDER = null; const btn = document.getElementById('processOrderBtn'); btn.innerHTML = '<i class="fa-solid fa-cash-register"></i> Оформити'; btn.classList.remove('btn-warning'); btn.classList.add('btn-success'); }
    const txs = getTransactions();
    const total = CURRENT_ORDER_LIST.reduce((acc, item) => acc + item.revenue, 0);
    const orderId = IS_EDITING_ORDER || Date.now();
    const discountPercent = parseInt(document.getElementById('discountSelectOrder').value) || 0;

    // Apply discount proportionally to each item to correct profit/rev stats
    const newTransactions = CURRENT_ORDER_LIST.map(item => {
        const itemDiscount = item.revenue * (discountPercent / 100);
        const finalRevenue = item.revenue - itemDiscount;
        const finalProfit = finalRevenue - item.costTotal; // Profit reduces by discount amount

        return {
            id: Date.now() + Math.random(), timestamp: Date.now(), clientName: client, source: source, markupTier: markup,
            perfumeName: item.name, quantityML: item.vol,
            revenue: finalRevenue, profit: finalProfit, costTotal: item.costTotal,
            ttnNumber: ttn, orderId: orderId, discountPercent: discountPercent
        };
    });
    txs.push(...newTransactions); saveTransactions(txs);
    let totalVolume = {};
    CURRENT_ORDER_LIST.forEach(item => { totalVolume[item.name] = (totalVolume[item.name] || 0) + item.vol; });
    for (const name in totalVolume) { PERFUME_STOCK[name] = (PERFUME_STOCK[name] || 0) - totalVolume[name]; }
    saveInventory();
    const itemSummary = CURRENT_ORDER_LIST.map(item => `${item.name} (${item.vol}ml)`).join(', ');
    // Order tasks are now auto-generated from transactions, so manual addTask is no longer needed here.
    showToast(`✅ Замовлення збережено!`, "success");
    showModalReceipt(CURRENT_ORDER_LIST, total, client, ttn, discountPercent);
    clearOrder(); updateDashboard();
}

window.generateAIOrderMessage = async function () {
    if (CURRENT_ORDER_LIST.length === 0) {
        showToast("📦 Спочатку додайте товари у кошик!", "warning");
        return;
    }

    const btn = document.querySelector('button[onclick="generateAIOrderMessage()"]');
    const originalContent = btn.innerHTML;
    const outputArea = document.getElementById('orderSummaryOutput');
    const clientName = document.getElementById('clientNameOrder').value.trim() || 'Клієнт';

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Генерую...';
    btn.disabled = true;

    try {
        const stats = getClientStats(clientName);
        const total = CURRENT_ORDER_LIST.reduce((acc, item) => acc + item.revenue, 0);
        const discountPercent = parseInt(document.getElementById('discountSelectOrder').value) || 0;
        const finalTotal = total * (1 - discountPercent / 100);

        const itemsText = CURRENT_ORDER_LIST.map(i => `- ${i.name} (${i.vol} мл) — ${i.revenue.toFixed(0)} ₴`).join('\n');

        const prompt = `
            Ти — менеджер магазину парфумерії. Склади ввічливе повідомлення для клієнта на основі замовлення.
            
            КЛІЄНТ: ${clientName}
            СТАТУС ЛОЯЛЬНОСТІ: ${stats.level}
            ТОВАРИ:
            ${itemsText}
            СУМА ДО ОПЛАТИ: ${finalTotal.toFixed(0)} ₴
            
            ВАШІ РЕКВІЗИТИ ТА УМОВИ:
            ${MY_PAYMENT_INFO}
            ${MY_DELIVERY_INFO}
            
            ВИМОГИ ДО ПОВІДОМЛЕННЯ:
            1. Тон: Професійний, дружній, українською мовою. 
            2. Подякуй за замовлення.
            3. Якщо клієнт має статус вище за "Новачок" (наприклад, Silver, Gold, VIP), обов'язково подякуй за лояльність та згадай це в тексті.
            4. Використовуй емодзі для привабливості.
            5. Структуровано виклади товари, суму та реквізити.
            
            Надай ТІЛЬКИ текст повідомлення для месенджера.
        `;

        const responseText = await callGemini(prompt);
        outputArea.value = responseText;
        showToast("🤖 ШІ сформував повідомлення!", "success");

    } catch (err) {
        console.error(err);
        showToast("❌ Не вдалося згенерувати повідомлення", "error");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

// --- DASHBOARD ---
// NOTE: updateDashboard is now defined in the Advanced Analytics section below
function renderTopProducts(transactions) {
    const productStats = {};
    transactions.forEach(t => {
        if (!productStats[t.perfumeName]) productStats[t.perfumeName] = { vol: 0, revenue: 0 };
        productStats[t.perfumeName].vol += t.quantityML;
        productStats[t.perfumeName].revenue += t.revenue;
    });
    const sortedProducts = Object.entries(productStats).sort(([, a], [, b]) => b.vol - a.vol).slice(0, 5);
    const tbody = document.getElementById('top-products-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    if (sortedProducts.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Немає даних</td></tr>'; return; }
    sortedProducts.forEach(([name, data], index) => {
        let rankDisplay = index + 1;
        if (index === 0) rankDisplay = '🥇 ' + rankDisplay;
        if (index === 1) rankDisplay = '🥈 ' + rankDisplay;
        if (index === 2) rankDisplay = '🥉 ' + rankDisplay;
        tbody.innerHTML += `<tr><td style="font-weight:bold;">${rankDisplay}</td><td>${name}</td><td class="text-right text-bold">${data.vol} мл</td><td class="text-right text-success">${data.revenue.toFixed(0)} ₴</td></tr>`;
    });
}

// --- HISTORY ---
// Week Pagination Helpers
function getWeekBounds(offset = 0) {
    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToMonday + (offset * 7));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { start: startOfWeek, end: endOfWeek };
}

window.navigateWeek = function (direction) {
    CURRENT_WEEK_OFFSET += direction;
    renderTransactionHistory();
    const { start, end } = getWeekBounds(CURRENT_WEEK_OFFSET);
    const label = CURRENT_WEEK_OFFSET === 0
        ? 'Поточний тиждень'
        : start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) + ' - ' + end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    document.getElementById('currentWeekLabel').textContent = label;
    document.getElementById('nextWeekBtn').disabled = CURRENT_WEEK_OFFSET >= 0;
}

window.renderTransactionHistory = function () {
    const tbody = document.getElementById('transaction-history-table').getElementsByTagName('tbody')[0];
    const summary = document.getElementById('transactionSummary');
    tbody.innerHTML = '';
    const uniqueTransactions = {};
    getTransactions().forEach(t => { const key = t.orderId || t.id; if (!uniqueTransactions[key] || t.orderId) uniqueTransactions[key] = t; });
    const filteredTxs = Object.values(uniqueTransactions).filter(t => {
        const search = document.getElementById('transactionSearch').value.toLowerCase();
        const sourceFilter = document.getElementById('historyFilterSource').value;
        const dateFilter = document.getElementById('historyStartDate').value;

        const txDate = new Date(t.timestamp);
        const { start: weekStart, end: weekEnd } = getWeekBounds(CURRENT_WEEK_OFFSET);

        if (txDate < weekStart || txDate > weekEnd) return false;
        if (search && !t.perfumeName.toLowerCase().includes(search) && !t.clientName.toLowerCase().includes(search)) return false;
        if (sourceFilter && t.source !== sourceFilter) return false;
        if (dateFilter && new Date(t.timestamp).toISOString().split('T')[0] !== dateFilter) return false;
        return true;
    });
    let totalRev = 0; let totalProf = 0;
    filteredTxs.sort((a, b) => b.timestamp - a.timestamp).forEach(t => {
        let displayItems = [t];
        if (t.orderId) displayItems = getTransactions().filter(tx => tx.orderId === t.orderId);
        const totalRevenue = displayItems.reduce((acc, item) => acc + (parseFloat(item.revenue) || 0), 0);
        const totalProfit = displayItems.reduce((acc, item) => acc + (parseFloat(item.profit) || 0), 0);
        totalRev += totalRevenue; totalProf += totalProfit;
        const infoText = t.orderId ? `Замовлення (${displayItems.length} поз.)` : `${t.perfumeName} (${t.quantityML} мл)`;
        const ttnDisplay = t.ttnNumber ? `<a href="https://novaposhta.ua/tracking/?cargo_key=${t.ttnNumber}" target="_blank">${t.ttnNumber}</a>` : '-';
        const deleteButton = t.orderId
            ? `<button class="btn-danger btn-sm" onclick="deleteOrder(${t.orderId})"><i class="fa-solid fa-trash"></i></button>`
            : `<button class="btn-danger btn-sm" onclick="deleteTx(${t.id})"><i class="fa-solid fa-trash"></i></button>`;
        const editButton = t.orderId ? `<button class="btn-warning btn-sm" onclick="startEditOrder(${t.orderId})"><i class="fa-solid fa-edit"></i></button>` : '';
        tbody.innerHTML += `<tr><td>${new Date(t.timestamp).toLocaleDateString()}</td><td>${t.clientName}</td><td>${t.source}</td><td>${ttnDisplay}</td><td>${infoText}</td><td class="text-right">${totalRevenue.toFixed(2)}</td><td class="text-right text-success">${totalProfit.toFixed(2)}</td><td class="text-right">${editButton} ${deleteButton}</td></tr>`;
    });
    summary.textContent = 'Всього за тиждень: ' + totalRev.toFixed(2) + ' ₴ (Прибуток: ' + totalProf.toFixed(2) + ' ₴)';

    // Update label if not done yet
    if (CURRENT_WEEK_OFFSET === 0 && document.getElementById('currentWeekLabel').textContent === 'Поточний тиждень') {
        const { start, end } = getWeekBounds(0);
        document.getElementById('currentWeekLabel').textContent = start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) + ' - ' + end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    }
}
window.deleteTx = function (id) {
    if (!confirm("Видалити?")) return;
    const tx = getTransactions().find(t => t.id === id);
    if (tx) { PERFUME_STOCK[tx.perfumeName] = (PERFUME_STOCK[tx.perfumeName] || 0) + tx.quantityML; saveInventory(); }
    saveTransactions(getTransactions().filter(t => t.id !== id));
    renderTransactionHistory(); updateDashboard();
}

// --- TRANSACTIONS NAVIGATION (WEEKLY) ---

window.copyOrderSummary = function () { document.getElementById("orderSummaryOutput").select(); document.execCommand("copy"); showToast("Скопійовано!", "success"); }
window.generateReport = function () {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    const output = document.getElementById('reportOutput');
    if (!start || !end) return;

    // Filter Transactions
    const txs = getTransactions().filter(t => {
        const d = new Date(t.timestamp).toISOString().split('T')[0];
        return d >= start && d <= end;
    });

    // Valid Transaction Count (excluding deleted/invalid if any)
    const count = txs.length;

    // Financials
    const revenue = txs.reduce((a, b) => a + (b.revenue || 0), 0);
    const profit = txs.reduce((a, b) => a + (b.profit || 0), 0);

    // Expenses
    const exps = getExpenses().filter(e => {
        const d = new Date(e.timestamp).toISOString().split('T')[0];
        return d >= start && d <= end;
    });
    const totalExp = exps.reduce((a, b) => a + b.amount, 0);
    const netProfit = profit - totalExp;

    // KPIs
    const avgCheck = count > 0 ? (revenue / count) : 0;
    const margin = revenue > 0 ? ((netProfit / revenue) * 100) : 0;

    // Source Breakdown
    const sourceStats = {};
    txs.forEach(t => {
        const s = t.source || 'Інше';
        sourceStats[s] = (sourceStats[s] || 0) + 1;
    });
    let sourceHtml = '<ul style="margin: 10px 0; padding-left: 20px;">';
    for (const [src, cnt] of Object.entries(sourceStats)) {
        sourceHtml += `<li>${src}: ${cnt}</li>`;
    }
    sourceHtml += '</ul>';

    // HTML Output
    output.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div style="background:var(--bg-input); padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; color:var(--text-muted);">Фінанси</h4>
                <p>Виручка: <strong>${revenue.toFixed(2)} ₴</strong></p>
                <p>Валовий прибуток: <strong>${profit.toFixed(2)} ₴</strong></p>
                <p>Витрати: <span style="color:var(--danger);">-${totalExp.toFixed(2)} ₴</span></p>
                <hr style="border:0; border-top:1px dashed var(--border);">
                <p style="font-size:1.2rem; color:var(--primary);">Чистий прибуток: <strong>${netProfit.toFixed(2)} ₴</strong></p>
            </div>
            <div style="background:var(--bg-input); padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; color:var(--text-muted);">KPI & Джерела</h4>
                <p>Кількість продажів: <strong>${count}</strong></p>
                <p>Середній чек: <strong>${avgCheck.toFixed(0)} ₴</strong></p>
                <p>Рентабельність: <strong>${margin.toFixed(1)}%</strong></p>
                <hr style="border:0; border-top:1px dashed var(--border);">
                <div style="font-size: 0.9rem;"><strong>По джерелах:</strong>${sourceHtml}</div>
            </div>
        </div>
    `;
}
window.addExpense = function () {
    const desc = document.getElementById('expenseDescription').value; const amount = parseFloat(document.getElementById('expenseAmount').value);
    if (!desc || !amount) return;
    const exps = getExpenses(); exps.push({ id: Date.now(), timestamp: Date.now(), description: desc, amount: amount });
    saveExpenses(exps); renderExpenseList();
    document.getElementById('expenseDescription').value = ''; document.getElementById('expenseAmount').value = '';
}
window.renderExpenseList = function () {
    const div = document.getElementById('expenseListOutput');
    const exps = getExpenses().sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    div.innerHTML = exps.map(e => `<div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding:5px 0;"><span>${e.description}</span><span style="font-weight:bold; color:var(--danger)">-${e.amount} ₴</span></div>`).join('');
}
window.addOrUpdateFlacon = function () {
    const vol = parseFloat(document.getElementById('adminFlaconVolume').value); const cost = parseFloat(document.getElementById('adminFlaconCost').value);
    if (vol && cost) { FLACON_COSTS[vol] = cost; if (!FLACON_VOLUMES.includes(vol)) FLACON_VOLUMES.push(vol); saveToLocalStorage(CONFIG_KEYS.FLACONS, FLACON_COSTS); saveToLocalStorage(CONFIG_KEYS.VOLUMES, FLACON_VOLUMES); populateFormOptions(); showToast("Флакон додано", "success"); }
}
window.addOrUpdateMarkupPreset = function () {
    const name = document.getElementById('adminMarkupName').value; const val = parseFloat(document.getElementById('adminMarkupValue').value);
    if (name && val) { MARKUP_PRESETS[name] = val; saveToLocalStorage(CONFIG_KEYS.MARKUPS, MARKUP_PRESETS); populateFormOptions(); showToast("Націнку додано", "success"); }
}

// ==========================================
//  ADVANCED ANALYTICS & CHARTS
// ==========================================
let salesChartInstance = null;
let topProductsChartInstance = null;
let monthlyProfitChartInstance = null;
let sourcesChartInstance = null;

window.updateDashboard = function () {
    const txs = getTransactions();
    const exps = getExpenses();

    // Update stat cards
    const totalRevenue = txs.reduce((sum, t) => sum + t.revenue, 0);
    const totalProfit = txs.reduce((sum, t) => sum + (t.profit || 0), 0);
    const totalExpenses = exps.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalProfit - totalExpenses;
    const lowStockCount = Object.values(PERFUME_STOCK).filter(stock => stock < 50).length;

    document.getElementById('dash-revenue-value').textContent = totalRevenue.toFixed(0) + ' ₴';
    document.getElementById('dash-net-profit-value').textContent = netProfit.toFixed(0) + ' ₴';
    document.getElementById('dash-orders-value').textContent = txs.length;
    document.getElementById('dash-low-stock-count-value').textContent = lowStockCount;

    // Render all charts
    renderSalesChart(txs);
    renderTopProductsChart(txs);
    renderMonthlyProfitChart(txs);
    renderSourcesChart(txs);
    renderTopProductsTable(txs);
};

function renderSalesChart(txs) {
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last30Days.push(date.toISOString().split('T')[0]);
    }

    const dailySales = {};
    last30Days.forEach(d => dailySales[d] = 0);

    txs.forEach(t => {
        const date = new Date(t.timestamp).toISOString().split('T')[0];
        if (dailySales.hasOwnProperty(date)) {
            dailySales[date] += t.revenue;
        }
    });

    const canvas = document.getElementById('salesChart');
    if (!canvas) return;

    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    salesChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: last30Days.map(d => new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })),
            datasets: [{
                label: 'Виручка (₴)',
                data: last30Days.map(d => dailySales[d]),
                borderColor: 'rgba(124, 58, 237, 1)',
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => v + ' ₴' } }
            }
        }
    });
}

function renderTopProductsChart(txs) {
    const productStats = {};
    txs.forEach(t => {
        productStats[t.perfumeName] = (productStats[t.perfumeName] || 0) + t.quantityML;
    });

    const sorted = Object.entries(productStats).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const canvas = document.getElementById('topProductsChart');
    if (!canvas) return;

    if (topProductsChartInstance) {
        topProductsChartInstance.destroy();
    }

    topProductsChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: sorted.map(([name]) => name.length > 20 ? name.substring(0, 17) + '...' : name),
            datasets: [{
                label: 'Продано (мл)',
                data: sorted.map(([, vol]) => vol),
                backgroundColor: [
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(124, 58, 237, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(59, 130, 246, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => v + ' мл' } }
            }
        }
    });
}

function renderMonthlyProfitChart(txs) {
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        last6Months.push(date.toISOString().substring(0, 7)); // YYYY-MM
    }

    const monthlyProfit = {};
    last6Months.forEach(m => monthlyProfit[m] = 0);

    txs.forEach(t => {
        const month = new Date(t.timestamp).toISOString().substring(0, 7);
        if (monthlyProfit.hasOwnProperty(month)) {
            monthlyProfit[month] += (t.profit || 0);
        }
    });

    const canvas = document.getElementById('monthlyProfitChart');
    if (!canvas) return;

    if (monthlyProfitChartInstance) {
        monthlyProfitChartInstance.destroy();
    }

    monthlyProfitChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: last6Months.map(m => {
                const [year, month] = m.split('-');
                const date = new Date(year, month - 1);
                return date.toLocaleDateString('uk-UA', { month: 'short', year: 'numeric' });
            }),
            datasets: [{
                label: 'Прибуток (₴)',
                data: last6Months.map(m => monthlyProfit[m]),
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => v + ' ₴' } }
            }
        }
    });
}

function renderSourcesChart(txs) {
    const sourceStats = {};
    txs.forEach(t => {
        const src = t.source || 'Інше';
        sourceStats[src] = (sourceStats[src] || 0) + 1;
    });

    const sorted = Object.entries(sourceStats).sort((a, b) => b[1] - a[1]);

    const canvas = document.getElementById('sourcesChart');
    if (!canvas) return;

    if (sourcesChartInstance) {
        sourcesChartInstance.destroy();
    }

    const colors = [
        'rgba(245, 158, 11, 0.8)',
        'rgba(124, 58, 237, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(236, 72, 153, 0.8)'
    ];

    sourcesChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: sorted.map(([src]) => src),
            datasets: [{
                data: sorted.map(([, count]) => count),
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 8,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function renderTopProductsTable(txs) {
    const table = document.getElementById('top-products-table');
    if (!table) return;

    const productStats = {};
    txs.forEach(t => {
        if (!productStats[t.perfumeName]) {
            productStats[t.perfumeName] = { vol: 0, revenue: 0, count: 0 };
        }
        productStats[t.perfumeName].vol += t.quantityML;
        productStats[t.perfumeName].revenue += t.revenue;
        productStats[t.perfumeName].count++;
    });

    const sorted = Object.entries(productStats).sort((a, b) => b[1].vol - a[1].vol).slice(0, 5);

    const tbody = table.querySelector('tbody');
    tbody.innerHTML = sorted.map(([name, stats], index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${name}</strong></td>
            <td class="text-right">${stats.vol} мл</td>
            <td class="text-right">${stats.revenue.toFixed(0)} ₴</td>
            <td class="text-right">${stats.count}</td>
        </tr>
    `).join('');
}

// Excel Export
window.exportToExcel = async function () {
    const txs = getTransactions();
    if (txs.length === 0) {
        showToast("📊 Немає даних для експорту", "warning");
        return;
    }

    showToast("📥 Генерую Excel файл...", "primary");

    // Create CSV (compatible with Excel)
    let csv = '\ufeffДата,Клієнт,Парфум,Об\'єм (мл),Виручка (₴),Прибуток (₴),Джерело\n';

    txs.forEach(t => {
        const date = new Date(t.timestamp).toLocaleDateString('uk-UA');
        const client = (t.clientName || 'Без імені').replace(/,/g, ' ');
        const perfume = t.perfumeName.replace(/,/g, ' ');
        csv += `${date},"${client}","${perfume}",${t.quantityML},${t.revenue.toFixed(2)},${(t.profit || 0).toFixed(2)},${t.source || 'Інше'}\n`;
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Звіт_PerfumeFlow_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    showToast("✅ Excel файл завантажено!", "success");
};

// AI Revenue Forecast
window.forecastRevenue = async function () {
    const btn = event?.target || document.querySelector('button[onclick="forecastRevenue()"]');
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Аналізую...';

    try {
        const txs = getTransactions();
        if (txs.length < 7) {
            showToast("📊 Потрібно мінімум 7 замовлень для прогнозу", "warning");
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-chart-line"></i> Прогноз виручки';
            return;
        }

        // Calculate statistics
        const last30Days = txs.filter(t => {
            const date = new Date(t.timestamp);
            const now = new Date();
            const diffDays = (now - date) / (1000 * 60 * 60 * 24);
            return diffDays <= 30;
        });

        const totalRevenue = last30Days.reduce((sum, t) => sum + t.revenue, 0);
        const avgDailyRevenue = totalRevenue / 30;
        const avgOrderValue = totalRevenue / last30Days.length;

        const monthlyData = {};
        txs.forEach(t => {
            const month = new Date(t.timestamp).toISOString().substring(0, 7);
            monthlyData[month] = (monthlyData[month] || 0) + t.revenue;
        });

        const monthlyRevenues = Object.values(monthlyData).slice(-6);
        const trend = monthlyRevenues.length > 1 ?
            ((monthlyRevenues[monthlyRevenues.length - 1] - monthlyRevenues[0]) / monthlyRevenues[0] * 100).toFixed(1) : 0;

        const prompt = `Ти - фінансовий аналітик магазину парфумерії. На основі даних зроби прогноз виручки на наступний місяць.

ДАНІ:
- Виручка за останні 30 днів: ${totalRevenue.toFixed(0)} ₴
- Середня виручка на день: ${avgDailyRevenue.toFixed(0)} ₴
- Кількість замовлень за 30 днів: ${last30Days.length}
- Середній чек: ${avgOrderValue.toFixed(0)} ₴
- Тренд за 6 місяців: ${trend > 0 ? '+' : ''}${trend}%
- Виручка по місяцях (останні 6): ${monthlyRevenues.map(r => r.toFixed(0)).join(', ')} ₴

ЗАВДАННЯ:
1. Проаналізуй тренд та сезонність
2. Дай прогноз виручки на наступний місяць (діапазон: мін-макс)
3. Дай 2-3 рекомендації для зростання
4. Відповідь в форматі:
   📊 ПРОГНОЗ: [сума] ₴ (діапазон: [мін]-[макс] ₴)
   
   📈 АНАЛІЗ ТРЕНДУ:
   [1-2 речення]
   
   💡 РЕКОМЕНДАЦІЇ:
   • [рекомендація 1]
   • [рекомендація 2]
   
Максимум 500 символів. Мова: українська.`;

        const forecast = await callGemini(prompt);

        // Display
        const modal = document.getElementById('settingsModal');
        modal.style.display = 'block';
        document.getElementById('settingsContent').innerHTML = `
            <h2 style="margin-top: 0;">📊 Прогноз виручки</h2>
            <div style="background: var(--bg-input); padding: 20px; border-radius: 12px; border-left: 4px solid var(--primary);">
                ${forecast.replace(/\n/g, '<br>')}
            </div>
            <button class="btn-secondary" onclick="document.getElementById('settingsModal').style.display='none'" style="margin-top: 20px; width: 100%;">
                Закрити
            </button>
        `;

    } catch (e) {
        console.error(e);
        showToast("❌ Помилка прогнозування", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-chart-line"></i> Прогноз виручки';
    }
};

window.calculateRetailPrice = function () {
    const name = document.getElementById('calcPerfumeName').value; const vol = parseFloat(document.getElementById('calcFlaconVolume').value); const mark = document.getElementById('calcMarkupTier').value;
    const res = calculateCost(name, vol, mark);
    if (res) { document.getElementById('calculatorOutput').innerHTML = `<strong>Ціна: ${res.revenue.toFixed(0)} ₴</strong>`; }
}
window.generatePriceList = function () {
    const markupKey = document.getElementById('priceListMarkup').value;
    if (!markupKey) return;
    const date = new Date().toLocaleDateString('uk-UA');
    let text = '📋 ПРАЙС-ЛИСТ PERFUMEFLOW\n📅 Дата: ' + date + '\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    text += '🧴 ВАРТІСТЬ ФЛАКОНІВ:\n\n';
    const bottleSizes = [3, 5, 10, 15, 20, 30, 40, 50, 100];
    bottleSizes.forEach(size => {
        const cost = FLACON_COSTS[size];
        if (cost) text += '   ' + size + ' мл — ' + cost + ' грн\n';
    });
    text += '\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n💎 ЦІНИ НА ПАРФУМИ:\n(ціна за 1 мл)\n\n';
    Object.keys(PERFUME_PRICES).sort().forEach(name => {
        const basePrice = PERFUME_PRICES[name].basePrice;
        if (!basePrice) return;
        const markup = MARKUP_PRESETS[markupKey] || 0.12;
        const pricePerMl = Math.round(basePrice * (1 + markup));
        text += '🔹 ' + name + '\n   ' + pricePerMl + ' грн/мл\n\n';
    });
    text += '━━━━━━━━━━━━━━━━━━━━━━━━\n\n📱 Для замовлення - пишіть!\n✨ Розливаємо від 3 мл\n';
    const output = document.getElementById('priceListOutput');
    output.value = text;
    output.select();
    document.execCommand("copy");
    showToast("✅ Прайс скопійовано!", "success");
}
window.showClientHistory = function () {
    const clientName = document.getElementById('clientSearchInput').value.trim().toLowerCase(); if (!clientName) return;
    const txs = getTransactions().filter(t => t.clientName.toLowerCase().includes(clientName));
    const tbody = document.getElementById('client-history-table').getElementsByTagName('tbody')[0]; tbody.innerHTML = '';

    const stats = getClientStats(clientName); // Use new helper
    document.getElementById('aiClientAnalysisBtn').style.display = txs.length > 0 ? 'inline-block' : 'none';

    txs.forEach(t => { tbody.innerHTML += `<tr><td>${new Date(t.timestamp).toLocaleDateString()}</td><td>${t.perfumeName} (${t.quantityML}ml)</td><td class="text-right">${t.revenue}</td><td class="text-right">${t.profit}</td></tr>`; });

    // Rich summary with Loyalty Level
    document.getElementById('clientCrmSummary').innerHTML = `
        <div style="background:var(--bg-input); padding:15px; border-radius:8px; border-left: 4px solid var(--primary);">
            <div style="font-size:1.1rem; font-weight:bold;">${clientName.toUpperCase()}</div>
            <div style="margin-top:5px;">Рівень: <span style="color:var(--primary); font-weight:800;">${stats.level}</span></div>
            <div>Всього покупок: <strong>${txs.length}</strong></div>
            <div>Загальна сума: <strong>${stats.totalSpend.toFixed(0)} ₴</strong></div>
            ${stats.discount > 0 ? `<div style="margin-top:5px; color:var(--secondary); font-weight:bold;">✨ Активна знижка: ${(stats.discount * 100).toFixed(0)}%</div>` : ''}
        </div>
    `;
}

window.analyzeClientPreferences = async function () {
    const clientName = document.getElementById('clientSearchInput').value.trim();
    if (!clientName) return;

    const txs = getTransactions().filter(t => t.clientName.toLowerCase().includes(clientName.toLowerCase()));
    if (txs.length === 0) return;

    const btn = document.getElementById('aiClientAnalysisBtn');
    const originalContent = btn.innerHTML;
    const summaryDiv = document.getElementById('clientCrmSummary');

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Аналізую...';
    btn.disabled = true;

    try {
        // Prepare purchase history with flavor data
        const purchaseHistory = txs.map(t => {
            const pData = PERFUME_PRICES[t.perfumeName] || {};
            return {
                perfume: t.perfumeName,
                volume: t.quantityML,
                gender: pData.gender || 'не вказано',
                tags: (pData.tags || []).join(', '),
                pyramid: pData.pyramid || 'немає дани'
            };
        });

        const prompt = `
            Ти — психолог-парфумер та експерт CRM. Проаналізуй історію покупок клієнта "${clientName}" та створи його "Ароматний Портрет".
            
            ІСТОРІЯ ПОКУПОК:
            ${JSON.stringify(purchaseHistory)}
            
            ТВОЄ ЗАВДАННЯ:
            1. Визнач домінуючі смаки (наприклад: любить деревні, свіжі чи солодкі аромати).
            2. Опиши характер клієнта як покупця (наприклад: "Експериментатор", "Любитель класики", "Шукає шлейфові аромати").
            3. Сформуй 3-5 коротких міток (тагів) для CRM.
            4. Порекомендуй 1-2 типи ароматів, які йому точно сподобаються, але він їх ще не купував.
            
            Відповідай українською мовою. Форматуй відповідь емодзі та жирним текстом. Зроби це професійно та надихаюче.
        `;

        const responseText = await callGemini(prompt);

        // Add analysis to the summary
        const analysisHtml = `
            <div id="aiClientAnalysisResult" style="margin-top:15px; padding:15px; background:rgba(var(--primary-rgb), 0.05); border:1px dashed var(--primary); border-radius:8px;">
                <h4 style="margin-bottom:10px;"><i class="fa-solid fa-magic"></i> ШІ-Портрет Клієнта</h4>
                <div style="font-size:0.9rem; line-height:1.5;">${responseText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
            </div>
        `;

        // Append or replace if already exists
        const oldResult = document.getElementById('aiClientAnalysisResult');
        if (oldResult) oldResult.remove();
        summaryDiv.innerHTML += analysisHtml;

        showToast("🏷️ Аналіз уподобань готовий!", "success");

    } catch (err) {
        console.error(err);
        showToast("❌ Помилка ШІ-аналізу", "error");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

// --- MODAL UTILS ---
function generateReceiptHTML(orderItems, totalOriginal, clientName, ttn = null, discount = 0) {
    const total = totalOriginal.toFixed(2);
    const discountAmount = totalOriginal * (discount / 100);
    const finalTotal = totalOriginal - discountAmount;
    const date = new Date().toLocaleDateString('uk-UA');

    const itemsHtml = orderItems.map((item, index) => `<p style="margin: 5px 0; display: flex; justify-content: space-between; font-size: 0.95rem;"><span>${index + 1}. ${item.name} (${item.vol} мл)</span><span class="text-bold">${item.revenue.toFixed(2)} ₴</span></p>`).join('');
    const ttnDisplay = ttn ? `<p style="margin: 10px 0; font-weight: 600;">📦 ТТН: ${ttn}</p>` : '';

    let totalsHtml = `<div class="receipt-total">До сплати: ${finalTotal.toFixed(2)} ₴</div>`;
    if (discount > 0) {
        totalsHtml = `
            <div style="border-top: 2px dashed var(--border); margin-top:15px; padding-top:10px; text-align:right;">
                <p>Сума: ${totalOriginal.toFixed(2)} ₴</p>
                <p style="color:var(--secondary);">Знижка (${discount}%): -${discountAmount.toFixed(2)} ₴</p>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin-top:5px;">Разом: ${finalTotal.toFixed(2)} ₴</div>
            </div>`;
    }

    return `<div style="max-width: 300px; margin: 0 auto; padding: 15px; border: 1px dashed var(--border); border-radius: 5px; font-family: monospace; color: var(--text-main);"><h3 style="text-align: center; margin-bottom: 5px; color: var(--primary);">PerfumeFlow</h3><p style="text-align: center; margin-bottom: 15px; border-bottom: 1px dashed var(--border); padding-bottom: 5px; font-size: 0.85rem;">Дата: ${date} | Клієнт: ${clientName}</p>${itemsHtml}${ttnDisplay}${totalsHtml}<p style="text-align: center; margin-top: 20px; font-size: 0.9rem; color: var(--text-muted);" class="no-print">Дякуємо!</p><div class="no-print admin-buttons-group" style="margin-top: 20px; text-align: center; display: flex; gap: 10px;"><button onclick="window.print()" style="background-color: var(--secondary); flex-grow: 1; color: white; border: none; border-radius: 4px; padding: 8px;">🖨️ Друк</button><button onclick="closeReceiptModal()" style="background-color: var(--text-muted); flex-grow: 1; color: white; border: none; border-radius: 4px; padding: 8px;">Закрити</button></div></div>`;
}
function showModalReceipt(orderItems, totalRounded, clientName, ttn = null, discount = 0) {
    document.getElementById('receiptContent').innerHTML = generateReceiptHTML(orderItems, totalRounded, clientName, ttn, discount);
    document.getElementById('receiptModal').classList.add('active');
}
window.closeReceiptModal = function () { closeModal('receiptModal'); }

// --- SYNC / EXPORT ---
window.showSyncModal = function () {
    const allData = {}; Object.values(CONFIG_KEYS).forEach(key => allData[key] = JSON.parse(localStorage.getItem(key) || 'null'));
    document.getElementById('syncDataOutput').value = JSON.stringify(allData); document.getElementById('syncModal').classList.add('active');
}
window.closeSyncModal = function () { closeModal('syncModal'); }
window.copySyncData = function () { document.getElementById("syncDataOutput").select(); document.execCommand("copy"); showToast("Скопійовано!", "success"); }
window.importDataFromSync = function () {
    try { const data = JSON.parse(document.getElementById('syncDataInput').value); if (confirm("Це перезапише дані! Продовжити?")) { Object.keys(data).forEach(key => { if (data[key]) localStorage.setItem(key, JSON.stringify(data[key])); }); location.reload(); } } catch (e) { showToast("Помилка формату", "error"); }
}
window.exportDataToJSON = function () {
    const allData = {};
    Object.values(CONFIG_KEYS).forEach(key => {
        const item = localStorage.getItem(key);
        // Save parsed JSON if it exists, otherwise null
        allData[key] = item ? JSON.parse(item) : null;
    });

    // Use Blob for massive data support related to base64 limits
    const dataStr = JSON.stringify(allData, null, 2); // Pretty print for readability
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const dl = document.createElement('a');
    dl.setAttribute("href", url);
    dl.setAttribute("download", "crm_backup_" + new Date().toISOString().slice(0, 10) + ".json");
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
    URL.revokeObjectURL(url); // Clean up
    showToast("Бек-ап успішно створено!", "success");
}

window.importDataFromJSON = function () {
    const fileInput = document.getElementById('importFileInput');
    if (!fileInput.files || !fileInput.files.length) {
        showToast("⚠️ Виберіть файл перед відновленням!", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm("⚠️ УВАГА: Всі поточні дані будуть замінені даними з файлу. Продовжити?")) {
                Object.keys(data).forEach(key => {
                    // Only restore known config keys to ensure safety
                    if (Object.values(CONFIG_KEYS).includes(key) && data[key] !== null) {
                        localStorage.setItem(key, JSON.stringify(data[key]));
                    }
                });
                showToast("Дані успішно відновлено! Оновлення...", "success");
                setTimeout(() => location.reload(), 1500); // Give time to read toast
            }
        } catch (err) {
            console.error(err);
            showToast(`❌ Помилка читання файлу: ${err.message}`, "error");
        }
    };

    reader.onerror = function () {
        showToast("❌ Помилка завантаження файлу", "error");
    };

    reader.readAsText(fileInput.files[0]);
}

// --- TASK MANAGEMENT (NEW) ---
window.switchTaskTab = function (tabName) {
    const ordersView = document.getElementById('task-view-orders');
    const manualView = document.getElementById('task-view-manual');
    const ordersTab = document.getElementById('tab-orders');
    const manualTab = document.getElementById('tab-manual');

    if (tabName === 'orders') {
        ordersView.style.display = 'block';
        manualView.style.display = 'none';
        ordersTab.classList.add('active');
        manualTab.classList.remove('active');
        renderTasksOrders();
    } else {
        ordersView.style.display = 'none';
        manualView.style.display = 'block';
        ordersTab.classList.remove('active');
        manualTab.classList.add('active');
        renderTasksManual();
    }
}

function getTasks() { return getFromLocalStorage(CONFIG_KEYS.TASKS, []); }
function saveTasks(tasks) { saveToLocalStorage(CONFIG_KEYS.TASKS, tasks); }
function getCompletedOrders() { return getFromLocalStorage(CONFIG_KEYS.COMPLETED_ORDERS, []); }
function saveCompletedOrders(ids) { saveToLocalStorage(CONFIG_KEYS.COMPLETED_ORDERS, ids); }

window.renderTasksOrders = function () {
    const container = document.getElementById('orders-task-list');
    if (!container) return;
    container.innerHTML = '';

    const completedIds = getCompletedOrders();
    const txs = getTransactions().filter(t => t.orderId);
    const uniqueOrderIds = [...new Set(txs.map(t => t.orderId))];

    // Sort: Pending first, then by date (reverse)
    uniqueOrderIds.sort((a, b) => {
        const aCompleted = completedIds.includes(a);
        const bCompleted = completedIds.includes(b);
        if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
        return b - a; // Newest first
    });

    uniqueOrderIds.forEach(orderId => {
        const orderItems = txs.filter(t => t.orderId === orderId);
        const t = orderItems[0];
        const itemsText = orderItems.map(oi => `🔹 ${oi.perfumeName} (${oi.quantityML} мл)`).join('\n');
        const isCompleted = completedIds.includes(orderId);

        const card = document.createElement('div');
        card.className = `task-card task-order ${isCompleted ? 'completed' : ''}`;
        card.innerHTML = `
            <div class="task-date">${new Date(t.timestamp).toLocaleString()}</div>
            <div class="task-type" style="background: #dbeafe; color: #1e40af;">📦 ЗАМОВЛЕННЯ #${orderId}</div>
            <div style="font-weight: bold; margin-bottom: 5px;">Клієнт: ${t.clientName}</div>
            <div class="task-content"><strong>Склад замовлення:</strong>\n${itemsText}</div>
            <div class="task-actions">
                 ${isCompleted
                ? '<span style="color:var(--success); font-weight:bold; font-size:0.8rem;">🗸 ВИКОНАНО</span>'
                : `<button class="btn-sm btn-success" onclick="completeOrderTask(${orderId})">✅ Виконано</button>`}
            </div>
        `;
        container.appendChild(card);
    });

    if (uniqueOrderIds.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 50px;">Замовлень поки немає</p>';
    }
}

window.renderTasksManual = function () {
    const container = document.getElementById('manual-task-list');
    if (!container) return;
    container.innerHTML = '';

    let tasks = getTasks().filter(t => t.type === 'manual');

    // Sort: Pending first, then by date (reverse)
    tasks.sort((a, b) => {
        const aComp = a.status === 'completed';
        const bComp = b.status === 'completed';
        if (aComp !== bComp) return aComp ? 1 : -1;
        return b.timestamp - a.timestamp;
    });

    tasks.forEach(task => {
        const isCompleted = task.status === 'completed';
        const card = document.createElement('div');
        card.className = `task-card task-manual ${isCompleted ? 'completed' : ''}`;
        card.innerHTML = `
            <div class="task-date">${new Date(task.timestamp).toLocaleString()}</div>
            <div class="task-type" style="background: #f3e8ff; color: #6b21a8;">📝 РУЧНА ЗАДАЧА</div>
            <div class="task-content">${task.content}</div>
            <div class="task-actions">
                 ${!isCompleted ? `
                    <button class="btn-sm btn-warning" onclick="editManualTask(${task.id})" title="Редагувати"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-sm btn-success" onclick="completeManualTask(${task.id})" title="Виконати"><i class="fa-solid fa-check"></i></button>
                 ` : `
                    <button class="btn-sm btn-danger" onclick="deleteManualTask(${task.id})" title="Видалити"><i class="fa-solid fa-trash"></i></button>
                 `}
            </div>
        `;
        container.appendChild(card);
    });

    if (tasks.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 50px;">Ручних задач немає</p>';
    }
}

window.createManualTaskAI = async function () {
    const text = document.getElementById('manualTaskInput').value.trim();
    if (!text) return;

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Створення...';
    btn.disabled = true;

    try {
        const prompt = `Ти - помічник у CRM для парфумерії. Користувач ввів нотатку.
Твоя задача: зробити її структурованою та граматично правильною.
НОТАТКА: "${text}"

Поверни ТІЛЬКИ відформатований текст задачі без зайвих слів. Якщо в тексті є дати або імена, виділи їх.
Мова: Українська.`;

        const aiOutput = await callGemini(prompt);
        const tasks = getTasks();
        tasks.push({
            id: Date.now(),
            type: 'manual',
            content: aiOutput.trim(),
            timestamp: Date.now(),
            status: 'pending'
        });
        saveTasks(tasks);
        document.getElementById('manualTaskInput').value = '';
        renderTasksManual();
        showToast("✅ Задачу створено!", "success");
    } catch (e) {
        showToast("❌ Помилка AI: " + e.message, "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

window.completeManualTask = function (id) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.status = 'completed';
        saveTasks(tasks);
        renderTasksManual();
        showToast("✅ Задачу виконано", "success");
    }
}

window.deleteManualTask = function (id) {
    if (!confirm("Видалити цю задачу назавжди?")) return;
    const tasks = getTasks().filter(t => t.id !== id);
    saveTasks(tasks);
    renderTasksManual();
    showToast("🗑️ Задача видалена", "error");
}

window.completeOrderTask = function (orderId) {
    const completedIds = getCompletedOrders();
    if (!completedIds.includes(orderId)) {
        completedIds.push(orderId);
        saveCompletedOrders(completedIds);
        renderTasksOrders();
        showToast("✅ Замовлення позначено як розлите та виконане", "success");
    }
}

window.editManualTask = async function (id) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newText = prompt("Редагувати задачу:", task.content);
    if (newText !== null) {
        task.content = newText;
        saveTasks(tasks);
        renderTasksManual();
    }
}

// Initial Tasks Load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof renderTasksOrders === 'function') renderTasksOrders();
    }, 1000);
});

// --- SETTINGS (AI API) ---
window.openSettingsModal = function () {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    modal.classList.add('active');
    modal.style.display = 'block'; // Ensure it's visible if style was set to none

    document.getElementById('apiKeyInput').value = localStorage.getItem('gemini_api_key') || '';

    // Load Supabase config
    const config = getSupabaseConfig();
    if (document.getElementById('supabaseUrlInput')) {
        document.getElementById('supabaseUrlInput').value = config.url || '';
        document.getElementById('supabaseKeyInput').value = config.key || '';
    }

    // Update sync status display
    updateSyncStatus();

    // Set model select value
    const savedModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
    if (document.getElementById('geminiModelSelect')) {
        document.getElementById('geminiModelSelect').value = savedModel;
    }
}
window.closeSettingsModal = function () { closeModal('settingsModal'); }
window.saveApiKey = function (key) { localStorage.setItem('gemini_api_key', key.trim()); showToast("Ключ збережено", "success"); }
// --- TASK MANAGEMENT INITIALIZATION ---
window.renderTasks = function () {
    switchTaskTab('orders');
}

window.saveGeminiKey = function (key) { saveApiKey(key); }

// Fix the recursive call by using a unique name or checking for existence correctly
window.saveTelegramConfig = function () {
    // This calls the function defined in telegram.js if it exists
    if (typeof saveTelegramConfig === 'function' && !saveTelegramConfig.isWrapper) {
        saveTelegramConfig();
    } else {
        // Fallback or specific logic if needed
        const token = document.getElementById('telegramBotTokenInput').value.trim();
        const channel = document.getElementById('telegramChannelIdInput').value.trim();
        if (token) localStorage.setItem('telegram_bot_token', token);
        if (channel) localStorage.setItem('telegram_channel_id', channel);
        showToast("✅ Telegram налаштування збережено", "success");
    }
}
window.saveTelegramConfig.isWrapper = true;

async function callGemini(prompt) {
    const apiKey = localStorage.getItem('gemini_api_key');
    const model = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';

    if (!apiKey) {
        showToast("🔑 Додайте Gemini API Key у налаштуваннях!", "error");
        openSettingsModal();
        throw new Error("API Key missing");
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, topP: 1 }
            })
        });

        if (response.status === 429) {
            throw new Error("⏳ Перевищено ліміт запитів ШІ. Зачекайте 15-30 секунд і спробуйте знову, або перемкніть модель на 1.5 Flash.");
        }

        const data = await response.json();
        if (data.error) {
            if (data.error.message.includes("quota") || data.error.message.includes("limit")) {
                throw new Error("⏳ Квота ШІ вичерпана. Зачекайте хвилину або виберіть 'Gemini 1.5 Flash' у налаштуваннях.");
            }
            throw new Error(data.error.message);
        }

        if (!data.candidates || !data.candidates[0].content.parts[0].text) throw new Error("Порожня відповідь від AI");

        return data.candidates[0].content.parts[0].text;
    } catch (err) {
        console.error("Gemini Error:", err);
        throw err;
    }
}

// --- AI PARSING (UPGRADED) ---
window.smartParseAI = async function (mode = 'single') {
    const inputId = mode === 'order' ? 'pasteAreaOrder' : 'pasteArea';
    const text = document.getElementById(inputId).value;

    if (!text) { showToast("⚠️ Спочатку вставте текст!", "warning"); return; }

    const btn = document.querySelector(`button[onclick*="smartParseAI"]`);
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Обробка...';
    btn.disabled = true;

    try {
        const perfumesList = Object.keys(PERFUME_PRICES).join(', ');
        const volumesList = FLACON_VOLUMES.join(', ');

        const prompt = `
            Ти — професійний асистент CRM для продажу парфумерії. 
            Твоє завдання: витягнути дані про замовлення та клієнта з тексту (текст може бути на українській, російській або суржику).

            КАТАЛОГ ПАРФУМІВ (доступні назви): [${perfumesList}]
            ДОСТУПНІ ОБ'ЄМИ: [${volumesList}]

            ПРАВИЛА:
            1. Для назв парфумів вибирай НАЙБЛИЖЧУ назву з КАТАЛОГУ (використовуй нечітке порівняння). Якщо зовсім не схоже — ігноруй.
            2. Імена та адреси пиши українською мовою.
            3. Об'єми мають бути ТІЛЬКИ з доступного списку.

            ПОВЕРНИ ТІЛЬКИ JSON:
            {
              "clientName": "ПІБ",
              "phone": "Телефон (0XXXXXXXXX)",
              "city": "Місто або н.п.",
              "postOffice": "Номер відділення або адреса",
              "items": [
                { "perfumeName": "Точна назва з каталогу", "volume": число }
              ]
            }

            ТЕКСТ ДЛЯ РОЗБОРУ:
            "${text}"
        `;

        const responseText = await callGemini(prompt);
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        // Fill Client Data
        const fieldMap = mode === 'order' ?
            { name: 'clientNameOrder', phone: 'phoneOrder', city: 'cityOrder', post: 'postOfficeOrder' } :
            { name: 'clientNameSingle', phone: 'phoneSingle', city: 'citySingle', post: 'postOfficeSingle' };

        if (result.clientName) document.getElementById(fieldMap.name).value = result.clientName;
        if (result.phone) document.getElementById(fieldMap.phone).value = result.phone;
        if (result.city) document.getElementById(fieldMap.city).value = result.city;
        if (result.postOffice) document.getElementById(fieldMap.post).value = result.postOffice;

        // Auto-Add Items
        if (result.items && result.items.length > 0) {
            let addedCount = 0;
            const markup = document.getElementById('saleMarkupTierOrder')?.value || 'Стандарт';

            result.items.forEach(item => {
                const pName = item.perfumeName;
                const vol = item.volume;

                if (pName && PERFUME_PRICES[pName] && vol) {
                    if (mode === 'order') {
                        const calc = calculateCost(pName, vol, markup);
                        if (calc) {
                            CURRENT_ORDER_LIST.push({ ...calc, name: pName, vol: vol, markup: markup });
                            addedCount++;
                        }
                    } else {
                        if (addedCount === 0) {
                            document.getElementById('perfumeName').value = pName;
                            document.getElementById('flaconVolume').value = vol;
                            addedCount++;
                        }
                    }
                }
            });

            if (addedCount > 0) {
                if (mode === 'order') renderOrderList();
                showToast(`🤖 AI розпізнав та додав ${addedCount} позицій!`, "success");
            }
        }

        if (result.clientName) {
            const inputEl = mode === 'order' ? document.getElementById('clientNameOrder') : document.getElementById('clientNameSingle');
            checkClientLoyalty(inputEl);
        }

    } catch (err) {
        console.error(err);
        showToast("❌ Помилка AI розбору. Перевірте ключ або текст.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- UNIVERSAL ADMIN BOT ---
window.runAdminAI = async function () {
    const input = document.getElementById('adminAiChatInput').value.trim();
    if (!input) return;

    const resDiv = document.getElementById('adminAiResponse');
    const contentDiv = document.getElementById('adminAiResponseContent');
    const btn = document.querySelector('button[onclick="runAdminAI()"]');

    resDiv.style.display = 'block';
    contentDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Аналізую...';
    btn.disabled = true;

    try {
        const perfumesList = Object.entries(PERFUME_PRICES).map(([name, data]) => {
            const stock = PERFUME_STOCK[name] || 0;
            return `
- НАЗВА: ${name}
  НАЯВНІСТЬ: ${stock} мл
  СТАТЬ: ${data.gender || 'не вказано'}
  СЕЗОН: ${(data.seasons || []).join(', ')}
  ТЕГИ: ${(data.tags || []).join(', ')}
  ПІРАМІДА: ${data.pyramid || 'немає дани'}
  ОПИС: ${data.description || 'немає дани'}
            `;
        }).join('\n');

        const prompt = `
            Ти — професійний менеджер та консультант магазину парфумерії. 
            Тобі надано актуальний каталог та дані про склад:
            ${perfumesList}

            ЛОГІКА ТВОЄЇ РОБОТИ:
            1. ЛЮДЯНІСТЬ: Спілкуйся ввічливо, професійно, українською мовою. 
            2. ЗНАННЯ: Якщо у нашому каталозі немає опису або піраміди для парфуму, використай свої внутрішні знання, щоб розповісти про нього клієнту.
            3. КОНСУЛЬТАЦІЯ: На запит "що порадити" або "що схоже" — підбирай варіанти на основі нот (піраміди), сезону та статі. Віддавай ПРІОРИТЕТ товарам, які є в наявності (>0 мл), але можеш згадати і відсутні, якщо вони ідеально підходять (зазначаючи, що їх зараз немає).
            4. РОЗРАХУНКИ: Якщо клієнт просить розрахувати ціну або OLX доставку — роби це чітко. 
               Формула OLX: ((Ціна_Товару + 35) * 1.03).

            ЗАПИТ КЛІЄНТА: "${input}"
        `;

        const responseText = await callGemini(prompt);
        contentDiv.innerHTML = responseText;
        contentDiv.innerHTML = responseText;
    } catch (err) {
        console.error(err);
        contentDiv.innerHTML = "❌ Помилка: " + err.message;
    } finally {
        btn.disabled = false;
    }
}

// --- SMM CREATOR ---
window.generateSMMContent = async function () {
    const pName = document.getElementById('smmPerfumeName').value;
    const goal = document.getElementById('smmGoal').value;

    if (!pName || !PERFUME_PRICES[pName]) {
        showToast("⚠️ Оберіть парфум зі списку!", "warning");
        return;
    }

    const pData = PERFUME_PRICES[pName];
    const outDiv = document.getElementById('smmOutput');
    const outContent = document.getElementById('smmOutputContent');
    const btn = document.querySelector('button[onclick="generateSMMContent()"]');

    outDiv.style.display = 'block';
    outContent.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Створюю креатив...';
    btn.disabled = true;

    try {
        const prompt = `
            Ти — професійний SMM-менеджер парфумерного бренду.
            Парфум: "${pName}".
            Дані: Стать: ${pData.gender}, Сезони: ${(pData.seasons || []).join(', ')}, Теги: ${(pData.tags || []).join(', ')}.
            Ціль: ${goal} (post, story, ads або strategy).

            Створи захоплюючий контент українською мовою. 
            Використовуй емодзі, заклики до дії та хештеги. 
            Якщо це Story — зроби сценарій на 3-4 кадри.
        `;

        const responseText = await callGemini(prompt);
        outContent.innerHTML = responseText;
    } catch (err) {
        console.error(err);
        outContent.innerHTML = "❌ Помилка: " + err.message;
    } finally {
        btn.disabled = false;
    }
}

// ==========================================
//  SUPABASE INTEGRATION
// ==========================================
let supabaseClient = null;

function getSupabaseConfig() {
    return {
        url: localStorage.getItem('supabase_url') || 'https://oxxzlqwnssivwzhalojw.supabase.co',
        key: localStorage.getItem('supabase_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94eHpscXduc3Npdnd6aGFsb2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU0MjgsImV4cCI6MjA4NTAyMTQyOH0.NsAb_R46ziufVT_5tqqTW9RntLkCdKDjzvd5m234_us'
    };
}
window.saveSupabaseConfig = function () {
    const url = document.getElementById('supabaseUrlInput').value.trim();
    const key = document.getElementById('supabaseKeyInput').value.trim();
    if (url) localStorage.setItem('supabase_url', url);
    if (key) localStorage.setItem('supabase_key', key);
    initSupabase();
}

function initSupabase() {
    const config = getSupabaseConfig();
    if (config.url && config.key && window.supabase) {
        try {
            supabaseClient = window.supabase.createClient(config.url, config.key);
            console.log("Supabase Client Initialized");
        } catch (e) {
            console.error("Supabase Init Error", e);
        }
    }
    // Populate inputs
    if (document.getElementById('supabaseUrlInput')) {
        document.getElementById('supabaseUrlInput').value = config.url || '';
        document.getElementById('supabaseKeyInput').value = config.key || '';
    }
}

// Call init on load
document.addEventListener('DOMContentLoaded', initSupabase);

// Helper function to update sync status display
function updateSyncStatus() {
    const lastSync = localStorage.getItem('last_cloud_sync');
    const lastRestore = localStorage.getItem('last_cloud_restore');

    // This will be called when settings modal opens
    const syncStatusEl = document.getElementById('syncStatusDisplay');
    if (syncStatusEl && lastSync) {
        const syncDate = new Date(lastSync);
        const timeAgo = getTimeAgo(syncDate);
        syncStatusEl.innerHTML = `<div style="margin-top: 10px; padding: 10px; background: rgba(16, 185, 129, 0.1); border-left: 3px solid var(--secondary); border-radius: 4px;">
            <strong>✅ Остання синхронізація:</strong><br>
            ${syncDate.toLocaleString('uk-UA')} (${timeAgo})
        </div>`;
    }

    if (syncStatusEl && lastRestore) {
        const restoreDate = new Date(lastRestore);
        const timeAgo = getTimeAgo(restoreDate);
        syncStatusEl.innerHTML += `<div style="margin-top: 5px; padding: 10px; background: rgba(79, 70, 229, 0.1); border-left: 3px solid var(--primary); border-radius: 4px;">
            <strong>📥 Останнє відновлення:</strong><br>
            ${restoreDate.toLocaleString('uk-UA')} (${timeAgo})
        </div>`;
    }
}

// Helper to calculate time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'щойно';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} хв тому`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} год тому`;
    return `${Math.floor(seconds / 86400)} дн тому`;
}

window.testSupabaseConnection = async function () {
    if (!supabaseClient) { initSupabase(); }
    if (!supabaseClient) { showToast("⚠️ Спочатку введіть URL та Key!", "error"); return; }

    showToast("🔄 Перевірка з'єднання...", "primary");

    try {
        // Try to select from a table named 'app_data'
        const { data, error } = await supabaseClient
            .from('app_data')
            .select('count', { count: 'exact', head: true });

        if (error) {
            throw error;
        }

        showToast("✅ З'єднання успішне! Таблиця app_data знайдена.", "success");
        console.log("✅ Supabase connection test successful");

    } catch (error) {
        console.error("❌ Connection test error:", error);

        if (error.code === '42P01') {
            const msg = "⚠️ З'єднання працює, але таблиця app_data не знайдена!\n\nСтворіть таблицю:\n1. Supabase Dashboard → Table Editor\n2. New Table: app_data\n3. Колонки: id (int8), json_data (jsonb), updated_at (timestamp)";
            alert(msg);
            showToast("⚠️ Таблиця app_data не створена", "warning");
        } else if (error.code === 'PGRST301') {
            showToast("❌ Невірний URL або Key", "error");
        } else if (error.message.includes('Failed to fetch')) {
            showToast("❌ Не вдалося підключитися. Перевірте URL.", "error");
        } else {
            showToast(`❌ Помилка: ${error.message}`, "error");
        }
    }
}


window.syncWithCloud = async function () {
    if (!supabaseClient) {
        showToast("⚠️ Налаштуйте Supabase!", "error");
        return;
    }

    if (!confirm("Це синхронізує ваші дані з хмарою. Продовжити?")) return;

    showToast("🔄 Підготовка даних...", "primary");

    try {
        // 1. Prepare Local Data
        const allData = {};
        let totalSize = 0;

        Object.values(CONFIG_KEYS).forEach(key => {
            const item = localStorage.getItem(key);
            if (item) {
                try {
                    // Try to parse as JSON first
                    allData[key] = JSON.parse(item);
                } catch (e) {
                    // If parse fails, it's a plain string (like theme: 'dark')
                    allData[key] = item;
                }
                totalSize += item.length;
            } else {
                allData[key] = null;
            }
        });

        // 2. Validate data size (Supabase has limits)
        const dataSizeMB = (totalSize / 1024 / 1024).toFixed(2);
        console.log(`📊 Розмір даних для синхронізації: ${dataSizeMB} MB`);

        if (totalSize > 10 * 1024 * 1024) { // 10MB limit
            showToast(`⚠️ Дані занадто великі (${dataSizeMB} MB). Максимум 10 MB.`, "error");
            return;
        }

        showToast("🔄 Відправка в хмару...", "primary");

        // 3. Upload (Upsert) with Timeout (20s)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout: Сервер не відповідає (20 сек)')), 20000)
        );

        const supabasePromise = supabaseClient
            .from('app_data')
            .upsert({
                id: 1,
                json_data: allData
            })
            .select();

        const result = await Promise.race([supabasePromise, timeoutPromise]);

        if (result.error) {
            throw result.error;
        }

        // 4. Save sync timestamp
        localStorage.setItem('last_cloud_sync', new Date().toISOString());

        const syncTime = new Date().toLocaleString('uk-UA');
        showToast(`✅ Дані збережено в хмару! (${syncTime})`, "success");
        console.log("✅ Supabase Sync Success:", result.data);

        // Update UI if sync status element exists
        updateSyncStatus();

    } catch (error) {
        console.error("❌ Supabase Save Error:", error);

        let errorMessage = "Невідома помилка";
        let errorDetails = "";

        // Parse different error types
        if (error.message) {
            errorMessage = error.message;
        }

        if (error.code === 'PGRST301') {
            errorDetails = "\n\n💡 Можлива причина: Таблиця app_data не існує або має неправильну структуру.\n\nРішення:\n1. Перейдіть в Supabase Dashboard\n2. Table Editor → New Table\n3. Назва: app_data\n4. Колонки: id (int8), json_data (jsonb), updated_at (timestamp)";
        } else if (error.code === '42501' || error.message.includes('permission')) {
            errorDetails = "\n\n💡 Можлива причина: Row Level Security (RLS) блокує доступ.\n\nРішення:\n1. Supabase Dashboard → Authentication → Policies\n2. Вимкніть RLS для таблиці app_data\nАБО\n3. Додайте політику: ALLOW ALL для anon ролі";
        } else if (error.code === 'TIMEOUT') {
            errorDetails = "\n\n💡 Можлива причина: Повільне з'єднання або сервер не відповідає.\n\nРішення:\n1. Перевірте інтернет-з'єднання\n2. Спробуйте ще раз через хвилину";
        } else if (error.code === '23505') {
            errorDetails = "\n\n💡 Конфлікт даних. Спробуйте спочатку завантажити дані з хмари.";
        }

        const fullError = `❌ ПОМИЛКА СИНХРОНІЗАЦІЇ\n\nПовідомлення: ${errorMessage}\nКод: ${error.code || 'N/A'}${errorDetails}`;

        alert(fullError);
        showToast(`❌ Помилка: ${errorMessage}`, "error");

        // Log full error for debugging
        console.log("Full error object:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            status: error.status
        });
    }
}

window.loadFromCloud = async function () {
    if (!supabaseClient) {
        showToast("⚠️ Налаштуйте Supabase!", "error");
        return;
    }

    if (!confirm("⚠️ УВАГА: Це замінить локальні дані даними з хмари!\n\nПродовжити?")) return;

    showToast("🔄 Завантаження з хмари...", "primary");

    try {
        const { data, error } = await supabaseClient
            .from('app_data')
            .select('json_data')
            .eq('id', 1)
            .single();

        if (error) {
            throw error;
        }

        if (!data || !data.json_data) {
            showToast("⚠️ У хмарі немає збережених даних.", "warning");
            return;
        }

        // Validate cloud data
        const cloudData = data.json_data;
        const cloudUpdateTime = new Date().toLocaleString('uk-UA');

        console.log(`📥 Завантаження даних з хмари (оновлено: ${cloudUpdateTime})`);

        // Check if cloud data is valid
        let validKeys = 0;
        Object.values(CONFIG_KEYS).forEach(key => {
            if (cloudData[key] !== undefined && cloudData[key] !== null) {
                validKeys++;
            }
        });

        if (validKeys === 0) {
            showToast("⚠️ Дані в хмарі порожні або пошкоджені.", "error");
            return;
        }

        console.log(`✅ Знайдено ${validKeys} валідних ключів даних`);

        // Restore data
        Object.keys(cloudData).forEach(key => {
            if (cloudData[key] !== null && cloudData[key] !== undefined) {
                const value = cloudData[key];
                // If value is already a string (like 'dark' or 'light'), store as-is
                // Otherwise, stringify it (for objects/arrays)
                if (typeof value === 'string') {
                    localStorage.setItem(key, value);
                } else {
                    localStorage.setItem(key, JSON.stringify(value));
                }
            }
        });

        // Save restore timestamp
        localStorage.setItem('last_cloud_restore', new Date().toISOString());

        showToast(`✅ Дані відновлено з хмари! (${cloudUpdateTime})\n\nОновлення сторінки...`, "success");
        setTimeout(() => location.reload(), 2000);

    } catch (error) {
        console.error("❌ Supabase Load Error:", error);

        let errorMessage = "Невідома помилка";
        let errorDetails = "";

        if (error.code === 'PGRST116') {
            errorMessage = "У хмарі немає збережених даних";
            errorDetails = "\n\n💡 Спочатку збережіть дані в хмару, використовуючи кнопку 'Зберегти в хмару'.";
        } else if (error.code === '42P01') {
            errorMessage = "Таблиця app_data не існує";
            errorDetails = "\n\n💡 Створіть таблицю app_data в Supabase Dashboard:\n1. Table Editor → New Table\n2. Назва: app_data\n3. Колонки: id (int8), json_data (jsonb), updated_at (timestamp)";
        } else if (error.message) {
            errorMessage = error.message;
        }

        const fullError = `❌ ПОМИЛКА ЗАВАНТАЖЕННЯ\n\nПовідомлення: ${errorMessage}\nКод: ${error.code || 'N/A'}${errorDetails}`;

        alert(fullError);
        showToast(`❌ Помилка: ${errorMessage}`, "error");

        console.log("Full error object:", error);
    }
}
window.closeModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
};

// --- GLOBAL MODAL CLICK-OUTSIDE ---
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal(e.target.id);
    }
});

window.saveSettings = function () {
    const key = document.getElementById('apiKeyInput').value;
    const model = document.getElementById('geminiModelSelect').value;
    localStorage.setItem('gemini_api_key', key);
    localStorage.setItem('gemini_model', model);
    showToast("✅ Налаштування збережено!", "success");
    document.getElementById('settingsModal').style.display = 'none';
};

window.callGemini = async function (prompt) {
    const apiKey = localStorage.getItem('gemini_api_key');
    const model = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';

    if (!apiKey) {
        showToast("⚠️ Потрібен API ключ Gemini", "warning");
        openSettingsModal();
        throw new Error("Missing API Key");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "AI Error");
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
};

document.addEventListener('DOMContentLoaded', () => {
    // Set user's provided key as default if none exists or if it's the old one
    const currentKey = localStorage.getItem('gemini_api_key');
    const newDefaultKey = 'AIzaSyDYtCM1M61MG18zX3KZD2jfwofLmKvPG9U';

    if (!currentKey || currentKey === 'AIzaSyDHKSxzyfzzcuZlnSox3Taj4L8k0ZPBAzg') {
        localStorage.setItem('gemini_api_key', newDefaultKey);
    }

    initTheme(); loadPerfumePrices(); loadFlaconData(); loadMarkupPresets(); loadSalesSources(); loadInventory();
    loadBottleStock(); // NEW: Load whole bottles stock
    loadSheetMappings(); // NEW: Load saved mappings
    TASKS = getTasks();
    populateFormOptions(); renderExpenseList(); updateDashboard();

    // Ensure UI shows current key and model
    const apiKeyInput = document.getElementById('apiKeyInput');
    if (apiKeyInput) apiKeyInput.value = localStorage.getItem('gemini_api_key') || '';
    const modelSelect = document.getElementById('geminiModelSelect');
    if (modelSelect) modelSelect.value = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';

    console.log("🚀 CRM Loaded: Standard Script Architecture");
});


// ==========================================
//  GOOGLE SHEETS INTEGRATION
// ==========================================
let SHEET_MAPPINGS = {}; // Stores "Sheet Name" -> "DB Name"

function loadSheetMappings() {
    SHEET_MAPPINGS = JSON.parse(localStorage.getItem('perfume_sheet_mappings') || '{}');

    // Restore last sync time display
    const last = localStorage.getItem('last_sheet_sync');
    const el = document.getElementById('lastSyncTime');
    if (el && last) el.textContent = `Остання синхронізація: ${last}`;

    // Restore auto-sync checkbox state
    const autoSync = localStorage.getItem('sheet_auto_sync') === 'true';
    const cb = document.getElementById('autoSyncOnLoad');
    if (cb) cb.checked = autoSync;

    // Auto-sync if enabled
    if (autoSync && document.getElementById('sheetUrl')) {
        setTimeout(() => syncWithGoogleSheet(), 2000); // small delay so UI loads first
    }
}

window.toggleAutoSync = function (enabled) {
    localStorage.setItem('sheet_auto_sync', enabled ? 'true' : 'false');
    showToast(enabled ? '🔄 Авто-синхронізація увімкнена' : '⏸ Авто-синхронізація вимкнена', 'success');
};

function saveSheetMappings() {
    localStorage.setItem('perfume_sheet_mappings', JSON.stringify(SHEET_MAPPINGS));
}

window.syncWithGoogleSheet = async function () {
    const url = document.getElementById('sheetUrl').value.trim();
    if (!url) { showToast("❌ Введіть URL таблиці", "error"); return; }

    const btn = document.querySelector('button[onclick="syncWithGoogleSheet()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Завантаження...';
    btn.disabled = true;

    // Use CORS proxies (needed when running from file://)
    const corsProxies = [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url='
    ];

    let csvText = null;

    // Try each proxy in order
    for (const proxy of corsProxies) {
        try {
            const proxyUrl = proxy + encodeURIComponent(url);
            const response = await fetch(proxyUrl);
            if (response.ok) {
                csvText = await response.text();
                break;
            }
        } catch (e) {
            console.warn(`Proxy ${proxy} failed:`, e.message);
        }
    }

    btn.innerHTML = originalText;
    btn.disabled = false;

    if (csvText) {
        processSheetData(csvText);
        // Record last sync time
        const now = new Date().toLocaleString('uk-UA');
        localStorage.setItem('last_sheet_sync', now);
        const el = document.getElementById('lastSyncTime');
        if (el) el.textContent = `Остання синхронізація: ${now}`;
    } else {
        // Show manual paste area as fallback
        showToast("⚠️ Не вдалося завантажити автоматично. Вставте CSV вручну.", "warning");
        showManualCsvPaste();
    }
};

function showManualCsvPaste() {
    const area = document.getElementById('reconciliationArea');
    area.style.display = 'block';
    area.innerHTML = `
        <h4 style="color: var(--warning);">📋 Ручне вставлення CSV</h4>
        <p style="font-size:0.85rem; color:var(--text-muted);">
            Відкрийте Google Таблицю → <strong>Файл → Завантажити → CSV</strong> → відкрийте файл, виділіть все (Ctrl+A), скопіюйте та вставте нижче:
        </p>
        <textarea id="manualCsvInput" class="form-control" style="min-height:120px; font-size:0.8rem; font-family:monospace;" placeholder="Вставте CSV дані тут..."></textarea>
        <button class="btn-primary" style="margin-top:10px;" onclick="processManualCsv()">
            <i class="fa-solid fa-check"></i> Обробити МЛ
        </button>
        <button class="btn-warning" style="margin-top:10px; margin-left: 10px;" onclick="processManualBottleCsv()">
            <i class="fa-solid fa-check"></i> Обробити Флакони
        </button>
    `;
}

window.processManualBottleCsv = function () {
    const csvText = document.getElementById('manualCsvInput').value.trim();
    if (!csvText) { showToast("❌ Вставте дані CSV", "error"); return; }
    processBottleSheetData(csvText);
};

window.syncBottlesFromGoogleSheets = async function () {
    const url = document.getElementById('bottleSheetUrl').value.trim();
    if (!url) { showToast("❌ Введіть URL таблиці флаконів", "error"); return; }

    const btn = document.querySelector('button[onclick="syncBottlesFromGoogleSheets()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Схрещуємо...';
    btn.disabled = true;

    const corsProxies = [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url='
    ];

    let csvText = null;
    for (const proxy of corsProxies) {
        try {
            const proxyUrl = proxy + encodeURIComponent(url);
            const response = await fetch(proxyUrl);
            if (response.ok) {
                csvText = await response.text();
                break;
            }
        } catch (e) {
            console.warn(`Proxy ${proxy} failed:`, e.message);
        }
    }

    btn.innerHTML = originalText;
    btn.disabled = false;

    if (csvText) {
        processBottleSheetData(csvText);
        showToast("✅ Флакони успішно синхронізовано!", "success");
    } else {
        showToast("⚠️ Не вдалося завантажити автоматично. Вставте CSV вручну.", "warning");
        showManualCsvPaste();
    }
};

function processBottleSheetData(csvText) {
    const rows = parseCSV(csvText);
    let updatedCount = 0;

    // Rows look like: Brand+Name (Col A), Quantity (Col B)
    // We clear current BOTTLE_STOCK to avoid stale data? 
    // Or we update? User said "sync", so let's overwrite for clean state.
    const newBottleStock = {};

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2) continue;

        const fullName = row[0].trim();
        const qtyRaw = row[1].trim();
        const qty = parseInt(qtyRaw, 10);

        if (!fullName || isNaN(qty) || qty <= 0) continue;

        // Try to find a matching perfume in our DB
        // 1. Direct match
        let linkedPerfume = null;
        if (PERFUME_PRICES[fullName]) {
            linkedPerfume = fullName;
        } else {
            // 2. Fuzzy match - check if any DB perfume name is part of the sheet name or vice versa
            const dbNames = Object.keys(PERFUME_PRICES);
            const lowerFullName = fullName.toLowerCase();
            linkedPerfume = dbNames.find(dbName =>
                lowerFullName.includes(dbName.toLowerCase()) ||
                dbName.toLowerCase().includes(lowerFullName)
            );
        }

        newBottleStock[fullName] = {
            qty: qty,
            linkedPerfume: linkedPerfume || "Невідомий парфум"
        };
        updatedCount++;
    }

    BOTTLE_STOCK = newBottleStock;
    saveBottleStock();
    renderBottleList();
    renderOrderList(); // Update warnings if order exists
}

window.processManualCsv = function () {
    const csvText = document.getElementById('manualCsvInput').value.trim();
    if (!csvText) { showToast("❌ Вставте дані CSV", "error"); return; }
    // Restore reconciliation area to normal (will be overwritten by processSheetData)
    document.getElementById('reconciliationArea').innerHTML = `
        <h4 style="color: var(--warning);"><i class="fa-solid fa-exclamation-triangle"></i> Незнайдені позиції (<span id="reconcileCount">0</span>)</h4>
        <p style="font-size: 0.85rem; color: var(--text-muted);">Ці товари є в таблиці, але відсутні в базі CRM. Оберіть дію:</p>
        <div class="table-container" style="max-height: 300px; overflow-y: auto;">
            <table class="table" id="reconcileTable">
                <thead><tr><th>Назва з Таблиці</th><th>Залишок</th><th>Дія</th></tr></thead>
                <tbody></tbody>
            </table>
        </div>
    `;
    processSheetData(csvText);
};

// =====================================================
//  SMART MATCHING HELPERS
// =====================================================

/**
 * Normalizes a perfume name for comparison:
 * - Lowercase
 * - Removes common fragrance suffixes (EDP, EDT, Parfum, etc.)
 * - Removes trailing/leading whitespace
 */
function normalizePerfumeName(name) {
    return name
        .toLowerCase()
        .replace(/\b(edp|edt|edc|eau de parfum|eau de toilette|eau de cologne|parfum|perfume|cologne|extrait|extract|intense|concentree?|concentrée?)\b/gi, '')
        .replace(/\b(20\d{2}|19\d{2})\b/g, '') // Remove years like 2023, 2024
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculates bigram similarity between two strings (Dice coefficient).
 * Returns a score from 0 (no match) to 1 (identical).
 */
function calculateSimilarity(a, b) {
    if (a === b) return 1.0;
    if (a.length < 2 || b.length < 2) return 0.0;

    const getBigrams = (str) => {
        const bigrams = new Set();
        for (let i = 0; i < str.length - 1; i++) bigrams.add(str.substring(i, i + 2));
        return bigrams;
    };

    const bigramsA = getBigrams(a);
    const bigramsB = getBigrams(b);

    let intersection = 0;
    bigramsA.forEach(bg => { if (bigramsB.has(bg)) intersection++; });

    return (2.0 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Finds the best matching CRM perfume for a given sheet name.
 * Returns: { match: string|null, score: number, candidates: [{name, score}] }
 * - match + score >= 0.75 → high confidence auto-match
 * - candidates → top 3 for display when score < 0.75
 */
function findBestMatch(sheetName, dbNames) {
    const normSheet = normalizePerfumeName(sheetName);

    let bestMatch = null;
    let bestScore = 0;
    const scored = [];

    for (const dbName of dbNames) {
        const normDb = normalizePerfumeName(dbName);

        // Score: exact normalized match gets 1.0
        // Partial containment gets 0.85
        // Bigram similarity otherwise
        let score = 0;
        if (normSheet === normDb) {
            score = 1.0;
        } else if (normSheet.includes(normDb) || normDb.includes(normSheet)) {
            // Containment score: penalize based on length difference
            const lenRatio = Math.min(normSheet.length, normDb.length) / Math.max(normSheet.length, normDb.length);
            score = 0.80 + (0.15 * lenRatio);
        } else {
            score = calculateSimilarity(normSheet, normDb);
        }

        scored.push({ name: dbName, score });
        if (score > bestScore) {
            bestScore = score;
            bestMatch = dbName;
        }
    }

    // Sort candidates by score descending, take top 3
    const candidates = scored
        .filter(c => c.score > 0.2) // Only relevant ones
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    return {
        match: bestScore >= 0.75 ? bestMatch : null,
        score: bestScore,
        candidates
    };
}
// =====================================================

function processSheetData(csvText) {
    const rows = parseCSV(csvText);
    const unmatchedItems = [];
    let updatedCount = 0;
    let autoMatchedCount = 0;
    const dbNames = Object.keys(PERFUME_PRICES);

    // Skip header (row 0)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 3) continue; // Skip empty/malformed rows

        const brand = row[0].trim();
        const name = row[1].trim();
        const stockRaw = row[2].trim();

        if (!brand || !name) continue;

        // Construct Full Name: "Brand Name"
        const sheetFullName = `${brand} ${name}`;

        // Parse Stock: "56,5" -> 56.5
        const stockVal = parseFloat(stockRaw.replace(',', '.'));

        // --- STEP 1: Check saved manual mapping ---
        if (SHEET_MAPPINGS[sheetFullName]) {
            const mappedName = SHEET_MAPPINGS[sheetFullName];
            PERFUME_STOCK[mappedName] = (!isNaN(stockVal) && stockVal > 0) ? stockVal : 0;
            updatedCount++;
            continue;
        }

        // --- STEP 2: Direct match ---
        if (PERFUME_PRICES[sheetFullName]) {
            PERFUME_STOCK[sheetFullName] = (!isNaN(stockVal) && stockVal > 0) ? stockVal : 0;
            updatedCount++;
            continue;
        }

        // --- STEP 3: Smart matching (normalize + bigram) ---
        const { match, score, candidates } = findBestMatch(sheetFullName, dbNames);

        if (match && score >= 0.75) {
            // High confidence auto-match → apply automatically and remember mapping
            PERFUME_STOCK[match] = (!isNaN(stockVal) && stockVal > 0) ? stockVal : 0;
            SHEET_MAPPINGS[sheetFullName] = match;
            updatedCount++;
            autoMatchedCount++;
        } else {
            // Low confidence → show in reconciliation UI with candidates
            unmatchedItems.push({ sheetName: sheetFullName, stock: stockVal, candidates });
        }
    }

    saveInventory();
    saveSheetMappings();
    renderInventoryList();
    updateDashboard();

    if (unmatchedItems.length > 0) {
        showReconciliationUI(unmatchedItems);
        const autoMsg = autoMatchedCount > 0 ? ` (авто-знайдено: ${autoMatchedCount})` : '';
        showToast(`⚠️ Оновлено: ${updatedCount}${autoMsg}. Потребує уточнення: ${unmatchedItems.length}`, "warning");
    } else {
        document.getElementById('reconciliationArea').style.display = 'none';
        const autoMsg = autoMatchedCount > 0 ? ` (авто-матч: ${autoMatchedCount})` : '';
        showToast(`✅ Синхронізовано! Оновлено: ${updatedCount}${autoMsg}`, "success");
    }
}

function parseCSV(text) {
    // Simple CSV parser handling quotes
    const result = [];
    let row = [];
    let inQuote = false;
    let currentToken = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuote && nextChar === '"') {
                currentToken += '"';
                i++; // Skip escaped quote
            } else {
                inQuote = !inQuote;
            }
        } else if (char === ',' && !inQuote) {
            row.push(currentToken);
            currentToken = '';
        } else if ((char === '\r' || char === '\n') && !inQuote) {
            if (currentToken || row.length > 0) row.push(currentToken);
            if (row.length > 0) result.push(row);
            row = [];
            currentToken = '';
            if (char === '\r' && nextChar === '\n') i++;
        } else {
            currentToken += char;
        }
    }
    if (currentToken || row.length > 0) row.push(currentToken);
    if (row.length > 0) result.push(row);
    return result;
}

function showReconciliationUI(items) {
    const area = document.getElementById('reconciliationArea');
    const tbody = document.getElementById('reconcileTable').querySelector('tbody');
    const countSpan = document.getElementById('reconcileCount');

    area.style.display = 'block';
    countSpan.textContent = items.length;
    tbody.innerHTML = '';

    items.forEach((item, index) => {
        const rowId = `rec-row-${index}`;
        const safeSheetName = item.sheetName.replace(/'/g, "\\'");
        const candidates = item.candidates || [];

        // Build candidates HTML (top-3 suggestions with % score)
        let candidatesHtml = '';
        if (candidates.length > 0) {
            candidatesHtml = `
                <div style="margin-bottom:6px; font-size:0.78rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">🤖 Можливо це:</div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    ${candidates.map(c => `
                        <button class="btn-sm" style="
                            background: linear-gradient(135deg, rgba(124,58,237,0.08), rgba(16,185,129,0.06));
                            border: 1px solid rgba(124,58,237,0.25);
                            color: var(--text);
                            text-align:left;
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            padding: 6px 10px;
                            border-radius:6px;
                            cursor:pointer;
                            transition: all 0.2s;
                        " 
                        onmouseover="this.style.borderColor='var(--primary)'; this.style.background='rgba(124,58,237,0.15)'"
                        onmouseout="this.style.borderColor='rgba(124,58,237,0.25)'; this.style.background='linear-gradient(135deg, rgba(124,58,237,0.08), rgba(16,185,129,0.06))'"
                        onclick="applyAutoMatch('${safeSheetName}', '${c.name.replace(/'/g, "\\'")}'  , ${item.stock}, '${rowId}')">
                            <span><i class="fa-solid fa-check-circle" style="color:var(--secondary); margin-right:5px;"></i>${c.name}</span>
                            <span style="
                                background: ${c.score >= 0.6 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'};
                                color: ${c.score >= 0.6 ? 'var(--secondary)' : 'var(--warning)'};
                                border-radius:4px; padding:2px 7px; font-size:0.75rem; font-weight:700;
                            ">${Math.round(c.score * 100)}%</span>
                        </button>
                    `).join('')}
                </div>
            `;
        }

        tbody.innerHTML += `
            <tr id="${rowId}">
                <td>
                    <strong>${item.sheetName}</strong>
                </td>
                <td>${!isNaN(item.stock) ? item.stock + ' мл' : '—'}</td>
                <td style="min-width:220px;">
                    ${candidatesHtml}
                    <div style="display:flex; gap:5px; margin-top:${candidates.length > 0 ? '8px' : '0'}; padding-top:${candidates.length > 0 ? '8px' : '0'}; ${candidates.length > 0 ? 'border-top:1px dashed var(--border);' : ''}">
                        <button class="btn-sm btn-success" onclick="createFromSheet('${safeSheetName}', ${item.stock}, '${rowId}')" title="Створити новий парфум з цією назвою">
                            <i class="fa-solid fa-plus"></i> Новий
                        </button>
                        <button class="btn-sm btn-secondary" onclick="showMapSelector('${safeSheetName}', ${item.stock}, '${rowId}')" title="Вибрати зі списку вручну">
                            <i class="fa-solid fa-link"></i> Вибрати
                        </button>
                        <button class="btn-sm" style="background:var(--bg-input); color:var(--text-muted); border:1px solid var(--border);" onclick="skipReconcileRow('${rowId}')" title="Пропустити цю позицію">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

window.createFromSheet = function (name, stock, rowId) {
    // Open admin form pre-filled
    document.getElementById('adminPerfumeName').value = name;
    document.getElementById('adminBasePrice').value = ''; // User must fill
    document.getElementById('adminPerfumeName').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('adminPerfumeName').focus();

    // Auto-save stock to temp so when user clicks "Save" we can apply it? 
    // Actually, "AddOrUpdatePerfume" handles stock init.
    // We can pre-set the stock so it saves?
    // Let's just create it directly with default params to save time?
    // No, user needs to set price.

    showToast("📝 Заповніть ціну та натисніть 'Зберегти'", "info");

    // We remove the row effectively "handling" it? 
    // Or we wait until they save? 
    // Let's add a one-time listener or just simpler:
    // Update global stock variable so when 'Save' is called, it persists?
    PERFUME_STOCK[name] = stock;
    // But 'Save' creates entry in PRICES.

    // Visual feedback
    document.getElementById(rowId).style.opacity = '0.5';
    document.getElementById(rowId).style.pointerEvents = 'none';
};

window.showMapSelector = function (sheetName, stock, rowId) {
    const existingNames = Object.keys(PERFUME_PRICES).sort();
    let options = `<option value="">-- Оберіть зі списку --</option>`;
    existingNames.forEach(n => options += `<option value="${n}">${n}</option>`);

    const row = document.getElementById(rowId);
    const cell = row.cells[2];

    cell.innerHTML = `
        <select class="form-control" style="font-size:0.8rem;" onchange="applyMapping('${sheetName.replace(/'/g, "\\'")}', this.value, ${stock}, '${rowId}')">
            ${options}
        </select>
        <button class="btn-sm btn-secondary" style="margin-top:5px;" onclick="skipReconcileRow('${rowId}')">Скасувати</button>
    `;
};

window.applyMapping = function (sheetName, dbName, stock, rowId) {
    if (!dbName) return;

    // Save Binding
    SHEET_MAPPINGS[sheetName] = dbName;
    saveSheetMappings();

    // Update Stock
    PERFUME_STOCK[dbName] = (!isNaN(stock) && stock > 0) ? stock : 0;
    saveInventory();
    renderInventoryList();
    updateDashboard();

    // Remove Row
    _removeReconcileRow(rowId);

    showToast(`🔗 Зв'язано: ${sheetName} → ${dbName}`, "success");
};

/**
 * Called when user clicks one of the smart AI-suggested candidates.
 * Same behavior as applyMapping but with a slightly different toast.
 */
window.applyAutoMatch = function (sheetName, dbName, stock, rowId) {
    if (!dbName) return;

    SHEET_MAPPINGS[sheetName] = dbName;
    saveSheetMappings();

    PERFUME_STOCK[dbName] = (!isNaN(stock) && stock > 0) ? stock : 0;
    saveInventory();
    renderInventoryList();
    updateDashboard();

    _removeReconcileRow(rowId);

    showToast(`✅ "${sheetName}" → "${dbName}" (збережено)`, "success");
};

/** Skip a reconciliation row without doing anything */
window.skipReconcileRow = function (rowId) {
    _removeReconcileRow(rowId);
    showToast('⏭️ Позицію пропущено', 'primary');
};

function _removeReconcileRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();

    const countSpan = document.getElementById('reconcileCount');
    if (countSpan) {
        const remaining = parseInt(countSpan.textContent) - 1;
        countSpan.textContent = remaining;
        if (remaining <= 0) {
            document.getElementById('reconciliationArea').style.display = 'none';
        }
    }
}

window.cancelMap = function (sheetName, stock, rowId) {
    // Re-render original buttons
    const row = document.getElementById(rowId);
    row.cells[2].innerHTML = `
        <div style="display:flex; gap:5px; flex-direction:column;">
            <button class="btn-sm btn-success" onclick="createFromSheet('${sheetName.replace(/'/g, "\\'")}', ${stock}, '${rowId}')">
                <i class="fa-solid fa-plus"></i> Створити
            </button>
            <button class="btn-sm btn-secondary" onclick="showMapSelector('${sheetName.replace(/'/g, "\\'")}', ${stock}, '${rowId}')">
                <i class="fa-solid fa-link"></i> Зв'язати
            </button>
        </div>
    `;
};
const dashboardBtn = document.querySelector('.nav-btn'); showSection('dashboard', dashboardBtn);
renderOrderList(); updateDashboard();

// --- FAB MENU LOGIC ---
window.toggleFabMenu = function () {
    const menu = document.getElementById('fabMenu');
    const button = document.querySelector('.fab-button');
    menu.classList.toggle('active');
    button.classList.toggle('active');
};

window.fabAction = function (action) {
    toggleFabMenu(); // Close menu

    switch (action) {
        case 'order':
            showSection('multi-calculator', document.querySelectorAll('.nav-btn')[1]);
            setTimeout(() => document.getElementById('orderPerfumeName')?.focus(), 300);
            break;
        case 'scan':
            showSection('admin-panel', document.querySelectorAll('.nav-btn')[6]);
            setTimeout(() => {
                const scanInput = document.getElementById('inventoryBarcodeScan');
                if (scanInput) {
                    scanInput.focus();
                    scanInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
            break;
        case 'task':
            showSection('tasks', document.querySelectorAll('.nav-btn')[3]);
            switchTaskTab('manual');
            setTimeout(() => document.getElementById('manualTaskInput')?.focus(), 300);
            break;
    }
};

// Close FAB menu when clicking outside
document.addEventListener('click', (e) => {
    const fabContainer = document.querySelector('.fab-container');
    const fabMenu = document.getElementById('fabMenu');
    if (fabMenu && fabContainer && !fabContainer.contains(e.target)) {
        fabMenu.classList.remove('active');
        document.querySelector('.fab-button')?.classList.remove('active');
    }
});

// --- MOBILE TOUCH GESTURES ---
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isPulling = false;
let pullDistance = 0;

// Pull-to-refresh
document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    if (window.scrollY === 0) {
        isPulling = true;
    }
});

document.addEventListener('touchmove', (e) => {
    if (!isPulling) return;

    const touchY = e.touches[0].clientY;
    pullDistance = touchY - touchStartY;

    if (pullDistance > 0 && pullDistance < 100) {
        // Visual feedback for pull-to-refresh
        const indicator = document.querySelector('.ptr-indicator');
        if (!indicator) {
            const div = document.createElement('div');
            div.className = 'ptr-indicator';
            div.innerHTML = '<i class="fa-solid fa-rotate"></i>';
            document.body.appendChild(div);
        }
        const ind = document.querySelector('.ptr-indicator');
        if (ind) {
            ind.style.transform = `translateX(-50%) translateY(${pullDistance}px) rotate(${pullDistance * 3}deg)`;
            ind.style.opacity = Math.min(pullDistance / 80, 1);
        }
    }
});

document.addEventListener('touchend', (e) => {
    if (isPulling && pullDistance > 80) {
        // Trigger refresh
        if (document.querySelector('.content-section.active')?.id === 'dashboard') {
            updateDashboard();
            showToast("🔄 Оновлено!", "success");
        }
    }

    // Reset
    isPulling = false;
    pullDistance = 0;
    const indicator = document.querySelector('.ptr-indicator');
    if (indicator) {
        indicator.style.transform = 'translateX(-50%) translateY(0) rotate(0)';
        indicator.style.opacity = '0';
    }
});

// Swipe-to-delete for table rows (orders, transactions)
let swipeElement = null;
let swipeStartX = 0;

document.addEventListener('touchstart', (e) => {
    const target = e.target.closest('tr[data-swipeable]');
    if (target) {
        swipeElement = target;
        swipeStartX = e.touches[0].clientX;
    }
});

document.addEventListener('touchmove', (e) => {
    if (!swipeElement) return;

    const touchX = e.touches[0].clientX;
    const diff = touchX - swipeStartX;

    if (diff < -50) {
        swipeElement.style.transform = `translateX(${Math.max(diff, -100)}px)`;
        swipeElement.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
    }
});

document.addEventListener('touchend', (e) => {
    if (!swipeElement) return;

    const translate = swipeElement.style.transform;
    const match = translate.match(/translateX\\((-?\\d+)px\\)/);
    const distance = match ? parseInt(match[1]) : 0;

    if (distance < -70) {
        // Delete action
        const deleteBtn = swipeElement.querySelector('button[onclick*="deleteOrder"], button[onclick*="deleteTransaction"]');
        if (deleteBtn && confirm('Видалити цей запис?')) {
            deleteBtn.click();
        }
    }

    // Reset
    swipeElement.style.transform = '';
    swipeElement.style.backgroundColor = '';
    swipeElement = null;
});

// --- PUSH NOTIFICATIONS ---
let notificationPermission = 'default';

// Request notification permission
window.requestNotificationPermission = async function () {
    if (!('Notification' in window)) {
        showToast("❌ Ваш браузер не підтримує нотифікації", "error");
        return false;
    }

    if (Notification.permission === 'granted') {
        showToast("✅ Нотифікації вже дозволені", "success");
        return true;
    }

    const permission = await Notification.requestPermission();
    notificationPermission = permission;

    if (permission === 'granted') {
        showToast("✅ Нотифікації увімкнено!", "success");
        scheduleNotificationChecks();
        return true;
    } else {
        showToast("❌ Нотифікації заблоковані", "error");
        return false;
    }
};

// Show local notification
function showLocalNotification(title, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            icon: './icon-192.png',
            badge: './icon-192.png',
            vibrate: [200, 100, 200],
            ...options
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
}

// Check for low stock and send alerts
function checkLowStockAlerts() {
    const threshold = 30; // мл
    const lowStockItems = Object.entries(PERFUME_STOCK)
        .filter(([name, stock]) => stock > 0 && stock < threshold);

    if (lowStockItems.length > 0 && Notification.permission === 'granted') {
        const names = lowStockItems.map(([name]) => name).slice(0, 3).join(', ');
        showLocalNotification('⚠️ Низький залишок', {
            body: `Закінчується: ${names}${lowStockItems.length > 3 ? ` та інші (${lowStockItems.length - 3})` : ''}`,
            tag: 'low-stock'
        });
    }
}

// Check for pending tasks
function checkTaskReminders() {
    const now = new Date();
    const pendingTasks = TASKS.filter(t => !t.completed);

    if (pendingTasks.length > 0 && Notification.permission === 'granted') {
        // Check if there are tasks from today
        const todayTasks = pendingTasks.filter(t => {
            const taskDate = new Date(t.timestamp);
            return taskDate.toDateString() === now.toDateString();
        });

        if (todayTasks.length > 0) {
            showLocalNotification('📋 Нагадування про задачі', {
                body: `У вас ${todayTasks.length} невиконаних задач на сьогодні`,
                tag: 'task-reminder'
            });
        }
    }
}

// Schedule periodic checks
function scheduleNotificationChecks() {
    // Check every hour
    setInterval(() => {
        checkLowStockAlerts();
        checkTaskReminders();
    }, 60 * 60 * 1000); // 1 hour

    // Initial check after 5 seconds
    setTimeout(() => {
        checkLowStockAlerts();
        checkTaskReminders();
    }, 5000);
}

// Auto-request permission if not set (only once)
if (localStorage.getItem('notification_prompted') !== 'true') {
    setTimeout(() => {
        if (Notification.permission === 'default') {
            const ask = confirm('Увімкнути нотифікації для нагадувань про задачі та низькі залишки?');
            if (ask) {
                requestNotificationPermission();
            }
            localStorage.setItem('notification_prompted', 'true');
        } else if (Notification.permission === 'granted') {
            scheduleNotificationChecks();
        }
    }, 10000); // Show after 10 seconds
} else if (Notification.permission === 'granted') {
    scheduleNotificationChecks();
}

// --- PWA SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

