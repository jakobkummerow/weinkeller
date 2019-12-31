#!/usr/bin/env python3

import os
import subprocess
import webbrowser

import PyQt5.QtWidgets as qt
import PyQt5.QtGui as qtgui

class Window(qt.QMainWindow):
  def __init__(self, address):
    super().__init__()

    self.statusBar().showMessage("Server läuft auf %s" % address)

    self.setWindowTitle("Weinkeller Server")
    self.resize(320, 160)

    mainpart = qt.QWidget()
    self.setCentralWidget(mainpart)

    layout = qt.QVBoxLayout()
    top_button = qt.QPushButton("Im Browser öffnen")

    def on_button_clicked():
      webbrowser.open(address)

    top_button.clicked.connect(on_button_clicked)
    layout.addWidget(top_button)

    quit_button = qt.QPushButton("Speichern und beenden")
    quit_button.clicked.connect(qt.QApplication.instance().quit)
    layout.addWidget(quit_button)

    update_button = qt.QPushButton("Updates installieren")
    update_button.clicked.connect(self.Update)
    layout.addWidget(update_button)

    mainpart.setLayout(layout)

    basedir = os.path.dirname(os.path.abspath(__file__))
    icon = os.path.join(os.path.dirname(basedir), "favicon.ico")
    self.setWindowIcon(qtgui.QIcon(icon))
    self.show()

  def AttemptUpdate(self):
    code = subprocess.call("which git", shell=True)
    if code != 0:
      return "'git' nicht gefunden, bitte installieren."
    if not os.path.exists(".git"):
      return "Kein git-Checkout gefunden."
    old_version = subprocess.check_output("git log -1 --format=%H", shell=True)
    print("old version: %s" % old_version)
    code = subprocess.call("git pull", shell=True)
    if code != 0:
      return "'git pull' fehlgeschlagen, code: %d" % code
    new_version = subprocess.check_output("git log -1 --format=%H", shell=True)
    print("new version: %s" % new_version)
    if new_version == old_version:
      return "Keine neuere Version gefunden."
    return "Update installiert, bitte Server neu starten"

  def Update(self):
    workdir = os.getcwd()
    basedir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(os.path.dirname(basedir))
    result = self.AttemptUpdate()
    self.statusBar().showMessage(result)
    os.chdir(workdir)

def ShowWindow(status):
  app = qt.QApplication([])
  win = Window(status)
  app.exec_()

if __name__ == "__main__":
  ShowWindow()
