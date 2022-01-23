import csv
import datetime
import io
import os
import shutil
import sqlite3
import uuid

CREATE_VINEYARDS = """
CREATE TABLE IF NOT EXISTS vineyards (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  region TEXT DEFAULT "",
  country TEXT DEFAULT "",
  website TEXT DEFAULT "",
  address TEXT DEFAULT "",
  comment TEXT DEFAULT "",
  lastchange INTEGER
)"""

CREATE_WINES = """
CREATE TABLE IF NOT EXISTS wines (
  id INTEGER PRIMARY KEY,
  vineyard INTEGER REFERENCES vineyards,
  name TEXT,
  grape TEXT DEFAULT "",
  comment TEXT DEFAULT "",
  lastchange INTEGER
)"""

# stock: temporary count during stock-taking mode.
# age_update: unix timestamp of last update to 'age'.
CREATE_YEARS = """
CREATE TABLE IF NOT EXISTS years (
  id INTEGER PRIMARY KEY,
  wine INTEGER REFERENCES wines,
  year INTEGER,
  count INTEGER,
  stock INTEGER DEFAULT 0,
  price REAL DEFAULT 0,
  rating REAL DEFAULT 0,
  value REAL DEFAULT 0,
  sweetness REAL DEFAULT 0,
  age INTEGER DEFAULT 0,
  age_update INTEGER DEFAULT 0,
  comment TEXT DEFAULT "",
  location TEXT DEFAULT "",
  lastchange INTEGER
)"""

CREATE_LOG = """
CREATE TABLE IF NOT EXISTS log (
  id INTEGER PRIMARY KEY,
  date TEXT,
  wine INTEGER REFERENCES years,
  delta INTEGER,
  reason INTEGER,
  comment TEXT,
  lastchange INTEGER
)"""

CREATE_DATA = """
CREATE TABLE IF NOT EXISTS data (
  key TEXT PRIMARY KEY,
  value TEXT
)"""

KNOWN_GRAPES = [
  "Bacchus",
  "Chardonnay",
  "Dornfelder",
  "Gewürztraminer",
  "Gutedel",
  "Grauburgunder",
  "Kerner",
  "Lemberger",
  "Merlot",
  "Muskateller",
  "Müller-Thurgau",
  "Regent",
  "Riesling",
  "Scheurebe",
  "Schwarzriesling",
  "Silvaner",
  "Spätburgunder",
  "Syrah",
  "Trollinger",
  "Weißburgunder",
]

GRAPE_GUESSES = {
  "Cabernet Sauvignon": "Cabernet Sauvignon",
  "Grauer Burgunder": "Grauburgunder",
  "Klingelberg": "Riesling",
  "Klingelberger": "Riesling",
  "Sauvignon Blanc": "Sauvignon Blanc",
  "Weißer Burgunder": "Weißburgunder",
}

class Update:
  def __init__(self, manager):
    self.manager = manager

  def __enter__(self):
    self.manager._lastchange += 1
    self.manager._has_update_scope = True
    return self

  def __exit__(self, *args):
    self.manager._conn.commit()
    self.manager._has_update_scope = False

def MakeFakeData():
  data = {"vineyards": [], "wines": [], "years": [], "log": []}
  def V(name, country, region):
    local_id = len(data["vineyards"]) + 1
    data["vineyards"].append({
      "name": name,
      "country": country,
      "region": region,
      "address": "",
      "website": "",
      "comment": "",
      "server_id": 0,
      "local_id": local_id,
    })
    return local_id
  def W(vineyard, name, grape):
    local_id = len(data["wines"]) + 1
    data["wines"].append({
      "vineyard_id": vineyard,
      "name": name,
      "grape": grape,
      "comment": "",
      "server_id": 0,
      "local_id": local_id,
    })
    return local_id
  def Y(wine_id, year, count, price, rating, value, sweetness, comment):
    local_id = len(data["years"]) + 1
    data["years"].append({
      "wine_id": wine_id,
      "year": year,
      "count": count,
      "stock": 0,
      "price": price,
      "rating": rating,
      "value": value,
      "sweetness": sweetness,
      "age": 0,
      "age_update": 0,
      "comment": comment,
      "location": "",
      "server_id": 0,
      "local_id": local_id,
    })
    return local_id

  beurer = V("Beurer", "Deutschland", "Württemberg")
  maennle = V("Männle", "Deutschland", "Baden")
  beurer2 = V("Beurer2", "Deutschland", "Baden")

  gipskeuper = W(beurer, "Gipskeuper", "Riesling")
  gips2 = W(beurer2, "Gipskeuper", "")
  schilf = W(beurer, "Schilfsandstein", "")
  schilf2 = W(beurer2, "Schilfsandstein", "Riesling")
  lemberger = W(beurer, "Lemberger", "Lemberger")
  sauvig = W(beurer2, "Sauvignon Blanc", "")
  spaetb = W(maennle, "Spätburgunder", "Spätburgunder")
  scheu = W(maennle, "Scheurebe", "Scheurebe")

  Y(gipskeuper, 2012, 1, 8.90, 3, 3, 2, "")
  Y(gipskeuper, 2013, 2, 9.90, 3, 3, 2, "")
  Y(gips2, 2012, 1, 8.90, 3, 3, 2, "merge it")
  Y(gips2, 2017, 2, 2, 2, 2, 2, "222222")
  Y(schilf, 2012, 1, 10.90, 4, 3, 2, "der bessere Hauswein")
  Y(schilf2, 2012, 1, 10.90, 4, 3, 2, "keep because of conflicts")
  Y(schilf2, 2019, 1, 12, 2, 2, 3, "move it")
  Y(lemberger, 2012, 0, 8.90, 2, 3, 2, "")
  Y(lemberger, 2009, 0, 7.90, 2, 3, 2, "")
  Y(sauvig, 2018, 2, 20, 4, 3, 3, "move it")
  Y(spaetb, 2016, 2, 12.50, 4, 5, 3, "super Jahrgang")
  Y(spaetb, 2017, 2, 12.50, 3, 3, 3, "nicht mehr so herausragend")
  Y(scheu, 2017, 1, 12.50, 3, 3, 5, "")

  return data

class Manager:
  def __init__(self, filename):
    self._MonthlyDatabaseBackup(filename)
    conn = sqlite3.connect(filename)
    self._conn = conn
    conn.row_factory = sqlite3.Row
    self.ApplyDatabaseUpdates(filename)
    self.SetUUID()
    self._lastchange = self.GetLastChange()
    self._has_update_scope = False
    # TODO: create index?
    # TODO: vacuum?
    # TODO: temporary implementation:
    if filename == ":memory:":
      print("Populating in-memory database with fake data...")
      self.Set(MakeFakeData())

    print("self._lastchange is now: %d" % self._lastchange)
    print("and computed from database: %d" % self.GetLastChange())

  def Shutdown(self):
    print("Datenbank wird gespeichert")
    self._conn.commit()
    self._conn.close()
    print("Datenbank erfolgreich gespeichert")

  # Backup strategy: if no backup has been created yet in the current calendar
  # month, do that now.
  def _MonthlyDatabaseBackup(self, filename):
    if filename == ":memory:": return
    today = datetime.date.today().strftime("%Y-%m")
    backup_name = "%s-%s-backup" % (filename, today)
    if os.path.exists(backup_name): return
    shutil.copyfile(filename, backup_name)

  def _BackupDatabase(self, filename, version):
    if filename == ":memory:": return
    backup_name = "%s-database-version-%d-autobackup" % (filename, version)
    shutil.copyfile(filename, backup_name)

  def ApplyDatabaseUpdates(self, filename):
    version = self._conn.execute("PRAGMA user_version").fetchone()[0]
    if version < 1:
      c = self._conn.cursor()
      existing = c.execute("""
          SELECT count(*) FROM sqlite_master WHERE type='table'
          AND name='years' OR name='vineyards' OR name='wines' OR name='log'
          OR name='data'""").fetchone()[0]
      if existing != 5:
        print("Creating database tables...")
        # Creating tables at the latest version.
        c.execute("PRAGMA user_version = 6")
        c.execute(CREATE_VINEYARDS)
        c.execute(CREATE_WINES)
        c.execute(CREATE_YEARS)
        c.execute(CREATE_LOG)
        c.execute(CREATE_DATA)
        self._conn.commit()
        version = 6
      else:
        print("Updating database version 0->1...")
        self._BackupDatabase(filename, version)
        self._conn.execute("ALTER TABLE years ADD COLUMN value REAL DEFAULT 0")
        self._conn.execute("PRAGMA user_version = 1")
        self._conn.commit()
        version = 1
    if version < 2:
      print("Updating database version 1->2...")
      self._BackupDatabase(filename, version)
      self._conn.execute("ALTER TABLE years ADD COLUMN stock INTEGER DEFAULT 0")
      self._conn.execute("PRAGMA user_version = 2")
      self._conn.commit()
      version = 2
    if version < 3:
      print("Updating database version 2->3...")
      self._BackupDatabase(filename, version)
      add_lastchange = "ALTER TABLE %s ADD COLUMN lastchange INTEGER DEFAULT 1"
      self._conn.execute(add_lastchange % "vineyards")
      self._conn.execute(add_lastchange % "wines")
      self._conn.execute(add_lastchange % "years")
      self._conn.execute(add_lastchange % "log")
      self._conn.execute("PRAGMA user_version = 3")
      self._conn.commit()
      version = 3
    if version < 4:
      print("Updating database version 3->4...")
      self._BackupDatabase(filename, version)
      self._conn.execute(CREATE_DATA)
      self._conn.execute("PRAGMA user_version = 4")
      self._conn.commit()
      version = 4
    if version < 5:
      print("Updating database version 4->5...")
      self._BackupDatabase(filename, version)
      self._conn.execute(
          "ALTER TABLE years ADD COLUMN location TEXT DEFAULT \"\"")
      self._conn.execute("PRAGMA user_version = 5")
      self._conn.commit()
      version = 5
    if version < 6:
      print("Updating database version 5->6...")
      self._BackupDatabase(filename, version)
      self._conn.execute(
          "ALTER TABLE years ADD COLUMN age_update INTEGER DEFAULT 0")
      self._conn.execute("PRAGMA user_version = 6")
      self._conn.commit()
      version = 6
    # When adding new database versions, don't forget to update the table
    # creation code at the top of this function!

  def _GetLastChange(self, table):
    c = self._conn.execute("SELECT MAX(lastchange) FROM %s" % table)
    maybe = c.fetchone()[0]
    return maybe if maybe is not None else 0

  def GetLastChange(self):
    v = self._GetLastChange("vineyards")
    w = self._GetLastChange("wines")
    y = self._GetLastChange("years")
    l = self._GetLastChange("log")
    return max(v, w, y, l)

  def SetUUID(self):
    query = "SELECT value FROM data WHERE key='uuid'"
    maybe = self._conn.execute(query).fetchone()
    if maybe is None:
      print("Generating new UUID...")
      self.uuid = str(uuid.uuid4())
      self._conn.execute("INSERT INTO data(key, value) VALUES (?, ?)",
                         ("uuid", self.uuid))
      self._conn.commit()
    else:
      self.uuid = maybe[0]
    print("Server UUID: %s" % self.uuid)

  def Execute(self, stmt, args=None):
    if (stmt.startswith("UPDATE") or stmt.startswith('INSERT')):
      assert self._has_update_scope
      assert 'lastchange' in stmt
    if args is None:
      return self._conn.execute(stmt)
    return self._conn.execute(stmt, args)

  ################# v2 FUNCTIONALITY ######################

  def GetAll2(self, client_knows_commit):
    vineyards = []
    cursor = self.Execute("SELECT * FROM vineyards WHERE lastchange>?",
                          (client_knows_commit,))
    for row in cursor:
      vineyards.append({
          "server_id": row["id"],
          "name": row["name"],
          "region": row["region"],
          "country": row["country"],
          "website": row["website"],
          "address": row["address"],
          "comment": row["comment"]
      })
    wines = []
    cursor = self.Execute("SELECT * FROM wines WHERE lastchange>?",
                          (client_knows_commit,))
    for row in cursor:
      wines.append({
          "server_id": row["id"],
          "vineyard_id": row["vineyard"],
          "name": row["name"],
          "grape": row["grape"],
          "comment": row["comment"]
      })
    years = []
    cursor = self.Execute("SELECT * FROM years WHERE lastchange>?",
                          (client_knows_commit,))
    for row in cursor:
      years.append({
          "server_id": row["id"],
          "wine_id": row["wine"],
          "year": row["year"],
          "count": row["count"],
          "stock": row["stock"],
          "price": row["price"],
          "rating": row["rating"],
          "value": row["value"],
          "sweetness": row["sweetness"],
          "age": row["age"],
          "age_update": row["age_update"],
          "comment": row["comment"],
          "location": row["location"]
      })
    log = []
    cursor = self.Execute("SELECT * FROM log WHERE lastchange>?",
                          (client_knows_commit,))
    for row in cursor:
      log.append({
        "server_id": row["id"],
        "date": row["date"],
        "year_id": row["wine"],
        "delta": row["delta"],
        "reason": row["reason"],
        "comment": row["comment"]
      })
    return {
        "vineyards": vineyards,
        "wines": wines,
        "years": years,
        "log": log,
        "commit": self._lastchange,
        "uuid": self.uuid,
    }

  def Set(self, postdata):
    with Update(self):
      result = {}
      receipts = {}
      if "vineyards" in postdata:
        vineyard_receipts = []
        for vineyard in postdata["vineyards"]:
          server_id = self._SetVineyard(vineyard)
          vineyard_receipts.append({
              "server_id": server_id,
              "local_id": vineyard["local_id"]
          })
        receipts["vineyards"] = vineyard_receipts
      if "wines" in postdata:
        wine_receipts = []
        for wine in postdata["wines"]:
          server_id = self._SetWine(wine)
          wine_receipts.append({
              "server_id": server_id,
              "local_id": wine["local_id"]
          })
        receipts["wines"] = wine_receipts
      if "years" in postdata:
        year_receipts = []
        for year in postdata["years"]:
          server_id = self._SetYear(year)
          year_receipts.append({
              "server_id": server_id,
              "local_id": year["local_id"]
          })
        receipts["years"] = year_receipts
      if "log" in postdata:
        log_receipts = []
        for log in postdata["log"]:
          server_id = self._SetLog(log)
          log_receipts.append({
            "server_id": server_id,
            "local_id": log["local_id"]
          })
        receipts["log"] = log_receipts
      if len(receipts) > 0:
        result["receipts"] = receipts
      result["commit"] = self._lastchange
      return result

  def _SetVineyard(self, v):
    server_id = v["server_id"]
    # TODO: for robustness, verify that such an entry actually exists.
    if not server_id:
      c = self.Execute("SELECT * FROM vineyards WHERE name=?", (v["name"],))
      r = c.fetchone()
      if r is None:
        print("INSERT vineyard: %s" % v)
        c = self.Execute("""
            INSERT INTO vineyards(name, country, region, address, website,
                                  comment, lastchange)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (v["name"], v["country"], v["region"], v["address"], v["website"],
             v["comment"], self._lastchange))
        return c.lastrowid
      server_id = r["id"]
    print("UPDATE vineyard: %s" % v)
    self.Execute("""
        UPDATE vineyards
        SET name=?, country=?, region=?, address=?, website=?, comment=?,
            lastchange=?
        WHERE id=?""",
        (v["name"], v["country"], v["region"], v["address"], v["website"],
         v["comment"], self._lastchange, server_id))
    return server_id

  def _SetWine(self, w):
    server_id = w["server_id"]
    # TODO: for robustness, verify that such an entry actually exists.
    if not server_id:
      c = self.Execute("SELECT * FROM wines WHERE name=? AND vineyard=?",
      (w["name"], w["vineyard_id"]))
      r = c.fetchone()
      if r is None:
        print("INSERT wine: %s" % w)
        c = self.Execute("""
            INSERT INTO wines(vineyard, name, grape, comment, lastchange)
            VALUES (?, ?, ?, ?, ?)""",
            (w["vineyard_id"], w["name"], w["grape"], w["comment"],
             self._lastchange))
        return c.lastrowid
      server_id = r["id"]
    print("UPDATE wine: %s" % w)
    self.Execute(
        "UPDATE wines SET name=?, grape=?, comment=?, lastchange=? WHERE id=?",
        (w["name"], w["grape"], w["comment"], self._lastchange, server_id))
    return server_id

  def _SetYear(self, y):
    server_id = y["server_id"]
    # TODO: for robustness, verify that such an entry actually exists.
    if not server_id:
      c = self.Execute("SELECT * FROM years WHERE year=? AND wine=?",
                       (y["year"], y["wine_id"]))
      r = c.fetchone()
      if r is None:
        print("INSERT year: %s" % y)
        c = self.Execute("""
            INSERT INTO years(wine, year, count, stock, price, rating, value,
                              sweetness, age, age_update, comment, location,
                              lastchange)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (y["wine_id"], y["year"], y["count"], y["stock"], y["price"],
             y["rating"], y["value"], y["sweetness"], y["age"], y["age_update"],
             y["comment"], y["location"], self._lastchange))
        return c.lastrowid
      server_id = r["id"]
    print("UPDATE year: %s" % y)
    self.Execute("""
        UPDATE years
        SET count=?, stock=?, price=?, rating=?, value=?, sweetness=?, age=?,
            age_update=?, comment=?, location=?, lastchange=?
        WHERE id=?""",
        (y["count"], y["stock"], y["price"], y["rating"], y["value"],
         y["sweetness"], y["age"], y["age_update"], y["comment"], y["location"],
         self._lastchange, server_id))
    return server_id

  def _SetLog(self, l):
    server_id = l["server_id"]
    # TODO: for robustness, verify that such an entry actually exists.
    if not server_id:
      c = self.Execute("SELECT * FROM log WHERE date=? AND wine=?",
                       (l["date"], l["year_id"]))
      r = c.fetchone()
      if r is None:
        print("INSERT log: %s" % l)
        c = self.Execute("""
            INSERT INTO log(date, wine, delta, reason, comment, lastchange)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (l["date"], l["year_id"], l["delta"], l["reason"], l["comment"],
             self._lastchange))
        return c.lastrowid
      server_id = r["id"]
    print("UPDATE log: %s" % l)
    self.Execute(
        "UPDATE log SET delta=?, reason=?, comment=?, lastchange=? WHERE id=?",
        (l["delta"], l["reason"], l["comment"], self._lastchange, server_id))
    return server_id

  ################# LEGACY (v1) FUNCTIONALITY ######################

  def Log(self, wine, delta, reason):
    date = datetime.date.today().isoformat()
    c = self.Execute("SELECT * FROM log WHERE date=? AND wine=?", (date, wine))
    r = c.fetchone()
    if r is None:
      self.Execute("""
          INSERT INTO log(date, wine, delta, reason, comment, lastchange)
          VALUES(?, ?, ?, ?, ?, ?)""",
          (date, wine, delta, reason, "", self._lastchange))
    else:
      self.Execute(
          "UPDATE log SET delta=delta+?, lastchange=? WHERE date=? AND wine=?",
          (delta, self._lastchange, date, wine))

  def GetLog(self, count):
    c = self.Execute("""
      SELECT log.id AS log_id,
             vineyards.name AS vineyard,
             wines.name AS wine,
             years.year AS year,
             log.date AS date,
             log.delta AS delta,
             log.reason AS reason
      FROM log
      INNER JOIN years on log.wine = years.id
      INNER JOIN wines on years.wine = wines.id
      INNER JOIN vineyards on wines.vineyard = vineyards.id
      ORDER BY log.id DESC LIMIT ?""", (count,))
    result = []
    for row in c:
      result.append({
          "log_id": row["log_id"], "date": row["date"],
          "wine": "%s %s %d" % (row["vineyard"], row["wine"], row["year"]),
          "delta": row["delta"], "reason": row["reason"]})
    return result

  def UpdateLog(self, log_id, reason):
    with Update(self):
      self.Execute("UPDATE log SET reason=?, lastchange=? WHERE id=?",
                   (reason, self._lastchange, log_id))
    return {"log_id": log_id, "reason": reason}

  def _GetVineyard(self, vineyard):
    c = self.Execute("SELECT * FROM vineyards WHERE name=?", (vineyard,))
    return c.fetchone()

  def _GetOrCreateVineyard(self, vineyard):
    r = self._GetVineyard(vineyard)
    if r is None:
      self.Execute("INSERT INTO vineyards(name, lastchange) VALUES (?, ?)",
                   (vineyard, self._lastchange))
      r = self._GetVineyard(vineyard)
    return r

  def _GetWine(self, vineyard_id, wine):
    c = self.Execute("SELECT * FROM wines WHERE vineyard=? AND name=?",
                     (vineyard_id, wine))
    return c.fetchone()

  def _GuessGrapeForWine(self, wine):
    wine_lower = wine.lower()
    for guess in GRAPE_GUESSES:
      if guess.lower() in wine_lower:
        return GRAPE_GUESSES[guess]
    for grape in KNOWN_GRAPES:
      if grape.lower() in wine_lower:
        return grape
    return ""

  def _CreateWine(self, vineyard_id, wine):
    grape = self._GuessGrapeForWine(wine)
    self.Execute("""INSERT INTO wines(vineyard, name, grape, lastchange)
                    VALUES (?, ?, ?, ?)""",
                 (vineyard_id, wine, grape, self._lastchange))
    return self._GetWine(vineyard_id, wine)

  def _GetOrCreateWine(self, vineyard_id, wine):
    r = self._GetWine(vineyard_id, wine)
    if r is None:
      r = self._CreateWine(vineyard_id, wine)
    return r

  def _AddYear(self, wine_id, year, count, rating, price, comment, reason):
    c = self.Execute("SELECT * FROM years WHERE wine=? AND year=?",
                     (wine_id, year))
    r = c.fetchone()
    if r is None:
      self.Execute("""
          INSERT INTO years(wine, year, count, rating, price, comment,
                            lastchange)
          VALUES(?, ?, ?, ?, ?, ?, ?)""",
          (wine_id, year, count, rating, price, comment, self._lastchange))
      c = self.Execute("SELECT id FROM years ORDER BY id DESC LIMIT 1")
      r = c.fetchone()
      year_id = r["id"]
      self.Log(year_id, count, reason)
    elif r["count"] == -1:
      # Reviving deleted year.
      year_id = r["id"]
      self.Execute("""
          UPDATE years
          SET count=?, rating=?, price=?, comment=?, lastchange=?
          WHERE id=?""",
          (count, rating, price, comment, self._lastchange, year_id))
      self.Log(year_id, count, reason)
    else:
      print("Tried to add existing year, ignoring")

  def AddYear(self, wine_id, year, count, rating, price, comment, reason):
    with Update(self):
      self._AddYear(wine_id, year, count, rating, price, comment, reason)

  def AddWine(self, vineyard_id, wine, year, count, rating, price, comment,
              reason):
    with Update(self):
      r = self._GetOrCreateWine(vineyard_id, wine)
      wine_id = r["id"]
      self._AddYear(wine_id, year, count, rating, price, comment, reason)

  def AddAll(self, vineyard, wine, year, count, rating, price, comment, reason):
    with Update(self):
      r = self._GetOrCreateVineyard(vineyard)
      vineyard_id = r["id"]
      r = self._GetOrCreateWine(vineyard_id, wine)
      wine_id = r["id"]
      self._AddYear(wine_id, year, count, rating, price, comment, reason)

  def _GetCurrentCount(self, year_id):
    c = self.Execute("SELECT count FROM years WHERE id=?", (year_id,))
    return c.fetchone()["count"]

  def _GetCurrentStock(self, year_id):
    c = self.Execute("SELECT stock FROM years WHERE id=?", (year_id,))
    return c.fetchone()["stock"]

  def AddOneBottle(self, year_id, reason):
    with Update(self):
      self.Execute("UPDATE years SET count=count+1, lastchange=? WHERE id=?",
                   (self._lastchange, year_id))
      self.Log(year_id, 1, reason)
    return self._GetCurrentCount(year_id)

  def RemoveOneBottle(self, year_id, reason):
    with Update(self):
      self.Execute("UPDATE years SET count=count-1, lastchange=? WHERE id=?",
                   (self._lastchange, year_id))
      self.Log(year_id, -1, reason)
    return self._GetCurrentCount(year_id)

  def AddStock(self, year_id):
    with Update(self):
      self.Execute("UPDATE years SET stock=stock+1, lastchange=? WHERE id=?",
                   (self._lastchange, year_id))
    return self._GetCurrentStock(year_id)

  def RemoveStock(self, year_id):
    with Update(self):
      self.Execute("UPDATE years SET stock=stock-1, lastchange=? WHERE id=?",
                   (self._lastchange, year_id))
    return self._GetCurrentStock(year_id)

  def _ApplyStockYear(self, year_id):
    self.Execute("UPDATE years SET count=stock, lastchange=? WHERE id=?",
                 (self._lastchange, year_id))

  def _ApplyStockWine(self, wine_id, result):
    yc = self.Execute(
        "SELECT id, stock FROM years WHERE wine=? AND count >= 0", (wine_id,))
    for year_row in yc:
      year_id = year_row["id"]
      self._ApplyStockYear(year_id)
      result[year_id] = {"count": year_row["stock"]}

  def _ApplyStockVineyard(self, vineyard_id, result):
    wc = self.Execute("SELECT id FROM wines WHERE vineyard=?", (vineyard_id,))
    for wine_row in wc:
      wine_id = wine_row["id"]
      self._ApplyStockWine(wine_id, result)

  def ApplyStock(self, year_id):
    with Update(self):
      self._ApplyStockYear(year_id)
    return self._GetCurrentCount(year_id)

  def ApplyStockWine(self, wine_id):
    result = {}
    with Update(self):
      self._ApplyStockWine(wine_id, result)
    return result

  def ApplyStockVineyard(self, vineyard_id):
    result = {}
    with Update(self):
      self._ApplyStockVineyard(vineyard_id, result)
    return result

  def ApplyStockAll(self):
    with Update(self):
      self.Execute(
          "UPDATE years SET count=stock, lastchange=? WHERE count >= 0",
          (self._lastchange,))
    result = {}
    c = self.Execute("SELECT id, count FROM years")
    for row in c:
      result[row["id"]] = {"count": row["count"]}
    return result

  def ResetStockAll(self):
    with Update(self):
      self.Execute("UPDATE years SET stock=0, lastchange=? WHERE count >= 0",
                   (self._lastchange,))

  def DeleteYear(self, year_id):
    with Update(self):
      self.Execute("UPDATE years SET count=-1, lastchange=? WHERE id=?",
                   (self._lastchange, year_id))

  def Update(self, year_id, price, comment):
    with Update(self):
      self.Execute(
          "UPDATE years SET price=?, comment=?, lastchange=? WHERE id=?",
          (price, comment, self._lastchange, year_id))

  def UpdateRating(self, year_id, what, val):
    with Update(self):
      self.Execute(
          "UPDATE years SET %s=?, lastchange=? WHERE id=?" % what,
          (val, self._lastchange, year_id))

  def GetAll(self, only_existing):
    result = {}
    vc = self.Execute("SELECT * FROM vineyards")
    for vineyard_row in vc:
      wines = {}
      vineyard_data = {"wines": wines, "id": vineyard_row["id"],
                       "region": vineyard_row["region"]}
      wc = self.Execute("SELECT * FROM wines WHERE vineyard=?",
                        (vineyard_row["id"],))
      have_one_wine = False
      for wine_row in wc:
        years = {}
        wine_data = {"years": years, "id": wine_row["id"],
                     "grape": wine_row["grape"]}
        query = "SELECT * FROM years WHERE wine=?"
        if int(only_existing):
          query += " AND count > 0"
        else:
          query += " AND count >= 0"
        yc = self.Execute(query, (wine_row["id"],))
        have_one_year = False
        for year_row in yc:
          have_one_year = True
          years[year_row["year"]] = {
            "year_id": year_row["id"],
            "count": year_row["count"],
            "stock": year_row["stock"],
            "price": year_row["price"],
            "rating": year_row["rating"],
            "value": year_row["value"],
            "sweetness": year_row["sweetness"],
            "age": year_row["age"],
            "comment": year_row["comment"]
          }
        if have_one_year:
          wines[wine_row["name"]] = wine_data
          have_one_wine = True
      if have_one_wine:
        result[vineyard_row["name"]] = vineyard_data
    return result

  def GetSortKey(self, sortby):
    w = sortby.split("_")
    sortby = w[0]
    if sortby not in ("count", "price", "rating", "year", "value", "sweetness",
                      "age"):
      sortby = "price"
    direction = w[1]
    if direction not in ("asc", "desc"): direction = "asc"
    return "%s %s" % (sortby, direction)

  def GetSorted(self, only_existing, sortby):
    result = []
    sortby = self.GetSortKey(sortby)
    filter = "count > 0" if only_existing else "count >= 0"
    c = self.Execute("""
      SELECT years.id as year_id, years.year as year, years.count as count,
             years.stock as stock,
             years.price as price, years.rating as rating, years.value as value,
             years.sweetness as sweetness, years.age as age,
             years.comment as comment, wines.id as wine_id,
             wines.name as wine_name, wines.grape as grape,
             vineyards.id as vineyard_id, vineyards.name as vineyard_name,
             vineyards.region as region
      FROM years
      INNER JOIN wines ON years.wine = wines.id
      INNER JOIN vineyards ON wines.vineyard = vineyards.id
      WHERE %s
      ORDER BY %s""" % (filter, sortby))
    for r in c:
      result.append({
        "year_id": r["year_id"],
        "year": r["year"],
        "count": r["count"],
        "stock": r["stock"],
        "price": r["price"],
        "rating": r["rating"],
        "value": r["value"],
        "sweetness": r["sweetness"],
        "age": r["age"],
        "comment": r["comment"],
        "wine_id": r["wine_id"],
        "wine_name": r["wine_name"],
        "grape": r["grape"],
        "vineyard_id": r["vineyard_id"],
        "vineyard_name": r["vineyard_name"],
        "region": r["region"]})
    return result

  def GetVineyards(self):
    result = []
    c = self.Execute("SELECT name FROM vineyards")
    for r in c:
      result.append(r["name"])
    return result

  def GetWinesForVineyard(self, vineyard_name):
    result = []
    c = self.Execute("""
      SELECT wines.name as name
      FROM wines
      INNER JOIN vineyards ON vineyards.id = wines.vineyard
      WHERE vineyards.name = ?""", (vineyard_name,))
    for r in c:
      result.append(r["name"])
    return result

  def GetVineyardData(self, vineyard_id):
    c = self.Execute("""
        SELECT SUM(years.count) AS count,
               SUM(years.count * years.price) AS price
        FROM years
        JOIN wines ON years.wine = wines.id
        JOIN vineyards ON wines.vineyard = vineyards.id
        WHERE vineyards.id=? AND years.count > 0""", (vineyard_id,))
    r = c.fetchone()
    total_count = r["count"]
    total_price = r["price"]
    c = self.Execute("SELECT * FROM vineyards WHERE id=?", (vineyard_id,))
    r = c.fetchone()
    return {"id": r["id"],
            "vineyard": r["name"],
            "country": r["country"],
            "region": r["region"],
            "address": r["address"],
            "website": r["website"],
            "comment": r["comment"],
            "total_count": total_count,
            "total_price": total_price}

  def SetVineyardData(self, vineyard_id, name, country, region, address,
                      website, comment):
    with Update(self):
      self.Execute("""
          UPDATE vineyards
          SET name=?, country=?, region=?, address=?, website=?, comment=?,
              lastchange=?
          WHERE id=?""",
          (name, country, region, address, website, comment, self._lastchange,
          vineyard_id))
    c = self.Execute("SELECT id, name, region FROM vineyards WHERE id=?",
                     (vineyard_id,))
    r = c.fetchone()
    return {"id": r["id"], "name": r["name"], "region": r["region"]}

  def GetWineData(self, wine_id):
    c = self.Execute("""
        SELECT wines.name AS name,
               wines.id AS id,
               vineyards.name AS vineyard,
               wines.grape AS grape,
               wines.comment AS comment
        FROM wines
        INNER JOIN vineyards ON vineyards.id = wines.vineyard
        WHERE wines.id=?""", (wine_id,))
    r = c.fetchone()
    return {"id": r["id"], "wine": r["name"], "vineyard": r["vineyard"],
            "grape": r["grape"], "comment": r["comment"]}

  def GetCountries(self):
    c = self.Execute("SELECT DISTINCT country FROM vineyards ORDER BY country")
    result = []
    for r in c:
      candidate = r["country"]
      if candidate: result.append(candidate)
    return result

  def GetRegionsForCountry(self, country):
    c = self.Execute(
        "SELECT DISTINCT region FROM vineyards WHERE country=? ORDER BY region",
        (country,))
    result = []
    for r in c:
      candidate = r["region"]
      if candidate: result.append(candidate)
    return result

  def GetGrapes(self):
    c = self.Execute("SELECT DISTINCT grape FROM wines ORDER BY grape")
    result = []
    for r in c:
      candidate = r["grape"]
      if candidate: result.append(candidate)
    return result

  def UpdateWine(self, wine_id, name, grape, comment):
    with Update(self):
      self.Execute("""
          UPDATE wines
          SET name=?, grape=?, comment=?, lastchange=?
          WHERE id=?""",
          (name, grape, comment, self._lastchange, wine_id))
    c = self.Execute("SELECT id, name, grape FROM wines WHERE id=?", (wine_id,))
    r = c.fetchone()
    return {"id": r["id"], "name": r["name"], "grape": r["grape"]}

  def GetTotals(self):
    c = self.Execute("""
        SELECT SUM(count) AS count, SUM(count * price) AS price
        FROM years
        WHERE count > 0""")
    r = c.fetchone()
    return {"count": r["count"], "price": r["price"]}

  #################  CSV Export. ###############################
  # (Remember to keep this when deleting v1!)

  def _FormatRating(self, rating):
    rating = int(rating)
    return "\u2605" * rating + "\u2606" * (5 - rating)

  def _FormatAge(self, age):
    return ["unbekannt", "zu jung", "wird noch besser", "genau richtig",
            "bald trinken", "zu alt"][age]

  def _FormatDate(self, timestamp):
    if timestamp == 0: return ""
    d = datetime.date.fromtimestamp(timestamp)
    return d.isoformat()

  def ExportCSV(self):
    c = self.Execute("""
      SELECT years.year as year, years.count as count,
             years.price as price, years.rating as rating, years.value as value,
             years.sweetness as sweetness, years.age as age,
             years.age_update as age_update,
             years.comment as comment, years.location as location,
             wines.name as wine_name, wines.grape as grape,
             vineyards.name as vineyard_name
      FROM years
      INNER JOIN wines ON years.wine = wines.id
      INNER JOIN vineyards ON wines.vineyard = vineyards.id
      ORDER BY vineyard_name ASC, wine_name ASC, year ASC""")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Weingut", "Wein", "Jahr", "Anzahl", "Preis", "Kommentar",
                     "Bewertung", "Preis/Leist", "Süße", "Alter", "(update)",
                     "Lagerort", "Traube"])
    for r in c:
      row = [r["vineyard_name"], r["wine_name"], r["year"], r["count"],
             r["price"], r["comment"], self._FormatRating(r["rating"]),
             self._FormatRating(r["value"]), self._FormatRating(r["sweetness"]),
             self._FormatAge(r["age"]), self._FormatDate(r["age_update"]),
             r["location"], r["grape"]]
      writer.writerow(row)
    return output.getvalue()

if __name__ == '__main__':
  m = Manager(":memory:")
  b = m.ExportCSV()
  print(b)
  m.Shutdown()
