"use strict";
class DataObject {
    constructor(server_id, dirty = 0) {
        this.server_id = server_id;
        this.dirty = dirty;
    }
    isDirty() { return this.dirty !== 0; }
    markDirty() { this.dirty |= 1; }
    markSyncPending() { this.dirty = 2; }
    markSyncDone() { this.dirty &= (~2); }
    assertSame(other, properties) {
        for (let key of properties) {
            if (this[key] !== other[key]) {
                throw ('Bug: ' + key + ' must match, was ' + this[key] + ', is ' +
                    other[key]);
            }
        }
    }
    applyUpdates(other, properties) {
        if (this.isDirty())
            return false;
        let changed = false;
        for (let key of properties) {
            if (this[key] !== other[key]) {
                this[key] = other[key];
                changed = true;
            }
        }
        return changed;
    }
    packForSync(local_id) {
        this.markSyncPending();
        let result = { local_id };
        for (let k of Object.keys(this)) {
            if (k === "dirty")
                continue;
            result[k] = this[k];
        }
        return result;
    }
}
class VineyardData extends DataObject {
    constructor(server_id, dirty, name, region, country, website, address, comment) {
        super(server_id, dirty);
        this.name = name;
        this.region = region;
        this.country = country;
        this.website = website;
        this.address = address;
        this.comment = comment;
    }
    static fromStruct(v) {
        return new VineyardData(v.server_id, v.dirty, v.name, v.region, v.country, v.website, v.address, v.comment);
    }
    maybeUpdate(new_data) {
        this.assertSame(new_data, ['server_id']);
        return this.applyUpdates(new_data, ['name', 'region', 'country', 'website', 'address', 'comment']);
    }
}
class WineData extends DataObject {
    constructor(server_id, dirty, vineyard_id, name, grape, comment) {
        super(server_id, dirty);
        this.vineyard_id = vineyard_id;
        this.name = name;
        this.grape = grape;
        this.comment = comment;
    }
    static fromStruct(w) {
        return new WineData(w.server_id, w.dirty, w.vineyard_id, w.name, w.grape, w.comment);
    }
    maybeUpdate(new_data) {
        this.assertSame(new_data, ['server_id', 'vineyard_id']);
        return this.applyUpdates(new_data, ['name', 'grape', 'comment']);
    }
}
class YearData extends DataObject {
    constructor(server_id, dirty, wine_id, year, count, stock, price, rating, value, sweetness, age, comment) {
        super(server_id, dirty);
        this.wine_id = wine_id;
        this.year = year;
        this.count = count;
        this.stock = stock;
        this.price = price;
        this.rating = rating;
        this.value = value;
        this.sweetness = sweetness;
        this.age = age;
        this.comment = comment;
    }
    static fromStruct(y) {
        return new YearData(y.server_id, y.dirty, y.wine_id, y.year, y.count, y.stock, y.price, y.rating, y.value, y.sweetness, y.age, y.comment);
    }
    maybeUpdate(new_data) {
        this.assertSame(new_data, ['server_id', 'wine_id', 'year']);
        return this.applyUpdates(new_data, [
            'count', 'stock', 'price', 'rating', 'value', 'sweetness', 'age',
            'comment'
        ]);
    }
}
class LogData extends DataObject {
    constructor(server_id, dirty, date, year_id, delta, reason, comment) {
        super(server_id, dirty);
        this.date = date;
        this.year_id = year_id;
        this.delta = delta;
        this.reason = reason;
        this.comment = comment;
    }
    static fromStruct(l) {
        return new LogData(l.server_id, l.dirty, l.date, l.year_id, l.delta, l.reason, l.comment);
    }
    maybeUpdate(new_data) {
        this.assertSame(new_data, ['server_id', 'date', 'year_id']);
        return this.applyUpdates(new_data, ['delta', 'reason', 'comment']);
    }
}
class Observable {
    constructor() {
        this.observers = [];
    }
    registerObserver(observer) {
        this.observers.push(observer);
    }
    unregisterObserver(observer) {
        let index = this.observers.indexOf(observer);
        if (index === this.observers.length - 1) {
            this.observers.pop();
        }
        else {
            this.observers[index] = this.observers.pop();
        }
    }
    notifyObservers() {
        for (let observer of this.observers) {
            observer.update();
        }
    }
}
class TotalsWatchPoint extends Observable {
    constructor() {
        super();
        this.price_delta = 0;
        this.count_delta = 0;
    }
    notifyDelta(price_delta, count_delta) {
        this.price_delta = price_delta;
        this.count_delta = count_delta;
        this.notifyObservers();
    }
    priceDelta() { return this.price_delta; }
    countDelta() { return this.count_delta; }
}
class Watchpoints {
    constructor() {
        this.deletions = new Observable();
        this.grape_names = new Observable();
        this.totals = new TotalsWatchPoint();
    }
}
var g_watchpoints = new Watchpoints();
class DataWrapper extends Observable {
    constructor(store, local_id, data) {
        super();
        this.store = store;
        this.local_id = local_id;
        this.data = data;
    }
    maybeUpdate(new_data) {
        if (this.data.maybeUpdate(new_data)) {
            this.changedNoDirtyMark();
        }
    }
    changed() {
        this.data.markDirty();
        this.store.dataChanged();
        this.changedNoDirtyMark();
    }
    changedNoDirtyMark() {
        this.notifyObservers();
        this.getWriteStore().put(this.data, this.local_id);
    }
    markSyncDone(server_id) {
        if (this.data.server_id) {
            if (this.data.server_id !== server_id)
                throw "bug: server_id mismatch";
        }
        else {
            this.data.server_id = server_id;
        }
        this.data.markSyncDone();
        this.changedNoDirtyMark();
    }
}
class Vineyard extends DataWrapper {
    constructor(store, local_id, data) {
        super(store, local_id, data);
        this.wines = [];
        this.wines_by_name = new Map();
    }
    getWriteStore() {
        return this.store.getWriteStore('vineyards');
    }
    addWine(w) {
        this.wines.push(w);
        this.wines_by_name.set(w.data.name, w);
        w.vineyard = this;
    }
    getWineNames() {
        let result = [];
        for (let w of this.wines)
            result.push(w.data.name);
        return result.sort();
    }
    iterateWines(callback) {
        for (let w of this.wines)
            callback(w);
    }
    iterateYears(callback) {
        for (let w of this.wines)
            w.iterateYears(callback);
    }
    saveEdits(new_name, new_country, new_region, new_website, new_address, new_comment) {
        let changed = false;
        if (this.data.name !== new_name) {
            this.data.name = new_name;
            changed = true;
        }
        if (this.data.country !== new_country) {
            this.data.country = new_country;
            changed = true;
        }
        if (this.data.region !== new_region) {
            this.data.region = new_region;
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
        if (changed)
            this.changed();
    }
    applyStock() { for (let w of this.wines)
        w.applyStock(); }
}
class Wine extends DataWrapper {
    constructor(store, local_id, data) {
        super(store, local_id, data);
        this.years = [];
        this.years_by_year = new Map();
        this.stock_applier = (y) => y.applyStock;
    }
    getWriteStore() { return this.store.getWriteStore('wines'); }
    hasYear(y) {
        let maybe_year = this.years_by_year.get(y);
        if (!maybe_year)
            return false;
        return maybe_year.data.count >= 0; // Negative means "deleted".
    }
    getDeletedYear(y) {
        let maybe_year = this.years_by_year.get(y);
        if (maybe_year && maybe_year.data.count < 0)
            return maybe_year;
        return null;
    }
    addYear(y) {
        this.years.push(y);
        this.years_by_year.set(y.data.year, y);
        y.wine = this;
    }
    iterateYears(callback) {
        for (let y of this.years) {
            if (y.data.count < 0)
                continue;
            callback(y);
        }
    }
    saveEdits(new_name, new_grape, new_comment) {
        let changed = false, grape_changed = false;
        if (this.data.name !== new_name) {
            this.data.name = new_name;
            changed = true;
        }
        if (this.data.grape !== new_grape) {
            this.data.grape = new_grape;
            grape_changed = true;
        }
        if (this.data.comment !== new_comment) {
            this.data.comment = new_comment;
            changed = true;
        }
        if (changed || grape_changed)
            this.changed();
        if (grape_changed)
            g_watchpoints.grape_names.notifyObservers();
    }
    applyStock() { this.iterateYears(this.stock_applier); }
}
class Year extends DataWrapper {
    constructor(store, local_id, data) {
        super(store, local_id, data);
        this.log_by_date = new Map();
    }
    getWriteStore() { return this.store.getWriteStore('years'); }
    maybeUpdate(new_data) {
        let old_count = this.data.count;
        let old_price = this.data.price;
        super.maybeUpdate(new_data);
        let price_delta = this.data.count * this.data.price - old_count * old_price;
        let count_delta = this.data.count - old_count;
        if (count_delta !== 0 || price_delta !== 0) {
            g_watchpoints.totals.notifyDelta(price_delta, count_delta);
        }
    }
    clickPlus() {
        this.data.count++;
        this.changed();
        g_watchpoints.totals.notifyDelta(this.data.price, 1);
        this.store.recordLog(this, 1);
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
    clickStockPlus() {
        this.data.stock++;
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
        }
    }
    resetStock() {
        let changed = (this.data.stock !== 0);
        this.data.stock = 0;
        if (changed)
            this.changed();
    }
    editPriceComment(new_price, new_comment) {
        let price_changed = false, comment_changed = false;
        let price_delta = 0;
        let old_price = this.data.price;
        if (old_price !== new_price) {
            price_delta = new_price - old_price;
            this.data.price = new_price;
            price_changed = true;
        }
        if (this.data.comment !== new_comment) {
            this.data.comment = new_comment;
            comment_changed = true;
        }
        if (price_changed || comment_changed)
            this.changed();
        if (price_changed) {
            g_watchpoints.totals.notifyDelta(price_delta * this.data.count, 0);
        }
    }
    updateRating(new_rating) {
        if (this.data.rating === new_rating)
            return;
        this.data.rating = new_rating;
        this.changed();
    }
    updateValue(new_value) {
        if (this.data.value === new_value)
            return;
        this.data.value = new_value;
        this.changed();
    }
    updateSweetness(new_sweetness) {
        if (this.data.sweetness === new_sweetness)
            return;
        this.data.sweetness = new_sweetness;
        this.changed();
    }
    updateAge(new_age) {
        if (this.data.age === new_age)
            return;
        this.data.age = new_age;
        this.changed();
    }
    reviveDeleted(new_count, new_price, new_comment) {
        this.data.count = new_count;
        if (new_price)
            this.data.price = new_price;
        if (new_comment)
            this.data.comment = new_comment;
        // Let's keep other old data, maybe it's useful.
        this.changed();
        g_watchpoints.totals.notifyDelta(new_count * this.data.price, new_count);
    }
    addLog(log) {
        this.log_by_date.set(log.data.date, log);
        log.year = this;
    }
}
class Log extends DataWrapper {
    constructor(store, local_id, data) {
        super(store, local_id, data);
    }
    getWriteStore() { return this.store.getWriteStore('log'); }
    updateDelta(count) {
        this.data.delta += count;
        this.changed();
    }
    updateReason(reason) {
        if (this.data.reason !== reason) {
            this.data.reason = reason;
            this.changed();
        }
    }
}
class DataStore {
    constructor() {
        this.vineyards = [];
        this.vineyards_by_name = new Map();
        this.vineyards_by_server_id = new Map();
        this.wines = [];
        this.wines_by_server_id = new Map();
        this.years = [];
        this.years_by_server_id = new Map();
        this.log = [];
        this.log_by_server_id = new Map();
        this.global_dirtybit = false;
        this.next_vineyard_id = 0;
        this.next_wine_id = 0;
        this.next_year_id = 0;
        this.next_log_id = 0;
        this.last_server_commit = 0;
        this.last_server_contact = 0;
        this.default_reason_add = 0;
        this.default_reason_remove = 0;
        this.ui = null;
        this.connection = null;
    }
    dataChanged() {
        this.global_dirtybit = true;
        if (this.connection)
            this.connection.kick();
    }
    getLastServerCommit() { return this.last_server_commit; }
    setLastServerCommit(commit) {
        this.last_server_commit = commit;
        this.persistLastServerCommit();
    }
    getLastServerContact() { return this.last_server_contact; }
    setLastServerContact(contact) {
        this.last_server_contact = contact;
        this.persistLastServerContact();
    }
    getOrCreateVineyard(name) {
        let vineyard = this.vineyards_by_name.get(name);
        if (vineyard)
            return vineyard;
        let data = new VineyardData(0, 1, name, "", "", "", "", "");
        return this.createVineyard(data);
    }
    getOrCreateWine(vineyard, name) {
        let wine = vineyard.wines_by_name.get(name);
        if (wine)
            return wine;
        let data = new WineData(0, 1, vineyard.local_id, name, "", "");
        return this.createWine(data);
    }
    getOrCreateYear(wine, year, count, price, comment) {
        let maybe_deleted = wine.getDeletedYear(year);
        if (maybe_deleted) {
            maybe_deleted.reviveDeleted(count, price, comment);
            this.recordLog(maybe_deleted, count);
            if (this.ui)
                this.ui.reviveYear(maybe_deleted);
            return;
        }
        let data = new YearData(0, 1, wine.local_id, year, count, 0, price, 0, 0, 0, 0, comment);
        let y = this.createYear(data);
        this.recordLog(y, count);
    }
    recordLog(y, delta) {
        let date = getDateString();
        let log = y.log_by_date.get(date);
        if (log) {
            log.updateDelta(delta);
        }
        else {
            let reason = delta > 0 ? this.default_reason_add : this.default_reason_remove;
            let data = new LogData(0, 1, date, y.local_id, delta, reason, "");
            this.createLog(data);
        }
    }
    getVineyardNames() {
        let result = [];
        for (let v of this.vineyards) {
            if (v)
                result.push(v.data.name);
        }
        return result.sort();
    }
    getWineNamesForVineyard(vineyard_name) {
        let result = [];
        let vineyard = this.vineyards_by_name.get(vineyard_name);
        if (!vineyard)
            return result;
        return vineyard.getWineNames();
    }
    iterateVineyards(callback) {
        for (let v of this.vineyards) {
            if (!v)
                continue;
            callback(v);
        }
    }
    iterateWines(callback) {
        for (let w of this.wines) {
            if (!w)
                continue;
            callback(w);
        }
    }
    iterateYears(callback) {
        for (let y of this.years) {
            if (!y)
                continue;
            if (y.data.count < 0)
                continue;
            callback(y);
        }
    }
    applyAllStock() {
        this.iterateYears((y) => y.applyStock());
    }
    resetAllStock() {
        this.iterateYears((y) => y.resetStock());
    }
    getNextVineyardId(update_db = true) {
        let result = this.next_vineyard_id++;
        if (update_db)
            this.persistNextVineyardId();
        return result;
    }
    getNextWineId(update_db = true) {
        let result = this.next_wine_id++;
        if (update_db)
            this.persistNextWineId();
        return result;
    }
    getNextYearId(update_db = true) {
        let result = this.next_year_id++;
        if (update_db)
            this.persistNextYearId();
        return result;
    }
    getNextLogId(update_db = true) {
        let result = this.next_log_id++;
        if (update_db)
            this.persistNextLogId();
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
            dbOpenRequest.onupgradeneeded = (event) => {
                let db = event.target.result;
                console.log('IndexedDB: Database needs upgrade from version ' +
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
                this.db = event.target.result;
                this.db.onerror = (event) => {
                    console.log('IndexedDB database error: ' +
                        event.target.error);
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
                                resolve();
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
    persistNextVineyardId() {
        this.getWriteStore('data').put(this.next_vineyard_id, 'next_vineyard_id');
    }
    persistNextWineId() {
        this.getWriteStore('data').put(this.next_wine_id, 'next_wine_id');
    }
    persistNextYearId() {
        this.getWriteStore('data').put(this.next_year_id, 'next_year_id');
    }
    persistNextLogId() {
        this.getWriteStore('data').put(this.next_log_id, 'next_log_id');
    }
    persistLastServerCommit() {
        this.getWriteStore('data').put(this.last_server_commit, 'last_server_commit');
    }
    persistLastServerContact() {
        this.getWriteStore('data').put(this.last_server_contact, 'last_server_contact');
    }
    readDataFromDB(data_store) {
        data_store.get('next_vineyard_id').onsuccess = (event) => {
            let next = event.target.result;
            if (next)
                this.next_vineyard_id = next;
        };
        data_store.get('next_wine_id').onsuccess = (event) => {
            let next = event.target.result;
            if (next)
                this.next_wine_id = next;
        };
        data_store.get('next_year_id').onsuccess = (event) => {
            let next = event.target.result;
            if (next)
                this.next_year_id = next;
        };
        data_store.get('next_log_id').onsuccess = (event) => {
            let next = event.target.result;
            if (next)
                this.next_log_id = next;
        };
        data_store.get('last_server_commit').onsuccess = (event) => {
            let commit = event.target.result;
            if (commit)
                this.last_server_commit = commit;
        };
        data_store.get('last_server_contact').onsuccess = (event) => {
            let contact = event.target.result;
            if (contact)
                this.last_server_contact = contact;
        };
    }
    readVineyardsFromDB(tx) {
        tx.objectStore("vineyards").openCursor().onsuccess = (event) => {
            let cursor = event.target.result;
            if (cursor) {
                // Does it make sense to defensively compare cursor.key against
                // this.next_vineyard_id?
                let local_id = cursor.key;
                let data = VineyardData.fromStruct(cursor.value);
                this.createVineyardWithId(data, local_id);
                cursor.continue();
            }
        };
    }
    readWinesFromDB(tx) {
        tx.objectStore("wines").openCursor().onsuccess = (event) => {
            let cursor = event.target.result;
            if (cursor) {
                let local_id = cursor.key;
                let data = WineData.fromStruct(cursor.value);
                this.createWineWithId(data, local_id);
                cursor.continue();
            }
        };
    }
    readYearsFromDB(tx) {
        tx.objectStore("years").openCursor().onsuccess = (event) => {
            let cursor = event.target.result;
            if (cursor) {
                let local_id = cursor.key;
                let data = YearData.fromStruct(cursor.value);
                this.createYearWithId(data, local_id);
                cursor.continue();
            }
        };
    }
    readLogFromDB(tx) {
        tx.objectStore('log').openCursor().onsuccess = (event) => {
            let cursor = event.target.result;
            if (cursor) {
                let local_id = cursor.key;
                let data = LogData.fromStruct(cursor.value);
                this.createLogWithId(data, local_id);
                cursor.continue();
            }
        };
    }
    // These must be public because the Connection logic needs them.
    createVineyard(data, persist_next_id = true) {
        let id = this.getNextVineyardId(persist_next_id);
        let request = this.getWriteStore('vineyards').add(data, id);
        request.onerror = (event) => console.log('adding vineyard failed');
        return this.createVineyardWithId(data, id);
    }
    createWine(data, persist_next_id = true) {
        if (!data.grape) {
            data.grape = GuessGrapeForWine(data.name);
            if (data.grape)
                data.markDirty();
        }
        let id = this.getNextWineId(persist_next_id);
        let request = this.getWriteStore('wines').add(data, id);
        request.onerror = (event) => console.log('adding wine failed');
        return this.createWineWithId(data, id);
    }
    createYear(data, persist_next_id = true) {
        let id = this.getNextYearId(persist_next_id);
        let request = this.getWriteStore('years').add(data, id);
        request.onerror = (event) => console.log('adding year failed');
        return this.createYearWithId(data, id);
    }
    createLog(data, persist_next_id = true) {
        let id = this.getNextLogId(persist_next_id);
        let request = this.getWriteStore('log').add(data, id);
        request.onerror = (event) => console.log('adding log failed');
        this.createLogWithId(data, id);
    }
    createVineyardWithId(data, id) {
        let v = new Vineyard(this, id, data);
        this.vineyards[id] = v;
        this.vineyards_by_name.set(data.name, v);
        if (data.server_id) {
            this.vineyards_by_server_id.set(data.server_id, v);
        }
        if (data.isDirty())
            this.dataChanged();
        return v;
    }
    createWineWithId(data, id) {
        let w = new Wine(this, id, data);
        this.wines[id] = w;
        if (data.server_id) {
            this.wines_by_server_id.set(data.server_id, w);
        }
        let vineyard = this.vineyards[data.vineyard_id];
        vineyard.addWine(w);
        if (data.isDirty())
            this.dataChanged();
        return w;
    }
    createYearWithId(data, id) {
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
        if (data.isDirty())
            this.dataChanged();
        g_watchpoints.totals.notifyDelta(data.count * data.price, data.count);
        return y;
    }
    createLogWithId(data, id) {
        let l = new Log(this, id, data);
        this.log[id] = l;
        if (data.server_id) {
            this.log_by_server_id.set(data.server_id, l);
        }
        let year = this.years[data.year_id];
        year.addLog(l);
        if (this.ui)
            this.ui.addLog(l);
        if (data.isDirty())
            this.dataChanged();
        return l;
    }
    getWriteStore(key) {
        return this.db.transaction([key], 'readwrite').objectStore(key);
    }
}
//# sourceMappingURL=data.js.map