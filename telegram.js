// Telegram Bot API Integration
const TELEGRAM_CONFIG = {
    botToken: localStorage.getItem('telegram_bot_token') || '8297695215:AAHzqkm9e3Q7NgXPQaeb3r2jIF9kiHPW0tc',
    channelId: localStorage.getItem('telegram_channel_id') || '-10023478137496',
    platform: 'telegram'
};

window.setSmmPlatform = function (platform) {
    TELEGRAM_CONFIG.platform = platform;
    document.querySelectorAll('.platform-selector .filter-chip').forEach(el => el.classList.remove('active'));
    document.getElementById(platform === 'telegram' ? 'platform-tg' : 'platform-inst').classList.add('active');

    // Show/Hide relevant buttons
    const isTg = (platform === 'telegram');
    document.getElementById('postTgBtn').style.display = isTg ? 'inline-block' : 'none';
    document.getElementById('copySmmBtn').style.display = isTg ? 'none' : 'inline-block';

    document.getElementById('postCategorizedBtn').style.display = isTg ? 'inline-block' : 'none';
    document.getElementById('copyCategorizedBtn').style.display = isTg ? 'none' : 'inline-block';

    showToast(`🔹 Режим: ${platform.charAt(0).toUpperCase() + platform.slice(1)}`, "info");
}

function saveTelegramConfig() {
    const token = document.getElementById('telegramBotTokenInput').value.trim();
    const channel = document.getElementById('telegramChannelIdInput').value.trim();
    if (token) localStorage.setItem('telegram_bot_token', token);
    if (channel) localStorage.setItem('telegram_channel_id', channel);
    TELEGRAM_CONFIG.botToken = token;
    TELEGRAM_CONFIG.channelId = channel;
    showToast("✅ Telegram налаштування збережено", "success");
}

window.testTelegramConnection = async function () {
    const token = document.getElementById('telegramBotTokenInput').value.trim();
    if (!token) { showToast("⚠️ Введіть Bot Token!", "warning"); return; }

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await response.json();
        if (data.ok) {
            showToast(`✅ Підключено до @${data.result.username}`, "success");
        } else {
            showToast("❌ Помилка: " + data.description, "error");
        }
    } catch (e) {
        showToast("❌ Помилка підключення", "error");
    }
}

window.generateSMMPreview = async function () {
    const perfumeName = document.getElementById('smmPerfumeSelect').value;
    const photoFile = document.getElementById('smmPhotoUpload').files[0];

    if (!perfumeName) { showToast("⚠️ Оберіть парфум!", "warning"); return; }
    if (!photoFile) { showToast("⚠️ Завантажте фото!", "warning"); return; }

    const previewArea = document.getElementById('smmPreviewArea');
    previewArea.innerHTML = '<div style="text-align:center; padding:50px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>AI створює опис...</p></div>';

    try {
        const perfumeData = PERFUME_PRICES[perfumeName];
        const markup = MARKUP_PRESETS['Базова'];

        // Calculate prices for preview
        const p3 = Math.round(perfumeData.basePrice * 1.12 * 3 + FLACON_COSTS[3]);
        const p5 = Math.round(perfumeData.basePrice * 1.12 * 5 + FLACON_COSTS[5]);
        const p10 = Math.round(perfumeData.basePrice * 1.12 * 10 + FLACON_COSTS[10]);

        const isInst = (TELEGRAM_CONFIG.platform === 'instagram');

        let prompt = "";
        if (isInst) {
            prompt = `Ти - SMM менеджер магазину елітної парфумерії. 
Створи КОРОТКИЙ, візуально привабливий опис для INSTAGRAM про аромат "${perfumeName}".

СТИЛЬ: Естетичний, трендовий, з використанням емодзі. 
СТРУКТУРА:
1. Захоплюючий початок.
2. Короткий опис вайбу аромату.
3. Ціни: 3мл - ${p3}грн, 5мл - ${p5}грн, 10мл - ${p10}грн.
4. Заклик написати в Direct.
5. Набір з 10 актуальних хештегів через пробіл (напр: #парфуми #україна #розпив).

Мова: Українська. 
Поверни ТІЛЬКИ текст посту.`;
        } else {
            prompt = `Ти - SMM менеджер магазину елітної парфумерії. 
Створи вишуканий та лаконічний пост для Telegram про аромат "${perfumeName}".

СТИЛЬ: Преміальний, естетичний, з використанням емодзі, але без зайвого тексту.
СТРУКТУРА:
1. Захоплюючий заголовок з назвою.
2. Короткий опис характеру аромату (2 речення).
3. Ціни чітким списком: 3мл - ${p3}грн, 5мл - ${p5}грн, 10мл - ${p10}грн.
4. Заклик до дії.

Мова: Українська. 
ВАЖЛИВО: Текст має бути стислим (до 600 символів)!
Поверни ТІЛЬКИ текст посту.`;
        }

        const caption = await callGemini(prompt);

        // Safety trim and check
        let finalCaption = caption.trim();
        if (finalCaption.length > 1000) {
            finalCaption = finalCaption.substring(0, 997) + "...";
        }

        // Create local preview image URL
        const reader = new FileReader();
        reader.onload = (e) => {
            previewArea.innerHTML = `
                <img src="${e.target.result}" style="width:100%; border-radius:8px; margin-bottom:10px;">
                <div style="white-space:pre-wrap; font-size:0.9rem; line-height:1.4;">${finalCaption}</div>
            `;
            // Store caption globally for posting
            window.currentSMMCaption = finalCaption;
        };
        reader.readAsDataURL(photoFile);

    } catch (e) {
        previewArea.innerHTML = `<p style="color:var(--danger);">❌ Помилка: ${e.message}</p>`;
    }
}

window.postToTelegram = async function () {
    const token = localStorage.getItem('telegram_bot_token');
    const channelId = localStorage.getItem('telegram_channel_id');
    const caption = window.currentSMMCaption;
    const photoFile = document.getElementById('smmPhotoUpload').files[0];

    if (!token || !channelId) { showToast("⚠️ Налаштуйте Telegram Bot!", "warning"); return; }
    if (!caption || !photoFile) { showToast("⚠️ Спочатку згенеруйте превью!", "warning"); return; }

    if (caption.length > 1024) {
        showToast("⚠️ Опис занадто довгий для Telegram (max 1024)! Скоротіть його.", "warning");
        return;
    }

    const btn = event.target;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Публікація...';

    try {
        const formData = new FormData();
        formData.append('chat_id', channelId);
        formData.append('photo', photoFile);
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');

        // Add inline keyboard
        const keyboard = {
            inline_keyboard: [
                [
                    { text: "🛍️ Замовити — @Stascyba", url: "https://t.me/Stascyba" }
                ]
            ]
        };
        formData.append('reply_markup', JSON.stringify(keyboard));

        const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.ok) {
            showToast("🚀 Опубліковано в Telegram!", "success");
        } else {
            showToast("❌ Помилка: " + data.description, "error");
        }
    } catch (e) {
        showToast("❌ Помилка відправки", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-brands fa-telegram"></i> Опублікувати в Telegram';
    }
}

// Auto-Post Top-5 Products
// postCategorizedListToTelegram - Logic for posting themed lists
window.postCategorizedListToTelegram = async function () {
    const token = localStorage.getItem('telegram_bot_token');
    const channelId = localStorage.getItem('telegram_channel_id');
    const category = document.getElementById('smmListCategory')?.value || 'popular';

    if (!token || !channelId) {
        showToast("⚠️ Налаштуйте Telegram Bot!", "warning");
        return;
    }

    const btn = event?.target || document.querySelector('button[onclick="postCategorizedListToTelegram()"]');
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Обробка...';

    try {
        let selectedProducts = [];
        let listTitle = "Наші найкращі аромати";

        if (category === 'popular') {
            // Get top-5 products from transactions
            const txs = getTransactions();
            const productStats = {};
            txs.forEach(t => {
                if (!productStats[t.perfumeName]) {
                    productStats[t.perfumeName] = { vol: 0, count: 0 };
                }
                productStats[t.perfumeName].vol += t.quantityML;
            });
            selectedProducts = Object.entries(productStats)
                .sort(([, a], [, b]) => b.vol - a.vol)
                .slice(0, 5)
                .map(([name]) => name);
            listTitle = "🔥 ТОП-5 НАЙПОПУЛЯРНІШИХ АРОМАТІВ";
        } else {
            // General filtering logic
            const allNames = Object.keys(PERFUME_PRICES);
            let filteredNames = [];

            if (category === 'winter') {
                filteredNames = allNames.filter(name => (PERFUME_PRICES[name].seasons || []).includes('Зима'));
                listTitle = "❄️ 5 НАЙКРАЩИХ ЗИМОВИХ АРОМАТІВ";
            } else if (category === 'summer') {
                filteredNames = allNames.filter(name => (PERFUME_PRICES[name].seasons || []).includes('Літо'));
                listTitle = "☀️ ТОП-5 ЛІТНІХ ПАРФУМІВ";
            } else if (category === 'fresh') {
                filteredNames = allNames.filter(name => {
                    const tags = (PERFUME_PRICES[name].tags || []).map(t => t.toLowerCase());
                    return tags.some(t => t.includes('свіж') || t.includes('fresh'));
                });
                listTitle = "🌿 ПІДБІРКА СВІЖИХ АРОМАТІВ";
            } else {
                filteredNames = [...allNames];
                listTitle = "🎲 ВИПАДКОВА ПІДБІРКА АРОМАТІВ";
            }

            if (filteredNames.length === 0) {
                showToast(`📊 Немає ароматів у категорії "${category}"`, "warning");
                btn.disabled = false;
                btn.innerHTML = originalHTML;
                return;
            }

            // Shuffle and pick 5
            selectedProducts = filteredNames
                .sort(() => 0.5 - Math.random())
                .slice(0, 5);
        }

        // Calculate prices for each product
        const markup = MARKUP_PRESETS['Базова'] || 0.12;
        const productsText = selectedProducts.map((name, index) => {
            const data = PERFUME_PRICES[name] || {};
            const p3 = data.basePrice ? Math.round(data.basePrice * (1 + markup) * 3 + (FLACON_COSTS[3] || 12)) : '??';
            const p5 = data.basePrice ? Math.round(data.basePrice * (1 + markup) * 5 + (FLACON_COSTS[5] || 12)) : '??';
            const p10 = data.basePrice ? Math.round(data.basePrice * (1 + markup) * 10 + (FLACON_COSTS[10] || 15)) : '??';
            return `<b>${name}</b>\n3мл — ${p3}₴ | 5мл — ${p5}₴ | 10мл — ${p10}₴`;
        }).join('\n\n');

        const isInst = (TELEGRAM_CONFIG.platform === 'instagram');

        // AI Prompt for post text
        let prompt = "";
        if (isInst) {
            prompt = `Ти - SMM менеджер магазину елітної парфумерії. 
Створи естетичний пост для INSTAGRAM STORIES/REELS з наступною підбіркою.

ЗАГОЛОВОК: ${listTitle}
СПИСОК:
${productsText}

СТИЛЬ: Трендовий, лаконічний, Instagram-friendly.
ВИМОГИ:
1. Використовуй вказаний заголовок.
2. Список ароматів має виглядати чисто.
3. Додай заклик "Пишіть у Direct для замовлення".
4. Додай 5 популярних хештегів.
5. Мова: Українська.

Поверни ТІЛЬКИ текст посту.`;
        } else {
            prompt = `Ти - SMM менеджер магазину елітної парфумерії. 
Створи естетичний та структурований пост для Telegram каналу з наступною підбіркою.

ЗАГОЛОВОК: ${listTitle}
СПИСОК:
${productsText}

СТИЛЬ: Преміальний, лаконічний, діловий але привітний.
ВИМОГИ:
1. Використовуй вказаний заголовок.
2. Додай короткий вступ (1 речення) про актуальність цієї підбірки.
3. Список ароматів має виглядати чисто (назва та ціни).
4. Закінчи закликом замовити.
5. Використовуй HTML розмітку (<b>, <i>).
6. МАКСИМУМ 800 символів.
7. Мова: Українська.

Поверни ТІЛЬКИ текст посту.`;
        }

        const caption = await callGemini(prompt);
        window.currentSMMCaption = caption; // Store for copy

        if (isInst) {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            showToast("✨ Текст для Instagram згенеровано! Тепер натисніть 'Копіювати'.", "success");
            return;
        }

        // Safety trim
        let finalCaption = caption.trim();
        if (finalCaption.length > 1024) {
            finalCaption = finalCaption.substring(0, 1020) + "...";
        }

        // Send to Telegram
        const keyboard = {
            inline_keyboard: [[
                { text: "🛍️ Замовити — @Stascyba", url: "https://t.me/Stascyba" }
            ]]
        };

        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: channelId,
                text: finalCaption,
                parse_mode: 'HTML',
                reply_markup: keyboard
            })
        });

        const data = await response.json();
        if (data.ok) {
            showToast("🚀 Список опубліковано в Telegram!", "success");
        } else {
            showToast("❌ Помилка: " + data.description, "error");
        }
    } catch (e) {
        console.error(e);
        showToast("❌ Помилка генерації поста", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

window.copySmmToClipboard = function () {
    if (!window.currentSMMCaption) { showToast("⚠️ Спочатку згенеруйте превью!", "warning"); return; }
    navigator.clipboard.writeText(window.currentSMMCaption)
        .then(() => showToast("📋 Текст скопійовано!", "success"))
        .catch(() => showToast("❌ Не вдалося скопіювати", "error"));
}

window.copyCategorizedListToClipboard = function () {
    if (!window.currentSMMCaption) { showToast("⚠️ Спочатку сформуйте список!", "warning"); return; }
    navigator.clipboard.writeText(window.currentSMMCaption)
        .then(() => showToast("📋 Список скопійовано!", "success"))
        .catch(() => showToast("❌ Не вдалося скопіювати", "error"));
}

