"use strict";

abstract class DataObject {
  constructor(public server_id: number, private dirty: number = 0) {}
  public abstract maybeUpdate(new_data: any): boolean;

  isDirty() { return this.dirty !== 0; }
  markDirty() { this.dirty |= 1; }
  markSyncPending() { this.dirty = 2; }
  markSyncDone() { this.dirty &= (~2); }
  assertSame(other: any, properties: string[]) {
    for (let key of properties) {
      if ((this as any)[key] !== other[key]) {
        throw (
            'Bug: ' + key + ' must match, was ' + (this as any)[key] + ', is ' +
            other[key]);
      }
    }
  }
  protected applyUpdates(other: any, properties: string[]) {
    if (this.isDirty()) return false;
    let changed = false;
    for (let key of properties) {
      if (other.hasOwnProperty(key) && (this as any)[key] !== other[key]) {
        (this as any)[key] = other[key];
        changed = true;
      }
    }
    return changed;
  }
  packForSync(local_id: number) {
    this.markSyncPending();
    let result: any = {local_id};
    for (let k of Object.keys(this)) {
      if (k === "dirty") continue;
      result[k] = (this as any)[k];
    }
    return result;
  }
}

class VineyardData extends DataObject {
  constructor(
      server_id: number, dirty: number, public name: string,
      public region: string, public country: string, public website: string,
      public address: string, public comment: string) {
    super(server_id, dirty);
  }
  static fromStruct(v: any) {
    return new VineyardData(
        v.server_id, v.dirty, v.name, v.region, v.country, v.website, v.address,
        v.comment);
  }
  maybeUpdate(new_data: any) {
    this.assertSame(new_data, ['server_id']);
    return this.applyUpdates(
        new_data,
        ['name', 'region', 'country', 'website', 'address', 'comment']);
  }
}

class WineData extends DataObject {
  constructor(
      server_id: number, dirty: number, public vineyard_id: number,
      public name: string, public grape: string, public comment: string) {
    super(server_id, dirty);
  }
  static fromStruct(w: any) {
    return new WineData(
        w.server_id, w.dirty, w.vineyard_id, w.name, w.grape, w.comment);
  }
  maybeUpdate(new_data: any) {
    this.assertSame(new_data, ['server_id', 'vineyard_id']);
    return this.applyUpdates(new_data, ['name', 'grape', 'comment']);
  }
  copyForVineyard(vineyard_id: number) {
    return new WineData(0, 1, vineyard_id, this.name, this.grape, this.comment);
  }
}

class YearData extends DataObject {
  constructor(
      server_id: number, dirty: number, public wine_id: number,
      public year: number, public count: number, public stock: number,
      public price: number, public rating: number, public value: number,
      public sweetness: number, public age: number, public age_update: number,
      public comment: string, public location: string) {
    super(server_id, dirty);
  }
  static fromStruct(y: any) {
    // Fields that were added later need special handling to fill in defaults.
    let location = y.location === undefined ? "" : y.location;
    let age_update = y.age_update === undefined ? 0 : y.age_update;
    return new YearData(
        y.server_id, y.dirty, y.wine_id, y.year, y.count, y.stock, y.price,
        y.rating, y.value, y.sweetness, y.age, age_update, y.comment, location);
  }
  maybeUpdate(new_data: any) {
    this.assertSame(new_data, ['server_id', 'wine_id', 'year']);
    return this.applyUpdates(new_data, [
      'count', 'stock', 'price', 'rating', 'value', 'sweetness', 'age',
      'age_update', 'comment', 'location'
    ]);
  }
  CopyForWine(wine_id: number) {
    return new YearData(
        0, 1, wine_id, this.year, this.count, this.stock, this.price,
        this.rating, this.value, this.sweetness, this.age, this.age_update,
        this.comment, this.location);
  }
}

class LogData extends DataObject {
  constructor(
      server_id: number, dirty: number, public date: string,
      public year_id: number, public delta: number, public reason: number,
      public comment: string) {
    super(server_id, dirty);
  }
  static fromStruct(l: any) {
    return new LogData(
        l.server_id, l.dirty, l.date, l.year_id, l.delta, l.reason, l.comment);
  }
  maybeUpdate(new_data: any) {
    this.assertSame(new_data, ['server_id', 'date', 'year_id']);
    return this.applyUpdates(new_data, ['delta', 'reason', 'comment']);
  }
}

interface Observer {
  update(): void;
}
interface AdditionObserver {
  add(new_value: string): void;
}

class AbstractObservable<ObserverType> {
  protected observers: ObserverType[] = [];
  registerObserver(observer: ObserverType) {
    this.observers.push(observer);
  }
  unregisterObserver(observer: ObserverType) {
    let index = this.observers.indexOf(observer);
    if (index === this.observers.length - 1) {
      this.observers.pop();
    } else {
      this.observers[index] = this.observers.pop() as ObserverType;
    }
  }
}

class Observable extends AbstractObservable<Observer> {
  notifyObservers() {
    for (let observer of this.observers) {
      observer.update();
    }
  }
}

class TotalsWatchPoint extends Observable {
  private price_delta = 0;
  private count_delta = 0;
  constructor() { super(); }

  notifyDelta(price_delta: number, count_delta: number) {
    this.price_delta = price_delta;
    this.count_delta = count_delta;
    this.notifyObservers();
  }
  priceDelta() { return this.price_delta; }
  countDelta() { return this.count_delta; }
}

class StringAdditionObservable extends AbstractObservable<AdditionObserver> {
  notifyObservers(new_value: string) {
    for (let observer of this.observers) {
      observer.add(new_value);
    }
  }
}

class Watchpoints {
  public deletions = new Observable();
  public grape_names = new Observable();
  public vineyard_countries = new Observable();
  public vineyard_regions = new Observable();
  public totals = new TotalsWatchPoint();
  public grapes = new StringAdditionObservable();
  public years = new StringAdditionObservable();
  public countries = new StringAdditionObservable();
  public regions = new StringAdditionObservable();
  public locations = new StringAdditionObservable();
  constructor() {}
}
var g_watchpoints = new Watchpoints();

abstract class DataWrapper<DataObjectType extends DataObject> extends
    Observable {
  constructor(
      public store: DataStore, public local_id: number,
      public data: DataObjectType) {
    super();
  }
  abstract getWriteStore(): IDBObjectStore;

  maybeUpdate(new_data: any) {
    if (this.data.maybeUpdate(new_data)) {
      this.changedNoDirtyMark();
    }
  }
  changed() {
    this.data.markDirty();
    this.store.dataChanged();
    this.changedNoDirtyMark();
  }
  private changedNoDirtyMark() {
    this.notifyObservers();
    this.getWriteStore().put(this.data, this.local_id);
  }
  markSyncDone(server_id: number) {
    if (this.data.server_id) {
      if (this.data.server_id !== server_id) throw "bug: server_id mismatch"
    } else {
      this.data.server_id = server_id;
    }
    this.data.markSyncDone();
    this.changedNoDirtyMark();
  }
}

class Vineyard extends DataWrapper<VineyardData> {
  wines: Wine[] = [];
  wines_by_name = new Map<String, Wine>();

  constructor(store: DataStore, local_id: number, data: VineyardData) {
    super(store, local_id, data);
  }
  getWriteStore(): IDBObjectStore {
    return this.store.getWriteStore('vineyards');
  }

  addWine(w: Wine) {
    this.wines.push(w);
    this.wines_by_name.set(w.data.name, w);
    w.vineyard = this;
  }
  deleteWine(w: Wine) {
    this.wines_by_name.delete(w.data.name);
    w.data.name = kDeleted;
    w.changed();
  }

  public getWineIfExists(name: string) {
    return this.wines_by_name.get(name);
  }

  getWineNames() {
    let result = [];
    for (let w of this.wines) {
      if (w.data.name === kDeleted) continue;
      result.push(w.data.name);
    }
    return result.sort();
  }
  iterateWines(callback: (w: Wine) => void) {
    for (let w of this.wines) {
      if (w.data.name === kDeleted) continue;
      callback(w);
    }
  }
  iterateYears(callback: (y: Year) => void) {
    for (let w of this.wines) {
      if (w.data.name === kDeleted) continue;
      w.iterateYears(callback);
    }
  }

  saveEdits(
      new_name: string, new_country: string, new_region: string,
      new_website: string, new_address: string, new_comment: string) {
    if (new_name === kDeleted) new_name = this.data.name;
    let changed = false;
    let country_changed = false;
    let region_changed = false;
    if (this.data.name !== new_name) {
      this.data.name = new_name;
      changed = true;
    }
    if (this.data.country !== new_country) {
      this.data.country = new_country;
      country_changed = true;
      changed = true;
    }
    if (this.data.region !== new_region) {
      this.data.region = new_region;
      region_changed = true;
      changed = true;
    }
    if (this.data.website !== new_website) {
      this.data.website = new_website;
      changed = true;
    }
    if (this.data.address !== new_address) {
      this.data.address = new_address;
      changed = true;
    }
    if (this.data.comment !== new_comment) {
      this.data.comment = new_comment;
      changed = true;
    }
    if (country_changed || region_changed) {
      this.store.geo_cache.insertPair(new_country, new_region);
    }
    if (country_changed) g_watchpoints.vineyard_countries.notifyObservers();
    if (region_changed) g_watchpoints.vineyard_regions.notifyObservers();
    if (changed) this.changed();
  }

  merge(other: Vineyard, store: DataStore): MergeResult {
    // Merge per-vineyard data.
    let changed = false;
    let region = this.data.region;
    let country = this.data.country;
    let website = this.data.website;
    let address = this.data.address;
    let comment = this.data.comment;
    if (region === '' && other.data.region !== '') {
      region = other.data.region;
      changed = true;
    } else if (other.data.region !== '' && other.data.region !== region) {
      return MergeResult.kRegionConflict;
    }
    if (country === '' && other.data.country !== '') {
      country = other.data.country;
      changed = true;
    } else if (other.data.country !== '' && other.data.country !== country) {
      return MergeResult.kCountryConflict;
    }
    if (website === '' && other.data.website !== '') {
      website = other.data.website;
      changed = true;
    } else if (other.data.website !== '' && other.data.website !== website) {
      return MergeResult.kWebsiteConflict;
    }
    if (address === '' && other.data.address !== '') {
      address = other.data.address;
      changed = true;
    } else if (other.data.address !== '' && other.data.address !== address) {
      return MergeResult.kAddressConflict;
    }
    if (comment === '' && other.data.comment !== '') {
      comment = other.data.comment;
      changed = true;
    } else if (other.data.comment !== '' && other.data.comment !== comment) {
      return MergeResult.kCommentConflict;
    }
    // Commit.
    this.data.region = region;
    this.data.country = country;
    this.data.website = website;
    this.data.address = address;
    this.data.comment = comment;
    if (changed) this.changed();

    // Merge wines.
    let years_left = false;
    for (let w of other.wines) {
      let own = this.wines_by_name.get(w.data.name);
      if (own) {
        own.merge(w, store);
        for (let y of w.years) {
          if (y.data.count >= 0) {
            years_left = true;
            break;
          }
        }
      } else {
        let new_wine = store.createWine(w.data.copyForVineyard(this.local_id));
        w.iterateYears((y: Year) => {
          store.createYear(y.data.CopyForWine(new_wine.local_id));
          y.clickDelete();
        });
      }
    }
    // Mark as deleted.
    if (years_left === false) {
      this.store.vineyards_by_name.delete(other.data.name);
      other.data.name = kDeleted;
      other.changed();
    }
    return MergeResult.kOK;
  }

  applyStock() { for (let w of this.wines) w.applyStock(); }
}

class Wine extends DataWrapper<WineData> {
  vineyard: Vineyard;
  years: Year[] = [];
  private years_by_year = new Map<number, Year>();

  constructor(store: DataStore, local_id: number, data: WineData) {
    super(store, local_id, data);
  }
  getWriteStore() { return this.store.getWriteStore('wines'); }

  hasYear(y: number) {
    let maybe_year = this.years_by_year.get(y);
    if (!maybe_year) return false;
    return maybe_year.data.count >= 0;  // Negative means "deleted".
  }
  getYear(y: number) {
    return this.years_by_year.get(y);
  }
  getDeletedYear(y: number) {
    let maybe_year = this.years_by_year.get(y);
    if (maybe_year && maybe_year.data.count < 0) return maybe_year;
    return null;
  }

  addYear(y: Year) {
    this.years.push(y);
    this.years_by_year.set(y.data.year, y);
    y.wine = this;
  }
  iterateYears(callback: (y: Year) => void) {
    for (let y of this.years) {
      if (y.data.count < 0) continue;
      callback(y);
    }
  }

  saveEdits(new_name: string, new_grape: string, new_comment: string) {
    let changed = false, grape_changed = false;
    if (this.data.name !== new_name) {
      this.data.name = new_name;
      changed = true;
    }
    if (this.data.grape !== new_grape) {
      this.data.grape = new_grape;
      grape_changed = true;
      this.store.grape_cache.update(new_grape);
    }
    if (this.data.comment !== new_comment) {
      this.data.comment = new_comment;
      changed = true;
    }
    if (changed || grape_changed) this.changed();
    if (grape_changed) g_watchpoints.grape_names.notifyObservers();
  }

  merge(other: Wine, store: DataStore): MergeResult {
    // Merge per-wine data.
    let changed = false;
    let grape = this.data.grape;
    let comment = this.data.comment;
    if (grape === '' && other.data.grape !== '') {
      grape = other.data.grape;
      changed = true;
    } else if (other.data.grape !== '' && other.data.grape !== grape) {
      return MergeResult.kGrapeConflict;
    }
    if (comment === '' && other.data.comment !== '') {
      comment = other.data.comment;
      changed = true;
    } else if (other.data.comment !== '' && other.data.comment !== comment) {
      return MergeResult.kCommentConflict;
    }
    // Commit.
    this.data.grape = grape;
    this.data.comment = comment;
    if (changed) this.changed();

    // Merge years.
    let years_left = false;
    for (let y of other.years) {
      // Don't duplicate deleted years.
      if (y.data.count < 0) continue;
      let own = this.years_by_year.get(y.data.year);
      if (own) {
        if (own.merge(y)) {
          y.clickDelete();
        } else {
          years_left = true;
        }
      } else {
        store.createYear(y.data.CopyForWine(this.local_id));
        y.clickDelete();
      }
    }
    // Mark as deleted.
    if (years_left === false) {
      other.vineyard.deleteWine(other);
    }
    return MergeResult.kOK;
  }

  private stock_applier = (y: Year) => y.applyStock();
  applyStock() { this.iterateYears(this.stock_applier); }
}

class Year extends DataWrapper<YearData> {
  wine: Wine;
  log_by_date = new Map<string, Log>();

  constructor(store: DataStore, local_id: number, data: YearData) {
    super(store, local_id, data);
  }
  getWriteStore() { return this.store.getWriteStore('years'); }
  maybeUpdate(new_data: any) {  // override.
    let old_count = this.data.count;
    let old_price = this.data.price;
    super.maybeUpdate(new_data);
    let price_delta = this.data.count * this.data.price - old_count * old_price;
    let count_delta = this.data.count - old_count;
    if (count_delta !== 0 || price_delta !== 0) {
      g_watchpoints.totals.notifyDelta(price_delta, count_delta)
    }
  }

  clickPlus(count = 1) {
    this.data.count += count;
    this.changed();
    if (this.data.count > 0) this.store.year_cache.update(this.data.year);
    g_watchpoints.totals.notifyDelta(this.data.price, count);
    this.store.recordLog(this, count);
  }
  clickMinus() {
    if (this.data.count > 0) {
      this.data.count--;
      this.changed();
      g_watchpoints.totals.notifyDelta(-this.data.price, -1);
      this.store.recordLog(this, -1);
    }
  }
  clickDelete() {
    this.data.count = -1;
    this.changed();
    g_watchpoints.deletions.notifyObservers();
  }
  clickStockPlus(count = 1) {
    this.data.stock += count;
    this.changed();
  }
  clickStockMinus() {
    if (this.data.stock > 0) {
      this.data.stock--;
      this.changed();
    }
  }
  applyStock() {
    if (this.data.count !== this.data.stock) {
      let count_delta = this.data.stock - this.data.count;
      let price_delta = this.data.price * count_delta;
      this.data.count = this.data.stock;
      this.changed();
      g_watchpoints.totals.notifyDelta(price_delta, count_delta);
      this.store.recordLogApplyStock(this, count_delta);
      this.store.extra_backup = true;
    }
  }
  resetStock() {
    let changed = (this.data.stock !== 0);
    this.data.stock = 0;
    if (changed) this.changed();
  }
  editPriceCommentLocation(
      new_price: number, new_comment: string, new_location: string) {
    let changed = false;
    let price_delta = 0;
    let old_price = this.data.price;
    if (old_price !== new_price) {
      price_delta = new_price - old_price;
      this.data.price = new_price;
      changed = true;
      g_watchpoints.totals.notifyDelta(price_delta * this.data.count, 0);
    }
    if (this.data.comment !== new_comment) {
      this.data.comment = new_comment;
      changed = true;
    }
    if (this.data.location !== new_location) {
      this.data.location = new_location;
      this.store.location_cache.update(new_location);
      changed = true;
    }
    if (changed) this.changed();
  }
  updateRating(new_rating: number) {
    if (this.data.rating === new_rating) return;
    this.data.rating = new_rating;
    this.changed();
  }
  updateValue(new_value: number) {
    if (this.data.value === new_value) return;
    this.data.value = new_value;
    this.changed();
  }
  updateSweetness(new_sweetness: number) {
    if (this.data.sweetness === new_sweetness) return;
    this.data.sweetness = new_sweetness;
    this.changed();
  }
  updateAge(new_age: number) {
    if (this.data.age === new_age) return;
    this.data.age = new_age;
    this.data.age_update = Math.round(Date.now() / 1000);
    this.changed();
  }
  reviveDeleted(
      new_count: number, new_stock: number, new_price: number,
      new_comment: string, new_location: string) {
    this.data.count = new_count;
    this.data.stock = new_stock;
    if (new_price) this.data.price = new_price;
    if (new_comment) this.data.comment = new_comment;
    if (new_location) this.data.location = new_location;
    // Let's keep other old data, maybe it's useful.
    this.changed();
    g_watchpoints.totals.notifyDelta(new_count * this.data.price, new_count);
  }
  addLog(log: Log) {
    this.log_by_date.set(log.data.date, log);
    log.year = this;
  }
  merge(src: Year) {
    let changed = false;
    if (this.data.count < 0) {
      // Special case: {this} is deleted, take over all of {src}.
      this.data.count = src.data.count;
      this.data.stock = src.data.stock;
      this.data.price = src.data.price;
      this.data.comment = src.data.comment;
      this.data.rating = src.data.rating;
      this.data.value = src.data.value;
      this.data.sweetness = src.data.sweetness;
      this.data.age = src.data.age;
      this.data.age_update = src.data.age_update;
      this.data.location = src.data.location;
      this.changed();
      return true;
    }
    let count = this.data.count;
    let stock = this.data.stock;
    let price = this.data.price;
    let comment = this.data.comment;
    let rating = this.data.rating;
    let value = this.data.value;
    let sweetness = this.data.sweetness;
    let age = this.data.age;
    let age_update = this.data.age_update;
    let location = this.data.location;
    if (count === 0 && src.data.count !== 0) {
      count = src.data.count;
      changed = true;
    } else if (src.data.count !== 0 && src.data.count !== count) {
      return false;
    }
    if (stock === 0 && src.data.stock !== 0) {
      stock = src.data.stock;
      changed = true;
    } else if (src.data.stock !== 0 && src.data.stock !== stock) {
      return false;
    }
    if (price === 0 && src.data.price !== 0) {
      price = src.data.price;
      changed = true;
    } else if (src.data.price !== 0 && src.data.price !== price) {
      return false;
    }
    if (comment === '' && src.data.comment !== '') {
      comment = src.data.comment;
      changed = true;
    } else if (src.data.comment !== '' && src.data.comment !== comment) {
      return false;
    }
    if (rating === 0 && src.data.rating !== 0) {
      rating = src.data.rating;
      changed = true;
    } else if (src.data.rating !== 0 && src.data.rating !== rating) {
      return false;
    }
    if (value === 0 && src.data.value !== 0) {
      value = src.data.value;
      changed = true;
    } else if (src.data.value !== 0 && src.data.value !== value) {
      return false;
    }
    if (sweetness === 0 && src.data.sweetness !== 0) {
      sweetness = src.data.sweetness;
      changed = true;
    } else if (src.data.sweetness !== 0 && src.data.sweetness !== sweetness) {
      return false;
    }
    if (age === 0 && src.data.age !== 0) {
      age = src.data.age;
      age_update = src.data.age_update;
      changed = true;
    } else if (src.data.age !== 0 && src.data.age !== age) {
      return false;
    }
    if (location === '' && src.data.location !== '') {
      location = src.data.location;
      changed = true;
    } else if (src.data.location !== '' && src.data.location !== location) {
      return false;
    }
    this.data.count = count;
    this.data.stock = stock;
    this.data.price = price;
    this.data.comment = comment;
    this.data.rating = rating;
    this.data.value = value;
    this.data.sweetness = sweetness;
    this.data.age = age;
    this.data.age_update = age_update;
    this.data.location = location;
    if (changed) this.changed();
    return true;
  }
}

class Log extends DataWrapper<LogData> {
  year: Year;
  constructor(store: DataStore, local_id: number, data: LogData) {
    super(store, local_id, data);
  }
  getWriteStore() { return this.store.getWriteStore('log'); }

  updateDelta(count: number) {
    this.data.delta += count;
    if (!IsValidReasonFor(this.data.reason, this.data.delta)) {
      this.data.reason =
          this.data.delta > 0 ? this.store.default_reason_add :
          this.data.delta < 0 ? this.store.default_reason_remove :
                                LogReason.kUnknown;
    }
    this.changed();
  }
  updateReason(reason: number) {
    if (this.data.reason !== reason) {
      this.data.reason = reason;
      this.changed();
    }
  }
}

class GeoCache {
  private countries = new Map<string, Set<string>>();
  private regions = new Map<string, string>();
  constructor(private store: DataStore) {
    this.countries = new Map();
    this.regions = new Map();
  }

  public insertPair(country: string, region: string) {
    if (country) {
      let regions = this.countries.get(country);
      if (!regions) {
        regions = new Set();
        this.countries.set(country, regions);
        g_watchpoints.countries.notifyObservers(country);
      }
      if (region) regions.add(region);
    }
    if (region) {
      let is_new = !this.regions.has(region);
      if (country) {
        this.regions.set(region, country);
      } else if (!this.regions.has(region)) {
        this.regions.set(region, "");
      }
      if (is_new) g_watchpoints.regions.notifyObservers(region);
    }
  }
  public getCountries() {
    let countries: string[] = [];
    for (let c of this.countries.keys()) countries.push(c);
    return countries.sort();
  }
  public getAllRegions() {
    let regions: string[] = [];
    for (let r of this.regions.keys()) regions.push(r);
    return regions.sort();
  }
  public getRegions(country: string) {
    let regions: string[] = [];
    let regions_set = this.countries.get(country);
    if (!regions_set) return [];
    for (let r of regions_set.keys()) regions.push(r);
    return regions.sort();
  }
  public getCountry(region: string) {
    return this.regions.get(region);
  }
}

class GrapeCache {
  private grapes = new Set<string>();
  constructor(private store: DataStore) {}
  update(grape: string) {
    if (this.grapes.has(grape)) return;
    this.grapes.add(grape);
    g_watchpoints.grapes.notifyObservers(grape);
  }
  getGrapes() {
    let grapes: string[] = [];
    for (let g of this.grapes.values()) {
      if (g) grapes.push(g);
    }
    return grapes.sort();
  }
}

class YearCache {
  private years = new Set<number>();
  constructor(private store: DataStore) {}
  update(year: number) {
    if (this.years.has(year)) return;
    this.years.add(year);
    g_watchpoints.years.notifyObservers(year.toString());
  }
  getYears(): string[] {
    let years: number[] = [];
    for (let y of this.years.values()) {
      years.push(y);
    }
    years.sort((a, b) => a - b);
    return years.map((y) => y.toString());
  }
}

class LocationCache {
  private locations = new Set<string>();
  constructor(private store: DataStore) {}
  update(location: string) {
    if (this.locations.has(location)) return;
    this.locations.add(location);
    g_watchpoints.locations.notifyObservers(location);
  }
  getLocations() {
    let locations: string[] = [];
    for (let l of this.locations.values()) {
      if (l) locations.push(l);
    }
    return locations.sort();
  }
}

interface UI {
  addLog(log: Log): void;
  addYear(year: Year): void;
  reviveYear(year: Year): void;
  isStockMode(): boolean;
}

class DataStore {
  vineyards: Vineyard[] = [];
  vineyards_by_name = new Map<string, Vineyard>();
  vineyards_by_server_id = new Map<number, Vineyard>();
  wines: Wine[] = [];
  wines_by_server_id = new Map<number, Wine>();
  years: Year[] = [];
  years_by_server_id = new Map<number, Year>();
  log: Log[] = [];
  log_by_server_id = new Map<number, Log>();
  global_dirtybit = false;
  extra_backup = false;

  db: IDBDatabase;
  next_vineyard_id: number = 0;
  next_wine_id: number = 0;
  next_year_id: number = 0;
  next_log_id: number = 0;
  last_server_commit: number = 0;
  last_server_contact: number = 0;
  server_uuid: string = "";
  default_reason_add: number = 0;
  default_reason_remove: number = 0;

  ui: UI | null = null;
  connection: Connection | null = null;

  geo_cache: GeoCache;
  grape_cache: GrapeCache;
  year_cache: YearCache;
  location_cache: LocationCache;

  constructor() {
    this.geo_cache = new GeoCache(this);
    this.grape_cache = new GrapeCache(this);
    this.year_cache = new YearCache(this);
    this.location_cache = new LocationCache(this);
  }

  dataChanged() {
    this.global_dirtybit = true;
    if (this.connection) this.connection.kick();
  }
  getLastServerCommit() { return this.last_server_commit; }
  setLastServerCommit(commit: number) {
    this.last_server_commit = commit;
    this.persistLastServerCommit();
  }
  getLastServerContact() { return this.last_server_contact; }
  setLastServerContact(contact: number) {
    this.last_server_contact = contact;
    this.persistLastServerContact();
  }

  public serverUuid() { return this.server_uuid; }
  public setServerUuid(uuid: string) {
    this.server_uuid = uuid;
    this.persistServerUuid();
  }

  public getVineyardIfExists(name: string) {
    return this.vineyards_by_name.get(name);
  }

  public getOrCreateVineyard(name: string) {
    let vineyard = this.vineyards_by_name.get(name);
    if (vineyard) return vineyard;
    let data = new VineyardData(0, 1, name, "", "", "", "", "");
    return this.createVineyard(data);
  }

  public getOrCreateWine(vineyard: Vineyard, name: string) {
    let wine = vineyard.wines_by_name.get(name);
    if (wine) return wine;
    let data = new WineData(0, 1, vineyard.local_id, name, "", "");
    return this.createWine(data);
  }

  public getOrCreateYear(
      wine: Wine, year: number, count: number, price: number, comment: string,
      location: string) {
    let stock_mode = (this.ui && this.ui.isStockMode());
    let stock = 0;
    if (stock_mode) {
      stock = count;
      count = 0;
    }
    let maybe_deleted = wine.getDeletedYear(year);
    if (maybe_deleted) {
      maybe_deleted.reviveDeleted(count, stock, price, comment, location);
      if (!stock_mode) this.recordLog(maybe_deleted, count);
      if (this.ui) this.ui.reviveYear(maybe_deleted);
      return;
    }
    let data = new YearData(
        0, 1, wine.local_id, year, count, stock, price, 0, 0, 0, 0, 0, comment,
        location);
    let y = this.createYear(data);
    if (!stock_mode) this.recordLog(y, count);
  }

  recordLog(y: Year, delta: number) {
    let date = getDateString();
    let log = y.log_by_date.get(date);
    if (log) {
      log.updateDelta(delta);
    } else {
      let reason =
          delta > 0 ? this.default_reason_add : this.default_reason_remove;
      let data = new LogData(0, 1, date, y.local_id, delta, reason, "");
      this.createLog(data);
    }
  }
  recordLogApplyStock(y: Year, delta: number) {
    let date = getDateString();
    let log = y.log_by_date.get(date);
    let kReasonStock = LogReason.kStock;
    if (log && log.data.reason === kReasonStock) {
      log.updateDelta(delta);
    } else {
      let data = new LogData(0, 1, date, y.local_id, delta, kReasonStock, '');
      this.createLog(data);
    }
  }

  public getVineyardNames() {
    let result: string[] = [];
    for (let v of this.vineyards) {
      if (v && v.data.name !== kDeleted) result.push(v.data.name);
    }
    return result.sort();
  }
  public getWineNamesForVineyard(vineyard_name: string) {
    let result: string[] = [];
    let vineyard = this.vineyards_by_name.get(vineyard_name);
    if (!vineyard) return result;
    return vineyard.getWineNames();
  }
  public getStorageLocations() {
    return this.location_cache.getLocations();
  }

  iterateVineyards(callback: (v: Vineyard) => void) {
    for (let v of this.vineyards) {
      if (!v) continue;
      callback(v);
    }
  }
  iterateWines(callback: (w: Wine) => void) {
    for (let w of this.wines) {
      if (!w) continue;
      callback(w);
    }
  }
  iterateYears(callback: (y: Year) => void) {
    for (let y of this.years) {
      if (!y) continue;
      if (y.data.count < 0) continue;
      callback(y);
    }
  }

  public applyAllStock() {
    this.iterateYears((y: Year) => y.applyStock());
  }
  public resetAllStock() {
    this.iterateYears((y: Year) => y.resetStock());
  }

  private getNextVineyardId(update_db = true) {
    let result = this.next_vineyard_id++;
    if (update_db) this.persistNextVineyardId();
    return result;
  }
  private getNextWineId(update_db = true) {
    let result = this.next_wine_id++;
    if (update_db) this.persistNextWineId();
    return result;
  }
  private getNextYearId(update_db = true) {
    let result = this.next_year_id++;
    if (update_db) this.persistNextYearId();
    return result;
  }
  private getNextLogId(update_db = true) {
    let result = this.next_log_id++;
    if (update_db) this.persistNextLogId();
    return result;
  }

  initializeFromDatabase() {
    return new Promise((resolve, reject) => {
      let kDatabaseVersion = 1;
      let version = kDatabaseVersion;
      let dbOpenRequest = window.indexedDB.open('wines', version);
      dbOpenRequest.onerror = (event) => {
        console.log('IndexedDB open request failed:');
        console.log(event);
      };
      dbOpenRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        let db = (event.target as IDBRequest<IDBDatabase>).result;
        console.log(
            'IndexedDB: Database needs upgrade from version ' +
            event.oldVersion + ' to ' + event.newVersion);
        let config = {};
        if (event.oldVersion < 1) {
          db.createObjectStore('vineyards', config);
          db.createObjectStore('wines', config);
          db.createObjectStore('years', config);
          db.createObjectStore('log', config);
          db.createObjectStore('data', config);
        }
      };
      dbOpenRequest.onsuccess = (event) => {
        console.log('IndexedDB open: success!');
        this.db = (event.target as IDBOpenDBRequest).result as IDBDatabase;
        this.db.onerror = (event) => {
          console.log(
              'IndexedDB database error: ' +
              (event.target as IDBRequest).error);
          console.log(event);
        };
        let tx_vineyard = this.db.transaction(['vineyards', 'data']);
        tx_vineyard.onerror = (event) => {
          console.log('Reading vineyards from DB failed, error:');
          console.log(event);
          reject(event);
        };
        tx_vineyard.oncomplete = (event) => {
          console.log('Reading vineyards from DB: done');
          let tx_wine = this.db.transaction(['wines']);
          tx_wine.onerror = (event) => {
            console.log('Reading wines from DB failed, error:');
            console.log(event);
            reject(event);
          };
          tx_wine.oncomplete = (event) => {
            console.log('Reading wines from DB: done');
            let tx_year = this.db.transaction(['years']);
            tx_year.onerror = (event) => {
              console.log('Reading years from DB failed, error:');
              console.log(event);
              reject(event);
            };
            tx_year.oncomplete = (event) => {
              console.log('Reading years from DB: done');
              let tx_log = this.db.transaction(['log']);
              tx_log.onerror = (event) => {
                console.log('Reading log from DB failed, error:');
                console.log(event);
                reject(event);
              };
              tx_log.oncomplete = (event) => {
                console.log('Reading log from DB: done');
                resolve(event);
              };
              this.readLogFromDB(tx_log);
            };
            this.readYearsFromDB(tx_year);
          };
          this.readWinesFromDB(tx_wine);
        };
        this.readDataFromDB(tx_vineyard.objectStore('data'));
        this.readVineyardsFromDB(tx_vineyard);
      };
    });
  }

  // These must be public because the Connection logic needs them.
  public persistNextVineyardId() {
    this.getWriteStore('data').put(this.next_vineyard_id, 'next_vineyard_id');
  }
  public persistNextWineId() {
    this.getWriteStore('data').put(this.next_wine_id, 'next_wine_id');
  }
  public persistNextYearId() {
    this.getWriteStore('data').put(this.next_year_id, 'next_year_id');
  }
  public persistNextLogId() {
    this.getWriteStore('data').put(this.next_log_id, 'next_log_id');
  }
  private persistLastServerCommit() {
    this.getWriteStore('data').put(
        this.last_server_commit, 'last_server_commit');
  }
  private persistLastServerContact() {
    this.getWriteStore('data').put(
        this.last_server_contact, 'last_server_contact');
  }
  private persistServerUuid() {
    this.getWriteStore('data').put(this.server_uuid, 'server_uuid');
  }
  private readDataFromDB(data_store: IDBObjectStore) {
    data_store.get('next_vineyard_id').onsuccess = (event) => {
      let next = (event.target as IDBRequest<number>).result;
      if (next) this.next_vineyard_id = next;
    };
    data_store.get('next_wine_id').onsuccess = (event) => {
      let next = (event.target as IDBRequest<number>).result;
      if (next) this.next_wine_id = next;
    };
    data_store.get('next_year_id').onsuccess = (event) => {
      let next = (event.target as IDBRequest<number>).result;
      if (next) this.next_year_id = next;
    };
    data_store.get('next_log_id').onsuccess = (event) => {
      let next = (event.target as IDBRequest<number>).result;
      if (next) this.next_log_id = next;
    };
    data_store.get('last_server_commit').onsuccess = (event) => {
      let commit = (event.target as IDBRequest<number>).result;
      if (commit) this.last_server_commit = commit;
    };
    data_store.get('last_server_contact').onsuccess = (event) => {
      let contact = (event.target as IDBRequest<number>).result;
      if (contact) this.last_server_contact = contact;
    };
    data_store.get('server_uuid').onsuccess = (event) => {
      let uuid = (event.target as IDBRequest<string>).result;
      if (uuid) this.server_uuid = uuid;
    };
  }
  private readVineyardsFromDB(tx: IDBTransaction) {
    tx.objectStore("vineyards").openCursor().onsuccess = (event) => {
      let cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        // Does it make sense to defensively compare cursor.key against
        // this.next_vineyard_id?
        let local_id: number = cursor.key as number;
        let data = VineyardData.fromStruct(cursor.value);
        this.createVineyardWithId(data, local_id);
        cursor.continue();
      }
    };
  }
  private readWinesFromDB(tx: IDBTransaction) {
    tx.objectStore("wines").openCursor().onsuccess = (event) => {
      let cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        let local_id = cursor.key as number;
        let data = WineData.fromStruct(cursor.value);
        this.createWineWithId(data, local_id);
        cursor.continue();
      }
    };
  }
  private readYearsFromDB(tx: IDBTransaction) {
    tx.objectStore("years").openCursor().onsuccess = (event) => {
      let cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        let local_id = cursor.key as number;
        let data = YearData.fromStruct(cursor.value);
        this.createYearWithId(data, local_id);
        cursor.continue();
      }
    };
  }
  private readLogFromDB(tx: IDBTransaction) {
    tx.objectStore('log').openCursor().onsuccess = (event) => {
      let cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        let local_id = cursor.key as number;
        let data = LogData.fromStruct(cursor.value);
        this.createLogWithId(data, local_id);
        cursor.continue();
      }
    }
  }

  // These must be public because the Connection logic needs them.
  public createVineyard(data: VineyardData, persist_next_id = true) {
    let id = this.getNextVineyardId(persist_next_id);
    let request = this.getWriteStore('vineyards').add(data, id);
    request.onerror = (event) => console.log('adding vineyard failed');
    return this.createVineyardWithId(data, id);
  }
  public createWine(data: WineData, persist_next_id = true) {
    if (!data.grape) {
      data.grape = GuessGrapeForWine(data.name);
      if (data.grape) data.markDirty();
    }
    let id = this.getNextWineId(persist_next_id);
    let request = this.getWriteStore('wines').add(data, id);
    request.onerror = (event) => console.log('adding wine failed');
    return this.createWineWithId(data, id);
  }
  public createYear(data: YearData, persist_next_id = true) {
    let id = this.getNextYearId(persist_next_id);
    let request = this.getWriteStore('years').add(data, id);
    request.onerror = (event) => console.log('adding year failed');
    return this.createYearWithId(data, id);
  }
  public createLog(data: LogData, persist_next_id = true) {
    let id = this.getNextLogId(persist_next_id);
    let request = this.getWriteStore('log').add(data, id);
    request.onerror = (event) => console.log('adding log failed');
    this.createLogWithId(data, id);
  }

  private createVineyardWithId(data: VineyardData, id: number) {
    let v = new Vineyard(this, id, data);
    this.vineyards[id] = v;
    this.vineyards_by_name.set(data.name, v);
    if (data.server_id) {
      this.vineyards_by_server_id.set(data.server_id, v);
    }
    this.geo_cache.insertPair(data.country, data.region);
    if (data.isDirty()) this.dataChanged();
    return v;
  }
  private createWineWithId(data: WineData, id: number) {
    let w = new Wine(this, id, data);
    this.wines[id] = w;
    if (data.server_id) {
      this.wines_by_server_id.set(data.server_id, w);
    }
    this.grape_cache.update(data.grape);
    let vineyard = this.vineyards[data.vineyard_id];
    vineyard.addWine(w);
    if (data.isDirty()) this.dataChanged();
    return w;
  }
  private createYearWithId(data: YearData, id: number) {
    let y = new Year(this, id, data);
    this.years[id] = y;
    if (data.server_id) {
      this.years_by_server_id.set(data.server_id, y);
    }
    let wine = this.wines[data.wine_id];
    wine.addYear(y);
    if (this.ui) {
      this.ui.addYear(y);
    }
    if (data.count > 0) {
      this.year_cache.update(data.year);
    }
    this.location_cache.update(data.location);
    if (data.isDirty()) this.dataChanged();
    // We're not calling g_watchpoints.totals.notifyDelta here because
    // {this.ui.addYear} already took care of updating the UI as needed.
    return y;
  }
  private createLogWithId(data: LogData, id: number) {
    let l = new Log(this, id, data);
    this.log[id] = l;
    if (data.server_id) {
      this.log_by_server_id.set(data.server_id, l);
    }
    let year = this.years[data.year_id];
    year.addLog(l);
    if (this.ui) this.ui.addLog(l);
    if (data.isDirty()) this.dataChanged();
    return l;
  }

  getWriteStore(key: string) {
    return this.db.transaction([key], 'readwrite').objectStore(key);
  }

  clearAll() {
    let tx = this.db.transaction(
        ['vineyards', 'wines', 'years', 'log', 'data'], 'readwrite');
    tx.oncomplete = (_) => {
      console.log('Local database cleared.');
      window.location.reload();
    };
    tx.objectStore('vineyards').clear();
    tx.objectStore('wines').clear();
    tx.objectStore('years').clear();
    tx.objectStore('log').clear();
    tx.objectStore('data').clear();
  }
}
