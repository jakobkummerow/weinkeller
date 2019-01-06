import datetime
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

CREATE_YEARS = """
CREATE TABLE IF NOT EXISTS years (
  id INTEGER PRIMARY KEY,
  wine INTEGER REFERENCES wines,
  year INTEGER,
  count INTEGER,
  price INTEGER,
  rating REAL DEFAULT 0,
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
  "Grauer Burgunder": "Grauburgunder",
  "Klingelberg": "Riesling",
  "Klingelberger": "Riesling",
  "Sauvignon Blanc": "Sauvignon Blanc",
}

class Manager:
  def __init__(self, filename):
    conn = sqlite3.connect(filename)
    self._conn = conn
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(CREATE_VINEYARDS)
    c.execute(CREATE_WINES)
    c.execute(CREATE_YEARS)
    c.execute(CREATE_LOG)
    conn.commit()
    # TODO: create index?
    # TODO: temporary implementation:
    if filename == ":memory:":
      self.AddWine("Beurer", "Gipskeuper", 2012, 1, 8.90, "", 2)
      self.AddWine("Beurer", "Gipskeuper", 2013, 1, 9.90, "", 2)
      self.AddWine("Beurer", "Schilfsandstein", 2012, 1, 10.90, "", 2)
      self.AddWine("Zipf", "Inka", 2012, 1, 14.90, "", 2)
      self.AddWine("Zipf", "Riesling **", 2013, 2, 7.50, "", 2)

  def Shutdown(self):
    print("Committing and closing DB connection")
    self._conn.commit()
    self._conn.close()

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
      ORDER BY log.id DESC LIMIT ?""", str(count))
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
    words = wine.split(" ")
    if wine in GRAPE_GUESSES:
      return GRAPE_GUESSES[wine]
    for word in words:
      if word in KNOWN_GRAPES:
        return word
    return ""

  def _GetOrCreateWine(self, vineyard_id, wine):
    r = self._GetWine(vineyard_id, wine)
    if r is None:
      grape = self._GuessGrapeForWine(wine)
      self._conn.execute(
          "INSERT INTO wines(vineyard, name, grape) VALUES (?, ?, ?)",
          (vineyard_id, wine, grape))
      r = self._GetWine(vineyard_id, wine)
    return r

  def AddWine(self, vineyard, wine, year, count, price, comment, reason):
    r = self._GetOrCreateVineyard(vineyard)
    vineyard_id = r["id"]
    r = self._GetOrCreateWine(vineyard_id, wine)
    wine_id = r["id"]
    c = self._conn.execute("SELECT * FROM years WHERE wine=? AND year=?",
                           (wine_id, year))
    r = c.fetchone()
    if r is None:
      self._conn.execute("""
            INSERT INTO years(wine, year, count, price, comment)
            VALUES(?, ?, ?, ?, ?)""", (wine_id, year, count, price, comment))
      c = self._conn.execute("SELECT id FROM years ORDER BY id DESC LIMIT 1")
      r = c.fetchone()
      year_id = r["id"]
      self.Log(year_id, count, reason)
    else:
      # TODO: When does this happen? Handle this differently? Update other fields at least?
      # self._conn.execute("UPDATE years SET count=count+1 WHERE wine=? and year=?", (wine_id, year))
      pass
    self._conn.commit()

  def _GetCurrentCount(self, wine_id):
    c = self._conn.execute("SELECT count FROM years WHERE id=?", (wine_id,))
    return c.fetchone()["count"]

  # TODO: "wine_id" should maybe be called "year_id" or something
  def AddOneBottle(self, wine_id, reason):
    self._conn.execute("UPDATE years SET count=count+1 WHERE id=?", (wine_id,))
    self.Log(wine_id, 1, reason)
    self._conn.commit()
    return self._GetCurrentCount(wine_id)

  def RemoveOneBottle(self, wine_id, reason):
    self._conn.execute("UPDATE years SET count=count-1 WHERE id=?", (wine_id,))
    self.Log(wine_id, -1, reason)
    self._conn.commit()
    return self._GetCurrentCount(wine_id)

  def Update(self, wine_id, price, comment):
    self._conn.execute("UPDATE years SET price=?, comment=? WHERE id=?",
                       (price, comment, wine_id))
    self._conn.commit()

  def GetAll(self):
    result = {}
    vc = self._conn.execute("SELECT * FROM vineyards")
    for vineyard_row in vc:
      wines = {}
      vineyard_data = {"wines": wines, "id": vineyard_row["id"],
                       "region": vineyard_row["region"]}
      result[vineyard_row["name"]] = vineyard_data
      wc = self._conn.execute("SELECT * FROM wines WHERE vineyard=?",
                              (vineyard_row["id"],))
      for wine_row in wc:
        years = {}
        wine_data = {"years": years, "id": wine_row["id"],
                     "grape": wine_row["grape"]}
        wines[wine_row["name"]] = wine_data
        yc = self._conn.execute("SELECT * FROM years WHERE wine=?",
                                (wine_row["id"],))
        for year_row in yc:
          years[year_row["year"]] = {
            "wineid": year_row["id"],
            "count": year_row["count"],
            "price": year_row["price"],
            "rating": year_row["rating"],
            "comment": year_row["comment"]
          }
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
    c = self._conn.execute("SELECT * FROM vineyards WHERE id=?", (vineyard_id,))
    r = c.fetchone()
    return {"id": r["id"],
            "vineyard": r["name"],
            "country": r["country"],
            "region": r["region"],
            "address": r["address"],
            "website": r["website"],
            "comment": r["comment"]}

  def SetVineyardData(self, vineyard_id, country, region, address, website,
                      comment):
    self._conn.execute("""
        UPDATE vineyards
        SET country=?, region=?, address=?, website=?, comment=?
        WHERE id=?""",
        (country, region, address, website, comment, vineyard_id))
    self._conn.commit()

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

if __name__ == '__main__':
  m = Manager(":memory:")
  m.AddWine("Beurer", "Gipskeuper", 2012, 1, 8.90, "")
  m.AddWine("Beurer", "Gipskeuper", 2013, 1, 9.90, "")
  m.AddWine("Beurer", "Schilfsandstein", 2012, 1, 10.90, "")
  m.AddOneBottle(1)
  c = m._conn.execute('select * from years')
  #print(c.fetchall())
  #for row in c:
  #  print(row)
  print(m.GetAll())
  m.Shutdown()
