
// ==UserScript==
// @name         RME Menu
// @namespace    RME
// @version      2.3
// @description  RME Menu + Customization + Rename + Pack Opener + Bazaar Lookup + Sniper
// @match        https://blacket.org/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
'use strict';

// =========================================
// SETTINGS
// =========================================

const C = {
    messages: 5,
    messageDelay: 6000,
    sniperDelay: 1500,
    retries: 3
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[RME]', ...a);
const notify = m => alert('[RME] ' + m);

const game = () => {
    if (typeof blacket === 'undefined')
        throw Error('Blacket data unavailable.');
    return blacket;
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

const fetchJSON = async (url, opts) => {
    const r = await fetch(url, opts);
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    return r.json();
};

// =========================================
// MENU CUSTOMIZATION
// =========================================

const STORAGE_KEY = 'RME_SETTINGS';
const defaults = {
    color: 'red',
    layout: 'default'
};

let settings = {...defaults};

try {
    settings = {
        ...defaults,
        ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    };

    if (!['red', 'blue', 'purple', 'green', 'orange'].includes(settings.color))
        settings.color = defaults.color;

    if (!['compact', 'default', 'wide'].includes(settings.layout))
        settings.layout = defaults.layout;

} catch {
    settings = {...defaults};
}

const themes = {
    red: {
        accent: '#d12a32',
        border: '#b9000b',
        selected: '#39090d',
        hover: '#292020'
    },
    blue: {
        accent: '#299cff',
        border: '#0066bb',
        selected: '#102b45',
        hover: '#172c40'
    },
    purple: {
        accent: '#ad72ff',
        border: '#7134bd',
        selected: '#29163f',
        hover: '#30203e'
    },
    green: {
        accent: '#35c879',
        border: '#16834b',
        selected: '#103522',
        hover: '#193629'
    },
    orange: {
        accent: '#ff963b',
        border: '#bd5900',
        selected: '#40230d',
        hover: '#392619'
    }
};

const layouts = {
    compact: {
        width: 260,
        height: 290,
        optionHeight: 30,
        gap: 5
    },
    default: {
        width: 305,
        height: 350,
        optionHeight: 34,
        gap: 7
    },
    wide: {
        width: 380,
        height: 390,
        optionHeight: 38,
        gap: 8
    }
};

function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch(e) {
        console.error('[RME] Settings save failed:', e);
    }
}

// =========================================
// STATE
// =========================================

let selected = 0;
let visible = true;
let settingsView = false;
let settingsSection = 'main';

let auto = false;
let autoTimer = null;

let sniper = false;
let sniperTimer = null;
let sniperBusy = false;

const options = [
    'Extra Options',
    'Rename Display',
    'Pack Opener',
    'Bazaar Lookup',
    'Bazaar Sniper (ON)',
    'Auto Message (OFF)'
];

// =========================================
// CREDITS
// =========================================

function replaceCredits() {
    document.querySelectorAll(
        '.styles__pageText___1eo7q-camelCase'
    ).forEach(e => {
        if (e.textContent.trim() === 'Credits')
            e.textContent = 'Cred Prq <3';
    });
}

replaceCredits();

new MutationObserver(replaceCredits).observe(document.body, {
    childList: true,
    subtree: true
});

// =========================================
// MENU
// =========================================

const menu = document.createElement('div');
menu.id = 'rme-menu';

menu.style.cssText = `
position:fixed;
top:30%;
left:20px;
background:#101010;
box-sizing:border-box;
color:#aaa;
font:14px monospace;
letter-spacing:1px;
z-index:999999;
padding:10px;
overflow:hidden;
box-shadow:0 5px 25px #000a;
border:3px solid;
`;

menu.innerHTML = `
<div id="rme-title">
    <span>RME OPTIONS</span>
    <span id="rme-version">V2.3</span>
</div>

<div id="rme-divider"></div>
<div id="rme-items"></div>

<div id="rme-footer">
    <span>RME SYSTEM</span>
    <span>ESC TO HIDE</span>
</div>
`;

document.body.appendChild(menu);

const title = menu.querySelector('#rme-title');
const list = menu.querySelector('#rme-items');

const style = document.createElement('style');

style.textContent = `
#rme-title {
    display:flex;
    justify-content:space-between;
    align-items:center;
    font-size:17px;
    font-weight:bold;
    letter-spacing:2px;
    padding:5px;
    cursor:grab;
    user-select:none;
}

#rme-version {
    font-size:10px;
    color:#666;
}

#rme-divider {
    height:2px;
    margin:7px 0 15px;
}

#rme-items {
    display:flex;
    flex-direction:column;
    gap:7px;
    overflow-y:auto;
    max-height:calc(100% - 95px);
    scrollbar-width:thin;
}

.rme-option {
    min-height:34px;
    box-sizing:border-box;
    display:flex;
    align-items:center;
    padding:0 10px;
    color:#aaa;
    background:#181818;
    border-left:3px solid transparent;
    cursor:pointer;
    transition:.15s;
}

.rme-option:hover,
.rme-option.selected {
    color:white;
}

#rme-footer {
    position:absolute;
    bottom:9px;
    left:10px;
    right:10px;
    display:flex;
    justify-content:space-between;
    color:#555;
    font-size:10px;
}

#rme-opener {
    scrollbar-width:thin;
}

#rme-opener button {
    cursor:pointer;
}

/* RAINBOW DISPLAY */

.rme-rainbow {
    background-image:linear-gradient(
        90deg,
        red,
        orange,
        yellow,
        lime,
        cyan,
        blue,
        violet,
        red
    ) !important;

    background-size:300% auto !important;
    background-clip:text !important;
    -webkit-background-clip:text !important;
    -webkit-text-fill-color:transparent !important;

    animation:rmeRainbow 3s linear infinite !important;
}

@keyframes rmeRainbow {
    to {
        background-position:300% center;
    }
}

/* RENAME PANEL */

#rme-rename-panel {
    position:fixed;
    top:50%;
    left:50%;
    transform:translate(-50%,-50%);
    width:320px;
    box-sizing:border-box;
    background:#111;
    color:white;
    padding:18px;
    border:2px solid;
    border-radius:9px;
    z-index:1000002;
    font-family:monospace;
    box-shadow:0 0 30px #000c;
}

#rme-rename-panel input[type="text"] {
    box-sizing:border-box;
    width:100%;
    padding:10px;
    margin:8px 0 15px;
    background:#202020;
    color:white;
    border:1px solid #444;
    outline:none;
}

#rme-rename-panel button {
    cursor:pointer;
}
`;

document.head.appendChild(style);

// =========================================
// APPLY MENU SETTINGS
// =========================================

function applySettings() {
    const theme = themes[settings.color] || themes.red;
    const layout = layouts[settings.layout] || layouts.default;

    menu.style.width = layout.width + 'px';
    menu.style.height = layout.height + 'px';
    menu.style.borderColor = theme.border;

    menu.style.setProperty('--accent', theme.accent);
    menu.style.setProperty('--selected', theme.selected);
    menu.style.setProperty('--hover', theme.hover);

    title.style.color = theme.accent;

    menu.querySelector('#rme-divider').style.background = theme.border;

    document.querySelectorAll('.rme-option').forEach(el => {
        el.style.minHeight = layout.optionHeight + 'px';

        el.style.background = el.classList.contains('selected')
            ? theme.selected
            : '#181818';

        el.style.borderLeftColor = el.classList.contains('selected')
            ? theme.accent
            : 'transparent';
    });

    menu.querySelector('#rme-items').style.gap = layout.gap + 'px';
}

// =========================================
// MENU RENDERING
// =========================================

function addOption(label, callback, active = false) {
    const el = document.createElement('div');

    el.className = 'rme-option' + (active ? ' selected' : '');
    el.textContent = label;
    el.onclick = callback;

    list.appendChild(el);
}

function renderSettings() {
    list.innerHTML = '';

    const heading = document.createElement('div');

    heading.textContent = 'RME CUSTOMIZATION';

    heading.style.cssText = `
        color:var(--accent);
        font-weight:bold;
        padding:5px;
        letter-spacing:2px;
    `;

    list.appendChild(heading);

    if (settingsSection === 'main') {

        addOption('← BACK', () => {
            settingsView = false;
            settingsSection = 'main';
            render();
        });

        addOption('MENU COLOR', () => {
            settingsSection = 'colors';
            render();
        });

        addOption('MENU LAYOUT', () => {
            settingsSection = 'layouts';
            render();
        });

        addOption('RESET SETTINGS', () => {
            if (!confirm('Reset RME customization?')) return;

            settings = {...defaults};
            saveSettings();
            applySettings();
            render();
        });

    } else if (settingsSection === 'colors') {

        addOption('← BACK', () => {
            settingsSection = 'main';
            render();
        });

        Object.keys(themes).forEach(color => {
            addOption(
                `${color.toUpperCase()} ${settings.color === color ? '✓' : ''}`,
                () => {
                    settings.color = color;
                    saveSettings();
                    applySettings();
                    render();
                },
                settings.color === color
            );
        });

    } else if (settingsSection === 'layouts') {

        addOption('← BACK', () => {
            settingsSection = 'main';
            render();
        });

        Object.keys(layouts).forEach(layout => {
            addOption(
                `${layout.toUpperCase()} ${settings.layout === layout ? '✓' : ''}`,
                () => {
                    settings.layout = layout;
                    saveSettings();
                    applySettings();
                    render();
                },
                settings.layout === layout
            );
        });
    }

    applySettings();
}

function render() {
    list.innerHTML = '';

    if (settingsView) {
        renderSettings();
        return;
    }

    options.forEach((option, index) => {
        const el = document.createElement('div');

        el.className = 'rme-option' +
            (index === selected ? ' selected' : '');

        el.textContent = option;

        el.onclick = () => {
            selected = index;
            render();
            execute(option);
        };

        list.appendChild(el);
    });

    applySettings();
}

function updateOption(name, on) {
    const i = options.findIndex(o => o.startsWith(name));

    if (i !== -1)
        options[i] = `${name} (${on ? 'ON' : 'OFF'})`;

    render();
}

applySettings();
render();

// =========================================
// DRAGGING
// =========================================

let dragging = false;
let offsetX = 0;
let offsetY = 0;

title.onmousedown = e => {
    if (e.button !== 0) return;

    dragging = true;

    const r = menu.getBoundingClientRect();

    offsetX = e.clientX - r.left;
    offsetY = e.clientY - r.top;

    title.style.cursor = 'grabbing';
    e.preventDefault();
};

document.addEventListener('mousemove', e => {
    if (!dragging) return;

    menu.style.left = Math.max(
        0,
        Math.min(innerWidth - menu.offsetWidth, e.clientX - offsetX)
    ) + 'px';

    menu.style.top = Math.max(
        0,
        Math.min(innerHeight - menu.offsetHeight, e.clientY - offsetY)
    ) + 'px';
});

document.addEventListener('mouseup', () => {
    dragging = false;
    title.style.cursor = 'grab';
});

// =========================================
// RENAME DISPLAY
// =========================================

const RENAME_KEY = 'RME_RENAME_SETTINGS';

const renameDefaults = {
    name: 'prq',
    color: '#ffffff',
    rainbow: false
};

let renameSettings = {...renameDefaults};
let lastAppliedName = 'prq';

try {
    renameSettings = {
        ...renameDefaults,
        ...JSON.parse(localStorage.getItem(RENAME_KEY) || '{}')
    };

    if (typeof renameSettings.name !== 'string' ||
        !renameSettings.name.trim()) {
        renameSettings.name = renameDefaults.name;
    }

    if (!/^#[0-9a-f]{6}$/i.test(renameSettings.color))
        renameSettings.color = renameDefaults.color;

    renameSettings.rainbow = Boolean(renameSettings.rainbow);

} catch {
    renameSettings = {...renameDefaults};
}

// FIND ONLY THE TWO REQUESTED DISPLAY ELEMENTS

function getRenameTargets() {
    const elements = document.querySelectorAll(
        '.styles__headerName___1GBcl-camelCase, text[class=""]'
    );

    return [...elements].filter(el => {
        if (el.matches('.styles__headerName___1GBcl-camelCase'))
            return true;

        const current = el.textContent.trim();

        return [
            'prq',
            renameSettings.name,
            lastAppliedName
        ].includes(current);
    });
}

// APPLY NAME AND COLOR

function applyRename() {
    const targets = getRenameTargets();

    targets.forEach(el => {
        if (el.textContent !== renameSettings.name)
            el.textContent = renameSettings.name;

        if (renameSettings.rainbow) {
            el.classList.add('rme-rainbow');
            el.style.color = 'transparent';
            el.style.webkitTextFillColor = 'transparent';

        } else {
            el.classList.remove('rme-rainbow');

            el.style.removeProperty('background-image');
            el.style.removeProperty('background-size');
            el.style.removeProperty('background-clip');
            el.style.removeProperty('-webkit-background-clip');
            el.style.removeProperty('-webkit-text-fill-color');

            el.style.color = renameSettings.color;
        }
    });

    lastAppliedName = renameSettings.name;
}

// SAVE RENAME SETTINGS

function saveRename() {
    try {
        localStorage.setItem(
            RENAME_KEY,
            JSON.stringify(renameSettings)
        );
    } catch(e) {
        console.error('[RME] Rename save failed:', e);
        notify('Could not save rename settings.');
        return false;
    }

    applyRename();
    return true;
}

// RENAME EDITOR

function openRename() {
    if (document.getElementById('rme-rename-panel'))
        return;

    const theme = themes[settings.color] || themes.red;

    const panel = document.createElement('div');

    panel.id = 'rme-rename-panel';
    panel.style.borderColor = theme.border;

    panel.innerHTML = `
        <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            color:${theme.accent};
            font-size:18px;
            font-weight:bold;
            margin-bottom:18px;
        ">
            RME RENAME

            <button id="rme-rename-close" style="
                background:#a11;
                color:white;
                border:0;
                padding:5px 10px;
            ">X</button>
        </div>

        <label>Display Name</label>

        <input id="rme-rename-input" type="text"
            maxlength="30"
            placeholder="Enter display name">

        <label>Name Color</label>

        <input id="rme-rename-color" type="color"
            style="
                display:block;
                width:100%;
                height:38px;
                margin:8px 0 16px;
                background:#222;
                border:1px solid #444;
                cursor:pointer;
            ">

        <label style="
            display:flex;
            align-items:center;
            gap:9px;
            margin-bottom:18px;
        ">
            <input id="rme-rename-rainbow" type="checkbox">
            Rainbow Animation
        </label>

        <div style="
            background:#1b1b1b;
            border:1px solid #333;
            padding:12px;
            text-align:center;
            margin-bottom:16px;
        ">
            <div style="color:#666;font-size:10px;margin-bottom:8px">
                LIVE PREVIEW
            </div>

            <span id="rme-rename-preview"
                style="font-size:22px;font-weight:bold">
                prq
            </span>
        </div>

        <div style="display:flex;gap:8px">

            <button id="rme-rename-save" style="
                flex:1;
                padding:11px;
                background:${theme.border};
                color:white;
                border:0;
                font-weight:bold;
            ">SAVE</button>

            <button id="rme-rename-reset" style="
                padding:11px;
                background:#292929;
                color:white;
                border:1px solid #444;
            ">RESET</button>

        </div>

        <div style="
            color:#666;
            font-size:10px;
            text-align:center;
            margin-top:13px;
        ">
            SETTINGS SAVED LOCALLY
        </div>
    `;

    document.body.appendChild(panel);

    const $ = id => panel.querySelector('#rme-rename-' + id);

    const input = $('input');
    const color = $('color');
    const rainbow = $('rainbow');
    const preview = $('preview');

    input.value = renameSettings.name;
    color.value = renameSettings.color;
    rainbow.checked = renameSettings.rainbow;

    // LIVE PREVIEW

    function updatePreview() {
        preview.textContent = input.value || 'Preview';

        if (rainbow.checked) {
            preview.classList.add('rme-rainbow');
            preview.style.color = 'transparent';
        } else {
            preview.classList.remove('rme-rainbow');
            preview.style.backgroundImage = 'none';
            preview.style.webkitTextFillColor = 'initial';
            preview.style.color = color.value;
        }
    }

    input.addEventListener('input', updatePreview);
    color.addEventListener('input', updatePreview);
    rainbow.addEventListener('change', updatePreview);

    updatePreview();

    // CLOSE

    $('close').onclick = () => panel.remove();

    // SAVE

    $('save').onclick = () => {
        const name = input.value.trim();

        if (!name) {
            notify('Enter a display name.');
            return;
        }

        renameSettings = {
            name,
            color: color.value,
            rainbow: rainbow.checked
        };

        if (!saveRename()) return;

        panel.remove();
        notify('Display name saved!');
    };

    // RESET

    $('reset').onclick = () => {
        renameSettings = {...renameDefaults};

        if (!saveRename()) return;

        panel.remove();
        notify('Display settings reset!');
    };
}

// OBSERVE BLACKET PAGE UPDATES

const renameObserver = new MutationObserver(() => {
    const targets = getRenameTargets();

    if (targets.some(el =>
        el.textContent !== renameSettings.name ||
        el.classList.contains('rme-rainbow') !== renameSettings.rainbow
    )) {
        applyRename();
    }
});

renameObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// INITIAL RENAME

applyRename();

// =========================================
// CHAT
// =========================================

function sendMessage(message) {
    const g = game();

    if (typeof g.sendMessage !== 'function' || !g.chat?.room)
        throw Error('Blacket chat unavailable.');

    return g.sendMessage(g.chat.room, message, true);
}

// =========================================
// AUTO MESSAGE
// =========================================

function stopAuto() {
    auto = false;

    clearInterval(autoTimer);
    autoTimer = null;

    updateOption('Auto Message', false);
}

function toggleAuto() {
    if (auto) {
        stopAuto();
        notify('Auto Message stopped.');
        return;
    }

    const message = prompt('Enter the message to send:');

    if (!message?.trim() ||
        !confirm('Send this message up to 5 times, every 6 seconds?'))
        return;

    let sent = 0;

    try {
        sendMessage(message.trim());
        sent++;
    } catch(e) {
        notify(e.message);
        return;
    }

    auto = true;
    updateOption('Auto Message', true);

    log(`Auto Message: ${sent}/5`);

    autoTimer = setInterval(() => {
        try {
            sendMessage(message.trim());

            log(`Auto Message: ${++sent}/5`);

            if (sent >= C.messages) {
                stopAuto();
                notify('Auto Message finished.');
            }

        } catch(e) {
            stopAuto();

            console.error('[RME] Auto Message:', e);
            notify('Auto Message stopped: ' + e.message);
        }

    }, C.messageDelay);
}

// =========================================
// BAZAAR LOOKUP
// =========================================

async function bazaarLookup() {
    const name = prompt('Enter Blook name to search:')?.trim();

    if (!name) return;

    try {
        const data = await fetchJSON(
            '/worker/bazaar?item=' + encodeURIComponent(name)
        );

        if (data.error || !Array.isArray(data.bazaar))
            throw Error(data.reason || 'Invalid bazaar response.');

        const matches = data.bazaar.filter(x =>
            typeof x.item === 'string' &&
            x.item.toLowerCase() === name.toLowerCase()
        );

        if (!matches.length)
            return notify(`No listings found for ${name}.`);

        const cheapest = matches.reduce(
            (a, b) => b.price < a.price ? b : a
        );

        const message =
            `Cheapest listing for ${cheapest.item}\n` +
            `Price: ${cheapest.price.toLocaleString()} tokens\n` +
            `Seller: ${cheapest.seller}`;

        try {
            sendMessage(message);
            notify('Listing information sent to chat.');
        } catch {
            alert(message);
        }

    } catch(e) {
        console.error('[RME] Bazaar Lookup:', e);
        notify('Bazaar error: ' + e.message);
    }
}

// =========================================
// PACK OPENER
// =========================================

async function packOpener() {
    let g;

    try {
        g = game();

        if (!g.packs || !g.requests || !g.user ||
            !g.blooks || !g.rarities)
            throw Error('Required Blacket data is missing.');

    } catch(e) {
        return notify(e.message);
    }

    const packs = Object.keys(g.packs);

    if (!packs.length)
        return notify('No packs available.');

    const input = prompt('Enter pack:\n\n' + packs.join(', '));

    if (!input?.trim()) return;

    const pack = packs.find(
        p => p.toLowerCase() === input.trim().toLowerCase()
    );

    if (!pack)
        return notify('Invalid pack.');

    const price = Number(g.packs[pack].price);

    if (!Number.isFinite(price) || price <= 0)
        return notify('Invalid pack price.');

    const max = Math.floor(g.user.tokens / price);

    if (max < 1)
        return notify("You don't have enough tokens.");

    const amount = Number(prompt(`Enter amount (Max ${max}):`));

    if (!Number.isSafeInteger(amount) || amount < 1 || amount > max)
        return notify('Invalid amount.');

    if (document.getElementById('rme-opener'))
        return;

    if (!confirm(
        `Open ${amount.toLocaleString()} ${pack} packs?\n` +
        `Estimated cost: ${(amount * price).toLocaleString()} tokens`
    )) return;

    const panel = document.createElement('div');

    panel.id = 'rme-opener';

    panel.style.cssText = `
        position:fixed;
        top:20px;
        right:20px;
        width:350px;
        max-height:80vh;
        overflow-y:auto;
        background:#111;
        color:white;
        padding:15px;
        border:2px solid ${themes[settings.color].border};
        border-radius:10px;
        z-index:1000000;
        font-family:monospace;
        box-shadow:0 0 25px #000b;
    `;

    panel.innerHTML = `
        <button id="rme-close" style="
            float:right;
            background:${themes[settings.color].border};
            color:white;
            border:0;
            padding:5px 10px;
        ">X</button>

        <div style="
            font-size:23px;
            text-align:center;
            color:${themes[settings.color].accent}
        ">RME PACK OPENER</div>

        <div style="text-align:center;color:#777;margin-top:5px">
            ${esc(pack)}
        </div>

        <hr style="border-color:#333">
        <div id="rme-stats"></div>
        <hr style="border-color:#333">
        <div id="rme-results"></div>
        <div id="rme-status" style="
            margin-top:12px;
            color:#aaa;
            text-align:center;
        ">Initializing...</div>
    `;

    document.body.appendChild(panel);

    panel.querySelector('#rme-close').onclick = () => panel.remove();

    const stats = panel.querySelector('#rme-stats');
    const results = panel.querySelector('#rme-results');
    const status = panel.querySelector('#rme-status');

    const pulled = {};

    let opened = 0;
    let spent = 0;
    let best = null;
    let errors = 0;

    const maxDelay = Math.max(
        0,
        ...Object.values(g.rarities).map(r => Number(r.wait) || 0)
    );

    const openPack = () => new Promise((resolve, reject) => {
        try {
            g.requests.post('/worker3/open', {pack}, data => {
                if (!data || data.error || !data.blook)
                    reject(Error(data?.error || 'Pack request failed.'));
                else
                    resolve(data.blook);
            });
        } catch(e) {
            reject(e);
        }
    });

    function update(blook, rarity) {
        stats.innerHTML = `
            <div>Packs: ${opened}/${amount}</div>
            <div>Spent: ${spent.toLocaleString()}</div>
            <div>Tokens: ${Number(g.user.tokens).toLocaleString()}</div>
            <div>Last Pull: ${esc(blook)}</div>
            <div>Rarity: ${esc(rarity)}</div>
        `;

        results.innerHTML = Object.entries(pulled)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => {
                const color =
                    g.rarities[g.blooks[name]?.rarity]?.color || '#fff';

                return `
                    <div style="
                        padding:6px;
                        margin:4px 0;
                        background:#191919;
                        border-left:3px solid ${esc(color)};
                        color:${esc(color)}
                    ">
                        ${esc(name)} x${count}
                    </div>
                `;
            }).join('');
    }

    while (opened < amount && document.body.contains(panel)) {
        try {
            status.textContent = `Opening pack ${opened + 1}/${amount}...`;

            const blook = await openPack();

            const rarity = g.blooks[blook]?.rarity;
            const rarityData = g.rarities[rarity];

            if (!rarityData)
                throw Error('Unknown Blook or rarity returned.');

            opened++;
            spent += price;

            pulled[blook] = (pulled[blook] || 0) + 1;

            if (!best || rarityData.exp > g.rarities[best].exp)
                best = rarity;

            errors = 0;

            update(blook, rarity);

            await sleep(Number(rarityData.wait) || 0);

        } catch(e) {
            console.error('[RME] Pack Opener:', e);

            status.textContent =
                `Request error (${++errors}/${C.retries})`;

            if (errors >= C.retries) {
                status.textContent = 'Stopped after repeated request errors.';
                break;
            }

            await sleep(maxDelay || 1000);
        }
    }

    if (!document.body.contains(panel)) return;

    const summary = document.createElement('div');

    summary.style.cssText = `
        margin-top:15px;
        padding:12px;
        background:#1c1010;
        border:1px solid #790008;
        text-align:center;
    `;

    summary.innerHTML = `
        <div style="font-size:20px;color:#e33">
            ${opened === amount ? 'OPENING COMPLETE' : 'OPENING STOPPED'}
        </div>

        <hr style="border-color:#444">

        <div>Packs Opened: ${opened}</div>
        <div>Spent: ${spent.toLocaleString()}</div>
        <div>Tokens Remaining: ${Number(g.user.tokens).toLocaleString()}</div>
        <div>Best Pull: ${esc(best || 'None')}</div>

        <div style="margin-top:12px;color:#888">
            Thanks For Using RME!
        </div>
    `;

    panel.appendChild(summary);

    status.textContent = 'Process finished.';

    log('Pack opening completed:', opened);
}

// =========================================
// BAZAAR SNIPER
// =========================================

function stopSniper() {
    sniper = false;

    clearInterval(sniperTimer);
    sniperTimer = null;

    updateOption('Bazaar Sniper', false);
}

async function sniperScan() {
    if (!sniper || sniperBusy) return;

    let g;

    try {
        g = game();

        if (!g.user || !g.blooks)
            throw Error('Blacket user data unavailable.');

    } catch(e) {
        console.error('[RME] Sniper:', e);
        return stopSniper();
    }

    sniperBusy = true;

    try {
        const data = await fetchJSON('/worker/bazaar');

        if (data.error || !Array.isArray(data.bazaar))
            return;

        for (const item of data.bazaar) {
            if (!sniper) break;

            if (!item?.id || !item.item ||
                !Number.isFinite(Number(item.price)))
                continue;

            const blook = g.blooks[item.item];

            if (!blook || !Number.isFinite(Number(blook.price)))
                continue;

            if (
                Number(blook.price) < Number(item.price) ||
                item.seller === g.user.username ||
                Number(g.user.tokens) < Number(item.price)
            ) continue;

            if (!sniper) break;

            // AUTOMATIC PURCHASE

            const result = await fetchJSON('/worker/bazaar/buy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: item.id
                })
            });

            if (result.error) {
                log('Purchase failed:', result);
                continue;
            }

            log('Purchase completed:', item);

            g.createToast?.({
                message:
                    `Purchased ${item.item} for ` +
                    `${Number(item.price).toLocaleString()} tokens!`
            });

            break;
        }

    } catch(e) {
        console.error('[RME] Bazaar Sniper:', e);

    } finally {
        sniperBusy = false;
    }
}

function toggleSniper() {
    if (sniper) {
        stopSniper();
        notify('Bazaar Sniper disabled.');
        return;
    }

    try {
        if (!game().user)
            throw Error('Blacket user data unavailable.');

    } catch(e) {
        return notify(e.message);
    }

    if (!confirm(
        'Enable Bazaar Sniper?\n\n' +
        'The scanner will check marketplace listings.\n' +
        'Qualifying listings will be purchased automatically.'
    )) return;

    sniper = true;

    updateOption('Bazaar Sniper', true);

    sniperScan();

    sniperTimer = setInterval(sniperScan, C.sniperDelay);

    notify('Bazaar Sniper enabled.');
}

// =========================================
// MENU ACTIONS
// =========================================

function execute(choice) {
    if (choice === 'Extra Options') {
        settingsView = true;
        settingsSection = 'main';
        render();
    }

    else if (choice === 'Rename Display') {
        openRename();
    }

    else if (choice === 'Pack Opener') {
        packOpener();
    }

    else if (choice === 'Bazaar Lookup') {
        bazaarLookup();
    }

    else if (choice.startsWith('Bazaar Sniper')) {
        toggleSniper();
    }

    else if (choice.startsWith('Auto Message')) {
        toggleAuto();
    }
}

// =========================================
// KEYBOARD
// =========================================

document.addEventListener('keydown', e => {
    if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
    ) return;

    if (e.key === 'Escape') {
        if (settingsView) {
            settingsView = false;
            settingsSection = 'main';
            render();

        } else {
            visible = !visible;
            menu.style.display = visible ? 'block' : 'none';
        }

        return;
    }

    if (!visible) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();

        if (settingsView) return;

        selected = (
            selected + (e.key === 'ArrowDown' ? 1 : -1) + options.length
        ) % options.length;

        render();

    } else if (e.key === 'Enter') {
        e.preventDefault();

        if (!settingsView)
            execute(options[selected]);
    }

}, true);

// =========================================
// AUTOMATIC STARTUP
// =========================================

function startSniper() {
    let attempts = 0;

    const initialize = () => {
        if (sniper) return;

        try {
            if (!game().user)
                throw Error('Blacket user data unavailable.');

        } catch(e) {
            if (++attempts < 30)
                return setTimeout(initialize, 1000);

            console.error('[RME] Auto-start failed:', e);
            return;
        }

        sniper = true;

        updateOption('Bazaar Sniper', true);

        sniperScan();

        sniperTimer = setInterval(sniperScan, C.sniperDelay);

        log('Bazaar Sniper automatically enabled.');
    };

    initialize();
}

// =========================================
// INITIALIZATION
// =========================================

log('RME Menu V2.3 initialized.');

startSniper();

})();
