; ============================================================
; Inno Setup Script — JRT Tech ANALIST Pro 3.4
; Optimized Windows Installer (wraps PyInstaller onedir output)
;
; Build:  iscc installer.iss
; Input:  dist\JRT Tech ANALIST Pro\  (PyInstaller onedir output)
; Output: Output\JRT_Tech_ANALIST_Pro_v3.4_Setup.exe
; ============================================================

#define MyAppName      "JRT Tech ANALIST Pro"
#define MyAppVersion   "3.4"
#define MyAppPublisher "JRT Tech Studio"
#define MyAppURL       "https://github.com/whynyou88-gif/ecu-honda-jrt-tech"
#define MyAppExeName   "JRT Tech ANALIST Pro.exe"
#define MyAppId        "{{C6B579E1-835A-4A73-A3B9-281C4F98E1A3}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; License shown during installation
LicenseFile=EULA_LICENSE.txt

; Output installer name
OutputDir=Output
OutputBaseFilename=JRT_Tech_ANALIST_Pro_v{#MyAppVersion}_Setup

; Compression — lzma2/ultra64 compresses the INSTALLER .exe only.
; After installation, files on disk are uncompressed → exe starts instantly.
Compression=lzma2/ultra64
SolidCompression=yes

; Visual styling
WizardStyle=modern
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

; Architecture
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible

; Privileges — install to user folder without UAC prompt.
; Falls back to {localappdata} if {autopf} requires admin.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; Uninstaller (enabled by default, explicitly keep it)
Uninstallable=yes
CreateUninstallRegKey=yes

; Misc
AllowNoIcons=yes
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; Copy the entire PyInstaller onedir output folder recursively
Source: "dist\JRT Tech ANALIST Pro\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start Menu shortcut
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
; Desktop shortcut (optional task)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Launch app immediately after installation completes
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up logs and temp files created at runtime
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\__pycache__"
Type: files; Name: "{app}\*.log"
