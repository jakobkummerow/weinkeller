import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as url from 'url';

const kPort = 7887;
const kSaveFileName = 'saved_data.json';

interface LooseObject {
  [key: string]: any
}

class Vineyard {
  constructor(
      public server_id: number, public name: string, public region: string,
      public country: string, public website: string, public address: string,
      public comment: string) {}
}

class Wine {
  constructor(
      public server_id: number, public vineyard_id: number, public name: string,
      public grape: string, public comment: string) {}
}

class Year {
  constructor(
      public server_id: number, public wine_id: number, public year: number,
      public count: number, public stock: number, public price: number,
      public rating: number, public value: number, public sweetness: number,
      public age: number, public comment: string, public location: string) {}
}

class Log {
  constructor(
      public server_id: number, public date: string, public year_id: number,
      public delta: number, public reason: number, public comment: string) {}
}

class Data {
  // The client code currently doesn't want server_id == 0, so we put an
  // empty first element into every array.
  private vineyards: (Vineyard|null)[] = [null];
  private vineyard_lastchange: number[] = [0];
  private wines: (Wine|null)[] = [null];
  private wine_lastchange: number[] = [0];
  private years: (Year|null)[] = [null];
  private year_lastchange: number[] = [0];
  private log: (Log|null)[] = [null];
  private log_lastchange: number[] = [0];
  private lastchange: number = 0;
  private uuid: string = '';
  constructor(private save_file_name: string) {}

  public readFromFile() {
    if (!fs.existsSync(this.save_file_name)) {
      console.log(
          'Warning: save file "' + this.save_file_name +
          '" not found, starting without data');
      this.getUuid();
      return true;
    }
    let file_contents;
    try {
      file_contents = fs.readFileSync(this.save_file_name, 'utf-8');
    } catch (e) {
      console.log('Error reading file (' + this.save_file_name + '): ');
      console.log(e);
      return false;
    }
    let data;
    try {
      data = JSON.parse(file_contents);
    } catch (e) {
      console.log('Corrupted save file (' + this.save_file_name + '): ');
      console.log(e);
      return false;
    }
    if (data.uuid) this.uuid = data.uuid;
    if (data.vineyards) {
      for (let v of data.vineyards) {
        let id = v.id;
        let vineyard = new Vineyard(
            id, v.name, v.region, v.country, v.website, v.address, v.comment);
        this.vineyards[id] = vineyard;
        this.vineyard_lastchange[id] = v.lastchange;
      }
    }
    if (data.wines) {
      for (let w of data.wines) {
        let id = w.id;
        let wine = new Wine(id, w.vineyard, w.name, w.grape, w.comment);
        this.wines[id] = wine;
        this.wine_lastchange[id] = w.lastchange;
      }
    }
    if (data.years) {
      for (let y of data.years) {
        let id = y.id;
        let location = y.location === undefined ? "" : y.location;
        let year = new Year(
            id, y.wine, y.year, y.count, y.stock, y.price, y.rating, y.value,
            y.sweetness, y.age, y.comment, location);
        this.years[id] = year;
        this.year_lastchange[id] = y.lastchange;
      }
    }
    if (data.log) {
      for (let l of data.log) {
        let id = l.id;
        let log = new Log(id, l.date, l.year, l.delta, l.reason, l.comment);
        this.log[id] = log;
        this.log_lastchange[id] = l.lastchange;
      }
    }
    this.getUuid();
    this.getLastChange();
    return true;
  }

  public save() {
    try {
      let vineyards: any = [];
      for (let i = 0; i < this.vineyards.length; i++) {
        let v = this.vineyards[i];
        if (!v) continue;
        vineyards.push({
          id: v.server_id,
          name: v.name,
          region: v.region,
          country: v.country,
          website: v.website,
          address: v.address,
          comment: v.comment,
          lastchange: this.vineyard_lastchange[i],
        });
      }
      let wines: any = [];
      for (let i = 0; i < this.wines.length; i++) {
        let w = this.wines[i];
        if (!w) continue;
        wines.push({
          id: w.server_id,
          vineyard: w.vineyard_id,
          name: w.name,
          grape: w.grape,
          commment: w.comment,
          lastchange: this.wine_lastchange[i],
        });
      }
      let years: any = [];
      for (let i = 0; i < this.years.length; i++) {
        let y = this.years[i];
        if (!y) continue;
        years.push({
          id: y.server_id,
          wine: y.wine_id,
          year: y.year,
          count: y.count,
          stock: y.stock,
          price: y.price,
          rating: y.rating,
          value: y.value,
          sweetness: y.sweetness,
          age: y.age,
          comment: y.comment,
          location: y.location,
          lastchange: this.year_lastchange[i]
        });
      }
      let log: any = [];
      for (let i = 0; i < this.log.length; i++) {
        let l = this.log[i];
        if (!l) continue;
        log.push({
          id: l.server_id,
          date: l.date,
          year: l.year_id,
          delta: l.delta,
          reason: l.reason,
          comment: l.comment,
          lastchange: this.log_lastchange[i]
        });
      }
      let uuid = this.uuid;
      let data = {vineyards, wines, years, log, uuid};
      fs.writeFileSync(this.save_file_name, JSON.stringify(data));
      console.log('Data written to file.')
    } catch (err) {
      console.error(err);
    }
  }

  public getAll(since: number) {
    let vineyards = [];
    for (let i = 0; i < this.vineyards.length; i++) {
      if (!(this.vineyard_lastchange[i] > since)) continue;
      vineyards.push(this.vineyards[i]);
    }
    let wines = [];
    for (let i = 0; i < this.wines.length; i++) {
      if (!(this.wine_lastchange[i] > since)) continue;
      wines.push(this.wines[i]);
    }
    let years = [];
    for (let i = 0; i < this.years.length; i++) {
      if (!(this.year_lastchange[i] > since)) continue;
      years.push(this.years[i]);
    }
    let log = [];
    for (let i = 0; i < this.log.length; i++) {
      if (!(this.log_lastchange[i] > since)) continue;
      log.push(this.log[i]);
    }
    let uuid = this.uuid;
    let commit = this.lastchange;
    return {vineyards, wines, years, log, commit, uuid};
  }

  public setAll(data: any) {
    this.lastchange++;
    let receipts: LooseObject = {};
    let have_receipts = false;
    let result: LooseObject = {};
    if (data.vineyards) {
      let vineyard_receipts = [];
      for (let v of data.vineyards) {
        let server_id = this.setVineyard(v);
        let local_id = v.local_id;
        vineyard_receipts.push({server_id, local_id});
      }
      receipts.vineyards = vineyard_receipts;
      have_receipts = true;
    }
    if (data.wines) {
      let wine_receipts = [];
      for (let w of data.wines) {
        let server_id = this.setWine(w);
        let local_id = w.local_id;
        wine_receipts.push({server_id, local_id});
      }
      receipts.wines = wine_receipts;
      have_receipts = true;
    }
    if (data.years) {
      let year_receipts = [];
      for (let y of data.years) {
        let server_id = this.setYears(y);
        let local_id = y.local_id;
        year_receipts.push({server_id, local_id});
      }
      receipts.years = year_receipts;
      have_receipts = true;
    }
    if (data.log) {
      let log_receipts = [];
      for (let l of data.log) {
        let server_id = this.setLog(l);
        let local_id = l.local_id;
        log_receipts.push({server_id, local_id});
      }
      receipts.log = log_receipts;
      have_receipts = true;
    }
    if (have_receipts) {
      result.receipts = receipts;
    }
    result.commit = this.lastchange;
    return result;
  }

  private setVineyard(v: any) {
    if (v.server_id) {
      return this.updateVineyard(this.vineyards[v.server_id] as Vineyard, v);
    }
    let maybe_vineyard = this.findVineyard(v.name);
    if (maybe_vineyard) {
      return this.updateVineyard(maybe_vineyard, v);
    }
    console.log('inserting vineyard: ' + JSON.stringify(v));
    let server_id = this.vineyards.length;
    let vineyard = new Vineyard(
        server_id, v.name, v.region, v.country, v.website, v.address,
        v.comment);
    this.vineyards.push(vineyard);
    this.vineyard_lastchange.push(this.lastchange);
    return server_id;
  }
  private setWine(w: any) {
    if (w.server_id) return this.updateWine(this.wines[w.server_id] as Wine, w);
    let maybe_wine = this.findWine(w.name, w.vineyard_id);
    if (maybe_wine) return this.updateWine(maybe_wine, w);
    console.log('inserting wine: ' + JSON.stringify(w));
    let server_id = this.wines.length;
    let wine = new Wine(server_id, w.vineyard_id, w.name, w.grape, w.comment);
    this.wines.push(wine);
    this.wine_lastchange.push(this.lastchange);
    return server_id;
  }
  private setYears(y: any) {
    if (y.server_id) return this.updateYear(this.years[y.server_id] as Year, y);
    let maybe_year = this.findYear(y.year, y.wine_id);
    if (maybe_year) return this.updateYear(maybe_year, y);
    console.log('inserting year: ' + JSON.stringify(y));
    let server_id = this.years.length;
    let year = new Year(
        server_id, y.wine_id, y.year, y.count, y.stock, y.price, y.rating,
        y.value, y.sweetness, y.age, y.comment, y.location);
    this.years.push(year);
    this.year_lastchange.push(this.lastchange);
    return server_id;
  }
  private setLog(l: any) {
    if (l.server_id) return this.updateLog(this.log[l.server_id] as Log, l);
    let maybe_log = this.findLog(l.date, l.year_id);
    if (maybe_log) return this.updateLog(maybe_log, l);
    console.log('inserting log: ' + JSON.stringify(l));
    let server_id = this.log.length;
    let log =
        new Log(server_id, l.date, l.year_id, l.delta, l.reason, l.comment);
    this.log.push(log);
    this.log_lastchange.push(this.lastchange);
    return server_id;
  }


  private updateVineyard(vineyard: Vineyard, v: any) {
    console.log('updating vineyard: ' + JSON.stringify(v));
    vineyard.name = v.name;
    vineyard.region = v.region;
    vineyard.country = v.country;
    vineyard.website = v.website;
    vineyard.address = v.address;
    vineyard.comment = v.comment;
    this.vineyard_lastchange[vineyard.server_id] = this.lastchange;
    return vineyard.server_id;
  }
  private updateWine(wine: Wine, w: any) {
    console.log('updating wine: ' + JSON.stringify(w));
    wine.name = w.name;
    wine.grape = w.grape;
    wine.comment = w.comment;
    this.wine_lastchange[wine.server_id] = this.lastchange;
    return wine.server_id;
  }
  private updateYear(year: Year, y: any) {
    console.log('updating year: ' + JSON.stringify(y));
    year.count = y.count;
    year.stock = y.stock;
    year.price = y.price;
    year.rating = y.rating;
    year.value = y.value;
    year.sweetness = y.sweetness;
    year.age = y.age;
    year.comment = y.comment;
    year.location = y.location;
    this.year_lastchange[year.server_id] = this.lastchange;
    return year.server_id;
  }
  private updateLog(log: Log, l: any) {
    console.log('updating log: ' + JSON.stringify(l));
    log.delta = l.delta;
    log.reason = l.reason;
    log.comment = l.comment;
    this.log_lastchange[log.server_id] = this.lastchange;
    return log.server_id;
  }

  private findVineyard(name: string) {
    for (let v of this.vineyards) {
      if (v && v.name === name) return v;
    }
    return null;
  }
  private findWine(name: string, vineyard_id: number) {
    for (let w of this.wines) {
      if (w && w.name === name && w.vineyard_id === vineyard_id) return w;
    }
    return null;
  }
  private findYear(year: number, wine_id: number) {
    for (let y of this.years) {
      if (y && y.year === year && y.wine_id === wine_id) return y;
    }
    return null;
  }
  private findLog(date: string, year_id: number) {
    for (let l of this.log) {
      if (l && l.date === date && l.year_id === year_id) return l;
    }
    return null;
  }

  private getLastChange() {
    let last_change = 0;
    for (let v of this.vineyard_lastchange) {
      if (v > last_change) last_change = v;
    }
    for (let w of this.wine_lastchange) {
      if (w > last_change) last_change = w;
    }
    for (let y of this.year_lastchange) {
      if (y > last_change) last_change = y;
    }
    for (let l of this.log_lastchange) {
      if (l > last_change) last_change = l;
    }
    this.lastchange = last_change;
  }

  private getUuid() {
    if (this.uuid !== '') return;
    this.uuid = crypto.randomBytes(8).toString('base64');
  }
}

let g_data = new Data(kSaveFileName);
if (!g_data.readFromFile()) {
  console.log('Corrupted save file (' + kSaveFileName + ').');
  process.exit(1);
}

function GetAll(since: number) {
  return g_data.getAll(since);
}

function SetAll(data: any) {
  return g_data.setAll(data);
}

function ServeFile(path: string, mimetype: string, res: http.ServerResponse) {
  fs.readFile(path, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      res.writeHead(404);
      res.end();
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', mimetype);
    res.write(data);
    res.end();
  });
}

function ServeJson(res: http.ServerResponse, data: any) {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(data));
  res.end();
}

const server = http.createServer((req, res) => {
  // TODO: should we use urlparts.pathname instead? That'd strip the query.
  let req_url = req.url as string;
  if (req.method === 'GET') {
    if (req_url === '/') {
      let raw_agent = req.headers['user-agent'];
      let user_agent = raw_agent ? raw_agent.toLowerCase() : '';
      if (user_agent.indexOf('android') !== -1 ||
          user_agent.indexOf('mobile') !== -1) {
        req_url = '/mobile2.html';
      } else {
        req_url = '/index2.html';
      }
    } else if (req_url === '/m') {
      req_url = '/mobile2.html';
    }
    let mimetype = null;
    if (req_url.endsWith('.html')) {
      mimetype = 'text/html; charset=utf-8';
    } else if (req_url.endsWith('.js')) {
      mimetype = 'text/javascript';
    } else if (req_url.endsWith('.css')) {
      mimetype = 'text/css';
    } else if (req_url.endsWith('.js.map')) {
      mimetype = 'application/json';
    } else if (req_url.endsWith('.ts')) {
      mimetype = 'application/x-typescript';
    }
    if (mimetype) {
      ServeFile('.' + req_url, mimetype, res);
      return;
    }
    if (req_url === '/favicon.ico') {
      fs.readFile('favicon.ico', (err, data) => {
        if (err) {
          console.error(err);
          res.writeHead(404);
          res.end();
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/x-icon');
        res.write(data);
        res.end();
      });
      return;
    }
    let urlparts = url.parse(req_url, true);
    // Example:
    // search: '?foo=bar',
    // query: [Object: null prototype] { foo: 'bar' },
    // pathname: '/data',
    // path: '/data?foo=bar',
    // href: '/data?foo=bar'
    if (urlparts.pathname === '/api/get') {
      let since = Number(urlparts.query.last_commit);
      let data = GetAll(since);
      return ServeJson(res, data);
    }

    // Anything else is 404.
    res.statusCode = 404;
    res.end();

  } else if (req.method === 'POST') {
    let data: any = [];
    req.on('data', chunk => {
      data.push(chunk);
    });
    req.on('end', () => {
      if (req_url !== '/api/set') {
        console.log('invalid POST url: ' + req_url);
        res.statusCode = 404;
        res.end();
        return;
      }
      let obj = JSON.parse(data);
      let response = SetAll(obj);
      ServeJson(res, response);
    });

  } else {
    res.statusCode = 404;
    res.write('unsupported');
    res.end();
  }
});

function Shutdown() {
  console.log('Shutting down...');
  g_data.save();
  server.close(() => {
    console.log('Server stopped.');
    process.exit();
  });
  // Fallback: kill the process if the server fails to stop quickly.
  setTimeout(() => {
    process.exit();
  }, 3000);
}

process.on('SIGTERM', () => {
  Shutdown();
});

process.on('SIGINT', () => {
  Shutdown();
});

function GetIpAddress() {
  let interfaces = os.networkInterfaces();
  let fallback = "localhost";
  for (let i_name in interfaces) {
    let iface = interfaces[i_name];
    if (!iface) continue;
    for (let i of iface) {
      if (i.address.startsWith('192.')) {
        return i.address;
      }
      if (i.netmask.startsWith('255.255.')) {
        fallback = i.address;
      }
    }
  }
  return fallback;
}

let hostname = GetIpAddress();

server.listen(kPort, () => {
  console.log(
      `Server running at http://${hostname}:${kPort}/, hit Ctrl+C to stop`);
});
