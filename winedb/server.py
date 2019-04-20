from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
import threading
import urllib

from .manager import Manager

class WineHandler(BaseHTTPRequestHandler):

  def __init__(self, request, client_address, server):
    self._server = server
    self._basedir = server.basedir
    BaseHTTPRequestHandler.__init__(self, request, client_address, server)

  def _set_headers(self, content_type):
    self.send_response(200)
    self.send_header('Content-type', content_type)
    self.end_headers()

  def _send_json(self, data):
    self._set_headers('application/json')
    response = urllib.parse.quote(json.dumps(data, sort_keys=True))
    self.wfile.write(response.encode('utf-8'))

  def do_GET(self):
    parsed_path = urllib.parse.urlparse(self.path)
    path = parsed_path.path

    if path == '/':
      path = '/index.html'

    try:
      mimetype = None
      if path.endswith(".html"):
        mimetype = "text/html; charset=utf-8"
      elif path.endswith(".js"):
        mimetype = "text/javascript"
      elif path.endswith(".css"):
        mimetype = "text/css"
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
      self.send_error(404, 'File not found: %s' % self.path)

    raw_query = parsed_path.query
    query = urllib.parse.parse_qs(raw_query)

    if path == "/get_all":
      only_existing = query["only_existing"][0]
      self._send_json(self._server.manager.GetAll(only_existing))

    elif path == "/get_vineyards":
      self._send_json(self._server.manager.GetVineyards())

    elif path == "/get_wines":
      wines = self._server.manager.GetWinesForVineyard(query["vineyard"][0])
      self._send_json(wines)

    elif path =="/get_log":
      self._send_json(self._server.manager.GetLog(10))

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

  def _get_post_data(self, option):
    return self._post_data[option][0]

  def _get_optional(self, option, default):
    if option in self._post_data:
      return self._post_data[option][0]
    return default

  def do_POST(self):
    content_length = int(self.headers['Content-Length'])
    raw = str(self.rfile.read(content_length), encoding='utf-8')
    self._post_data = urllib.parse.parse_qs(raw)
    # print("post data: %s" % self._post_data)

    if self.path == "/add_all":
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
      wineid = self._get_post_data("wineid")
      reason = self._get_post_data("reason")
      updated = self._server.manager.AddOneBottle(wineid, reason)
      self._send_json({"wineid": wineid, "count": updated})

    elif self.path == "/remove_bottle":
      wineid = self._get_post_data("wineid")
      reason = self._get_post_data("reason")
      updated = self._server.manager.RemoveOneBottle(wineid, reason)
      self._send_json({"wineid": wineid, "count": updated})

    elif self.path == "/update":
      wineid = self._get_post_data("wineid")
      price = self._get_optional("price", 0)
      comment = self._get_optional("comment", "")
      self._server.manager.Update(wineid, price, comment)
      self._send_json({"status": "ok"})

    elif self.path == "/update_rating":
      wineid = self._get_post_data("wineid")
      rating = self._get_post_data("rating")
      self._server.manager.UpdateRating(wineid, rating)
      self._send_json({"status": "ok"})

    elif self.path == "/set_vineyard":
      vineyard_id = self._get_post_data("vineyard_id")
      country = self._get_optional("country", "")
      region = self._get_optional("region", "")
      address = self._get_optional("address", "")
      website = self._get_optional("website", "")
      comment = self._get_optional("comment", "")
      self._server.manager.SetVineyardData(
          vineyard_id, country, region, address, website, comment)
      self._send_json({"status": "ok"})

    elif self.path == "/update_log":
      log_id = self._get_post_data("log_id")
      reason = self._get_post_data("reason")
      self._send_json(self._server.manager.UpdateLog(log_id, reason))

    elif self.path == "/set_wine":
      wine_id = self._get_post_data("wine_id")
      name = self._get_post_data("name")
      grape = self._get_optional("grape", "")
      comment = self._get_optional("comment", "")
      self._server.manager.UpdateWine(wine_id, name, grape, comment)
      self._send_json({"status": "ok"})

class WineServer(HTTPServer):
  def __init__(self, server_address, basedir):
    HTTPServer.__init__(self, server_address, WineHandler)
    self.manager = None
    self.basedir = basedir
    self.shutdown_done = threading.Event()

  def Run(self):
    db_file = os.path.join(self.basedir, "wines.sqlite3")
    self.manager = Manager(db_file)
    print("Server läuft auf Port %d" % self.server_address[1])
    try:
      self.serve_forever()
    finally:
      self.manager.Shutdown()
      self.shutdown_done.set()

  def Shutdown(self):
    self.shutdown()
    self.shutdown_done.wait()
