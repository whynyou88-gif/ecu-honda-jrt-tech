# ============================================================
# Inno Setup Script for JRT Tech ANALIST Pro 3.4
# Creates a Windows Standalone Setup Installer (.exe)
# ============================================================

[Setup]
AppId={{C6B579E1-835A-4A73-A3B9-281C4F98E1A3}
AppName=JRT Tech ANALIST Pro
AppVersion=3.4
AppPublisher=JRT Tech
AppPublisherURL=https://ftdichip.com
AppSupportURL=https://ftdichip.com
AppUpdatesURL=https://ftdichip.com
DefaultDirName={autopf}\JRT Tech ANALIST Pro
DefaultGroupName=JRT Tech ANALIST Pro
DisableProgramGroupPage=yes
LicenseFile=README.md
OutputBaseFilename=JRT_Tech_ANALIST_Pro_v3.4_Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\JRT Tech ANALIST Pro.exe
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "dist\JRT Tech ANALIST Pro\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\JRT Tech ANALIST Pro"; Filename: "{app}\JRT Tech ANALIST Pro.exe"
Name: "{autodesktop}\JRT Tech ANALIST Pro"; Filename: "{app}\JRT Tech ANALIST Pro.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\JRT Tech ANALIST Pro.exe"; Description: "{cm:LaunchProgram,JRT Tech ANALIST Pro}"; Flags: nowait postinstall skipifsilent
