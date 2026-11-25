; Pemasang Windows untuk Ruang Tulis GS.
; Membuat pintasan (Start menu, opsional desktop) yang membuka aplikasi sebagai jendela mandiri
; lewat Chrome atau Edge yang sudah ada. Data dan login Google memakai profil peramban itu,
; jadi masuk dengan Google tetap berfungsi dan mode offline ikut jalan.
#define AppName "Ruang Tulis GS"
#define AppUrl "https://gussohe.github.io/ruang-tulis-gs/"

[Setup]
AppId={{B7C1E9A2-4B0E-4E2B-9B54-6C1A5E7D2F31}
AppName={#AppName}
AppVersion=1.0.0
AppPublisher=Gus Sohe
DefaultDirName={autopf}\Ruang Tulis GS
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=RuangTulisGS-Setup
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Buat ikon di desktop"; GroupDescription: "Pintasan:"

[Files]
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{code:BrowserExe}"; Parameters: "--app={#AppUrl}"; IconFilename: "{app}\icon.ico"; Comment: "Ruang menulis dan perpustakaan draf"
Name: "{autodesktop}\{#AppName}"; Filename: "{code:BrowserExe}"; Parameters: "--app={#AppUrl}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{code:BrowserExe}"; Parameters: "--app={#AppUrl}"; Description: "Buka Ruang Tulis GS sekarang"; Flags: nowait postinstall skipifsilent

[Code]
function FirstExisting(const A, B, C, D: string): string;
begin
  Result := '';
  if FileExists(A) then Result := A
  else if FileExists(B) then Result := B
  else if FileExists(C) then Result := C
  else if FileExists(D) then Result := D;
end;

function BrowserExe(Param: string): string;
begin
  Result := FirstExisting(
    ExpandConstant('{commonpf}\Google\Chrome\Application\chrome.exe'),
    ExpandConstant('{localappdata}\Google\Chrome\Application\chrome.exe'),
    ExpandConstant('{commonpf32}\Microsoft\Edge\Application\msedge.exe'),
    ExpandConstant('{commonpf}\Microsoft\Edge\Application\msedge.exe'));
end;

function InitializeSetup(): Boolean;
begin
  Result := BrowserExe('') <> '';
  if not Result then
    MsgBox('Chrome atau Microsoft Edge tidak ditemukan. Pasang salah satunya dulu, lalu jalankan pemasang ini lagi.', mbError, MB_OK);
end;
