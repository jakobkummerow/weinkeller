"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const url = require("url");
const kPort = 7887;
const kSaveFileName = 'saved_data.json';
class Vineyard {
    constructor(server_id, name, region, country, website, address, comment) {
        this.server_id = server_id;
        this.name = name;
        this.region = region;
        this.country = country;
        this.website = website;
        this.address = address;
        this.comment = comment;
    }
}
class Wine {
    constructor(server_id, vineyard_id, name, grape, comment) {
        this.server_id = server_id;
        this.vineyard_id = vineyard_id;
        this.name = name;
        this.grape = grape;
        this.comment = comment;
    }
}
class Year {
    constructor(server_id, wine_id, year, count, stock, price, rating, value, sweetness, age, age_update, comment, location) {
        this.server_id = server_id;
        this.wine_id = wine_id;
        this.year = year;
        this.count = count;
        this.stock = stock;
        this.price = price;
        this.rating = rating;
        this.value = value;
        this.sweetness = sweetness;
        this.age = age;
        this.age_update = age_update;
        this.comment = comment;
        this.location = location;
    }
}
class Log {
    constructor(server_id, date, year_id, delta, reason, comment) {
        this.server_id = server_id;
        this.date = date;
        this.year_id = year_id;
        this.delta = delta;
        this.reason = reason;
        this.comment = comment;
    }
}
function MonthlyDatabaseBackup(filename) {
    let now = new Date();
    let month = (now.getMonth() + 1).toString();
    if (month.length == 1)
        month = '0' + month;
    let backup_name = `${filename}-${now.getFullYear()}-${month}-backup`;
    if (fs.existsSync(backup_name))
        return;
    fs.copyFileSync(filename, backup_name);
}
class Data {
    constructor(save_file_name) {
        this.save_file_name = save_file_name;
        // The client code currently doesn't want server_id == 0, so we put an
        // empty first element into every array.
        this.vineyards = [null];
        this.vineyard_lastchange = [0];
        this.wines = [null];
        this.wine_lastchange = [0];
        this.years = [null];
        this.year_lastchange = [0];
        this.log = [null];
        this.log_lastchange = [0];
        this.lastchange = 0;
        this.uuid = '';
    }
    readFromFile() {
        if (!fs.existsSync(this.save_file_name)) {
            console.log('Warning: save file "' + this.save_file_name +
                '" not found, starting without data');
            this.getUuid();
            return true;
        }
        else {
            MonthlyDatabaseBackup(this.save_file_name);
        }
        let file_contents;
        try {
            file_contents = fs.readFileSync(this.save_file_name, 'utf-8');
        }
        catch (e) {
            console.log('Error reading file (' + this.save_file_name + '): ');
            console.log(e);
            return false;
        }
        let data;
        try {
            data = JSON.parse(file_contents);
        }
        catch (e) {
            console.log('Corrupted save file (' + this.save_file_name + '): ');
            console.log(e);
            return false;
        }
        if (data.uuid)
            this.uuid = data.uuid;
        if (data.vineyards) {
            for (let v of data.vineyards) {
                let id = v.id;
                let vineyard = new Vineyard(id, v.name, v.region, v.country, v.website, v.address, v.comment);
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
                // Fields that were added later need special handling to set defaults.
                let location = y.location === undefined ? "" : y.location;
                let age_update = y.age_update === undefined ? 0 : y.age_update;
                let year = new Year(id, y.wine, y.year, y.count, y.stock, y.price, y.rating, y.value, y.sweetness, y.age, age_update, y.comment, location);
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
    save() {
        try {
            let vineyards = [];
            for (let i = 0; i < this.vineyards.length; i++) {
                let v = this.vineyards[i];
                if (!v)
                    continue;
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
            let wines = [];
            for (let i = 0; i < this.wines.length; i++) {
                let w = this.wines[i];
                if (!w)
                    continue;
                wines.push({
                    id: w.server_id,
                    vineyard: w.vineyard_id,
                    name: w.name,
                    grape: w.grape,
                    commment: w.comment,
                    lastchange: this.wine_lastchange[i],
                });
            }
            let years = [];
            for (let i = 0; i < this.years.length; i++) {
                let y = this.years[i];
                if (!y)
                    continue;
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
                    age_update: y.age_update,
                    comment: y.comment,
                    location: y.location,
                    lastchange: this.year_lastchange[i]
                });
            }
            let log = [];
            for (let i = 0; i < this.log.length; i++) {
                let l = this.log[i];
                if (!l)
                    continue;
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
            let data = { vineyards, wines, years, log, uuid };
            fs.writeFileSync(this.save_file_name, JSON.stringify(data));
            console.log('Data written to file.');
        }
        catch (err) {
            console.error(err);
        }
    }
    getAll(since) {
        let vineyards = [];
        for (let i = 0; i < this.vineyards.length; i++) {
            if (!(this.vineyard_lastchange[i] > since))
                continue;
            vineyards.push(this.vineyards[i]);
        }
        let wines = [];
        for (let i = 0; i < this.wines.length; i++) {
            if (!(this.wine_lastchange[i] > since))
                continue;
            wines.push(this.wines[i]);
        }
        let years = [];
        for (let i = 0; i < this.years.length; i++) {
            if (!(this.year_lastchange[i] > since))
                continue;
            years.push(this.years[i]);
        }
        let log = [];
        for (let i = 0; i < this.log.length; i++) {
            if (!(this.log_lastchange[i] > since))
                continue;
            log.push(this.log[i]);
        }
        let uuid = this.uuid;
        let commit = this.lastchange;
        return { vineyards, wines, years, log, commit, uuid };
    }
    setAll(data) {
        this.lastchange++;
        let receipts = {};
        let have_receipts = false;
        let result = {};
        if (data.vineyards) {
            let vineyard_receipts = [];
            for (let v of data.vineyards) {
                let server_id = this.setVineyard(v);
                let local_id = v.local_id;
                vineyard_receipts.push({ server_id, local_id });
            }
            receipts.vineyards = vineyard_receipts;
            have_receipts = true;
        }
        if (data.wines) {
            let wine_receipts = [];
            for (let w of data.wines) {
                let server_id = this.setWine(w);
                let local_id = w.local_id;
                wine_receipts.push({ server_id, local_id });
            }
            receipts.wines = wine_receipts;
            have_receipts = true;
        }
        if (data.years) {
            let year_receipts = [];
            for (let y of data.years) {
                let server_id = this.setYears(y);
                let local_id = y.local_id;
                year_receipts.push({ server_id, local_id });
            }
            receipts.years = year_receipts;
            have_receipts = true;
        }
        if (data.log) {
            let log_receipts = [];
            for (let l of data.log) {
                let server_id = this.setLog(l);
                let local_id = l.local_id;
                log_receipts.push({ server_id, local_id });
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
    setVineyard(v) {
        if (v.server_id) {
            return this.updateVineyard(this.vineyards[v.server_id], v);
        }
        let maybe_vineyard = this.findVineyard(v.name);
        if (maybe_vineyard) {
            return this.updateVineyard(maybe_vineyard, v);
        }
        console.log('inserting vineyard: ' + JSON.stringify(v));
        let server_id = this.vineyards.length;
        let vineyard = new Vineyard(server_id, v.name, v.region, v.country, v.website, v.address, v.comment);
        this.vineyards.push(vineyard);
        this.vineyard_lastchange.push(this.lastchange);
        return server_id;
    }
    setWine(w) {
        if (w.server_id)
            return this.updateWine(this.wines[w.server_id], w);
        let maybe_wine = this.findWine(w.name, w.vineyard_id);
        if (maybe_wine)
            return this.updateWine(maybe_wine, w);
        console.log('inserting wine: ' + JSON.stringify(w));
        let server_id = this.wines.length;
        let wine = new Wine(server_id, w.vineyard_id, w.name, w.grape, w.comment);
        this.wines.push(wine);
        this.wine_lastchange.push(this.lastchange);
        return server_id;
    }
    setYears(y) {
        if (y.server_id)
            return this.updateYear(this.years[y.server_id], y);
        let maybe_year = this.findYear(y.year, y.wine_id);
        if (maybe_year)
            return this.updateYear(maybe_year, y);
        console.log('inserting year: ' + JSON.stringify(y));
        let server_id = this.years.length;
        let year = new Year(server_id, y.wine_id, y.year, y.count, y.stock, y.price, y.rating, y.value, y.sweetness, y.age, y.age_update, y.comment, y.location);
        this.years.push(year);
        this.year_lastchange.push(this.lastchange);
        return server_id;
    }
    setLog(l) {
        if (l.server_id)
            return this.updateLog(this.log[l.server_id], l);
        let maybe_log = this.findLog(l.date, l.year_id);
        if (maybe_log)
            return this.updateLog(maybe_log, l);
        console.log('inserting log: ' + JSON.stringify(l));
        let server_id = this.log.length;
        let log = new Log(server_id, l.date, l.year_id, l.delta, l.reason, l.comment);
        this.log.push(log);
        this.log_lastchange.push(this.lastchange);
        return server_id;
    }
    updateVineyard(vineyard, v) {
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
    updateWine(wine, w) {
        console.log('updating wine: ' + JSON.stringify(w));
        wine.name = w.name;
        wine.grape = w.grape;
        wine.comment = w.comment;
        this.wine_lastchange[wine.server_id] = this.lastchange;
        return wine.server_id;
    }
    updateYear(year, y) {
        console.log('updating year: ' + JSON.stringify(y));
        year.count = y.count;
        year.stock = y.stock;
        year.price = y.price;
        year.rating = y.rating;
        year.value = y.value;
        year.sweetness = y.sweetness;
        year.age = y.age;
        year.age_update = y.age_update;
        year.comment = y.comment;
        year.location = y.location;
        this.year_lastchange[year.server_id] = this.lastchange;
        return year.server_id;
    }
    updateLog(log, l) {
        console.log('updating log: ' + JSON.stringify(l));
        log.delta = l.delta;
        log.reason = l.reason;
        log.comment = l.comment;
        this.log_lastchange[log.server_id] = this.lastchange;
        return log.server_id;
    }
    findVineyard(name) {
        for (let v of this.vineyards) {
            if (v && v.name === name)
                return v;
        }
        return null;
    }
    findWine(name, vineyard_id) {
        for (let w of this.wines) {
            if (w && w.name === name && w.vineyard_id === vineyard_id)
                return w;
        }
        return null;
    }
    findYear(year, wine_id) {
        for (let y of this.years) {
            if (y && y.year === year && y.wine_id === wine_id)
                return y;
        }
        return null;
    }
    findLog(date, year_id) {
        for (let l of this.log) {
            if (l && l.date === date && l.year_id === year_id)
                return l;
        }
        return null;
    }
    getLastChange() {
        let last_change = 0;
        for (let v of this.vineyard_lastchange) {
            if (v > last_change)
                last_change = v;
        }
        for (let w of this.wine_lastchange) {
            if (w > last_change)
                last_change = w;
        }
        for (let y of this.year_lastchange) {
            if (y > last_change)
                last_change = y;
        }
        for (let l of this.log_lastchange) {
            if (l > last_change)
                last_change = l;
        }
        this.lastchange = last_change;
    }
    getUuid() {
        if (this.uuid !== '')
            return;
        this.uuid = crypto.randomBytes(8).toString('base64');
    }
}
let g_data = new Data(kSaveFileName);
if (!g_data.readFromFile()) {
    console.log('Corrupted save file (' + kSaveFileName + ').');
    process.exit(1);
}
function GetAll(since) {
    return g_data.getAll(since);
}
function SetAll(data) {
    return g_data.setAll(data);
}
function ServeFile(path, mimetype, res) {
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
function ServeJson(res, data) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify(data));
    res.end();
}
const server = http.createServer((req, res) => {
    // TODO: should we use urlparts.pathname instead? That'd strip the query.
    let req_url = req.url;
    if (req.method === 'GET') {
        if (req_url === '/') {
            let raw_agent = req.headers['user-agent'];
            let user_agent = raw_agent ? raw_agent.toLowerCase() : '';
            if (user_agent.indexOf('android') !== -1 ||
                user_agent.indexOf('mobile') !== -1) {
                req_url = '/mobile2.html';
            }
            else {
                req_url = '/index2.html';
            }
        }
        else if (req_url === '/m') {
            req_url = '/mobile2.html';
        }
        let mimetype = null;
        if (req_url.endsWith('.html')) {
            mimetype = 'text/html; charset=utf-8';
        }
        else if (req_url.endsWith('.js')) {
            mimetype = 'text/javascript';
        }
        else if (req_url.endsWith('.css')) {
            mimetype = 'text/css';
        }
        else if (req_url.endsWith('.js.map')) {
            mimetype = 'application/json';
        }
        else if (req_url.endsWith('.ts')) {
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
    }
    else if (req.method === 'POST') {
        let data = [];
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
    }
    else {
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
process.on('SIGBREAK', () => {
    Shutdown();
});
function GetIpAddress() {
    let interfaces = os.networkInterfaces();
    let fallback = "localhost";
    for (let i_name in interfaces) {
        let iface = interfaces[i_name];
        if (!iface)
            continue;
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
    console.log(`Server running at http://${hostname}:${kPort}/, hit Ctrl+C to stop`);
});
//# sourceMappingURL=node-server.js.map