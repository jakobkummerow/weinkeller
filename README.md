# Weinkeller

A small application to keep track of the contents of your wine cellar.
How many bottles of which year of which wine from which vineyard do you have,
and how do you like them?

Designed as a client-server application: run the server component on any
computer on your home network, access it via web browser from however many
clients you like (including the same computer that runs the server, of course).
For example, you can take a laptop/tablet/phone to walk into your cellar and
count bottles there. Losing wifi coverage temporarily is not an issue: the
client is fully offline capable, it holds all data locally and syncs with the
server when network connectivity is restored.

The app's user interface is currently in German; offering other languages is
planned for the future.

# Recommended installation

### Requirements

Many **Linux** systems have everything they need out of the box; on other
systems you may have to install these:
- git
- Python 3.x
- PyQt5 (optional, for server GUI)

On **MacOS**, a simple way to get git and Python is to install the "Xcode
command-line tools": open a terminal and type `xcode-select --install` (see
[here](https://mac.install.guide/commandlinetools/4.html) or your favorite
search engine for more details). Getting PyQt5 appears to be a bit more involved
and is probably best done with Homebrew; you can skip that and run the server
in headless mode (see "Tips" below), or see the "Minimal installation" below.

On **Windows** you could use Cygwin or WSL (both untested), or see the "Minimal
installation" below.

### Installation

Get a checkout of this repository:
`git clone https://github.com/jakobkummerow/weinkeller.git`

Optionally create a shortcut to the included file `start.py` on your desktop.

### Running

1. Start the server by clicking the shortcut you created earlier, or by typing
  `~/weinkeller/start.py` in a terminal.
1. Either click the button "open in browser" in the window that opens, or
  manually type the address into your browser's address bar, e.g.
  `192.168.0.42:7887`

### Tips

You can click the system tray icon to minimize the server to the tray.

You can leave the server running when you shut down your computer; many
desktop environments will automatically restart it when you boot the system
up again.

You can create a browser bookmark so you won't have to type the address again.

If your system doesn't have PyQt, you can start the  server with the
`--headless` argument for a pure command-line experience. In that case, you
can stop the server with `Ctrl-C`.

If your system doesn't have git, you can download an archive of this repository
instead. In that case, you won't be able to use the built-in updater.

# Minimal installation

If the recommended requirements are too onerous, you can use these instructions
instead. The instructions below assume that this may be the case on Windows;
they translate to other systems in a straightforward manner.

Drawbacks of the minimal installation compared to the recommended installation:
- no built-in updater
- no graphical user interface for the server (just command line)
- the server may be a bit slow for huge databases

### Requirements

- [Node.js](https://nodejs.org/en/download/) (tested with version 14, other
  versions should work too)

### Installation

Download an [archive of this repository](https://github.com/jakobkummerow/weinkeller/archive/master.zip)
and extract it. The example below assumes that you put it to
`C:\Users\<you>\Downloads\weinkeller`.

Pro tip: if you got Node.js by extracting it from the .zip archive, put it
into a subdirectory, e.g. `weinkeller\node`.

#### Optional: create a shortcut

1. Right-click your desktop, choose "New" > "Shortcut".
2. Select the `node.exe` binary from where you installed or extracted it.
3. Click "Finish".
4. Right-click the new shortcut, choose "Properties".
5. Edit the "Target" line to append: `" js\node-server.js"` (without quotes,
  with space)
6. Edit the "Start in" line to be the directory where you put the server (e.g.
  `C:\Users\<you>\Downloads\weinkeller`)
7. Optionally: change the icon.
8. Optionally: switch to "Font" tab and select a more readable font.
9. Click "OK" to save.

### Running

If you created a shortcut, simply double-click that.

Type the address that's printed (e.g. `192.168.1.42:7887`) into your browser.

To stop the server and save all data, switch to the command prompt window
and hit `<Ctrl>+<C>`.

The first time you start the server, you may have to grant it access to the
network in the Windows Firewall dialog window that pops up.

#### Alternative: manual start

1. Open a command prompt: hit `<Win>+<R>`, type `cmd.exe`, hit `<Return>`
2. Navigate to the directory where you put the server's files, e.g.:
  `cd Downloads\weinkeller`.
3. Start the server by launching `node.exe` (wherever you put it) with the
  file `js/node-server.js` as argument, e.g. if you followed the tip above
  you can type: `node\node.exe js\node-server.js`
