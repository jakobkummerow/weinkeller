import configparser
import datetime
import os
import socket
import subprocess
import sys

from .server import WineServer

class Main():
  def __init__(self):
    self.basedir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    self.config_filename = os.path.join(self.basedir, 'config.ini')
    self.config = configparser.ConfigParser()
    self.config.read(self.config_filename)
    self._InitSettings()
    self.ip = socket.gethostbyname(socket.gethostname())
    print("detected IP: %s" % self.ip)
    self.address = "http://%s:%d" % (self.ip, self.confPort())

  def _InitSettings(self):
    if Main.key_settings not in self.config:
      self.config[Main.key_settings] = {}
    settings = self._Settings()
    def define(key, value):
      if key not in settings: settings[key] = value
    define(Main.key_database_filename, 'wines.sqlite3')
    define(Main.key_port, '7887')
    define(Main.key_show_window_startup, 'true')

  def SaveAll(self):
    self._SaveSettings()
    self.SaveDatabase()

  def SaveDatabase(self):
    self.server.Shutdown()

  def Run(self, argv):
    db_file = os.path.join(self.basedir, self.confDatabaseFilename())
    #db_file = ":memory:"
    self.server = WineServer(self.confPort(), db_file, self.basedir)
    self.server.Start()
    gui = '--headless' not in argv
    if gui:
      # Only do the import here so we can run on systems that don't have PyQt.
      from .gui import App
      app = App(self, argv)
      app.exec_()
    else:
      print('headless mode, not starting GUI')
      try:
        self.server.thread.join()
      except KeyboardInterrupt:
        print("Shutting down")
        self.server.Shutdown()

  def confDatabaseFilename(self):
    return self._Settings()[Main.key_database_filename]
  def setConfDatabaseFilename(self, filename):
    self._Settings()[Main.key_database_filename] = filename
    self._SaveSettings()
  def confPort(self):
    return int(self._Settings()[Main.key_port])

  def confShowWindowStartup(self):
    return self._Settings().getboolean(Main.key_show_window_startup)
  def setConfShowWindowStartup(self, show):
    self._Settings()[Main.key_show_window_startup] = "true" if show else "false"
    self._SaveSettings()

  def _Settings(self):
    return self.config[Main.key_settings]
  def _SaveSettings(self):
    with open(self.config_filename, 'w') as configfile:
      self.config.write(configfile)

  key_settings = 'Settings'
  key_database_filename = 'DatabaseFilename'
  key_port = 'Port'
  key_show_window_startup = 'ShowWindowStartup'
