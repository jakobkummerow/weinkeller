import csv
import datetime
import io
import sqlite3

CREATE_VINEYARDS = """
CREATE TABLE IF NOT EXISTS vineyards (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  region TEXT DEFAULT "",
  country TEXT DEFAULT "",
  website TEXT DEFAULT "",
  address TEXT DEFAULT "",
  comment TEXT DEFAULT ""
)"""

CREATE_WINES = """
CREATE TABLE IF NOT EXISTS wines (
  id INTEGER PRIMARY KEY,
  vineyard INTEGER REFERENCES vineyards,
  name TEXT,
  grape TEXT DEFAULT "",
  comment TEXT DEFAULT ""
)"""

# stock: temporary count during stock-taking mode.
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
  comment TEXT
)"""

CREATE_LOG = """
CREATE TABLE IF NOT EXISTS log (
  id INTEGER PRIMARY KEY,
  date TEXT,
  wine INTEGER REFERENCES years,
  delta INTEGER,
  reason INTEGER,
  comment TEXT
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

class Manager:
  def __init__(self, filename):
    conn = sqlite3.connect(filename)
    self._conn = conn
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    # Set current user_version if fresh tables will be created.
    existing = c.execute("""
        SELECT count(*) FROM sqlite_master WHERE type='table'
        AND name='years' OR name='vineyards' OR name='wines' OR name='log'
        """).fetchone()[0]
    if existing != 4:
      c.execute("PRAGMA user_version = 2")
    # Make sure tables exist.
    c.execute(CREATE_VINEYARDS)
    c.execute(CREATE_WINES)
    c.execute(CREATE_YEARS)
    c.execute(CREATE_LOG)
    conn.commit()
    self.ApplyDatabaseUpdates()
    # TODO: create index?
    # TODO: vacuum?
    # TODO: temporary implementation:
    if filename == ":memory:":
      # AddAll(self, vineyard, wine, year, count, rating, price, comment, reason)
      self.AddAll("Beurer", "Gipskeuper", 2012, 1, 3, 8.90, "", 2)
      self.AddAll("Beurer", "Gipskeuper", 2013, 1, 3, 9.90, "", 2)
      self.AddAll("Beurer", "Schilfsandstein", 2012, 1, 4, 10.90, "", 2)
      self.AddAll("Beurer", "Lemberger", 2012, 0, 3, 8.90, "ausgetrunken", 2)
      self.AddAll("Zipf", "Inka", 2012, 1, 3, 14.90, "", 2)
      self.AddAll("Zipf", "Riesling **", 2013, 2, 2, 7.50, "", 2)
      self._GetOrCreateVineyard("Christmann")

  def Shutdown(self):
    print("Datenbank wird gespeichert")
    self._conn.commit()
    self._conn.close()
    print("Datenbank erfolgreich gespeichert")

  def ApplyDatabaseUpdates(self):
    version = self._conn.execute("PRAGMA user_version").fetchone()[0]
    if version < 1:
      print("Updating database version 0->1...")
      self._conn.execute("ALTER TABLE years ADD COLUMN value REAL DEFAULT 0")
      self._conn.execute("PRAGMA user_version = 1")
      self._conn.commit()
      version = 1
    if version < 2:
      print("Updating database version 1->2...")
      self._conn.execute("ALTER TABLE years ADD COLUMN stock INTEGER DEFAULT 0")
      self._conn.execute("PRAGMA user_version = 2")
      self._conn.commit()
      version = 2

  def Log(self, wine, delta, reason):
    date = datetime.date.today().isoformat()
    c = self._conn.execute("SELECT * FROM log WHERE date=? AND wine=?",
                           (date, wine))
    r = c.fetchone();
    if r is None:
      self._conn.execute("""
          INSERT INTO log(date, wine, delta, reason, comment)
          VALUES(?, ?, ?, ?, ?)""", (date, wine, delta, reason, ""))
    else:
      self._conn.execute("UPDATE log SET delta=delta+? WHERE date=? AND wine=?",
                         (delta, date, wine))

  def GetLog(self, count):
    c = self._conn.execute("""
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
    self._conn.execute("UPDATE log SET reason=? WHERE id=?", (reason, log_id))
    return {"log_id": log_id, "reason": reason}

  def _GetVineyard(self, vineyard):
    c = self._conn.execute("SELECT * FROM vineyards WHERE name=?", (vineyard,))
    return c.fetchone()

  def _GetOrCreateVineyard(self, vineyard):
    r = self._GetVineyard(vineyard)
    if r is None:
      self._conn.execute("INSERT INTO vineyards(name) VALUES (?)", (vineyard,))
      r = self._GetVineyard(vineyard)
    return r

  def _GetWine(self, vineyard_id, wine):
    c = self._conn.execute("SELECT * FROM wines WHERE vineyard=? AND name=?",
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
    self._conn.execute(
        "INSERT INTO wines(vineyard, name, grape) VALUES (?, ?, ?)",
        (vineyard_id, wine, grape))
    return self._GetWine(vineyard_id, wine)

  def _GetOrCreateWine(self, vineyard_id, wine):
    r = self._GetWine(vineyard_id, wine)
    if r is None:
      r = self._CreateWine(vineyard_id, wine)
    return r

  def AddYear(self, wine_id, year, count, rating, price, comment, reason):
    self._conn.execute("""
        INSERT INTO years(wine, year, count, rating, price, comment)
        VALUES(?, ?, ?, ?, ?, ?)""",
        (wine_id, year, count, rating, price, comment))
    c = self._conn.execute("SELECT id FROM years ORDER BY id DESC LIMIT 1")
    r = c.fetchone()
    year_id = r["id"]
    self.Log(year_id, count, reason)

  def AddWine(self, vineyard_id, wine, year, count, rating, price, comment,
              reason):
    grape = self._GuessGrapeForWine(wine)
    r = self._GetOrCreateWine(vineyard_id, wine)
    wine_id = r["id"]
    self.AddYear(wine_id, year, count, rating, price, comment, reason)

  def AddAll(self, vineyard, wine, year, count, rating, price, comment, reason):
    r = self._GetOrCreateVineyard(vineyard)
    vineyard_id = r["id"]
    r = self._GetOrCreateWine(vineyard_id, wine)
    wine_id = r["id"]
    c = self._conn.execute("SELECT * FROM years WHERE wine=? AND year=?",
                           (wine_id, year))
    r = c.fetchone()
    if r is None:
      self.AddYear(wine_id, year, count, rating, price, comment, reason)
    else:
      # TODO: When does this happen? Handle this differently? Update other fields at least?
      # self._conn.execute("UPDATE years SET count=count+1 WHERE wine=? and year=?", (wine_id, year))
      pass
    self._conn.commit()

  def _GetCurrentCount(self, year_id):
    c = self._conn.execute("SELECT count FROM years WHERE id=?", (year_id,))
    return c.fetchone()["count"]

  def _GetCurrentStock(self, year_id):
    c = self._conn.execute("SELECT stock FROM years WHERE id=?", (year_id,))
    return c.fetchone()["stock"]

  def AddOneBottle(self, year_id, reason):
    self._conn.execute("UPDATE years SET count=count+1 WHERE id=?", (year_id,))
    self.Log(year_id, 1, reason)
    self._conn.commit()
    return self._GetCurrentCount(year_id)

  def RemoveOneBottle(self, year_id, reason):
    self._conn.execute("UPDATE years SET count=count-1 WHERE id=?", (year_id,))
    self.Log(year_id, -1, reason)
    self._conn.commit()
    return self._GetCurrentCount(year_id)

  def AddStock(self, year_id):
    self._conn.execute("UPDATE years SET stock=stock+1 WHERE id=?", (year_id,))
    self._conn.commit()
    return self._GetCurrentStock(year_id)

  def RemoveStock(self, year_id):
    self._conn.execute("UPDATE years SET stock=stock-1 WHERE id=?", (year_id,))
    self._conn.commit()
    return self._GetCurrentStock(year_id)

  def _ApplyStockYear(self, year_id):
    self._conn.execute("UPDATE years SET count=stock WHERE id=?",
                       (year_id,))

  def _ApplyStockWine(self, wine_id, result):
    yc = self._conn.execute("SELECT id, stock FROM years WHERE wine=?",
                            (wine_id,))
    for year_row in yc:
      year_id = year_row["id"]
      self._ApplyStockYear(year_id)
      result[year_id] = {"count": year_row["stock"]}

  def _ApplyStockVineyard(self, vineyard_id, result):
    wc = self._conn.execute("SELECT id FROM wines WHERE vineyard=?",
                            (vineyard_id,))
    for wine_row in wc:
      wine_id = wine_row["id"]
      self._ApplyStockWine(wine_id, result)

  def ApplyStock(self, year_id):
    self._ApplyStockYear(year_id)
    self._conn.commit()
    return self._GetCurrentCount(year_id)

  def ApplyStockWine(self, wine_id):
    result = {}
    self._ApplyStockWine(wine_id, result)
    self._conn.commit()
    return result

  def ApplyStockVineyard(self, vineyard_id):
    result = {}
    self._ApplyStockVineyard(vineyard_id, result)
    self._conn.commit()
    return result

  def ApplyStockAll(self):
    self._conn.execute("UPDATE years SET count=stock")
    self._conn.commit()
    result = {}
    c = self._conn.execute("SELECT id, count FROM years")
    for row in c:
      result[row["id"]] = {"count": row["count"]}
    return result

  def ResetStockAll(self):
    self._conn.execute("UPDATE years SET stock=0")
    self._conn.commit()

  def DeleteYear(self, year_id):
    self._conn.execute("DELETE FROM years WHERE id=?", (year_id,))
    self._conn.commit()

  def Update(self, year_id, price, comment):
    self._conn.execute("UPDATE years SET price=?, comment=? WHERE id=?",
                       (price, comment, year_id))
    self._conn.commit()

  def UpdateRating(self, year_id, what, val):
    self._conn.execute("UPDATE years SET %s=? WHERE id=?" % what,
                       (val, year_id))
    self._conn.commit()

  def GetAll(self, only_existing):
    result = {}
    vc = self._conn.execute("SELECT * FROM vineyards")
    for vineyard_row in vc:
      wines = {}
      vineyard_data = {"wines": wines, "id": vineyard_row["id"],
                       "region": vineyard_row["region"]}
      wc = self._conn.execute("SELECT * FROM wines WHERE vineyard=?",
                              (vineyard_row["id"],))
      have_one_wine = False
      for wine_row in wc:
        years = {}
        wine_data = {"years": years, "id": wine_row["id"],
                     "grape": wine_row["grape"]}
        query = "SELECT * FROM years WHERE wine=?"
        if int(only_existing):
          query += " AND count > 0"
        yc = self._conn.execute(query, (wine_row["id"],))
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
                      "age"): sortby = "price"
    direction = w[1]
    if direction not in ("asc", "desc"): direction = "asc"
    return "%s %s" % (sortby, direction)

  def GetSorted(self, only_existing, sortby):
    result = []
    sortby = self.GetSortKey(sortby)
    c = self._conn.execute("""
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
      ORDER BY %s""" % sortby)
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
    c = self._conn.execute("SELECT name FROM vineyards")
    for r in c:
      result.append(r["name"])
    return result

  def GetWinesForVineyard(self, vineyard_name):
    result = []
    c = self._conn.execute("""
      SELECT wines.name as name
      FROM wines
      INNER JOIN vineyards ON vineyards.id = wines.vineyard
      WHERE vineyards.name = ?""", (vineyard_name,))
    for r in c:
      result.append(r["name"])
    return result

  def GetVineyardData(self, vineyard_id):
    c = self._conn.execute("""
        SELECT SUM(years.count) AS count,
               SUM(years.count * years.price) AS price
        FROM years
        JOIN wines ON years.wine = wines.id
        JOIN vineyards ON wines.vineyard = vineyards.id
        WHERE vineyards.id=?""", (vineyard_id,))
    r = c.fetchone()
    total_count = r["count"]
    total_price = r["price"]
    c = self._conn.execute("SELECT * FROM vineyards WHERE id=?", (vineyard_id,))
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
    self._conn.execute("""
        UPDATE vineyards
        SET name=?, country=?, region=?, address=?, website=?, comment=?
        WHERE id=?""",
        (name, country, region, address, website, comment, vineyard_id))
    self._conn.commit()
    c = self._conn.execute("SELECT id, name, region FROM vineyards WHERE id=?",
                           (vineyard_id,))
    r = c.fetchone()
    return {"id": r["id"], "name": r["name"], "region": r["region"]}

  def GetWineData(self, wine_id):
    c = self._conn.execute("""
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
    c = self._conn.execute(
        "SELECT DISTINCT country FROM vineyards ORDER BY country")
    result = []
    for r in c:
      candidate = r["country"]
      if candidate: result.append(candidate)
    return result

  def GetRegionsForCountry(self, country):
    c = self._conn.execute(
        "SELECT DISTINCT region FROM vineyards WHERE country=? ORDER BY region",
        (country,))
    result = []
    for r in c:
      candidate = r["region"]
      if candidate: result.append(candidate)
    return result

  def GetGrapes(self):
    c = self._conn.execute("SELECT DISTINCT grape FROM wines ORDER BY grape")
    result = []
    for r in c:
      candidate = r["grape"]
      if candidate: result.append(candidate)
    return result

  def UpdateWine(self, wine_id, name, grape, comment):
    self._conn.execute("UPDATE wines SET name=?, grape=?, comment=? WHERE id=?",
                       (name, grape, comment, wine_id))
    self._conn.commit()
    c = self._conn.execute("SELECT id, name, grape FROM wines WHERE id=?",
                           (wine_id,))
    r = c.fetchone()
    return {"id": r["id"], "name": r["name"], "grape": r["grape"]}

  def GetTotals(self):
    c = self._conn.execute("""
        SELECT SUM(count) AS count, SUM(count * price) AS price FROM years""")
    r = c.fetchone()
    return {"count": r["count"], "price": r["price"]}

  def _FormatRating(self, rating):
    rating = int(rating)
    return "\u2605" * rating + "\u2606" * (5 - rating)

  def _FormatAge(self, age):
    return ["unbekannt", "zu jung", "wird noch besser", "genau richtig",
            "muss weg", "zu alt"][age]

  def ExportCSV(self):
    c = self._conn.execute("""
      SELECT years.year as year, years.count as count,
             years.price as price, years.rating as rating, years.value as value,
             years.sweetness as sweetness, years.age as age,
             years.comment as comment, wines.name as wine_name,
             vineyards.name as vineyard_name
      FROM years
      INNER JOIN wines ON years.wine = wines.id
      INNER JOIN vineyards ON wines.vineyard = vineyards.id
      ORDER BY vineyard_name ASC, wine_name ASC, year ASC""")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Weingut", "Wein", "Jahr", "Anzahl", "Preis", "Kommentar",
                     "Bewertung", "Preis/Leist", "Süße", "Alter"])
    for r in c:
      row = [r["vineyard_name"], r["wine_name"], r["year"], r["count"],
             r["price"], r["comment"], self._FormatRating(r["rating"]),
             self._FormatRating(r["value"]), self._FormatRating(r["sweetness"]),
             self._FormatAge(r["age"])]
      writer.writerow(row)
    return output.getvalue()

if __name__ == '__main__':
  m = Manager(":memory:")
  b = m.ExportCSV()
  print(b)
  m.Shutdown()
