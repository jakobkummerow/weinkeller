"use strict";

const kLogLang = {
  date: 'Datum',
  wine: 'Wein',
  count: 'Anzahl',
  reason: 'Grund',
  last_count_prefix: 'Letzte ',  // "<10> most recent changes".
  last_count_postfix: ' Änderungen:',
};

enum ChangeDirection {
  kAdding,
  kRemoving,
  kUnknown,
}

class LogWineTD {
  public td = document.createElement('td');
  constructor(private year: Year) {
    this.year.wine.registerObserver(this);
    this.year.wine.vineyard.registerObserver(this);
  }
  update() {
    let w = this.year.wine;
    let v = w.vineyard;
    let text = [v.data.name, w.data.name, this.year.data.year].join(' ');
    SetText(this.td, text);
  }
  unregisterObservers() {
    this.year.wine.unregisterObserver(this);
    this.year.wine.vineyard.unregisterObserver(this);
  }
}


class LogTR {
  tr = document.createElement('tr');
  private wine: LogWineTD;
  private count_td = document.createElement('td');
  private reason_td = document.createElement('td');
  private reason_string = document.createElement('span');
  private select = document.createElement('select');
  private direction = ChangeDirection.kUnknown;

  constructor(private log: Log) {
    AddT(AddC(this.tr, 'td'), log.data.date);
    this.wine = new LogWineTD(log.year);
    this.tr.appendChild(this.wine.td);
    this.tr.appendChild(this.count_td);
    this.tr.appendChild(this.reason_td);
    this.reason_td.appendChild(this.reason_string);
    this.reason_td.appendChild(this.select);
    this.select.className = 'reason';
    this.reason_td.onchange = (_) => { this.changeReason(); };
    this.update();
    this.wine.update();
  }
  update() {
    let data = this.log.data;
    let delta = data.delta;
    let direction = delta > 0 ? ChangeDirection.kAdding :
                    delta < 0 ? ChangeDirection.kRemoving :
                    ChangeDirection.kUnknown;
    if (direction !== this.direction) {
      let s = this.select;
      while (s.firstChild) s.removeChild(s.firstChild);
      for (let i in kSideLang.reasons) {
        let i_num = Number(i);
        if (i_num !== data.reason && !IsValidReasonFor(i_num, delta)) continue;
        let option = AddC(s, 'option');
        option.value = i;
        AddT(option, FormatReason(i_num));
        if (i_num === data.reason) option.selected = true;
      }
    }
    SetText(this.reason_string, FormatReason(data.reason));
    SetText(this.count_td, delta.toString());
  }
  changeReason() {
    this.log.updateReason(Number(this.select.value));
  }
  unregisterObservers() {
    this.wine.unregisterObservers();
  }
}

class LogEntry {
  public date: string;
  private previous_delta: number;
  constructor(public log: Log, public tr: LogTR | null, private ui: LogUI) {
    this.date = log.data.date;
    this.log.registerObserver(this);
    this.previous_delta = log.data.delta;
  }
  show() {
    if (this.tr === null) this.tr = new LogTR(this.log);
    return this.tr.tr;
  }
  hide(parent_element: Node) {
    if (this.tr === null) return;
    parent_element.removeChild(this.tr.tr);
    this.tr.unregisterObservers();
    this.tr = null;
  }
  update() {
    let delta = this.log.data.delta;
    if ((delta === 0) !== (this.previous_delta === 0)) {
      this.ui.redraw();
    }
    this.previous_delta = delta;
    if (this.tr !== null) this.tr.update();
  }
}

class LogUI {
  private table = document.createElement('table');
  private tbody = document.createElement('tbody');
  private count = document.createElement('select');
  private count_value: number;
  private log_data: LogEntry[] = [];
  private sorter = (a: LogEntry, b: LogEntry) => {
    let a_date = a.date;
    let b_date = b.date;
    if (a_date < b_date) return -1;
    if (a_date > b_date) return 1;
    return a.log.local_id - b.log.local_id;
  }

  constructor(private data: DataStore) {
    let container = AddC(document.body, 'div');
    // Create headline.
    let header = AddC(container, 'div');
    AddT(header, kLogLang.last_count_prefix);
    header.className = 'logheader';
    header.appendChild(this.count);
    AddT(header, kLogLang.last_count_postfix);
    for (let c of [10, 20, 50, 100]) {
      let o = AddC(this.count, 'option');
      let c_str = c.toString();
      AddT(o, c_str);
      o.value = c_str;
    }
    this.count.onchange = (_) => { this.redraw(); }
    container.appendChild(this.table);
    container.className = 'loglistcontainer';
    this.table.className = 'loglist';
  }

  create() {
    // Create table header row.
    let thead = AddC(this.table, 'thead');
    let tr = AddC(thead, 'tr');
    AddT(AddC(tr, 'td'), kLogLang.date);
    AddT(AddC(tr, 'td'), kLogLang.wine);
    AddT(AddC(tr, 'td'), kLogLang.count);
    AddT(AddC(tr, 'td'), kLogLang.reason);

    // Populate.
    this.table.appendChild(this.tbody);
    for (let l of this.data.log) {
      if (!l) continue;
      this.log_data.push(new LogEntry(l, null, this));
    }
    this.log_data.sort(this.sorter);
    this.redraw();
  }

  private populate(count: number) {
    let i = this.log_data.length - 1;
    for (; count > 0 && i >= 0; i--) {
      let entry = this.log_data[i];
      if (entry.log.data.delta === 0) {
        entry.hide(this.tbody);
        continue;
      }
      entry.show();
      this.tbody.appendChild(entry.show());
      count--;
    }
    for (; i >= 0; i--) {
      this.log_data[i].hide(this.tbody);
    }
  }
  redraw() {
    this.count_value = Number(this.count.value);
    this.populate(this.count_value);
  }

  addLog(log: Log) {
    let entry = new LogEntry(log, null, this);
    let last_index = this.log_data.length - 1;
    this.log_data.push(entry);
    if (log.data.delta !== 0 &&
        (last_index < 0 || this.sorter(this.log_data[last_index], entry) < 0)) {
      // Common case: new log is the latest entry.
      this.tbody.insertBefore(entry.show(), this.tbody.firstChild);
      if (this.log_data.length > this.count_value) {
        let last_shown_index = last_index - this.count_value + 1;
        this.log_data[last_shown_index].hide(this.tbody);
      }
    } else {
      this.log_data.sort(this.sorter);
      this.populate(this.count_value);
    }
  }
}