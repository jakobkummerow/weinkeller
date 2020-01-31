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
  filters: "Filter",
  grapes: "Nur rot/weiß anzeigen:",
  grapes_all: "alle",
  grapes_only_red: "nur rot",
  grapes_only_white: "nur weiß",
  grapes_unknown: "unbekannt",
  reasons: {
    0: "unbekannt",
    1: "Gekauft",
    2: "Bestand",
    3: "Geschenkt bek.",
    11: "Getrunken",
    12: "Verschenkt",
    13: "Verlust",
  },
};

function IsValidReasonFor(reason: number, delta: number) {
  if (delta > 0) return reason > 0 && reason < 10;
  if (delta < 0) return reason > 10;
  return reason === 0;
}

function FormatReason(int: number): string {
  return (kSideLang.reasons as any)[int];
}

class Sidebar {
  private div = document.createElement('div');
  private edit_div = document.createElement('div');
  private edit_mode = document.createElement('input');
  private stock_div = document.createElement('div');
  private stock_mode = document.createElement('input');
  private stock_buttons = document.createElement('span');
  private only_existing = document.createElement('input');
  private grape_div = document.createElement('div');
  private grape_select = document.createElement('select');
  private reason_add_select = document.createElement('select');
  private reason_remove_select = document.createElement('select');

  constructor(private winelist: WinelistUI) {
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
    this.only_existing.checked = true;
    existing_div.onclick = (_) => { this.toggleOnlyExisting(); };
    AddT(existing_label, kSideLang.only_existing);

    // Grapes.
    this.div.appendChild(this.grape_div);
    this.grape_div.className = 'setting';
    AddT(this.grape_div, kSideLang.grapes);  // label?
    this.grape_div.appendChild(this.grape_select);
    this.grape_select.onchange = (_) => { this.changeGrapeFilter(); }
    let gr_all = AddC(this.grape_select, 'option');
    gr_all.selected = true;
    gr_all.value = GrapeColor.kAny;
    AddT(gr_all, kSideLang.grapes_all);
    let gr_red = AddC(this.grape_select, 'option');
    gr_red.value = GrapeColor.kRed;
    AddT(gr_red, kSideLang.grapes_only_red);
    let gr_white = AddC(this.grape_select, 'option');
    gr_white.value = GrapeColor.kWhite;
    AddT(gr_white, kSideLang.grapes_only_white);
    let gr_unknown = AddC(this.grape_select, 'option');
    gr_unknown.value = GrapeColor.kUnknown;
    AddT(gr_unknown, kSideLang.grapes_unknown);

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
    this.edit_div.onclick = (event) => { this.toggleEditMode(); };
    AddT(edit_label, kSideLang.edit_mode);

    // Stock-taking mode.
    this.div.appendChild(this.stock_div);
    this.stock_div.className = 'setting';
    let stock_div = AddC(this.stock_div, 'div');
    let stock_label = AddC(stock_div, 'label');
    stock_label.appendChild(this.stock_mode);
    this.stock_mode.type = 'checkbox';
    this.stock_div.onclick = (event) => { this.toggleStockMode(); };
    AddT(stock_label, kSideLang.stock_mode);
    this.stock_div.appendChild(this.stock_buttons);
    this.stock_buttons.style.display = 'none';
    let apply_div = AddC(this.stock_buttons, 'div');
    let apply_button = AddC(apply_div, 'button');
    apply_button.className = 'apply';
    apply_button.onclick = (event) => {
      event.stopPropagation();
      this.applyAllStock();
    };
    AddT(apply_button, kSideLang.stock_apply_all);
    let reset_div = AddC(this.stock_buttons, 'div');
    let reset_button = AddC(reset_div, 'button');
    reset_button.className = 'minus';
    reset_button.onclick = (event) => {
      event.stopPropagation();
      this.resetAllStock();
    };
    AddT(reset_button, kSideLang.stock_reset_all);

    // Connection status.
    let conn_status = new ConnectionUI(g_connection);
    this.div.appendChild(conn_status.create());

    // CSV export link.
    let link_container = AddC(this.div, 'p');
    let link = AddC(link_container, 'a');
    link.href = '/api/export';
    AddT(link, 'CSV-Export');
  }

  private toggleEditMode() {
    this.edit_mode.checked = !this.edit_mode.checked;
    let edit_mode = this.edit_mode.checked;
    if (edit_mode) {
      this.edit_div.classList.add('checked');
    } else {
      this.edit_div.classList.remove('checked');
    }
    this.winelist.setEditMode(edit_mode);
  }

  private toggleStockMode() {
    this.stock_mode.checked = !this.stock_mode.checked;
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

  private toggleOnlyExisting() {
    this.only_existing.checked = !this.only_existing.checked;
    let only_existing = this.only_existing.checked;
    this.winelist.setOnlyExisting(only_existing);
  }

  private changeGrapeFilter() {
    let grape_filter = this.grape_select.value as GrapeColor;
    if (grape_filter === GrapeColor.kAny) {
      this.grape_div.classList.remove('checked');
    } else {
      this.grape_div.classList.add('checked');
    }
    this.winelist.setGrapeFilter(grape_filter);
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

    let table = AddC(this.box, 'div');
    table.className = 'table'
    this.makeRow(table, kCLang.last_result, this.last_result);
    this.makeRow(table, kCLang.last_success, this.last_success);
    this.makeRow(table, kCLang.next_attempt, this.next_attempt);

    let button_div = AddC(this.box, 'div');
    let button = AddC(button_div, 'button');
    AddT(button, kCLang.connect_now);
    button.className = 'generic';
    button.onclick = (_) => { this.connection.kick(true); };
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
    SetText(this.next_attempt, formatFuture(this.connection.next_ping - now));
  }
}
