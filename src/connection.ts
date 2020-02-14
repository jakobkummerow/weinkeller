"use strict";

enum Result { kSuccess, kError };

const kSeconds = 1000;  // Milliseconds.
const kMinutes = 60 * kSeconds;
const kHours = 60 * kMinutes;
const kMinHeartbeatDelay = 5 * kSeconds;
const kMaxHeartbeatDelay = 5 * kMinutes;
const kMinErrorDelay = 5 * kSeconds;
const kMaxErrorDelay = 5 * kHours;

class Connection {
  public last_result = Result.kSuccess;
  public last_success = 0;
  public next_ping = 0;
  private delay = 0;
  private torch = 0;
  private callback = () => { this.entryPoint() };
  private last_commit = 0;
  private prefix = "";

  constructor(private data: DataStore) {
    data.connection = this;
  }

  public start() {
    this.last_commit = this.data.getLastServerCommit();
    this.entryPoint();
  }

  public setPrefix(prefix: string) {
    this.prefix = prefix;
  }

  // Call this to notify the Connection that there is an update to be sent.
  public kick(manually_triggered = false) {
    if (manually_triggered || this.last_result === Result.kSuccess) {
      if (this.torch === 0) {
        // There's currently a request in flight.
        this.delay = 0;
      } else {
        // We're currently waiting for the next scheduled activity.
        window.clearTimeout(this.torch);
        this.torch = 0;
        this.entryPoint();
      }
    } else {
      // Last attempt result in an error... let's not interfere with the
      // automatic backoff.
    }
  }

  private onError() {
    this.last_result = Result.kError;
    if (this.delay < kMinErrorDelay) {
      this.delay = kMinErrorDelay;
    } else {
      this.delay = Math.min(this.delay * 2, kMaxErrorDelay);
    }
    this.loop();
  }
  private registerSuccess() {
    let now = Date.now();
    this.last_result = Result.kSuccess;
    this.last_success = now;
    this.data.setLastServerContact(now);
  }
  private onReceivedData() {
    this.registerSuccess();
    this.delay = kMinHeartbeatDelay;
    this.loop();
  }
  private onNoData() {
    this.registerSuccess();
    if (this.delay < kMinHeartbeatDelay) {
      this.delay = kMinHeartbeatDelay;
    } else {
      this.delay = Math.min(this.delay * 2, kMaxHeartbeatDelay);
    }
    this.loop();
  }
  private loop() {
    this.next_ping = Date.now() + this.delay;
    this.torch = window.setTimeout(this.callback, this.delay);
  }

  private entryPoint() {
    this.torch = 0;
    let updates = this.findWork();
    if (updates !== null) {
      console.log('Sending updates to server');
      return this.sendPost(updates);
    }
    console.log('Fetching data from server');
    this.sendGet('api/get', {last_commit: this.last_commit});
  }

  processResponse(response: any) {
    let had_receipts = this.processReceipts(response.receipts);
    let had_data = this.processData(response);
    if (had_receipts) {
      // We sent updates, see if there are more.
      this.entryPoint();
      return;
    }
    if (had_data) {
      this.onReceivedData();
    } else {
      this.onNoData();
    }
  }

  processError(error: any) {
    this.onError();
  }

  private findWork() {
    if (!this.data.global_dirtybit) return null;
    const kMax = 1;  // TODO: bump!
    let vineyards = [];
    for (let v of this.data.vineyards) {
      if (!v) continue;
      let data = v.data;
      if (!data.isDirty()) continue;
      vineyards.push(data.packForSync(v.local_id));
      if (vineyards.length >= kMax) break;
    }
    if (vineyards.length > 0) return {vineyards};
    let wines = [];
    for (let w of this.data.wines) {
      if (!w) continue;
      let data = w.data;
      if (!data.isDirty()) continue;
      let pack = data.packForSync(w.local_id);
      pack.vineyard_id = w.vineyard.data.server_id;
      wines.push(pack);
      if (wines.length >= kMax) break;
    }
    if (wines.length > 0) return {wines};
    let years = [];
    for (let y of this.data.years) {
      if (!y) continue;
      let data = y.data;
      if (!data.isDirty()) continue;
      // Important: this is the one place where we don't ignore years
      // with data.count < 0, because we still want to tell the server.
      let pack = data.packForSync(y.local_id);
      pack.wine_id = y.wine.data.server_id;
      years.push(pack);
      if (years.length >= kMax) break;
    }
    if (years.length > 0) return {years};
    let log = [];
    for (let l of this.data.log) {
      if (!l) continue;
      let data = l.data;
      if (!data.isDirty()) continue;
      let pack = data.packForSync(l.local_id);
      pack.year_id = l.year.data.server_id;
      log.push(pack);
      if (log.length >= kMax) break;
    }
    if (log.length > 0) return {log};
    this.data.global_dirtybit = false;
    return null;
  }

  private processReceipts(receipts: any) {
    if (!receipts) return false;
    let had_receipts = false;
    if (receipts.vineyards) {
      for (let v of receipts.vineyards) {
        let vineyard = this.data.vineyards[v.local_id];
        if (!vineyard.data.server_id) {
          this.data.vineyards_by_server_id.set(v.server_id, vineyard);
        }
        vineyard.markSyncDone(v.server_id);
        had_receipts = true;
      }
    }
    if (receipts.wines) {
      for (let w of receipts.wines) {
        let wine = this.data.wines[w.local_id];
        if (!wine.data.server_id) {
          this.data.wines_by_server_id.set(w.server_id, wine);
        }
        wine.markSyncDone(w.server_id);
        had_receipts = true;
      }
    }
    if (receipts.years) {
      for (let y of receipts.years) {
        let year = this.data.years[y.local_id];
        if (!year.data.server_id) {
          this.data.years_by_server_id.set(y.server_id, year);
        }
        year.markSyncDone(y.server_id);
        had_receipts = true;
      }
    }
    if (receipts.log) {
      for (let l of receipts.log) {
        let log = this.data.log[l.local_id];
        if (!log.data.server_id) {
          this.data.log_by_server_id.set(l.server_id, log);
        }
        log.markSyncDone(l.server_id);
        had_receipts = true;
      }
    }
    return had_receipts;
  }

  private processData(response: any) {
    if (response.vineyards) {
      let added_vineyard = false;
      for (let v of response.vineyards) {
        let existing = this.data.vineyards_by_server_id.get(v.server_id);
        if (existing) {
          existing.maybeUpdate(v);
        } else {
          this.data.createVineyard(VineyardData.fromStruct(v), false);
          added_vineyard = true;
        }
      }
      if (added_vineyard) this.data.persistNextVineyardId();
    }
    if (response.wines) {
      let added_wine = false;
      for (let w of response.wines) {
        let vineyard = this.data.vineyards_by_server_id.get(w.vineyard_id);
        if (!vineyard) {
          console.warn(
              'Warning: server sent us a wine for nonexistent vineyard:');
          console.warn(w);
          continue;
        }
        if (!vineyard) throw 'bug: must add vineyards before wines!';
        w.vineyard_id = vineyard.local_id;
        let existing = this.data.wines_by_server_id.get(w.server_id);
        if (existing) {
          existing.maybeUpdate(w);
        } else {
          this.data.createWine(WineData.fromStruct(w), false);
          added_wine = true;
        }
      }
      if (added_wine) this.data.persistNextWineId();
    }
    if (response.years) {
      let added_year = false;
      for (let year of response.years) {
        let wine = this.data.wines_by_server_id.get(year.wine_id);
        if (!wine) {
          console.warn('Warning: server sent us a year for nonexistent wine:');
          console.warn(year);
          continue;
        }
        year.wine_id = wine.local_id;
        let existing = this.data.years_by_server_id.get(year.server_id);
        if (existing) {
          existing.maybeUpdate(year);
        } else {
          this.data.createYear(YearData.fromStruct(year), false);
          added_year = true;
        }
      }
      if (added_year) this.data.persistNextYearId();
    }
    if (response.log) {
      let added_log = false;
      for (let log of response.log) {
        let year = this.data.years_by_server_id.get(log.year_id);
        if (!year) {
          console.warn(
              'Warning: server sent us a log entry for nonexistent year:');
          console.warn(log);
          continue;
        }
        log.year_id = year.local_id;
        let existing = this.data.log_by_server_id.get(log.server_id);
        if (existing) {
          existing.maybeUpdate(log);
        } else {
          this.data.createLog(LogData.fromStruct(log), false);
          added_log = true;
        }
      }
      if (added_log) this.data.persistNextLogId();
    }
    let commit = response.commit;
    if (commit !== this.last_commit) {
      this.last_commit = commit;
      this.data.setLastServerCommit(commit);
      return true;
    }
    return false;
  }

  private sendPost(updates: any) {
    fetch(this.prefix + 'api/set', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(updates)
    }).then((response) => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    }).then((response => {
      console.log('POST success: ' + JSON.stringify(response));
      this.processResponse(response);
    }), (error) => {
      console.log('POST error: ' + error);
      this.processError(error);
    });
  }

  private sendGet(path: string, query: any = null) {
    let str = [];
    if (query) {
      for (var p of Object.keys(query)) {
        let key = encodeURIComponent(p);
        let val = encodeURIComponent(query[p]);
        str.push(key + '=' + val);
      }
      path += '?' + str.join('&');
    }
    fetch(this.prefix + path).then((response) => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    }).then((response) => {
      console.log('GET success: ' + JSON.stringify(response));
      this.processResponse(response);
    }, (error) => {
      console.log('GET error: ' + error);
      this.processError(error);
    });
  }
}
