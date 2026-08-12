; ============================================================
; Inno Setup Script for JRT Tech ANALIST Pro 3.4 (Pure Native Slint)
; Generates Professional Windows Setup Wizard (JRT_Tech_ANALIST_Pro_v3.4.0_Windows_Setup.exe)
; ============================================================

[Setup]
AppId={{C6B579E1-835A-4A73-A3B9-281C4F98E1A3}
AppName=JRT Tech ANALIST Pro
AppVersion=3.4.0
AppPublisher=JRT Tech Studio
AppPublisherURL=https://github.com/whynyou88-gif/ecu-honda-jrt-tech
AppSupportURL=https://github.com/whynyou88-gif/ecu-honda-jrt-tech
AppUpdatesURL=https://github.com/whynyou88-gif/ecu-honda-jrt-tech
DefaultDirName={autopf}\JRT Tech ANALIST Pro
DefaultGroupName=JRT Tech ANALIST Pro
DisableProgramGroupPage=yes
LicenseFile=..\EULA_LICENSE.txt
OutputBaseFilename=JRT_Tech_ANALIST_Pro_v3.4.0_Windows_Setup
OutputDir=..
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\icon.ico
UninstallDisplayIcon={app}\jrt-tech-native.exe
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "target\x86_64-pc-windows-msvc\release\jrt-tech-native.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\EULA_LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\JRT Tech ANALIST Pro"; Filename: "{app}\jrt-tech-native.exe"; IconFilename: "{app}\jrt-tech-native.exe"
Name: "{autodesktop}\JRT Tech ANALIST Pro"; Filename: "{app}\jrt-tech-native.exe"; IconFilename: "{app}\jrt-tech-native.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\jrt-tech-native.exe"; Description: "{cm:LaunchProgram,JRT Tech ANALIST Pro}"; Flags: nowait postinstall skipifsilent
