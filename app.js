const CONFIG_KEYS = {
    PRICES: 'perfumePrices',
    FLACONS: 'flaconCosts',
    VOLUMES: 'flaconVolumes',
    MARKUPS: 'markupPresets',
    SOURCES: 'salesSources',
    TRANSACTIONS: 'transactions',
    EXPENSES: 'expenses',
    INVENTORY: 'perfumeStock',
    TASKS: 'userTasks',
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
let MARKUP_PRESETS = { 'Базова': 0.15, 'Стандарт': 0.20, 'Преміум': 0.25 };
let SALES_SOURCES = ['Instagram', 'Viber', 'Telegram', 'OLX', 'Особиста зустріч'];
let PERFUME_STOCK = {};
let CURRENT_ORDER_LIST = [];
let TASKS = [];
let IS_EDITING_ORDER = null;

// --- CHARTS ---
let salesChartInstance = null;
let topProductsChartInstance = null;


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
        showToast(`🌟 Клієнт: ${stats.level} (Знижка ${(stats.discount * 100).toFixed(0)}%)`, 'success');
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
function saveInventory() { saveToLocalStorage(CONFIG_KEYS.INVENTORY, PERFUME_STOCK); }
function getTasks() { return getFromLocalStorage(CONFIG_KEYS.TASKS, []); }
function saveTasks(tasks) { saveToLocalStorage(CONFIG_KEYS.TASKS, tasks); }
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

// --- TASK LOGIC ---
function addTask(description, type, relatedId, clientName, phone, city, postOffice, fullName, comments) {
    const tasks = getTasks();
    tasks.push({
        id: Date.now() + Math.random(),
        timestamp: Date.now(),
        description: description,
        type: type,
        relatedId: relatedId,
        clientName: clientName,
        isCompleted: false,
        phone: phone || '---',
        city: city || '---',
        postOffice: postOffice || '---',
        fullName: fullName || clientName || '---',
        comments: comments || '---'
    });
    saveTasks(tasks);
    showToast("✅ Завдання створено!", "success");
}
window.deleteTaskByRelatedId = function (relatedId) {
    saveTasks(getTasks().filter(t => t.relatedId !== relatedId));
}
window.completeTask = function (id) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === id);
    if (task) { task.isCompleted = true; saveTasks(tasks); renderTasks(); showToast("✅ Виконано!", "success"); }
}
window.deleteTask = function (id) {
    saveTasks(getTasks().filter(t => t.id !== id));
    renderTasks();
    showToast("🗑️ Видалено.", "error");
}

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
    if (!name || !basePrice) { showToast("Заповніть назву та ціну", "error"); return; }
    PERFUME_PRICES[name] = {
        basePrice: parseFloat(basePrice),
        discountVolume: parseFloat(discountVolume) || 5,
        discountPrice: parseFloat(discountPrice) || null,
        barcode: barcode || null
    };
    if (PERFUME_STOCK[name] === undefined) PERFUME_STOCK[name] = 0;
    savePerfumePrices(); saveInventory(); renderPerfumeList(); populateFormOptions();
    showToast(`Збережено: ${name}`, "success");
    document.getElementById('adminPerfumeName').value = '';
    document.getElementById('adminBasePrice').value = '';
    document.getElementById('adminBarcode').value = '';
}
window.editPerfume = function (name) {
    const pData = PERFUME_PRICES[name];
    if (!pData) return;
    document.getElementById('adminPerfumeName').value = name;
    document.getElementById('adminBasePrice').value = pData.basePrice;
    document.getElementById('adminDiscountVolume').value = pData.discountVolume || 5;
    document.getElementById('adminDiscountPrice').value = pData.discountPrice || '';
    document.getElementById('adminBarcode').value = pData.barcode || '';
    document.getElementById('adminPerfumeName').focus();
}
window.renderPerfumeList = function () {
    const tbody = document.getElementById('perfume-list-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    const search = document.getElementById('perfumeSearchInput').value.toLowerCase();
    Object.keys(PERFUME_PRICES).sort().forEach(name => {
        const pData = PERFUME_PRICES[name];
        if (search && !name.toLowerCase().includes(search) && (!pData.barcode || !pData.barcode.includes(search))) return;
        const barcodeDisplay = pData.barcode ? `<span style="font-size:0.75rem; color:var(--text-muted); display:block;">Код: ${pData.barcode}</span>` : '';
        tbody.innerHTML += `<tr><td><span class="text-bold">${name}</span>${barcodeDisplay}</td><td class="text-right">${pData.basePrice.toFixed(2)} ₴</td><td class="text-right"><button class="btn-sm btn-warning" onclick="editPerfume('${name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-edit"></i></button> <button class="btn-sm btn-danger" onclick="deletePerfume('${name.replace(/'/g, "\\'")}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    });
}
window.deletePerfume = function (name) {
    if (confirm('Видалити?')) { delete PERFUME_PRICES[name]; delete PERFUME_STOCK[name]; savePerfumePrices(); saveInventory(); renderPerfumeList(); renderInventoryList(); populateFormOptions(); }
}
window.renderInventoryList = function () {
    const tbody = document.getElementById('inventory-list-table').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    let lowStockCount = 0;
    Object.keys(PERFUME_STOCK).sort().forEach(name => {
        const stock = PERFUME_STOCK[name];
        if (stock <= 100) lowStockCount++;
        tbody.innerHTML += `<tr><td>${name}</td><td class="text-right" ${stock <= 100 ? 'style="color:var(--danger);font-weight:bold;"' : ''}>${stock} мл</td><td class="text-right"><button class="btn-sm btn-danger" onclick="PERFUME_STOCK['${name.replace(/'/g, "\\'")}']=0;saveInventory();renderInventoryList();updateDashboard();"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    });
    const dashLowStock = document.getElementById('dash-low-stock-count-value');
    if (dashLowStock) dashLowStock.textContent = lowStockCount;
}

// --- NAVIGATION ---
function showSection(sectionId, element) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (element) { document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active')); element.classList.add('active'); }
    if (sectionId === 'multi-calculator') renderOrderList();
    if (sectionId === 'transactions') renderTransactionHistory();
    if (sectionId === 'admin-panel') { renderPerfumeList(); renderInventoryList(); }
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
}

// --- ORDER ACTIONS ---
window.addSale = function () {
    const name = document.getElementById('perfumeName').value.trim();
    const volume = parseFloat(document.getElementById('flaconVolume').value);
    const markupTier = document.getElementById('saleMarkupTierSingle').value;
    const source = document.getElementById('saleSourceSingle').value;
    const client = document.getElementById('clientNameSingle').value.trim() || 'Гість';
    const phone = document.getElementById('phoneSingle').value.trim();
    const fullName = document.getElementById('fullNameSingle').value.trim();
    const city = document.getElementById('citySingle').value.trim();
    const postOffice = document.getElementById('postOfficeSingle').value.trim();
    const comments = document.getElementById('commentsSingle').value.trim();
    if (!name || !volume || !source) { showToast("Заповніть поля!", "error"); return; }
    const calc = calculateCost(name, volume, markupTier);
    if (!calc) { showToast("Парфум не знайдено!", "error"); return; }
    const tx = {
        id: Date.now(), timestamp: Date.now(), clientName: client, source: source, markupTier: markupTier, perfumeName: name, quantityML: volume,
        revenue: calc.revenue, profit: calc.profit, costTotal: calc.costTotal
    };
    const txs = getTransactions(); txs.push(tx); saveTransactions(txs);
    PERFUME_STOCK[name] = (PERFUME_STOCK[name] || 0) - volume; saveInventory();
    addTask(`Продаж: ${name} (${volume} мл)`, 'sale', tx.id, client, phone, city, postOffice, fullName, comments);
    showToast(`Продано! Прибуток: ${calc.profit.toFixed(0)} ₴`, "success");
    document.getElementById('perfumeName').value = ''; updateDashboard();
}

window.addItemToOrder = function () {
    const name = document.getElementById('orderPerfumeName').value.trim();
    const volume = parseFloat(document.getElementById('orderFlaconVolume').value);
    const markup = document.getElementById('saleMarkupTierOrder').value;
    if (!name || !volume) return;
    const calc = calculateCost(name, volume, markup);
    if (!calc) return;
    CURRENT_ORDER_LIST.push({ ...calc, name: name, vol: volume, markup: markup });
    renderOrderList(); document.getElementById('orderPerfumeName').value = '';
}
window.removeItemFromOrder = function (index) { CURRENT_ORDER_LIST.splice(index, 1); renderOrderList(); }

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

    // CLEAN ORDER TEXT
    if (CURRENT_ORDER_LIST.length > 0) {
        let text = "Ваше замовлення:\n\n";
        CURRENT_ORDER_LIST.forEach((item, i) => { text += `${i + 1}. ${item.name} (${item.vol} мл) — ${item.revenue.toFixed(0)} грн\n`; });
        text += `\n${MY_DELIVERY_INFO}\n\n`;
        text += `${MY_PAYMENT_INFO}\n\n`;
        text += `До сплати: ${totalRev.toFixed(0)} грн`;
        summaryText.value = text;
    } else { summaryText.value = ''; }
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
    deleteTaskByRelatedId(orderId);
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
    const task = getTasks().find(t => t.relatedId === orderId);
    if (task) {
        document.getElementById('phoneOrder').value = task.phone;
        document.getElementById('fullNameOrder').value = task.fullName;
        document.getElementById('cityOrder').value = task.city;
        document.getElementById('postOfficeOrder').value = task.postOffice;
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
    const newTransactions = CURRENT_ORDER_LIST.map(item => ({
        id: Date.now() + Math.random(), timestamp: Date.now(), clientName: client, source: source, markupTier: markup,
        perfumeName: item.name, quantityML: item.vol, revenue: item.revenue, profit: item.profit, costTotal: item.costTotal,
        ttnNumber: ttn, orderId: orderId
    }));
    txs.push(...newTransactions); saveTransactions(txs);
    let totalVolume = {};
    CURRENT_ORDER_LIST.forEach(item => { totalVolume[item.name] = (totalVolume[item.name] || 0) + item.vol; });
    for (const name in totalVolume) { PERFUME_STOCK[name] = (PERFUME_STOCK[name] || 0) - totalVolume[name]; }
    saveInventory();
    const itemSummary = CURRENT_ORDER_LIST.map(item => `${item.name} (${item.vol}ml)`).join(', ');
    addTask(`Відправка: ${client} - ${itemSummary}`, 'order', orderId, client, phone, city, postOffice, fullName, comments);
    showToast(`✅ Замовлення збережено!`, "success");
    showModalReceipt(CURRENT_ORDER_LIST, total, client, ttn);
    clearOrder(); updateDashboard();
}

// --- DASHBOARD ---
window.updateDashboard = function () {
    const today = new Date().toISOString().split('T')[0];
    const txs = getTransactions();
    const todayTxs = txs.filter(t => new Date(t.timestamp).toISOString().split('T')[0] === today);
    const rev = todayTxs.reduce((a, b) => a + b.revenue, 0);
    const prof = todayTxs.reduce((a, b) => a + b.profit, 0);
    document.getElementById('dash-revenue').textContent = rev.toFixed(0) + ' ₴';
    document.getElementById('dash-profit').textContent = prof.toFixed(0) + ' ₴';
    document.getElementById('dash-count').textContent = todayTxs.length;
    renderTopProducts(txs);
    renderDashboardCharts(txs);
}
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
    summary.textContent = `Всього: ${totalRev.toFixed(2)} ₴ (Прибуток: ${totalProf.toFixed(2)} ₴)`;
}
window.deleteTx = function (id) {
    if (!confirm("Видалити?")) return;
    const tx = getTransactions().find(t => t.id === id);
    if (tx) { PERFUME_STOCK[tx.perfumeName] = (PERFUME_STOCK[tx.perfumeName] || 0) + tx.quantityML; saveInventory(); }
    saveTransactions(getTransactions().filter(t => t.id !== id));
    renderTransactionHistory(); updateDashboard();
}

window.renderTasks = function () {
    const container = document.getElementById('tasks-list-container');
    const tasks = getTasks().sort((a, b) => b.timestamp - a.timestamp);
    container.innerHTML = '';
    if (tasks.length === 0) { container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Немає активних завдань</p>'; return; }
    tasks.forEach(task => {
        const date = new Date(task.timestamp).toLocaleString();
        const statusClass = task.isCompleted ? 'completed' : '';
        const shippingInfo = `
                    <div style="margin-top:5px; font-size:0.85rem; background:var(--bg-card); padding:8px; border-radius:4px; border:1px solid var(--border);">
                        <div><i class="fa-solid fa-user"></i> ${task.fullName}</div>
                        <div><i class="fa-solid fa-phone"></i> ${task.phone}</div>
                        <div><i class="fa-solid fa-location-dot"></i> ${task.city}, ${task.postOffice}</div>
                        ${task.comments !== '---' && task.comments ? `<div class="task-comment"><i class="fa-solid fa-comment"></i> ${task.comments}</div>` : ''}
                    </div>
                `;
        container.innerHTML += `<div class="task-item ${statusClass}"><div class="task-header"><span class="task-title">${task.type === 'order' ? '📦 Замовлення' : '🛍️ Продаж'}</span><span style="font-size:0.8rem; color:var(--text-muted);">${date}</span></div><div class="task-details">${task.description} ${shippingInfo}</div><div style="margin-top: 10px; display: flex; gap: 10px;">${!task.isCompleted ? `<button class="btn-success btn-sm" onclick="completeTask(${task.id})">Виконано</button>` : ''}<button class="btn-danger btn-sm" onclick="deleteTask(${task.id})"><i class="fa-solid fa-trash"></i></button></div></div>`;
    });
}

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
window.calculateRetailPrice = function () {
    const name = document.getElementById('calcPerfumeName').value; const vol = parseFloat(document.getElementById('calcFlaconVolume').value); const mark = document.getElementById('calcMarkupTier').value;
    const res = calculateCost(name, vol, mark);
    if (res) { document.getElementById('calculatorOutput').innerHTML = `<strong>Ціна: ${res.revenue.toFixed(0)} ₴</strong>`; }
}
window.generatePriceList = function () {
    const markupKey = document.getElementById('priceListMarkup').value; if (!markupKey) return;
    let text = `📅 Прайс-лист (${new Date().toLocaleDateString()})\n\n`;
    Object.keys(PERFUME_PRICES).sort().forEach(name => {
        let line = `🔹 ${name}\n`;
        FLACON_VOLUMES.forEach(vol => { const cost = calculateCost(name, vol, markupKey); if (cost) line += `   ▫️ ${vol} мл — ${cost.revenue.toFixed(0)} грн\n`; });
        text += line + "\n";
    });
    const output = document.getElementById('priceListOutput'); output.value = text; output.select(); document.execCommand("copy"); showToast("Прайс скопійовано!", "success");
}
window.showClientHistory = function () {
    const clientName = document.getElementById('clientSearchInput').value.trim().toLowerCase(); if (!clientName) return;
    const txs = getTransactions().filter(t => t.clientName.toLowerCase().includes(clientName));
    const tbody = document.getElementById('client-history-table').getElementsByTagName('tbody')[0]; tbody.innerHTML = '';

    const stats = getClientStats(clientName); // Use new helper

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

// --- MODAL UTILS ---
function generateReceiptHTML(orderItems, totalRounded, clientName, ttn = null) {
    const total = totalRounded.toFixed(2); const date = new Date().toLocaleDateString('uk-UA');
    const itemsHtml = orderItems.map((item, index) => `<p style="margin: 5px 0; display: flex; justify-content: space-between; font-size: 0.95rem;"><span>${index + 1}. ${item.name} (${item.vol} мл)</span><span class="text-bold">${item.revenue.toFixed(2)} ₴</span></p>`).join('');
    const ttnDisplay = ttn ? `<p style="margin: 10px 0; font-weight: 600;">📦 ТТН: ${ttn}</p>` : '';
    return `<div style="max-width: 300px; margin: 0 auto; padding: 15px; border: 1px dashed var(--border); border-radius: 5px; font-family: monospace; color: var(--text-main);"><h3 style="text-align: center; margin-bottom: 5px; color: var(--primary);">PerfumeFlow</h3><p style="text-align: center; margin-bottom: 15px; border-bottom: 1px dashed var(--border); padding-bottom: 5px; font-size: 0.85rem;">Дата: ${date} | Клієнт: ${clientName}</p>${itemsHtml}${ttnDisplay}<div class="receipt-total">До сплати: ${total} ₴</div><p style="text-align: center; margin-top: 20px; font-size: 0.9rem; color: var(--text-muted);" class="no-print">Дякуємо!</p><div class="no-print admin-buttons-group" style="margin-top: 20px; text-align: center; display: flex; gap: 10px;"><button onclick="window.print()" style="background-color: var(--secondary); flex-grow: 1; color: white; border: none; border-radius: 4px; padding: 8px;">🖨️ Друк</button><button onclick="closeReceiptModal()" style="background-color: var(--text-muted); flex-grow: 1; color: white; border: none; border-radius: 4px; padding: 8px;">Закрити</button></div></div>`;
}
function showModalReceipt(orderItems, totalRounded, clientName, ttn = null) {
    document.getElementById('receiptContent').innerHTML = generateReceiptHTML(orderItems, totalRounded, clientName, ttn);
    document.getElementById('receiptModal').classList.add('active');
}
window.closeReceiptModal = function () { document.getElementById('receiptModal').classList.remove('active'); }

// --- SYNC / EXPORT ---
window.showSyncModal = function () {
    const allData = {}; Object.values(CONFIG_KEYS).forEach(key => allData[key] = JSON.parse(localStorage.getItem(key) || 'null'));
    document.getElementById('syncDataOutput').value = JSON.stringify(allData); document.getElementById('syncModal').classList.add('active');
}
window.closeSyncModal = function () { document.getElementById('syncModal').classList.remove('active'); }
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
            showToast("❌ Помилка читання файлу (Невірний формат)", "error");
        }
    };

    reader.onerror = function () {
        showToast("❌ Помилка завантаження файлу", "error");
    };

    reader.readAsText(fileInput.files[0]);
}

// --- SETTINGS (AI API) ---
window.openSettingsModal = function () { document.getElementById('settingsModal').classList.add('active'); document.getElementById('apiKeyInput').value = localStorage.getItem('openai_api_key') || ''; }
window.closeSettingsModal = function () { document.getElementById('settingsModal').classList.remove('active'); }
window.saveApiKey = function (key) { localStorage.setItem('openai_api_key', key.trim()); showToast("Ключ збережено", "success"); }

// --- AI PARSING ---
window.smartParseAI = async function (mode = 'single') {
    const inputId = mode === 'order' ? 'pasteAreaOrder' : 'pasteArea';
    const text = document.getElementById(inputId).value;
    const apiKey = localStorage.getItem('openai_api_key');

    if (!text) { showToast("⚠️ Спочатку вставте текст!", "warning"); return; }
    if (!apiKey) { showToast("🔑 Спочатку додайте API Key у налаштуваннях!", "error"); openSettingsModal(); return; }

    const btn = document.querySelector(`button[onclick="smartParseAI('${mode === 'single' ? '' : mode}')"]`) || document.querySelector(`button[onclick="smartParseAI()"]`);
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Думаю...';
    btn.disabled = true;

    const perfumesList = Object.keys(PERFUME_PRICES).join(', ');
    const volumesList = FLACON_VOLUMES.join(', ');

    // Enhanced Prompt to handle multiple items
    const prompt = `
        Extract entities from this order text into JSON.
        Text: "${text}"
        
        Lists to match against:
        Perfumes: [${perfumesList}]
        Volumes: [${volumesList}]

        Task:
        1. Extract Client Info (Name, Phone, City, Post Office).
        2. Extract ALL items (Perfume + Volume).
        
        Return JSON ONLY structure:
        {
          "clientName": "string",
          "phone": "string (0XX...)",
          "city": "string",
          "postOffice": "string/number",
          "items": [
            { "perfumeName": "Exact match from Perfumes list", "volume": number (match from Volumes) }
          ]
        }
    `;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const content = data.choices[0].message.content;
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        if (mode === 'single') {
            // SINGLE MODE: Fill inputs only (take first item)
            if (result.clientName) document.getElementById('clientNameSingle').value = result.clientName;
            if (result.phone) document.getElementById('phoneSingle').value = result.phone;
            if (result.city) document.getElementById('citySingle').value = result.city;
            if (result.postOffice) document.getElementById('postOfficeSingle').value = result.postOffice;

            if (result.items && result.items.length > 0) {
                const item = result.items[0];
                if (item.perfumeName && PERFUME_PRICES[item.perfumeName]) document.getElementById('perfumeName').value = item.perfumeName;
                if (item.volume) document.getElementById('flaconVolume').value = item.volume;
            }
        } else {
            // ORDER MODE: Fill Client + Auto-Add Items
            if (result.clientName) document.getElementById('clientNameOrder').value = result.clientName;
            if (result.phone) document.getElementById('phoneOrder').value = result.phone;
            if (result.city) document.getElementById('cityOrder').value = result.city;
            if (result.postOffice) document.getElementById('postOfficeOrder').value = result.postOffice;

            // Auto-adding items to the basket
            if (result.items && result.items.length > 0) {
                let addedCount = 0;
                const markup = document.getElementById('saleMarkupTierOrder').value; // Use selected markup

                result.items.forEach(item => {
                    const pName = item.perfumeName;
                    const vol = item.volume;

                    if (pName && PERFUME_PRICES[pName] && vol) {
                        const calc = calculateCost(pName, vol, markup);
                        if (calc) {
                            CURRENT_ORDER_LIST.push({ ...calc, name: pName, vol: vol, markup: markup });
                            addedCount++;
                        }
                    }
                });

                if (addedCount > 0) {
                    renderOrderList(); // Updates table and Summary Text
                    showToast(`🤖 Додано ${addedCount} позицій у кошик!`, "success");
                } else {
                    showToast("⚠️ Товари розпізнано, але не знайдено у прайсі.", "warning");
                }
            }
        }

        // Trigger loyalty check if client name extracted
        if (result.clientName) {
            const input = mode === 'order' ? document.getElementById('clientNameOrder') : document.getElementById('clientNameSingle');
            checkClientLoyalty(input);
        }

    } catch (err) {
        console.error(err);
        if (err.message.includes("Incorrect API key")) {
            showToast("❌ Невірний API ключ!", "error");
        } else {
            showToast("❌ Помилка AI: " + err.message, "error");
        }
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function renderDashboardCharts(transactions) {
    // 1. Prepare Sales Data (Last 30 Days)
    const daysMap = {};
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        daysMap[dateStr] = 0;
    }

    transactions.forEach(t => {
        const dateStr = new Date(t.timestamp).toISOString().split('T')[0];
        if (daysMap[dateStr] !== undefined) {
            daysMap[dateStr] += t.revenue;
        }
    });

    const salesLabels = Object.keys(daysMap).map(d => d.slice(5)); // MD format
    const salesData = Object.values(daysMap);

    // 2. Prepare Top Products Data
    const productStats = {};
    transactions.forEach(t => {
        productStats[t.perfumeName] = (productStats[t.perfumeName] || 0) + 1;
    });
    const sortedProducts = Object.entries(productStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const prodLabels = sortedProducts.map(([k]) => k);
    const prodData = sortedProducts.map(([, v]) => v);

    // 3. Render Sales Chart
    const ctxSales = document.getElementById('salesChart').getContext('2d');
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctxSales, {
        type: 'line',
        data: {
            labels: salesLabels,
            datasets: [{
                label: 'Виручка (грн)',
                data: salesData,
                borderColor: '#4F46E5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // 4. Render Top Products Chart
    const ctxProd = document.getElementById('topProductsChart').getContext('2d');
    if (topProductsChartInstance) topProductsChartInstance.destroy();
    topProductsChartInstance = new Chart(ctxProd, {
        type: 'doughnut',
        data: {
            labels: prodLabels,
            datasets: [{
                data: prodData,
                backgroundColor: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme(); loadPerfumePrices(); loadFlaconData(); loadMarkupPresets(); loadSalesSources(); loadInventory(); TASKS = getTasks();
    populateFormOptions(); renderExpenseList();
    const dashboardBtn = document.querySelector('.nav-btn'); showSection('dashboard', dashboardBtn);
    renderOrderList(); updateDashboard();
});
