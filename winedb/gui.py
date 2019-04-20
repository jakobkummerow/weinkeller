#!/usr/bin/env python3

import webbrowser

import PyQt5.QtWidgets as qt
import PyQt5.QtGui as qtgui

class Window(qt.QMainWindow):
  def __init__(self, address):
    super().__init__()

    self.statusBar().showMessage("Server läuft auf %s" % address)

    self.setWindowTitle("WineDB Server")
    self.resize(250, 120)

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

    mainpart.setLayout(layout)

    self.setWindowIcon(qtgui.QIcon("/home/jkummerow/wine/favicon.ico"))
    self.show()

def ShowWindow(status):
  app = qt.QApplication([])
  win = Window(status)
  app.exec_()

if __name__ == "__main__":
  ShowWindow()
