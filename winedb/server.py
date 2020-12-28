from datetime import date
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
import selectors
import socket
import ssl
import threading
import time
import urllib

from .manager import Manager

class WineHandler(BaseHTTPRequestHandler):

  def __init__(self, request, client_address, server):
    self._server = server
    self._basedir = server.basedir
    super().__init__(request, client_address, server)

  def _set_headers(self, content_type):
    self.send_response(200)
    self.send_header("Content-Type", content_type)
    self.send_header("Access-Control-Allow-Origin", self._origin)
    self.end_headers()

  def _send_json(self, data):
    self._set_headers("application/json")
    response = urllib.parse.quote(json.dumps(data, sort_keys=True))
    self.wfile.write(response.encode("utf-8"))

  def _send_json2(self, data):
    self._set_headers("application/json")
    self.wfile.write(json.dumps(data, sort_keys=True).encode("utf-8"))

  def do_GET(self):
    parsed_path = urllib.parse.urlparse(self.path)
    path = parsed_path.path
    # We are fine with CORS requests.
    self._origin = self.headers['Origin']

    if path == "/":
      user_agent = self.headers['user-agent'].lower()
      if "android" in user_agent or "mobile" in user_agent:
        path = "/mobile2.html"
      else:
        path = "/index2.html"
    elif path == "/m":
      path = "/mobile2.html"
    elif path == "/v1":
      path = "/index.html"
    elif path == "/m1":
      path = "/mobile.html"

    try:
      mimetype = None
      if path.endswith(".html"):
        mimetype = "text/html; charset=utf-8"
      elif path.endswith(".js") or path.endswith(".js.map"):
        mimetype = "text/javascript"
      elif path.endswith(".css"):
        mimetype = "text/css"
      elif path.endswith(".ts"):
        mimetype = "application/x-typescript"
      if mimetype is not None:
        self._set_headers(mimetype)
        with open(self._basedir + path, "r") as f:
          self.wfile.write(f.read().encode('utf-8'))
        return
      if path == "/favicon.ico":
        self._set_headers("image/x-icon")
        with open(self._basedir + path, "rb") as f:
          self.wfile.write(f.read())
    except IOError:
      self.send_error(404, "File not found: %s" % self.path)

    raw_query = parsed_path.query
    query = urllib.parse.parse_qs(raw_query)

    if path == "/api/get":
      client_knows_commit = query["last_commit"][0]
      self._send_json2(self._server.manager.GetAll2(client_knows_commit))

    elif path == "/get_all":
      only_existing = query["only_existing"][0]
      self._send_json(self._server.manager.GetAll(only_existing))

    elif path == "/get_sorted":
      only_existing = query["only_existing"][0]
      sortby = query["sortby"][0]
      self._send_json(self._server.manager.GetSorted(only_existing, sortby))

    elif path == "/get_vineyards":
      self._send_json(self._server.manager.GetVineyards())

    elif path == "/get_wines":
      wines = self._server.manager.GetWinesForVineyard(query["vineyard"][0])
      self._send_json(wines)

    elif path =="/get_log":
      count = query["count"][0]
      self._send_json(self._server.manager.GetLog(count))

    elif path == "/vineyard_data":
      vineyard = query["vineyard"][0]
      self._send_json(self._server.manager.GetVineyardData(vineyard))

    elif path =="/wine_data":
      wine = query["wine"][0]
      self._send_json(self._server.manager.GetWineData(wine))

    elif path == "/countries":
      self._send_json(self._server.manager.GetCountries())

    elif path == "/regions":
      country = query["country"][0]
      self._send_json(self._server.manager.GetRegionsForCountry(country))

    elif path == "/grapes":
      self._send_json(self._server.manager.GetGrapes())

    elif path == "/get_totals":
      self._send_json(self._server.manager.GetTotals())

    elif path == "/export" or path == "/api/export":
      self.send_response(200)
      self.send_header("Content-type", "text/csv")
      filename = "wines-%s.csv" % date.today()
      self.send_header("Content-Disposition",
                       "attachment;filename=\"%s\"" % filename)
      self.end_headers()
      result = self._server.manager.ExportCSV()
      self.wfile.write(result.encode('utf-8'))

  def _get_post_data(self, option):
    return self._post_data[option][0].strip()

  def _get_optional(self, option, default):
    if option in self._post_data:
      return self._post_data[option][0].strip()
    return default

  def do_POST(self):
    # We are fine with CORS requests.
    self._origin = self.headers['Origin']
    content_length = int(self.headers['Content-Length'])
    raw = str(self.rfile.read(content_length), encoding='utf-8')
    content_type = self.headers['Content-Type']
    if content_type == "application/x-www-form-urlencoded":
      # The v1 way of doing things.
      self._post_data = urllib.parse.parse_qs(raw)
    elif content_type == "application/json":
      # The v2 way of doing things.
      post_data = json.loads(raw)
    # print("post data: %s" % self._post_data)

    if self.path == "/api/set":
      print("request: %s" % post_data)
      response = self._server.manager.Set(post_data)
      self._send_json2(response)

    elif self.path == "/add_all":
      vineyard = self._get_post_data("vineyard")
      wine = self._get_post_data("wine")
      year = self._get_post_data("year")
      count = self._get_optional("count", 0)
      rating = self._get_optional("rating", 0)
      price = self._get_optional("price", 0)
      comment = self._get_optional("comment", "")
      reason = self._get_post_data("reason")
      only_existing = self._get_post_data("only_existing")
      self._server.manager.AddAll(vineyard, wine, year, count, rating, price,
                                  comment, reason)
      self._send_json(self._server.manager.GetAll(only_existing))

    elif self.path == "/add_wine":
      vineyard_id = self._get_post_data("vineyard_id")
      wine = self._get_post_data("wine")
      year = self._get_post_data("year")
      count = self._get_optional("count", 0)
      rating = self._get_optional("rating", 0)
      price = self._get_optional("price", 0)
      comment = self._get_optional("comment", "")
      reason = self._get_post_data("reason")
      only_existing = self._get_post_data("only_existing")
      self._server.manager.AddWine(vineyard_id, wine, year, count, rating,
                                   price, comment, reason)
      self._send_json(self._server.manager.GetAll(only_existing))

    elif self.path == "/add_year":
      wine_id = self._get_post_data("wine_id")
      year = self._get_post_data("year")
      count = self._get_optional("count", 0)
      rating = self._get_optional("rating", 0)
      price = self._get_optional("price", 0)
      comment = self._get_optional("comment", "")
      reason = self._get_post_data("reason")
      only_existing = self._get_post_data("only_existing")
      self._server.manager.AddYear(wine_id, year, count, rating, price, comment,
                                   reason)
      self._send_json(self._server.manager.GetAll(only_existing))

    elif self.path == "/add_bottle":
      yearid = self._get_post_data("yearid")
      reason = self._get_post_data("reason")
      updated = self._server.manager.AddOneBottle(yearid, reason)
      self._send_json({"yearid": yearid, "count": updated})

    elif self.path == "/remove_bottle":
      yearid = self._get_post_data("yearid")
      reason = self._get_post_data("reason")
      updated = self._server.manager.RemoveOneBottle(yearid, reason)
      self._send_json({"yearid": yearid, "count": updated})

    elif self.path == "/add_stock":
      yearid = self._get_post_data("yearid")
      updated = self._server.manager.AddStock(yearid)
      self._send_json({"yearid": yearid, "stock": updated})

    elif self.path == "/remove_stock":
      yearid = self._get_post_data("yearid")
      updated = self._server.manager.RemoveStock(yearid)
      self._send_json({"yearid": yearid, "stock": updated})

    elif self.path == "/apply_stock":
      yearid = self._get_post_data("yearid")
      updated = self._server.manager.ApplyStock(yearid)
      self._send_json({"yearid": yearid, "count": updated})

    elif self.path == "/apply_stock_wine":
      wineid = self._get_post_data("wineid")
      result = self._server.manager.ApplyStockWine(wineid)
      self._send_json(result)

    elif self.path == "/apply_stock_vineyard":
      vineyard_id = self._get_post_data("vineyard_id")
      result = self._server.manager.ApplyStockVineyard(vineyard_id)
      self._send_json(result)

    elif self.path == "/apply_stock_all":
      self._send_json(self._server.manager.ApplyStockAll())

    elif self.path == "/reset_stock_all":
      self._server.manager.ResetStockAll()
      self._send_json({"status": "ok"})

    elif self.path == "/delete_year":
      year_id = self._get_post_data("year_id")
      self._server.manager.DeleteYear(year_id)
      self._send_json({"status": "ok"})

    elif self.path == "/update":
      year_id = self._get_post_data("year_id")
      price = self._get_optional("price", 0)
      comment = self._get_optional("comment", "")
      self._server.manager.Update(year_id, price, comment)
      self._send_json({"status": "ok"})

    elif self.path == "/update_rating":
      year_id = self._get_post_data("year_id")
      what = self._get_post_data("what")
      if what not in ("rating", "value", "sweetness", "age"): return
      val = self._get_post_data("val")
      self._server.manager.UpdateRating(year_id, what, val)
      self._send_json({"yearid": year_id, what: val})

    elif self.path == "/set_vineyard":
      vineyard_id = self._get_post_data("vineyard_id")
      name = self._get_optional("name", "")
      country = self._get_optional("country", "")
      region = self._get_optional("region", "")
      address = self._get_optional("address", "")
      website = self._get_optional("website", "")
      comment = self._get_optional("comment", "")
      response = self._server.manager.SetVineyardData(
          vineyard_id, name, country, region, address, website, comment)
      self._send_json(response)

    elif self.path == "/update_log":
      log_id = self._get_post_data("log_id")
      reason = self._get_post_data("reason")
      self._send_json(self._server.manager.UpdateLog(log_id, reason))

    elif self.path == "/set_wine":
      wine_id = self._get_post_data("wine_id")
      name = self._get_post_data("name")
      grape = self._get_optional("grape", "")
      comment = self._get_optional("comment", "")
      response = self._server.manager.UpdateWine(wine_id, name, grape, comment)
      self._send_json(response)

  def do_OPTIONS(self):
    # POST requests in offline mode require this for "pre-flighting" requests.
    self.send_response(204)
    self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
    self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    self.send_header('Access-Control-Allow-Headers', 'Content-type')
    self.end_headers()

class WineServer(HTTPServer):
  def __init__(self, port, db_file, basedir):
    super().__init__(('', port), WineHandler)
    self.manager = None
    self.db_file = db_file
    self.basedir = basedir
    self.shutdown_done = threading.Event()

  def Start(self):
    self.thread = threading.Thread(target=self._Run)
    self.thread.daemon = True
    self.thread.start()

  def _Run(self):
    self.manager = Manager(self.db_file)
    print("Server läuft auf Port %d" % self.server_address[1])
    try:
      self.serve_forever()
    finally:
      self.manager.Shutdown()
      self.shutdown_done.set()

  def Shutdown(self):
    self.shutdown()
    self.shutdown_done.wait()
