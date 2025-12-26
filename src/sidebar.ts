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
  nonexisting: "Ausgetrunkene",
  storage_location: "Lagerort",
  filters: "Anzeigen:",
  colors_all: "alle Farben",
  color_only_red: "nur rot",
  color_only_white: "nur weiß",
  color_only_rose: "nur rosé",
  color_only_sparkling: "nur Sekt",
  unknown: "unbekannt",
  grapes_all: "alle Trauben",
  years_all: "alle Jahre",
  years_until_all: "bis...",
  countries_all: "alle Länder",
  regions_all: "alle Regionen",
  reasons: {
    [LogReason.kUnknown]: "unbekannt",
    [LogReason.kBought]: "Gekauft",
    [LogReason.kExisting]: "Bestand",
    [LogReason.kReceivedAsGift]: "Geschenkt bek.",
    [LogReason.kConsumed]: "Getrunken",
    [LogReason.kGivenAway]: "Verschenkt",
    [LogReason.kLost]: "Verlust",
    [LogReason.kStock]: "Inventur",
  },
  special_tools: "Spezial-Tools",
  forget_all: "Lokale Daten löschen",
  forget_all_sure: "Dies löscht alle lokal gespeicherten Daten und holt sie " +
                   "neu vom Server. Sicher?",
  refetch_all: "Alles neu laden",
  push_all: "Alles neu senden",
  consistency: "Konsistenz-Check",
};

function FormatReason(int: number): string {
  return (kSideLang.reasons as any)[int];
}

function AddButton(parent: Node, label: string, className: string,
                   onclick: (ev: MouseEvent) => any) {
  let div = AddC(parent, 'div');
  let button = AddC(div, 'button');
  AddT(button, label);
  button.className = className;
  button.onclick = onclick;
}

abstract class DynamicDropdown {
  protected select = document.createElement('select');
  protected data: DataStore;

  public create(data: DataStore, onchange: (ev: Event) => any) {
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
    if (this.showUnknownOption()) {
      let unknown = AddC(this.select, 'option');
      unknown.value = kUnknown;
      AddT(unknown, kSideLang.unknown);
    }
    this.customSetup();
    return this.select;
  }

  public value() { return this.select.value; }
  public element(): HTMLElement { return this.select; }

  public add(value: string) {
    let option = document.createElement('option');
    option.value = value;
    option.style.display = this.displayStyle(value);
    AddT(option, value);
    // Cast is guaranteed to be fine because of "all" option.
    let p = this.select.firstChild as HTMLOptionElement;
    // Cast is guaranteed to be fine because of "unknown" option.
    do {
      p = p.nextSibling as HTMLOptionElement;
    } while (p && p.value !== kUnknown && p.value < value);
    this.select.insertBefore(option, p);
  }

  public updateShown() {
    let p = this.select.firstChild as HTMLOptionElement;
    p = p.nextSibling as HTMLOptionElement;
    while (p && p.value !== kUnknown) {
      p.style.display = this.displayStyle(p.value);
      p = p.nextSibling as HTMLOptionElement;
    }
  }

  // Subclasses may override.
  protected displayStyle(value: string) { return ''; }
  protected customSetup() {}
  protected showUnknownOption() { return true; }
  protected abstract all_label: string;
  protected abstract getValues(): string[];
}

class GrapeFilter extends DynamicDropdown {
  protected all_label = kSideLang.grapes_all;
  private color_filter: string;

  protected getValues() {
    return this.data.grape_cache.getGrapes();
  }
  protected customSetup() {
    g_watchpoints.grapes.registerObserver(this);
  }
  public setColorFilter(value: string) {
    this.color_filter = value;
    this.select.value = kAny;
  }
  displayStyle(grape: string) {
    if (this.color_filter === GrapeColor.kAny) return '';
    let color_for_grape = ColorForGrape(grape, '');
    if (color_for_grape === this.color_filter) return '';
    if (color_for_grape === GrapeColor.kRed &&
        this.color_filter === GrapeColor.kRose) {
      return '';
    }
    return 'none';
  }
}

class YearFilter extends DynamicDropdown {
  protected all_label = kSideLang.years_all;
  protected getValues() {
    return this.data.year_cache.getYears();
  }
  protected customSetup() {
    g_watchpoints.years.registerObserver(this);
  }
  protected showUnknownOption() {
    return false;
  }
}

class YearUntilFilter extends YearFilter {
  protected all_label = kSideLang.years_until_all;
  constructor(protected year_filter: YearFilter) { super(); };
  displayStyle(year: string) {
    if (+year > +this.year_filter.value()) {
      return '';
    }
    return 'none';
  }
}

class CountryFilter extends DynamicDropdown {
  protected all_label = kSideLang.countries_all;
  protected getValues() {
    return this.data.geo_cache.getCountries();
  }
  protected customSetup() {
    g_watchpoints.countries.registerObserver(this);
  }
}

class RegionFilter extends DynamicDropdown {
  protected all_label = kSideLang.regions_all;
  private country_filter: string = kAny;
  protected getValues() {
    return this.data.geo_cache.getAllRegions();
  }
  protected customSetup() {
    g_watchpoints.regions.registerObserver(this);
  }
  public setCountryFilter(country: string) {
    this.country_filter = country;
  }
  displayStyle(region: string) {
    if (this.country_filter === kAny) return '';
    if (this.data.geo_cache.getCountry(region) === this.country_filter) {
      return '';
    }
    return 'none';
  }
}

class Sidebar {
  private div = document.createElement('div');
  private edit_div = document.createElement('div');
  private edit_mode = document.createElement('input');
  private edit_mode_value = false;
  private stock_div = document.createElement('div');
  private stock_mode = document.createElement('input');
  private stock_mode_value = false;
  private stock_buttons = document.createElement('span');
  private show_nonexisting = document.createElement('input');
  private nonexisting_value = false;
  private storage_location = document.createElement('input');
  private storage_location_value = false;
  private filter_div = document.createElement('div');
  private grape_color_select = document.createElement('select');
  private grape_select = new GrapeFilter();
  private year_select = new YearFilter();
  private year_until_select = new YearUntilFilter(this.year_select);
  private country_select = new CountryFilter();
  private region_select = new RegionFilter();
  private reason_add_select = document.createElement('select');
  private reason_remove_select = document.createElement('select');
  private special_tools_div = document.createElement('div');
  private special_tools_mode = document.createElement('input');
  private special_tools_buttons = document.createElement('span');
  private collapsed = false;

  constructor(private winelist: WinelistUI, private connection: Connection) {
    document.body.appendChild(this.div);
    this.div.className = 'sidebar';
  }

  create() {
    // Filters.
    this.div.appendChild(this.filter_div);
    this.filter_div.className = 'setting';
    AddT(this.filter_div, kSideLang.filters);
    // Grape color.
    this.filter_div.appendChild(this.grape_color_select);
    this.grape_color_select.onchange = (_) => { this.changeGrapeColorFilter(); }
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
    let color_rose = AddC(this.grape_color_select, 'option');
    color_rose.value = GrapeColor.kRose;
    AddT(color_rose, kSideLang.color_only_rose);
    let color_sparkling = AddC(this.grape_color_select, 'option');
    color_sparkling.value = GrapeColor.kSparkling;
    AddT(color_sparkling, kSideLang.color_only_sparkling);
    let color_unknown = AddC(this.grape_color_select, 'option');
    color_unknown.value = GrapeColor.kUnknown;
    AddT(color_unknown, kSideLang.unknown);
    // Grapes, years, countries, regions.
    this.filter_div.appendChild(
        this.grape_select.create(this.winelist.data, (_) => {
          this.changeGrapeFilter();
        }));
    this.filter_div.appendChild(
        this.year_select.create(this.winelist.data, (_) => {
          this.changeYearFilter();
        }));
    this.filter_div.appendChild(
        this.year_until_select.create(this.winelist.data, (_) => {
          this.changeYearFilter();
        }));
    this.year_until_select.element().style.display = 'none';
    this.filter_div.appendChild(
        this.country_select.create(this.winelist.data, (_) => {
          this.changeCountryFilter();
        }));
    this.filter_div.appendChild(
        this.region_select.create(this.winelist.data, (_) => {
          this.changeRegionFilter();
        }));
    // Spacer.
    AddC(this.filter_div, 'hr');
    // Only existing.
    let existing_label = AddC(this.filter_div, 'label');
    existing_label.appendChild(this.show_nonexisting);
    this.show_nonexisting.type = 'checkbox';
    this.show_nonexisting.checked = this.nonexisting_value;
    existing_label.onclick = (e) => { this.toggleOnlyExisting(e); };
    AddT(existing_label, kSideLang.nonexisting);
    // Storage location.
    let storage_label = AddC(this.filter_div, 'label');
    storage_label.appendChild(this.storage_location);
    this.storage_location.type = 'checkbox';
    this.storage_location.checked = this.storage_location_value;
    storage_label.onclick = (e) => { this.toggleStorageLocation(e); };
    AddT(storage_label, kSideLang.storage_location);

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
      } else if (IsValidReasonFor(i_num, -1)) {
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
    AddButton(
        this.stock_buttons, kSideLang.stock_apply_all, 'apply', (event) => {
          event.stopPropagation();
          this.applyAllStock();
        });
    AddButton(
        this.stock_buttons, kSideLang.stock_reset_all, 'minus', (event) => {
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
    AddButton(
        this.special_tools_buttons, kSideLang.forget_all, 'generic',
        (event) => {
          event.stopPropagation();
          this.specialForgetAll();
        });
    AddButton(
        this.special_tools_buttons, kSideLang.refetch_all, 'generic',
        (event) => {
          event.stopPropagation();
          this.specialRefetchAll();
        });
    AddButton(
        this.special_tools_buttons, kSideLang.push_all, 'generic', (event) => {
          event.stopPropagation();
          this.specialPushAll();
        });
    AddButton(
        this.special_tools_buttons, kSideLang.consistency, 'generic',
        (event) => {
          event.stopPropagation();
          this.specialConsistency();
        });

    // Collapsing support.
    function StripPx(str: string) {
      if (str.endsWith("px")) {
        str = str.substring(0, str.length - 2);
      }
      return +str;
    }
    let style = window.getComputedStyle(this.div);
    let width = StripPx(style.width);
    let padding = StripPx(style.paddingRight);
    let normal_body_padding = `${width + 2 * padding}px`;
    let collapsed_body_padding = `${padding}px`;
    document.body.style.paddingRight = normal_body_padding;
    let right = width + padding;
    let animation = this.div.animate(
        [{translate: '0px'}, {translate: `${right}px`}],
        {duration: 300, iterations: 1, fill: "forwards"});
    animation.pause();
    this.div.onclick = (e) => {
      if (e.target !== this.div) return;
      if (this.collapsed) {
        this.collapsed = false;
        // We don't animate the body because that's too slow to look good.
        document.body.style.paddingRight = normal_body_padding;
        animation.playbackRate = -1;
        animation.play();
      } else {
        this.collapsed = true;
        document.body.style.paddingRight = collapsed_body_padding;
        animation.playbackRate = 1;
        animation.play();
      }
    }
  }

  private toggleSpecialTools() {
    this.special_tools_mode.checked = !this.special_tools_mode.checked;
    let special_tools = this.special_tools_mode.checked;
    if (special_tools) {
      this.special_tools_div.classList.add('checked');
      this.special_tools_buttons.style.display = '';
    } else {
      this.special_tools_div.classList.remove('checked');
      this.special_tools_buttons.style.display = 'none';
    }
  }
  private specialForgetAll() {
    if (!confirm(kSideLang.forget_all_sure)) return;
    this.winelist.data.clearAll();
  }
  private specialRefetchAll() {
    this.connection.kick(RequestType.kFetchAll);
  }
  private specialPushAll() {
    this.connection.kick(RequestType.kPushAll);
  }
  private specialConsistency() {
    this.connection.kick(RequestType.kConsistency);
  }

  private toggleEditMode(e: MouseEvent) {
    if ((e.target as HTMLElement).tagName == "LABEL") return;
    this.edit_mode.checked = this.edit_mode_value = !this.edit_mode_value;
    let edit_mode = this.edit_mode.checked;
    if (edit_mode) {
      this.edit_div.classList.add('checked');
    } else {
      this.edit_div.classList.remove('checked');
    }
    this.winelist.setEditMode(edit_mode);
  }

  private toggleStockMode(e: MouseEvent) {
    if ((e.target as HTMLElement).tagName == "LABEL") return;
    this.stock_mode.checked = this.stock_mode_value = !this.stock_mode_value;
    let stock_mode = this.stock_mode.checked;
    if (stock_mode) {
      this.stock_div.classList.add('checked');
      this.stock_buttons.style.display = '';
    } else {
      this.stock_div.classList.remove('checked');
      this.stock_buttons.style.display = 'none';
    }
    this.winelist.setStockMode(stock_mode);
  }

  private applyAllStock() {
    if (!confirm(kSideLang.stock_apply_sure)) return;
    this.winelist.applyAllStock();
  }
  private resetAllStock() {
    if (!confirm(kSideLang.stock_reset_sure)) return;
    this.winelist.resetAllStock();
  }

  private toggleOnlyExisting(e: MouseEvent) {
    if ((e.target as HTMLElement).tagName == "LABEL") return;
    let nonexisting = !this.nonexisting_value;
    this.show_nonexisting.checked = this.nonexisting_value = nonexisting;
    this.winelist.setOnlyExisting(!nonexisting);
  }

  private toggleStorageLocation(e: MouseEvent) {
    if ((e.target as HTMLElement).tagName == "LABEL") return;
    let location = !this.storage_location_value;
    this.storage_location.checked = this.storage_location_value = location;
    this.winelist.setShowStorageLocation(location);
  }

  private changeGrapeColorFilter() {
    let color = this.grape_color_select.value as GrapeColor;
    this.winelist.setColorFilter(color);
    this.grape_select.setColorFilter(color);
    this.grape_select.updateShown();
    this.winelist.setGrapeFilter(kAny);
    this.updateFilterHighlight();
  }

  private changeGrapeFilter() {
    let grape = this.grape_select.value();
    this.winelist.setGrapeFilter(grape);
    this.updateFilterHighlight();
  }

  private changeYearFilter() {
    let year = this.year_select.value();
    let year_from, year_to;
    if (year === kAny) {
      year_from = 0;
      year_to = 0;
      this.year_until_select.element().style.display = 'none';
    } else {
      year_from = +year;
      let year_until = this.year_until_select.value();
      year_to = year_until === kAny ? 0 : +year_until;
      this.year_until_select.element().style.display = '';
      this.year_until_select.updateShown();
    }
    this.winelist.setYearFilter(year_from, year_to);
    this.updateFilterHighlight();
  }

  private changeCountryFilter() {
    let country = this.country_select.value();
    this.winelist.setCountryFilter(country);
    this.region_select.setCountryFilter(country);
    this.region_select.updateShown();
    this.winelist.setRegionFilter(kAny);
    this.updateFilterHighlight();
  }

  private changeRegionFilter() {
    let region = this.region_select.value();
    this.winelist.setRegionFilter(region);
    this.updateFilterHighlight();
  }

  private updateFilterHighlight() {
    let color_filter = this.grape_color_select.value as GrapeColor;
    let grape_filter = this.grape_select.value();
    let year_filter = this.year_select.value();
    let country_filter = this.country_select.value();
    let region_filter = this.region_select.value();
    if (color_filter === GrapeColor.kAny && grape_filter === kAny &&
        year_filter === kAny && country_filter === kAny &&
        region_filter === kAny) {
      this.filter_div.classList.remove('checked');
    } else {
      this.filter_div.classList.add('checked');
    }
  }

  private setReasonAdd() {
    let select = this.reason_add_select;
    this.winelist.data.default_reason_add = Number(select.value);
  }
  private setReasonRemove() {
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
  ago_prefix: 'vor ',  // For past points in time: "2 hours ago".
  ago_postfix: '',
  in_prefix: 'in ',  // For future points in time: "in 2 hours".
  in_postfix: '',
}

function formatTimeDelta(delta: number) {
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

function formatPast(delta: number) {
  if (delta > kHours * 24 * 365 * 10) return kCLang.never;
  let time = formatTimeDelta(delta);
  return kCLang.ago_prefix + time + kCLang.ago_postfix;
}

function formatFuture(delta: number) {
  let time = formatTimeDelta(delta);
  return kCLang.in_prefix + time + kCLang.in_postfix;
}

class ConnectionUI {
  private box = document.createElement('div');
  private last_result = document.createElement('span');
  private last_success = document.createElement('span');
  private next_attempt = document.createElement('span');

  constructor(private connection: Connection) {}

  private makeRow(table: Node, label: string, content: Node) {
    let div = AddC(table, 'div');
    let span = AddC(div, 'span');
    AddT(span, label + ':\u00a0 ');
    div.appendChild(content);
  }

  create() {
    this.box.className = 'setting connectionui';
    let header = AddC(this.box, 'div');
    AddT(header, kCLang.connection_status);

    let prefix = this.connection.getPrefix();
    if (prefix !== '') {
      let div = AddC(this.box, 'div');
      AddT(div, prefix);
    }

    let table = AddC(this.box, 'div');
    table.className = 'table'
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
    } else {
      status = kCLang.error;
      this.box.classList.add('error');
    }
    SetText(this.last_result, status);
    SetText(this.last_success, formatPast(now - this.connection.last_success));
    let next_ping = this.connection.next_ping;
    if (next_ping === -1) {
      SetText(this.next_attempt, kCLang.never);
    } else {
      SetText(this.next_attempt, formatFuture(next_ping - now));
    }
  }
}
