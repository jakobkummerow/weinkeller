#define _WIN32_WINNT 0x0A00  // Windows 10.
#define NTDDI_VERSION 0x0A000007  // Windows 10 19H1.

#include <netlistmgr.h>     // For connectivity checking.
#include <shldisp.h>        // For unzipping.
#include <shobjidl_core.h>  // For file picker.
#include <stdlib.h>
#include <windows.h>
#include <wininet.h>  // For downloading.
#include <WinUser.h>

#include <filesystem>
#include <memory>
#include <string>

#pragma comment(lib, "wininet")

// Enable modern theme.
#pragma comment(linker, \
                "\"/manifestdependency:type='win32' \
name='Microsoft.Windows.Common-Controls' version='6.0.0.0' \
processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\"")

// Debugging help.
int __cdecl printf2(const char* format, ...) {
  char str[1024];
  va_list argptr;
  va_start(argptr, format);
  int ret = vsnprintf(str, sizeof(str), format, argptr);
  va_end(argptr);
  OutputDebugStringA(str);
  return ret;
}
#define printf printf2

// Global definitions and variables.
static const wchar_t* kWeinkellerUrl =
    L"https://github.com/jakobkummerow/weinkeller/archive/refs/heads/main.zip";
static const wchar_t* kWeinkellerCommits =
    L"https://api.github.com/repos/jakobkummerow/weinkeller/commits/main";
static const wchar_t* kPythonVersion =
    L"https://raw.githubusercontent.com/jakobkummerow/weinkeller/main/windows/"
    L"python_version.txt";

static wchar_t szWindowClass[] = L"WeinkellerManager";
static wchar_t szVersionString[] = L"Version: 2024.1";

static const int IDC_BTN_PATH = 201;
static const int IDC_BTN_INSTALL = 202;
static const int IDC_BTN_SERVER = 203;
static const int IDC_BTN_BROWSER = 204;
static const int IDC_BTN_QUIT = 205;

class MainWindow;
MainWindow* g_mainwin = nullptr;

// Language support.
#define ALL_STRINGS(V)                                                   \
  V(kPath, L"Path:", L"Pfad:")                                           \
  V(kBrowse, L"Choose...", L"Suchen...")                                 \
  V(kInstall, L"Install", L"Installieren")                               \
  V(kOffline, L"Cannot install: no internet connection",                 \
    L"Kann nicht installieren: keine Internetverbindung")                \
  V(kUpdateWine, L"Update Weinkeller", L"Weinkeller aktualisieren")      \
  V(kUpdatePython, L"Update Python", L"Python aktualisieren")            \
  V(kNoUpdates, L"No updates available", L"Keine Updates")               \
  V(kStartServer, L"Start server", L"Server starten")                    \
  V(kOpenBrowser, L"Open in browser", L"Im Browser öffnen")              \
  V(kErrorStartServer, L"Starting server failed, sorry.",                \
    L"Serverstart fehlgeschlagen, sorry.")                               \
  V(kErrorInstallPython,                                                 \
    L"Something went wrong while trying to install Python.\n"            \
    L"Please report this bug.",                                          \
    L"Etwas ist schiefgegangen beim Versuch, Python zu installieren.\n"  \
    L"Bitte melde diesen Fehler.")                                       \
  V(kErrorInstallWine,                                                   \
    L"Something went wrong while trying to install \"Weinkeller\".\n"    \
    L"Please report this bug.",                                          \
    L"Etwas ist schiefgegangen beim Versuch, die \"Weinkeller\"-App zu " \
    L"installieren.\nBitte melde diesen Fehler.")                        \
  V(kQuit, L"Quit", L"Beenden")

class Lang {
 public:
  enum StringId {
#define ENUM(kName, ...) kName,
    ALL_STRINGS(ENUM)
#undef ENUM
        kNumStrings
  };

  Lang(const wchar_t* preferred_langs, size_t len)
      : lang_(ParsePreferredLangs(preferred_langs, len)) {}

  const wchar_t* Get(StringId s) { return kStrings[s][lang_]; }

 private:
  enum LangId {
    kEnglish,
    kGerman,
    // Sentinels:
    kNumLangs,
    kDefault = kEnglish
  };

  const wchar_t* kStrings[kNumStrings][kNumLangs] = {
#define STRING(kName, kEn, kDe) {kEn, kDe},
      ALL_STRINGS(STRING)
#undef STRING
  };

  LangId ParsePreferredLangs(const wchar_t* raw, size_t len) {
    if (len < 2) return LangId::kDefault;
    size_t pos = 0;
    while (true) {
      if (raw[pos] == 'e' && raw[pos + 1] == 'n') {
        return LangId::kEnglish;
      }
      if (raw[pos] == 'd' && raw[pos + 1] == 'e') {
        return LangId::kGerman;
      }
      while (pos < len && raw[pos] != 0) pos++;
      // Need at least: 0-byte + 2 letters.
      if (pos > len - 3) return LangId::kDefault;
      if (raw[pos + 1] == 0) return LangId::kDefault;
      pos++;  // Skip over 0-byte.
    }
  }

  LangId lang_;
};

// Stateless helpers.

bool FileExists(const std::wstring& szPath) {
  DWORD attributes = GetFileAttributesW(szPath.c_str());
  return (attributes != INVALID_FILE_ATTRIBUTES &&
          !(attributes & FILE_ATTRIBUTE_DIRECTORY));
}
bool FolderExists(const std::wstring& szPath) {
  DWORD attributes = GetFileAttributesW(szPath.c_str());
  return (attributes != INVALID_FILE_ATTRIBUTES &&
          (attributes & FILE_ATTRIBUTE_DIRECTORY));
}

std::string GetLatestWeinkellerVersion() {
  HINTERNET session = InternetOpenW(
      L"jakobkummerow/weinkeller", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
  HINTERNET url =
      InternetOpenUrlW(session, kWeinkellerCommits,
                       L"Accept: application/vnd.github.sha", -1L, 0, 0);
  constexpr size_t kBufferSize = 260;
  char buf[kBufferSize];
  DWORD bytes_read;
  InternetReadFile(url, buf, kBufferSize - 1, &bytes_read);
  InternetCloseHandle(url);
  InternetCloseHandle(session);
  buf[bytes_read] = 0;
  return std::string(buf, bytes_read);
}

std::string GetPythonVersion() {
  HINTERNET session = InternetOpenW(
      L"jakobkummerow/weinkeller", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
  HINTERNET url = InternetOpenUrlW(session, kPythonVersion, NULL, 0, 0, 0);
  constexpr size_t kBufferSize = 1000;
  char buf[kBufferSize];
  DWORD total_bytes_read = 0;
  DWORD want_to_read = kBufferSize - 1;
  char* cursor = buf;
  BOOL error;
  for (DWORD bytes_read = 1; bytes_read > 0;) {
    error = InternetReadFile(url, cursor, want_to_read, &bytes_read);
    if (error == FALSE) break;
    total_bytes_read += bytes_read;
    cursor += bytes_read;
    want_to_read -= bytes_read;
  }
  InternetCloseHandle(url);
  InternetCloseHandle(session);
  if (error == FALSE) return {};
  buf[total_bytes_read] = 0;
  const char* line_start = buf;
  const char* line_end = strchr(line_start, '\n');
  if (line_end == nullptr) return {};
  return std::string(line_start, line_end);
}

bool DownloadFile(const wchar_t* source_url, const wchar_t* target_filename) {
  bool result = true;
  HINTERNET session =
      InternetOpenW(L"weinkeller", INTERNET_OPEN_TYPE_PRECONFIG, 0, 0, 0);
  HINTERNET url = InternetOpenUrlW(session, source_url, NULL, 0, 0, 0);
  static constexpr DWORD kBufferSize = 4096;  // more?
  char buf[kBufferSize];
  do {
    HANDLE f = CreateFileW(target_filename, GENERIC_WRITE, 0, NULL,
                           CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (f == INVALID_HANDLE_VALUE) {
      result = false;
      break;
    }
    for (DWORD bytes_read = 1; bytes_read > 0;) {
      BOOL error = InternetReadFile(url, buf, kBufferSize, &bytes_read);
      if (error == FALSE) {
        result = false;
        break;
      }
      DWORD bytes_written;
      error = WriteFile(f, buf, bytes_read, &bytes_written, NULL);
      if (error == FALSE || bytes_read != bytes_written) {
        result = false;
        break;
      }
    }
    CloseHandle(f);
  } while (false);
  InternetCloseHandle(url);
  InternetCloseHandle(session);
  return result;
}

std::string ReadFile(const std::wstring& path) {
  HANDLE f = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, NULL,
                         OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (f == INVALID_HANDLE_VALUE) {
    MessageBox(NULL, L"opening file failed!", L"error", 0);
    return {};
  }
  static constexpr DWORD kBufferSize = 1000;
  char buffer[kBufferSize];
  DWORD bytes_read;
  BOOL error = ReadFile(f, buffer, kBufferSize - 1, &bytes_read, NULL);
  std::string result;
  if (error != FALSE) {
    result = std::string(buffer, bytes_read);
  }
  CloseHandle(f);
  return result;
}

std::wstring ReadFileW(const std::wstring& path) {
  HANDLE f = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, NULL,
                         OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (f == INVALID_HANDLE_VALUE) {
    MessageBox(NULL, L"opening file failed!", L"error", 0);
    return {};
  }
  static constexpr DWORD kBufferSize = 1000;
  char buffer[kBufferSize];
  DWORD bytes_read;
  BOOL error = ReadFile(f, buffer, kBufferSize - 2, &bytes_read, NULL);
  std::wstring result;
  if (error != FALSE) {
    const wchar_t* start = reinterpret_cast<const wchar_t*>(buffer);
    size_t num_chars = bytes_read / sizeof(wchar_t);
    if (num_chars > 0 && (*start == 0xfeff || *start == 0xfffe)) {
      printf("Skipping BOM!");
      start++;
      num_chars--;
    }
    result = std::wstring(start, num_chars);
  }
  CloseHandle(f);
  return result;
}

void WriteFile(const std::wstring& path, std::string& contents) {
  HANDLE f = CreateFileW(path.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS,
                         FILE_ATTRIBUTE_NORMAL, NULL);
  DWORD bytes_written = 0;
  DWORD bytes_to_write = static_cast<DWORD>(contents.length());
  BOOL error =
      WriteFile(f, contents.c_str(), bytes_to_write, &bytes_written, NULL);
  if (error == FALSE || bytes_written != bytes_to_write) {
    MessageBox(NULL, L"writing to file failed!", L"error", 0);
  }
  CloseHandle(f);
}

void WriteFile(const std::wstring& path, std::wstring& contents) {
  HANDLE f = CreateFileW(path.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS,
                         FILE_ATTRIBUTE_NORMAL, NULL);
  DWORD bytes_written = 0;
  DWORD bytes_to_write =
      static_cast<DWORD>(contents.length() * sizeof(wchar_t));
  const char* bytes = reinterpret_cast<const char*>(contents.c_str());
  BOOL error = WriteFile(f, bytes, bytes_to_write, &bytes_written, NULL);
  if (error == FALSE || bytes_written != bytes_to_write) {
    MessageBox(NULL, L"writing to file failed!", L"error", 0);
  }
  CloseHandle(f);
}

template <class T>
class ComObject {
 public:
  ~ComObject() {
    if (ptr_) ptr_->Release();
  }
  T* operator->() { return ptr_; }
  T* get() { return ptr_; }
  T** pp() { return &ptr_; }

 private:
  T* ptr_{nullptr};
};

bool CheckInternetConnection() {
  ComObject<INetworkListManager> network_list;
  HRESULT res = CoCreateInstance(CLSID_NetworkListManager, NULL, CLSCTX_ALL,
                                 IID_PPV_ARGS(network_list.pp()));
  if (FAILED(res)) return false;
  NLM_CONNECTIVITY con = NLM_CONNECTIVITY_DISCONNECTED;
  res = network_list->GetConnectivity(&con);
  if (FAILED(res)) return false;
  int kInternet =
      NLM_CONNECTIVITY_IPV4_INTERNET | NLM_CONNECTIVITY_IPV6_INTERNET;
  return (con & kInternet);
}

bool UnZipFile(const wchar_t* src_zip, const wchar_t* dst_dir) {
  BSTR source = SysAllocString(src_zip);
  BSTR dest = SysAllocString(dst_dir);

  ComObject<IShellDispatch> dispatch;
  ComObject<Folder> from_folder;
  ComObject<Folder> to_folder;
  ComObject<FolderItems> folder_items;
  ComObject<FolderItem> item;
  bool result = false;  // Assume error at first.

  do {
    HRESULT res;
    res = CoCreateInstance(CLSID_Shell, NULL, CLSCTX_INPROC_SERVER,
                           IID_PPV_ARGS(dispatch.pp()));
    if (FAILED(res)) break;
    VARIANT to_dir;
    VariantInit(&to_dir);
    to_dir.vt = VT_BSTR;
    to_dir.bstrVal = dest;
    res = dispatch->NameSpace(to_dir, to_folder.pp());
    if (FAILED(res)) break;

    VARIANT from_file;
    VariantInit(&from_file);
    from_file.vt = VT_BSTR;
    from_file.bstrVal = source;
    res = dispatch->NameSpace(from_file, from_folder.pp());
    if (FAILED(res)) break;

    res = from_folder->Items(folder_items.pp());
    if (FAILED(res)) break;

    VARIANT options;
    VariantInit(&options);
    options.vt = VT_I4;
    // Like FOF_NO_UI, but with progress bar.
    options.lVal = FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_NOCONFIRMMKDIR;

    VARIANT items;
    VariantInit(&items);
    items.vt = VT_DISPATCH;
    items.pdispVal = folder_items.get();
    res = to_folder->CopyHere(items, options);
    result = true;  // If we got here, all's good.
  } while (false);
  SysFreeString(source);
  SysFreeString(dest);
  return result;
}

bool MoveDirectoryContents(const std::wstring& from, const std::wstring& to) {
  if (from.length() >= MAX_PATH - 4) return false;
  SHFILEOPSTRUCT op = {0};
  wchar_t from_buf[MAX_PATH];
  wchar_t to_buf[MAX_PATH];
  std::memcpy(from_buf, from.c_str(), from.size() * sizeof(wchar_t));
  size_t i = from.size();
  if (from_buf[i - 1] != '\\') from_buf[i++] = '\\';
  from_buf[i++] = '*';
  from_buf[i++] = 0;
  from_buf[i++] = 0;
  std::memcpy(to_buf, to.c_str(), to.size() * sizeof(wchar_t));
  i = to.size();
  if (to_buf[i - 1] != '\\') to_buf[i++] = '\\';
  to_buf[i++] = 0;
  to_buf[i++] = 0;
  op.wFunc = FO_MOVE;
  op.hwnd = 0;
  op.fFlags = FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_NOCONFIRMMKDIR;
  op.pFrom = from_buf;
  op.pTo = to_buf;
  return SHFileOperation(&op) == 0;
}

// Stateful application lifecycle.

class MainWindow {
 public:
  explicit MainWindow(HINSTANCE instance) : instance_(instance) {}
  ~MainWindow() { DeleteObject(font_); }

  bool Init(int nCmdShow) {
    // Load resources.
    NONCLIENTMETRICS metrics = {};
    metrics.cbSize = sizeof(metrics);
    SystemParametersInfo(SPI_GETNONCLIENTMETRICS, metrics.cbSize, &metrics, 0);
    font_ = CreateFontIndirect(&metrics.lfCaptionFont);

    cursor_wait_ = LoadCursor(NULL, IDC_WAIT);
    cursor_default_ = LoadCursor(NULL, IDC_ARROW);

    // Detect preferred language.
    {
      ULONG num_langs;
      static constexpr DWORD buf_size = 80;
      wchar_t buf[buf_size];
      ULONG written = buf_size;
      bool result = GetUserPreferredUILanguages(MUI_LANGUAGE_NAME, &num_langs,
                                                buf, &written);
      if (result) {
        lang_.reset(new Lang(buf, written));
      } else {
        lang_.reset(new Lang(L"", 0));
      }
    }

    // Create actual window.
    static constexpr DWORD kStyle =
        WS_BORDER | WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX;
    HWND parent = NULL;
    HMENU menu = NULL;
    int x = CW_USEDEFAULT, y = CW_USEDEFAULT;
    h_wnd_ = CreateWindowExW(WS_EX_OVERLAPPEDWINDOW, szWindowClass,
                             L"Weinkeller Manager", kStyle, x, y, kWindowWidth,
                             kWindowHeight, parent, menu, instance_, NULL);
    if (!h_wnd_) {
      MessageBoxW(NULL, L"Call to CreateWindow failed!", L"Weinkeller Manager",
                  NULL);
      return false;
    }

    // Initialize internal state.
    constexpr size_t kBufSize = MAX_PATH;
    wchar_t basedir_buffer[kBufSize];
    DWORD written;
    written = GetCurrentDirectory(kBufSize, basedir_buffer);
    if (written == 0 || written > kBufSize) return 1;
    std::wstring basedir(basedir_buffer);
    saved_basedir_filename_ = basedir + L"\\WeinkellerManager_target_dir.txt";
    if (FileExists(saved_basedir_filename_)) {
      basedir = ReadFileW(saved_basedir_filename_);
    }
    have_internet_ = CheckInternetConnection();
    if (have_internet_) {
      latest_python_ = GetPythonVersion();
      latest_weinkeller_ = GetLatestWeinkellerVersion();
    }
    SetNewBasedir(basedir);

    ShowWindow(h_wnd_, nCmdShow);
    UpdateWindow(h_wnd_);
    return true;
  }

  LRESULT ClickSelectPath() {
    wchar_t* path = nullptr;
    ComObject<IFileDialog> dialog;
    ComObject<IShellItem> chosen_item;
    ComObject<IShellItem> default_path;
    do {
      HRESULT res =
          CoCreateInstance(CLSID_FileOpenDialog, NULL, CLSCTX_INPROC_SERVER,
                           IID_PPV_ARGS(dialog.pp()));
      if (FAILED(res)) break;
      DWORD dwOptions;
      res = dialog->GetOptions(&dwOptions);
      if (FAILED(res)) break;
      dialog->SetOptions(dwOptions | FOS_PICKFOLDERS);
      res = SHCreateItemFromParsingName(basedir_.c_str(), NULL,
                                        IID_PPV_ARGS(default_path.pp()));
      if (FAILED(res)) break;
      dialog->SetDefaultFolder(default_path.get());
      res = dialog->Show(NULL);
      if (FAILED(res)) break;
      res = dialog->GetResult(chosen_item.pp());
      if (FAILED(res)) break;
      res = chosen_item->GetDisplayName(SIGDN_DESKTOPABSOLUTEPARSING, &path);
      if (FAILED(res)) break;
    } while (false);
    if (!path) return 0;
    std::wstring new_basedir(path);
    SetNewBasedir(new_basedir);
    WriteFile(saved_basedir_filename_, new_basedir);
    CoTaskMemFree(path);
    return 0;
  }

  LRESULT ClickInstall() {
    if (weinkeller_present_ && !have_weinkeller_update_ &&  // --
        python_present_ && !have_python_update_) {
      return 0;
    }
    EnableWindow(h_wnd_, false);
    SetCursor(cursor_wait_);

    if (!weinkeller_present_ || have_weinkeller_update_) {
      bool result = InstallWeinkeller();
      if (!result) {
        MessageBox(h_wnd_, lang_->Get(Lang::kErrorInstallWine), L"Error", 0);
      }
    }
    if (!python_present_ || have_python_update_) {
      bool result = InstallPython();
      if (!result) {
        MessageBox(h_wnd_, lang_->Get(Lang::kErrorInstallPython), L"Error", 0);
      }
    }
    EnableWindow(h_wnd_, true);
    SetCursor(cursor_default_);
    return 0;
  }

    LRESULT ClickRunPython() {
    STARTUPINFO si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));
    const wchar_t binary[] = L"\\python.exe";
    const size_t binary_len = wcslen(binary);
    const wchar_t file[] = L"start.py --headless";
    const size_t file_len = wcslen(file);
    const std::wstring& py = python_dir_;
    // Extra chars: 2 quotes, space, trailing zero.
    size_t cmd_size = py.length() + binary_len + file_len + 4;
    wchar_t* cmd = new wchar_t[cmd_size];
    size_t i = 0;
    cmd[i++] = L'"';
    for (size_t j = 0; j < py.size(); j++) cmd[i++] = py.at(j);
    for (size_t j = 0; j < binary_len; j++) cmd[i++] = binary[j];
    cmd[i++] = L'"';
    cmd[i++] = L' ';
    for (size_t j = 0; j < file_len; j++) cmd[i++] = file[j];
    cmd[i++] = 0;
    const wchar_t* directory = weinkeller_dir_.c_str();
    if (!CreateProcessW(NULL, cmd, NULL, NULL, FALSE, 0, NULL,
                        directory, &si, &pi)) {
      MessageBox(NULL, lang_->Get(Lang::kErrorStartServer), L"Error", 0);
      return 0;
    }
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    return 0;
  }

 private:
  static constexpr int kX = 11;
  static constexpr int kY = 11;
  static constexpr int kYGap = 23;
  static constexpr int kButtonHeight = 24;
  static constexpr int kButtonWidth = 162;

  static constexpr int kWindowWidth = 374;
  static constexpr int kWindowHeight = 186;

  static constexpr int kX2 = kX + kButtonWidth + 7;
  static constexpr int kX3 = 262;  // "Quit" and "Browse" buttons.
  static constexpr int kY2 = kY + kButtonHeight + kYGap;
  static constexpr int kBottomY = kY2 + kButtonHeight + kYGap;
  static constexpr int kWideButtonWidth = kButtonWidth * 2 + 7;

  static constexpr int kDefaultDpi = 96;

  int Scale(int points) { return points * dpi_ / kDefaultDpi; }

  HWND AddButton(Lang::StringId label, int id, int x, int y, int width,
                 DWORD extra_style = 0) {
    int height = Scale(kButtonHeight);
    const wchar_t* label_str = lang_->Get(label);
    HWND button = CreateWindow(
        WC_BUTTON, label_str, WS_VISIBLE | WS_CHILD | WS_TABSTOP | extra_style,
        x, y, width, height, h_wnd_, (HMENU)id, instance_, NULL);
    SendMessage(button, WM_SETFONT, (WPARAM)font_, MAKELPARAM(TRUE, 0));
    return button;
  }

  void SetNewBasedir(const std::wstring& new_basedir) {
    basedir_ = new_basedir;
    python_dir_ = basedir_ + L"\\python";
    python_version_file_ = python_dir_ + L"\\python_version.txt";
    weinkeller_dir_ = basedir_ + L"\\weinkeller";
    weinkeller_version_file_ = weinkeller_dir_ + L"\\weinkeller_version.txt";
    python_present_ = FileExists(python_version_file_);
    weinkeller_present_ = FileExists(weinkeller_version_file_);

    if (python_present_) {
      std::string present = ReadFile(python_version_file_);
      have_python_update_ = have_internet_ && (present != latest_python_);
    }
    if (weinkeller_present_) {
      std::string present = ReadFile(weinkeller_version_file_);
      have_weinkeller_update_ =
          have_internet_ && (present != latest_weinkeller_);
    }
    UpdateUI();
  }

  void UpdateUI() {
    dpi_ = GetDpiForWindow(h_wnd_);
    SetWindowPos(h_wnd_, NULL, CW_USEDEFAULT, CW_USEDEFAULT,
                 Scale(kWindowWidth), Scale(kWindowHeight),
                 SWP_NOZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS | SWP_NOMOVE);
    if (python_present_ && weinkeller_present_) {
      ShowDefaultUI();
      bool have_update = have_python_update_ || have_weinkeller_update_;
      EnableWindow(h_install_button_, have_update);
      if (have_weinkeller_update_) {
        SendMessage(h_install_button_, WM_SETTEXT, (WPARAM)0,
                    (LPARAM)lang_->Get(Lang::kUpdateWine));
      } else if (have_python_update_) {
        SendMessage(h_install_button_, WM_SETTEXT, (WPARAM)0,
                    (LPARAM)lang_->Get(Lang::kUpdatePython));
      } else {
        SendMessage(h_install_button_, WM_SETTEXT, (WPARAM)0,
                    (LPARAM)lang_->Get(Lang::kNoUpdates));
      }
    } else {
      ShowPathChooser();
      SendMessage(h_path_edit_, WM_SETTEXT, (WPARAM)0,
                  (LPARAM)basedir_.c_str());
    }
  }

  void ShowPathChooser() {
    if (state_ == UiState::kPathChooser) return;
    // Path: [______________] (...)
    h_path_label_ = CreateWindowW(WC_STATIC, lang_->Get(Lang::kPath),
                                  WS_VISIBLE | WS_CHILD | SS_SIMPLE, Scale(kX), Scale(kY + 3),
                                  Scale(30), Scale(13), h_wnd_, NULL, instance_, NULL);
    SendMessage(h_path_label_, WM_SETFONT, (WPARAM)font_, MAKELPARAM(TRUE, 0));
    int edit_height = Scale(kButtonHeight - 2);
    h_path_edit_ = CreateWindowW(
        WC_EDIT, L"", WS_VISIBLE | WS_BORDER | WS_CHILD | ES_LEFT | ES_READONLY,
        Scale(48), Scale(kY + 1), Scale(207), edit_height, h_wnd_, NULL, instance_, NULL);
    SendMessage(h_path_edit_, WM_SETFONT, (WPARAM)font_, MAKELPARAM(TRUE, 0));

    h_browse_button_ = AddButton(Lang::kBrowse, IDC_BTN_PATH, Scale(kX3), Scale(kY), Scale(80));

    // (  Install  )
    h_install_button_ =
        AddButton(Lang::kInstall, IDC_BTN_INSTALL, Scale(kX), Scale(kY2), Scale(kWideButtonWidth));
    if (!have_internet_) {
      EnableWindow(h_install_button_, false);
      SendMessage(h_install_button_, WM_SETTEXT, (WPARAM)0,
                  (LPARAM)lang_->Get(Lang::kOffline));
    }
    ShowBottomUI();
    state_ = UiState::kPathChooser;
  }

  void ShowBottomUI() {
    // Version: ABC     ( Quit)
    h_version_label_ = CreateWindowW(
        WC_STATIC, szVersionString, WS_VISIBLE | WS_CHILD | SS_SIMPLE,
        Scale(kX), Scale(kBottomY + 4), Scale(kButtonWidth), Scale(13), h_wnd_,
        NULL, instance_, NULL);
    SendMessage(h_version_label_, WM_SETFONT, (WPARAM)font_,
                MAKELPARAM(TRUE, 0));
    AddButton(Lang::kQuit, IDC_BTN_QUIT, Scale(kX3), Scale(kBottomY), Scale(80));
  }

  void ShowDefaultUI() {
    if (state_ == UiState::kDefault) return;
    if (state_ == UiState::kPathChooser) {
      DestroyWindow(h_path_label_);
      DestroyWindow(h_path_edit_);
      DestroyWindow(h_browse_button_);
      h_path_label_ = nullptr;
      h_path_edit_ = nullptr;
      h_browse_button_ = nullptr;
    }

    // (  Update  )
    if (state_ == UiState::kPathChooser) {
      MoveWindow(h_install_button_, Scale(kX), Scale(kY),
                 Scale(kWideButtonWidth), Scale(kButtonHeight),
                 TRUE);
      SendMessage(h_install_button_, WM_SETTEXT, (WPARAM)0,
                  (LPARAM)lang_->Get(Lang::kNoUpdates));
    } else {
      h_install_button_ = AddButton(Lang::kNoUpdates, IDC_BTN_INSTALL, Scale(kX), Scale(kY),
                                    Scale(kWideButtonWidth));
      ShowBottomUI();
    }

    // ( Start server)  ( Open in browser)
    h_server_button_ = AddButton(Lang::kStartServer, IDC_BTN_SERVER, Scale(kX), Scale(kY2),
                                 Scale(kButtonWidth), BS_DEFPUSHBUTTON);
    h_browser_button_ =
        AddButton(Lang::kOpenBrowser, IDC_BTN_BROWSER, Scale(kX2), Scale(kY2), Scale(kButtonWidth));
    state_ = UiState::kDefault;
  }

  bool InstallWeinkeller() {
    std::wstring file = basedir_ + L"\\weinkeller.zip";
    if (!FolderExists(weinkeller_dir_)) {
      std::filesystem::create_directories(weinkeller_dir_);
    }
    bool result = DownloadFile(kWeinkellerUrl, file.c_str());
    if (!result) return result;
    result = UnZipFile(file.c_str(), weinkeller_dir_.c_str());
    if (!result) return result;
    std::wstring extracted = weinkeller_dir_ + L"\\weinkeller-main\\";
    result = MoveDirectoryContents(extracted, weinkeller_dir_);
    if (!result) return result;
    result = RemoveDirectory(extracted.c_str());
    if (!result) return result;
    DeleteFile(file.c_str());
    WriteFile(weinkeller_version_file_, latest_weinkeller_);
    weinkeller_present_ = true;
    have_weinkeller_update_ = false;
    UpdateUI();
    return result;
  }

  std::string PythonVersionFromUrl(std::string url) {
    size_t offset = url.find("python-");
    if (offset == std::string::npos) return {};
    bool have_dot = false;
    const char* pos = url.c_str() + offset + strlen("python-");
    std::string result = "python";
    while (true) {
      char c = *(pos++);
      if (c >= '0' && c <= '9') {
        result += c;
        continue;
      }
      if (c == '.' && !have_dot) {
        have_dot = true;
        continue;
      }
      break;
    }
    return result;
  }

  bool InstallPython() {
    std::wstring url(latest_python_.begin(), latest_python_.end());
    std::wstring file = basedir_ + L"\\python.zip";
    if (!FolderExists(python_dir_)) {
      std::filesystem::create_directories(python_dir_);
    }
    bool result = true;
    if (!FileExists(file.c_str())) {
      result = DownloadFile(url.c_str(), file.c_str());
      if (!result) return result;
    }
    result = UnZipFile(file.c_str(), python_dir_.c_str());
    if (!result) return result;
    std::string version = PythonVersionFromUrl(latest_python_);
    std::wstring wversion(version.begin(), version.end());
    std::wstring path_file = python_dir_ + L"\\" + wversion + L"._pth";

    const char* mid = ".zip\n.\n";
    size_t buf_size =
        version.length() + strlen(mid) + weinkeller_dir_.length() + 2;
    char* buf = new char[buf_size];
    size_t i = 0;
    for (size_t j = 0; j < version.length(); j++) buf[i++] = version.at(j);
    for (size_t j = 0; j < strlen(mid); j++) buf[i++] = mid[j];
    for (size_t j = 0; j < weinkeller_dir_.length(); j++) {
      buf[i++] = weinkeller_dir_.at(j);
    }
    buf[i++] = '\n';
    buf[i++] = 0;
    std::string path_file_contents(buf, i);
    WriteFile(path_file, path_file_contents);
    WriteFile(python_version_file_, latest_python_);
    DeleteFile(file.c_str());
    python_present_ = true;
    have_python_update_ = false;
    UpdateUI();
    return result;
  }

  enum class UiState {
    kUninitialized,
    kPathChooser,
    kDefault,
  };

  HINSTANCE instance_{nullptr};
  HFONT font_{nullptr};
  HCURSOR cursor_wait_{nullptr};
  HCURSOR cursor_default_{nullptr};
  std::unique_ptr<Lang> lang_{nullptr};

  // UI elements.
  UiState state_{UiState::kUninitialized};
  HWND h_wnd_{nullptr};
  HWND h_path_label_{nullptr};
  HWND h_path_edit_{nullptr};
  HWND h_browse_button_{nullptr};
  HWND h_install_button_{nullptr};
  HWND h_server_button_{nullptr};
  HWND h_browser_button_{nullptr};
  HWND h_version_label_{nullptr};
  int dpi_{kDefaultDpi};

  // Internal state.
  std::wstring basedir_;
  std::wstring saved_basedir_filename_;
  std::wstring python_dir_;
  std::wstring python_version_file_;
  std::wstring weinkeller_dir_;
  std::wstring weinkeller_version_file_;
  std::string latest_python_;
  std::string latest_weinkeller_;
  bool have_internet_{false};
  bool python_present_{false};
  bool weinkeller_present_{false};
  bool have_python_update_{false};
  bool have_weinkeller_update_{false};
};

LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam,
                         LPARAM lParam) {
  switch (message) {
    case WM_COMMAND: {
      int wmId = LOWORD(wParam);
      int wmEvent = HIWORD(wParam);
      if (wmEvent != BN_CLICKED) break;
      switch (wmId) {
        case IDC_BTN_PATH:
          return g_mainwin->ClickSelectPath();
        case IDC_BTN_INSTALL:
          return g_mainwin->ClickInstall();
        case IDC_BTN_SERVER:
          return g_mainwin->ClickRunPython();
        case IDC_BTN_BROWSER:
          ShellExecute(NULL, NULL, L"http://localhost:7887", 0, 0,
                       SW_SHOWNORMAL);
          return 0;
        case IDC_BTN_QUIT:
          SendMessage(hWnd, WM_CLOSE, 0, 0);
          return 0;
        default:
          break;
      }
      break;
    }

    case WM_PAINT: {
      PAINTSTRUCT ps;
      HDC hdc = BeginPaint(hWnd, &ps);
      EndPaint(hWnd, &ps);
      return 0;
    }
    case WM_DESTROY:
      PostQuitMessage(0);
      return 0;
    default:
      break;
  }
  return DefWindowProc(hWnd, message, wParam, lParam);
}

int WINAPI WinMain(_In_ HINSTANCE hInstance, _In_opt_ HINSTANCE hPrevInstance,
                   _In_ LPSTR lpCmdLine, _In_ int nCmdShow) {
  WNDCLASSEX wcex;
  wcex.cbSize = sizeof(WNDCLASSEX);
  wcex.style = CS_HREDRAW | CS_VREDRAW;
  wcex.lpfnWndProc = WndProc;
  wcex.cbClsExtra = 0;
  wcex.cbWndExtra = 0;
  wcex.hInstance = hInstance;
  wcex.hIcon = LoadIcon(wcex.hInstance, IDI_APPLICATION);
  wcex.hCursor = LoadCursor(NULL, IDC_ARROW);
  wcex.hbrBackground = (HBRUSH)(COLOR_WINDOW);
  wcex.lpszMenuName = NULL;
  wcex.lpszClassName = szWindowClass;
  wcex.hIconSm = LoadIcon(wcex.hInstance, IDI_APPLICATION);

  if (!RegisterClassEx(&wcex)) {
    MessageBox(NULL, L"Call to RegisterClassEx failed!", L"Error", NULL);
    return 1;
  }
  HRESULT com_result = CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
  if (com_result != S_OK) {
    MessageBox(NULL, L"Call to CoInitializeEx failed!", L"Error", NULL);
    CoUninitialize();
    return 1;
  }

  g_mainwin = new MainWindow(hInstance);
  if (!g_mainwin->Init(nCmdShow)) {
    CoUninitialize();
    return 1;
  }

  MSG msg;
  while (GetMessage(&msg, NULL, 0, 0)) {
    TranslateMessage(&msg);
    DispatchMessage(&msg);
  }

  CoUninitialize();
  return (int)msg.wParam;
}
