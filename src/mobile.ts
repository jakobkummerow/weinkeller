"use strict";

let g_mdata: DataStore;
let g_mconnection: Connection;

// TODO: update for deleted and revived years,
//       g_watchpoints.deletions.registerObserver(...);
// TODO: show connection status?
// TODO: edit popup box?

class VineyardDiv {
  static kDefaultVisibilitySentinel: string = "__default_visibility";
  private div = document.createElement('div');
  private name = document.createElement('span');
  private wines: WineSpan[] = [];
  private visibility: string = VineyardDiv.kDefaultVisibilitySentinel;
  constructor(public vineyard: Vineyard) {
    vineyard.registerObserver(this);
    this.div.className = 'vineyard';
    this.div.appendChild(this.name);
    this.update();
  }
  addAll() {
    this.vineyard.iterateWines((wine) => {
      let wine_span = this.addWine(wine);
      wine_span.addAllYears();
    });
    this.maybeHide();
  }
  create() { return this.div; }
  update() {
    SetText(this.name, this.vineyard.data.name);
  }
  addWine(wine: Wine) {
    let index = 0;
    while (index < this.wines.length &&
           this.wines[index].getName().localeCompare(wine.data.name) < 0) {
      index++;
    }
    if (index < this.wines.length &&
        this.wines[index].getName() === wine.data.name) {
      return this.wines[index];
    }
    // Add a new WineSpan.
    for (let i = this.wines.length - 1; i >= index; i--) {
      this.wines[i+1] = this.wines[i];
    }
    let span = new WineSpan(wine);
    this.wines[index] = span;
    if (index === this.wines.length - 1) {
      this.div.appendChild(span.create());
    } else {
      this.div.insertBefore(span.create(), this.wines[index + 1].span);
    }
    return span;
  }
  addYear(year: Year) {
    let wine = this.addWine(year.wine);
    wine.addYear(year);
    wine.maybeHide();
    this.maybeHide();
  }
  maybeHide() {
    let hidden = true;
    for (let w of this.wines) {
      if (w.is_visible()) {
        hidden = false;
        break;
      }
    }
    if (hidden) {
      this.hide();
    } else {
      this.show();
    }
  }
  hide() {
    if (this.visibility !== VineyardDiv.kDefaultVisibilitySentinel) return;
    this.visibility = this.div.style.display;
    this.div.style.display = 'none';
  }
  show() {
    if (this.visibility === VineyardDiv.kDefaultVisibilitySentinel) return;
    this.div.style.display = this.visibility;
    this.visibility = VineyardDiv.kDefaultVisibilitySentinel;
  }
  public getName() { return this.vineyard.data.name; }
}

class WineSpan {
  static kDefaultVisibilitySentinel: string = "__default_visibility";
  public span = document.createElement('span');
  private name = document.createElement('span');
  private years: YearSpan[] = [];
  private visibility: string = WineSpan.kDefaultVisibilitySentinel;
  constructor(private wine: Wine) {
    wine.registerObserver(this);
    this.span.className = 'wine';
    this.span.appendChild(this.name);
    this.update();
  }
  addAllYears() {
    this.wine.iterateYears((year) => { this.addYear(year); });
    this.maybeHide();
  }
  create() { return this.span; }
  update() {
    SetText(this.name, this.wine.data.name);
  }
  addYear(year: Year) {
    // Mobile view always hides years with zero bottles.
    if (year.data.count <= 0) return;
    let span = new YearSpan(year);
    let index = 0;
    while (index < this.years.length &&
           this.years[index].getYear() < year.data.year) {
      index++;
    }
    for (let i = this.years.length - 1; i >= index; i--) {
      this.years[i+1] = this.years[i];
    }
    this.years[index] = span;
    if (index === this.years.length - 1) {
      this.span.appendChild(span.create());
    } else {
      this.span.insertBefore(span.create(), this.years[index+1].span);
    }
    // Un-hide if needed (if a new year is added to a wine that was hidden
    // previously).
    this.show();
  }
  getName() { return this.wine.data.name; }
  public is_visible() {
    return this.visibility === WineSpan.kDefaultVisibilitySentinel;
  }
  public maybeHide() {
    if (this.years.length === 0) this.hide();
  }
  private hide() {
    if (!this.is_visible()) return;
    this.visibility = this.span.style.display;
    this.span.style.display = 'none';
  }
  private show() {
    if (this.is_visible()) return;
    this.span.style.display = this.visibility;
    this.visibility = WineSpan.kDefaultVisibilitySentinel;
  }
}

class YearSpan {
  public span = document.createElement('span');
  private count = document.createElement('span');
  private plus_button = document.createElement('button');
  private minus_button = document.createElement('button');
  private price = document.createElement('span');
  constructor(private year: Year) {
    year.registerObserver(this);
    this.span.className = 'year';
    this.plus_button.className = 'plus';
    this.plus_button.onclick = (_) => { this.year.clickPlus(); };
    AddT(this.plus_button, '+');
    this.minus_button.className = 'minus';
    this.minus_button.onclick = (_) => { this.year.clickMinus(); };
    AddT(this.minus_button, '−');
    let count_span = AddC(this.span, 'span');
    count_span.appendChild(this.count);
    count_span.appendChild(this.plus_button);
    count_span.appendChild(this.minus_button);
    AddT(this.span, this.year.data.year.toString());
    this.span.appendChild(count_span);
    this.span.appendChild(this.price);
    this.update();
  }

  create() { return this.span; }
  update() {
    let data = this.year.data;
    let count = data.count;
    if (count === 0) {
      this.minus_button.disabled = true;
    } else {
      this.minus_button.disabled = false;
    }
    SetText(this.count, count.toString());
    SetText(this.price, FormatPrice(data.price));
  }
  getYear() { return this.year.data.year; }
}

class WinelistMobileUI {
  private container: HTMLDivElement;
  private vineyards: VineyardDiv[] = [];
  constructor(private data: DataStore) {
    this.container = AddC(document.body, 'div');
  }

  create() {
    this.data.ui = this;  // Ready for update notifications now.

    this.data.iterateVineyards((vineyard: Vineyard) => {
      let v = new VineyardDiv(vineyard);
      v.addAll();
      this.vineyards.push(v);
    });
    this.vineyards.sort(
        (a, b) => a.vineyard.data.name.localeCompare(b.vineyard.data.name));
    for (let v of this.vineyards) {
      this.container.appendChild(v.create());
    }
  }

  addYear(year: Year) {
    let vineyard = year.wine.vineyard;
    let name = vineyard.data.name;
    let index = 0;
    while (index < this.vineyards.length &&
           this.vineyards[index].getName().localeCompare(name) < 0) {
      index++;
    }
    let vineyard_div: VineyardDiv;
    if (index < this.vineyards.length &&
        this.vineyards[index].getName() === name) {
      vineyard_div = this.vineyards[index];
    } else {
      vineyard_div = new VineyardDiv(vineyard);
      if (index >= this.vineyards.length) {
        this.container.appendChild(vineyard_div.create());
        this.vineyards.push(vineyard_div);
      } else {
        let next_child = this.container.firstChild as ChildNode;
        for (let i = 0; i < index; i++) {
          next_child = next_child.nextSibling as ChildNode;
        }
        this.container.insertBefore(vineyard_div.create(), next_child);
        this.vineyards.splice(index, 0, vineyard_div);
      }
    }
    vineyard_div.addYear(year);
    vineyard_div.maybeHide();
  }

  reviveYear(year: Year) {
    // TODO: can this happen on mobile?
  }
  addLog(log: Log) {
    // Log is not shown on mobile.
  }
}

function winelist_mobile_main() {
  g_mdata = new DataStore();
  g_mconnection = new Connection(g_mdata);
  let ui = new WinelistMobileUI(g_mdata);
  g_mdata.initializeFromDatabase().then(() => {
    ui.create();
    g_mconnection.start();
  });
}