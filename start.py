#!/usr/bin/python3

import os
import threading

from winedb.gui import ShowWindow
from winedb.server import WineServer

PORT_NUMBER = 7887

if __name__ == "__main__":
  basedir = os.path.dirname(os.path.abspath(__file__))
  server = WineServer(('', PORT_NUMBER), basedir)
  server_thread = threading.Thread(target=server.Run)
  server_thread.daemon = True
  server_thread.start()
  address = "http://localhost:%d" % PORT_NUMBER
  ShowWindow(address)
  print("Server wird beendet")
  server.Shutdown()
