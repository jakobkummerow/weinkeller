"use strict";
var kSideLang = {
    settings: "Einstellungen",
    edit_mode: "Editier-Modus",
    reason_add: "Grund für Hinzufügen",
    reason_delete: "Grund für Entfernen",
    stock_mode: "Inventur-Modus",
    stock_reset_all: "Alle zurücksetzen",
    stock_apply_all: "Alle übernehmen",
    stock_reset_sure: "Dies setzt alle Inventur-Daten auf 0 zurück. Sicher?",
    stock_apply_sure: "Dies überschreibt den Bestand aller Weine mit den " +
        "Inventur-Daten. Sicher?",
    only_existing: "Nur vorhandene Weine anzeigen",
    filters: "Anzeigen:",
    colors_all: "alle Farben",
    color_only_red: "nur rot",
    color_only_white: "nur weiß",
    unknown: "unbekannt",
    grapes_all: "alle Trauben",
    countries_all: "alle Länder",
    regions_all: "alle Regionen",
    reasons: {
        0: "unbekannt",
        1: "Gekauft",
        2: "Bestand",
        3: "Geschenkt bek.",
        11: "Getrunken",
        12: "Verschenkt",
        13: "Verlust",
    },
    special_tools: "Spezial-Tools",
    forget_all: "Lokale Daten löschen",
    forget_all_sure: "Dies löscht alle lokal gespeicherten Daten und holt sie " +
        "neu vom Server. Sicher?",
    refetch_all: "Alles neu laden",
    push_all: "Alles neu senden",
};
function IsValidReasonFor(reason, delta) {
    if (delta > 0)
        return reason > 0 && reason < 10;
    if (delta < 0)
        return reason > 10;
    return reason === 0;
}
function FormatReason(int) {
    return kSideLang.reasons[int];
}
function AddButton(parent, label, className, onclick) {
    let div = AddC(parent, 'div');
    let button = AddC(div, 'button');
    AddT(button, label);
    button.className = className;
    button.onclick = onclick;
}
class DynamicDropdown {
    constructor() {
        this.select = document.createElement('select');
    }
    create(data, onchange) {
        this.data = data;
        this.select.onchange = onchange;
        let all = AddC(this.select, 'option');
        all.selected = true;
        all.value = kAny;
        AddT(all, this.all_label);
        for (let v of this.getValues()) {
            let option = AddC(this.select, 'option');
            option.value = v;
            AddT(option, v);
        }
        let unknown = AddC(this.select, 'option');
        unknown.value = kUnknown;
        AddT(unknown, kSideLang.unknown);
        this.customSetup();
        return this.select;
    }
    value() { return this.select.value; }
    add(value) {
        let option = document.createElement('option');
        option.value = value;
        option.style.display = this.displayStyle(value);
        AddT(option, value);
        // Cast is guaranteed to be fine because of "all" option.
        let p = this.select.firstChild;
        // Cast is guaranteed to be fine because of "unknown" option.
        do {
            p = p.nextSibling;
        } while (p.value !== kUnknown && p.value < value);
    }
    updateShown() {
        let p = this.select.firstChild;
        p = p.nextSibling;
        while (p.value !== kUnknown) {
            p.style.display = this.displayStyle(p.value);
            p = p.nextSibling;
        }
    }
    // Subclasses may override.
    displayStyle(value) { return ''; }
    customSetup() { }
}
class GrapeFilter extends DynamicDropdown {
    constructor() {
        super(...arguments);
        this.all_label = kSideLang.grapes_all;
    }
    getValues() {
        return this.data.grape_cache.getGrapes();
    }
    customSetup() {
        g_watchpoints.grapes.registerObserver(this);
    }
    setColorFilter(value) {
        this.color_filter = value;
        this.select.value = kAny;
    }
    displayStyle(grape) {
        if (this.color_filter === GrapeColor.kAny)
            return '';
        if (ColorForGrape(grape) === this.color_filter)
            return '';
        return 'none';
    }
}
class CountryFilter extends DynamicDropdown {
    constructor() {
        super(...arguments);
        this.all_label = kSideLang.countries_all;
    }
    getValues() {
        return this.data.geo_cache.getCountries();
    }
    customSetup() {
        g_watchpoints.countries.registerObserver(this);
    }
}
class RegionFilter extends DynamicDropdown {
    constructor() {
        super(...arguments);
        this.all_label = kSideLang.regions_all;
    }
    getValues() {
        return this.data.geo_cache.getAllRegions();
    }
    customSetup() {
        g_watchpoints.regions.registerObserver(this);
    }
    setCountryFilter(country) {
        this.country_filter = country;
    }
    displayStyle(region) {
        if (this.country_filter === kAny)
            return '';
        if (this.data.geo_cache.getCountry(region) === this.country_filter) {
            return '';
        }
        return 'none';
    }
}
class Sidebar {
    constructor(winelist, connection) {
        this.winelist = winelist;
        this.connection = connection;
        this.div = document.createElement('div');
        this.edit_div = document.createElement('div');
        this.edit_mode = document.createElement('input');
        this.edit_mode_value = false;
        this.stock_div = document.createElement('div');
        this.stock_mode = document.createElement('input');
        this.stock_mode_value = false;
        this.stock_buttons = document.createElement('span');
        this.only_existing = document.createElement('input');
        this.only_existing_value = true;
        this.filter_div = document.createElement('div');
        this.grape_color_select = document.createElement('select');
        this.grape_select = new GrapeFilter();
        this.country_select = new CountryFilter();
        this.region_select = new RegionFilter();
        this.reason_add_select = document.createElement('select');
        this.reason_remove_select = document.createElement('select');
        this.special_tools_div = document.createElement('div');
        this.special_tools_mode = document.createElement('input');
        this.special_tools_buttons = document.createElement('span');
        document.body.appendChild(this.div);
        this.div.className = 'sidebar';
    }
    create() {
        // Show existing.
        let existing_div = AddC(this.div, 'div');
        existing_div.className = 'setting';
        let existing_label = AddC(existing_div, 'label');
        existing_label.appendChild(this.only_existing);
        this.only_existing.type = 'checkbox';
        this.only_existing.checked = this.only_existing_value;
        existing_div.onclick = (e) => { this.toggleOnlyExisting(e); };
        AddT(existing_label, kSideLang.only_existing);
        // Filters.
        this.div.appendChild(this.filter_div);
        this.filter_div.className = 'setting';
        AddT(this.filter_div, kSideLang.filters);
        // Grape color.
        this.filter_div.appendChild(this.grape_color_select);
        this.grape_color_select.onchange = (_) => { this.changeGrapeColorFilter(); };
        let color_all = AddC(this.grape_color_select, 'option');
        color_all.selected = true;
        color_all.value = GrapeColor.kAny;
        AddT(color_all, kSideLang.colors_all);
        let color_red = AddC(this.grape_color_select, 'option');
        color_red.value = GrapeColor.kRed;
        AddT(color_red, kSideLang.color_only_red);
        let color_white = AddC(this.grape_color_select, 'option');
        color_white.value = GrapeColor.kWhite;
        AddT(color_white, kSideLang.color_only_white);
        let color_unknown = AddC(this.grape_color_select, 'option');
        color_unknown.value = GrapeColor.kUnknown;
        AddT(color_unknown, kSideLang.unknown);
        // Grapes, countries, regions.
        this.filter_div.appendChild(this.grape_select.create(this.winelist.data, (_) => {
            this.changeGrapeFilter();
        }));
        this.filter_div.appendChild(this.country_select.create(this.winelist.data, (_) => {
            this.changeCountryFilter();
        }));
        this.filter_div.appendChild(this.region_select.create(this.winelist.data, (_) => {
            this.changeRegionFilter();
        }));
        // Reason to add.
        let reason_add_div = AddC(this.div, 'div');
        reason_add_div.className = 'setting';
        AddT(reason_add_div, kSideLang.reason_add);
        reason_add_div.appendChild(this.reason_add_select);
        this.reason_add_select.onchange = (_) => { this.setReasonAdd(); };
        // Reason to delete.
        let reason_remove_div = AddC(this.div, 'div');
        reason_remove_div.className = 'setting';
        AddT(reason_remove_div, kSideLang.reason_delete);
        reason_remove_div.appendChild(this.reason_remove_select);
        this.reason_remove_select.onchange = (_) => { this.setReasonRemove(); };
        // Populate reasons.
        for (let i in kSideLang.reasons) {
            let option = document.createElement('option');
            option.value = i;
            let i_num = Number(i);
            AddT(option, FormatReason(i_num));
            if (IsValidReasonFor(i_num, 1)) {
                this.reason_add_select.appendChild(option);
            }
            else if (IsValidReasonFor(i_num, -1)) {
                this.reason_remove_select.appendChild(option);
            }
        }
        // Store default reasons in DataStore.
        this.setReasonAdd();
        this.setReasonRemove();
        // Edit mode.
        this.div.appendChild(this.edit_div);
        this.edit_div.className = 'setting';
        let edit_label = AddC(this.edit_div, 'label');
        edit_label.appendChild(this.edit_mode);
        this.edit_mode.type = 'checkbox';
        this.edit_mode.checked = this.edit_mode_value;
        this.edit_div.onclick = (e) => { this.toggleEditMode(e); };
        AddT(edit_label, kSideLang.edit_mode);
        // Stock-taking mode.
        this.div.appendChild(this.stock_div);
        this.stock_div.className = 'setting';
        this.stock_div.onclick = (e) => { this.toggleStockMode(e); };
        this.stock_mode.type = 'checkbox';
        this.stock_mode.checked = this.stock_mode_value;
        let stock_div = AddC(this.stock_div, 'div');
        let stock_label = AddC(stock_div, 'label');
        stock_label.appendChild(this.stock_mode);
        AddT(stock_label, kSideLang.stock_mode);
        this.stock_div.appendChild(this.stock_buttons);
        this.stock_buttons.style.display = 'none';
        AddButton(this.stock_buttons, kSideLang.stock_apply_all, 'apply', (event) => {
            event.stopPropagation();
            this.applyAllStock();
        });
        AddButton(this.stock_buttons, kSideLang.stock_reset_all, 'minus', (event) => {
            event.stopPropagation();
            this.resetAllStock();
        });
        // Connection status.
        let conn_status = new ConnectionUI(this.connection);
        this.div.appendChild(conn_status.create());
        // CSV export link.
        let link_container = AddC(this.div, 'p');
        let link = AddC(link_container, 'a');
        link.href = '/api/export';
        AddT(link, 'CSV-Export');
        // Special tools (for recovery from abnormal situations).
        this.div.appendChild(this.special_tools_div);
        this.special_tools_div.className = 'setting';
        this.special_tools_div.onclick = (_) => { this.toggleSpecialTools(); };
        this.special_tools_mode.type = 'checkbox';
        let special_div = AddC(this.special_tools_div, 'div');
        let special_label = AddC(special_div, 'label');
        special_label.appendChild(this.special_tools_mode);
        AddT(special_label, kSideLang.special_tools);
        this.special_tools_div.appendChild(this.special_tools_buttons);
        this.special_tools_buttons.style.display = 'none';
        AddButton(this.special_tools_buttons, kSideLang.forget_all, 'generic', (event) => {
            event.stopPropagation();
            this.specialForgetAll();
        });
        AddButton(this.special_tools_buttons, kSideLang.refetch_all, 'generic', (event) => {
            event.stopPropagation();
            this.specialRefetchAll();
        });
        AddButton(this.special_tools_buttons, kSideLang.push_all, 'generic', (event) => {
            event.stopPropagation();
            this.specialPushAll();
        });
    }
    toggleSpecialTools() {
        this.special_tools_mode.checked = !this.special_tools_mode.checked;
        let special_tools = this.special_tools_mode.checked;
        if (special_tools) {
            this.special_tools_div.classList.add('checked');
            this.special_tools_buttons.style.display = '';
        }
        else {
            this.special_tools_div.classList.remove('checked');
            this.special_tools_buttons.style.display = 'none';
        }
    }
    specialForgetAll() {
        if (!confirm(kSideLang.forget_all_sure))
            return;
        this.winelist.data.clearAll();
    }
    specialRefetchAll() {
        this.connection.kick(RequestType.kFetchAll);
    }
    specialPushAll() {
        this.connection.kick(RequestType.kPushAll);
    }
    toggleEditMode(e) {
        if (e.target.tagName == "LABEL")
            return;
        this.edit_mode.checked = this.edit_mode_value = !this.edit_mode_value;
        let edit_mode = this.edit_mode.checked;
        if (edit_mode) {
            this.edit_div.classList.add('checked');
        }
        else {
            this.edit_div.classList.remove('checked');
        }
        this.winelist.setEditMode(edit_mode);
    }
    toggleStockMode(e) {
        if (e.target.tagName == "LABEL")
            return;
        this.stock_mode.checked = this.stock_mode_value = !this.stock_mode_value;
        let stock_mode = this.stock_mode.checked;
        if (stock_mode) {
            this.stock_div.classList.add('checked');
            this.stock_buttons.style.display = '';
        }
        else {
            this.stock_div.classList.remove('checked');
            this.stock_buttons.style.display = 'none';
        }
        this.winelist.setStockMode(stock_mode);
    }
    applyAllStock() {
        if (!confirm(kSideLang.stock_apply_sure))
            return;
        this.winelist.applyAllStock();
    }
    resetAllStock() {
        if (!confirm(kSideLang.stock_reset_sure))
            return;
        this.winelist.resetAllStock();
    }
    toggleOnlyExisting(e) {
        if (e.target.tagName == "LABEL")
            return;
        let only_existing = !this.only_existing_value;
        this.only_existing.checked = this.only_existing_value = only_existing;
        this.winelist.setOnlyExisting(only_existing);
    }
    changeGrapeColorFilter() {
        let color = this.grape_color_select.value;
        this.winelist.setColorFilter(color);
        this.grape_select.setColorFilter(color);
        this.grape_select.updateShown();
        this.winelist.setGrapeFilter(kAny);
        this.updateFilterHighlight();
    }
    changeGrapeFilter() {
        let grape = this.grape_select.value();
        this.winelist.setGrapeFilter(grape);
        this.updateFilterHighlight();
    }
    changeCountryFilter() {
        let country = this.country_select.value();
        this.winelist.setCountryFilter(country);
        this.region_select.setCountryFilter(country);
        this.region_select.updateShown();
        this.winelist.setRegionFilter(kAny);
        this.updateFilterHighlight();
    }
    changeRegionFilter() {
        let region = this.region_select.value();
        this.winelist.setRegionFilter(region);
        this.updateFilterHighlight();
    }
    updateFilterHighlight() {
        let color_filter = this.grape_color_select.value;
        let grape_filter = this.grape_select.value();
        let country_filter = this.country_select.value();
        let region_filter = this.region_select.value();
        if (color_filter === GrapeColor.kAny && grape_filter === kAny &&
            country_filter === kAny && region_filter === kAny) {
            this.filter_div.classList.remove('checked');
        }
        else {
            this.filter_div.classList.add('checked');
        }
    }
    setReasonAdd() {
        let select = this.reason_add_select;
        this.winelist.data.default_reason_add = Number(select.value);
    }
    setReasonRemove() {
        let select = this.reason_remove_select;
        this.winelist.data.default_reason_remove = Number(select.value);
    }
}
var kCLang = {
    connection_status: 'Verbindung',
    connect_now: 'Jetzt verbinden',
    last_result: 'Status',
    error: 'Fehler',
    success: 'OK',
    last_success: 'Letzte',
    next_attempt: 'Nächste',
    never: 'nie',
    ago_prefix: 'vor ',
    ago_postfix: '',
    in_prefix: 'in ',
    in_postfix: '',
};
function formatTimeDelta(delta) {
    let seconds = Math.round(delta / 1000);
    let hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    let minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    if (hours > 0) {
        let mstr = (minutes > 9 ? "" : "0") + minutes.toString();
        return hours.toString() + 'h' + mstr + 'm';
    }
    if (minutes > 0) {
        let sstr = (seconds > 9 ? "" : "0") + seconds.toString();
        return minutes.toString() + 'm' + sstr + 's';
    }
    return seconds.toString() + 's';
}
function formatPast(delta) {
    if (delta > kHours * 24 * 365 * 10)
        return kCLang.never;
    let time = formatTimeDelta(delta);
    return kCLang.ago_prefix + time + kCLang.ago_postfix;
}
function formatFuture(delta) {
    let time = formatTimeDelta(delta);
    return kCLang.in_prefix + time + kCLang.in_postfix;
}
class ConnectionUI {
    constructor(connection) {
        this.connection = connection;
        this.box = document.createElement('div');
        this.last_result = document.createElement('span');
        this.last_success = document.createElement('span');
        this.next_attempt = document.createElement('span');
    }
    makeRow(table, label, content) {
        let div = AddC(table, 'div');
        let span = AddC(div, 'span');
        AddT(span, label + ':\u00a0 ');
        div.appendChild(content);
    }
    create() {
        this.box.className = 'setting connectionui';
        let header = AddC(this.box, 'div');
        AddT(header, kCLang.connection_status);
        let table = AddC(this.box, 'div');
        table.className = 'table';
        this.makeRow(table, kCLang.last_result, this.last_result);
        this.makeRow(table, kCLang.last_success, this.last_success);
        this.makeRow(table, kCLang.next_attempt, this.next_attempt);
        AddButton(this.box, kCLang.connect_now, 'generic', (_) => {
            this.connection.kick(RequestType.kManualSync);
        });
        window.setInterval(() => { this.update(); }, 1000);
        return this.box;
    }
    update() {
        let now = Date.now();
        let status;
        if (this.connection.last_result === Result.kSuccess) {
            status = kCLang.success;
            this.box.classList.remove('error');
        }
        else {
            status = kCLang.error;
            this.box.classList.add('error');
        }
        SetText(this.last_result, status);
        SetText(this.last_success, formatPast(now - this.connection.last_success));
        let next_ping = this.connection.next_ping;
        if (next_ping === -1) {
            SetText(this.next_attempt, kCLang.never);
        }
        else {
            SetText(this.next_attempt, formatFuture(next_ping - now));
        }
    }
}
//# sourceMappingURL=sidebar.js.map