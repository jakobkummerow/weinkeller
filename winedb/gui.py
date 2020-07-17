#!/usr/bin/env python3

import os
import subprocess
import webbrowser
import sys

import PyQt5.QtCore as qtcore
import PyQt5.QtGui as qtgui
import PyQt5.QtWidgets as qt

class SystemTrayIcon(qt.QSystemTrayIcon):
  def __init__(self, icon, parent):
    qt.QSystemTrayIcon.__init__(self, icon, parent)
    self.main_win = parent
    menu = qt.QMenu(None)
    show_win_action = menu.addAction("Fenster anzeigen")
    show_win_action.triggered.connect(parent.show)
    exit_action = menu.addAction("Speichern und beenden")
    exit_action.triggered.connect(parent.exit)
    self.setContextMenu(menu)
    self.setToolTip("Weinkeller Server")
    self.activated.connect(self.clicked)

  def clicked(self, reason):
    if reason == qt.QSystemTrayIcon.Trigger:
      if self.main_win.isVisible():
        self.main_win.hide()
      else:
        self.main_win.show()
    pass

class Window(qt.QMainWindow):
  def __init__(self, app):
    super().__init__()
    self.app = app

    self.statusBar().showMessage("Server läuft auf %s" % app.getAddress())
    self.setWindowTitle("Weinkeller Server")

    mainpart = qt.QWidget()
    self.setCentralWidget(mainpart)

    main_layout = qt.QVBoxLayout()
    open_button = qt.QPushButton("Im Browser öffnen")
    open_button.clicked.connect(self.open_button_clicked)
    quit_button = qt.QPushButton("Speichern und beenden")
    quit_button.clicked.connect(self.exit)
    main_layout.addWidget(open_button)
    main_layout.addWidget(quit_button)

    cols_widget = qt.QWidget()
    cols_layout = qt.QHBoxLayout()
    cols_widget.setLayout(cols_layout)
    main_layout.addWidget(cols_widget)

    right_col_box = qt.QGroupBox("Aktionen")
    update_button = qt.QPushButton("Updates installieren")
    update_button.clicked.connect(self.Update)
    restart_button = qt.QPushButton("Server neu starten")
    restart_button.clicked.connect(self.restart)
    right_col = qt.QVBoxLayout()
    right_col.addWidget(update_button)
    right_col.addWidget(restart_button)
    right_col_box.setLayout(right_col)

    left_col_box = qt.QGroupBox("Einstellungen")
    autostart_checkbox = qt.QCheckBox("Automatisch starten")
    autostart_checkbox.setEnabled(False)
    autostart_checkbox.setToolTip("Noch nicht implementiert")
    showwin_checkbox = qt.QCheckBox("Fenster beim Start zeigen")
    showwin_checkbox.setChecked(self.app.main.confShowWindowStartup())
    showwin_checkbox.toggled.connect(self.showwin_toggled)
    left_col = qt.QVBoxLayout()
    left_col.addWidget(autostart_checkbox)
    left_col.addWidget(showwin_checkbox)
    left_col_box.setLayout(left_col)

    cols_layout.addWidget(left_col_box)
    cols_layout.addWidget(right_col_box)

    mainpart.setLayout(main_layout)

    icon_img = os.path.join(self.app.main.basedir, "favicon.ico")
    icon = qtgui.QIcon(icon_img)
    self.setWindowIcon(icon)
    trayicon = SystemTrayIcon(icon, self)
    trayicon.show()

  def open_button_clicked(self):
    webbrowser.open(self.app.getAddress())

  def exit(self):
    print("quitting.")
    qtcore.QCoreApplication.exit()

  def restart(self):
    print("restarting.")
    self.app.onquit()
    os.execv(sys.argv[0], sys.argv)

  def showwin_toggled(self, checked):
    self.app.main.setConfShowWindowStartup(checked)

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

class App(qt.QApplication):
  def __init__(self, main, argv):
    super().__init__(argv)
    self.main = main
    self.win = Window(self)
    if main.confShowWindowStartup():
      self.win.show()
    else:
      self.win.hide()
    self.aboutToQuit.connect(self.onquit)

  def getAddress(self):
    return self.main.address

  def onquit(self):
    print("about to quit, saving everything")
    self.main.SaveAll()
