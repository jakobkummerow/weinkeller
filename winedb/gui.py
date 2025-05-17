#!/usr/bin/env python3

import os
import subprocess
import webbrowser
import sys

PYQT_VERSION = 6
try:
  import PyQt6.QtCore as qtcore
except ModuleNotFoundError:
  PYQT_VERSION = 5
  try:
    import PyQt5.QtCore as qtcore
  except:
    print("Please install either PyQt5 or PyQt6, or run with --headless")
    sys.exit(1)
if PYQT_VERSION == 5:
  import PyQt5.QtGui as qtgui
  import PyQt5.QtWidgets as qt
elif PYQT_VERSION == 6:
  import PyQt6.QtGui as qtgui
  import PyQt6.QtWidgets as qt
else:
  print(f"Unexpected PYQT_VERSION={PYQT_VERSION}, likely a bug")
  sys.exit(1)

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

class Window(qt.QMainWindow):
  def __init__(self, app):
    super().__init__()
    self.app = app

    self.statusBar().showMessage(f"Server läuft auf {app.getAddress()}")
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

  def MaybePerformMasterToMainMigration(self):
    kFrom = "master"
    kTo = "main"
    branch = subprocess.check_output("git rev-parse --abbrev-ref HEAD",
                                     shell=True)
    branch = branch.decode('utf-8', 'ignore').strip()
    if branch != kFrom: return 1001
    code = subprocess.call(f"git log -1 origin/{kTo} >/dev/null", shell=True)
    if code != 0: return 1002
    # Current branch is "master", and "origin/main" exists, so migrate!
    subprocess.call(f"git branch -m {kFrom} {kTo}", shell=True)
    subprocess.call("git fetch origin", shell=True)
    subprocess.call(f"git branch -u origin/{kTo} {kTo}", shell=True)
    subprocess.call("git remote set-head origin -a", shell=True)
    return subprocess.call("git pull", shell=True)

  def AttemptUpdate(self):
    code = subprocess.call("which git", shell=True)
    if code != 0:
      return "'git' nicht gefunden, bitte installieren."
    if not os.path.exists(".git"):
      return "Kein git-Checkout gefunden."
    old_version = subprocess.check_output("git log -1 --format=%H", shell=True)
    print(f"old version: {old_version}")
    code = subprocess.call("git pull", shell=True)
    if code != 0:
      code2 = self.MaybePerformMasterToMainMigration()
      if code2 != 0:
        return f"'git pull' fehlgeschlagen, code: {code},{code2}"
    new_version = subprocess.check_output("git log -1 --format=%H", shell=True)
    print(f"new version: {new_version}")
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
