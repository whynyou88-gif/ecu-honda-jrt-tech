// ============================================================
// installer.nsi — NSIS Windows Installer Script
// Generates standard Windows Setup Wizard (JRT_Tech_ANALIST_Pro_Setup.exe)
// ============================================================

!define APP_NAME "JRT Tech ANALIST Pro"
!define APP_VERSION "3.4.0"
!define APP_PUBLISHER "JRT Tech Studio"
!define APP_EXE "jrt-tech-native.exe"

Name "${APP_NAME}"
OutFile "../JRT_Tech_ANALIST_Pro_v3.4.0_Windows_Setup.exe"
InstallDir "$PROGRAMFILES64\JRT Tech ANALIST Pro"
RequestExecutionLevel admin

// UI Pages
Page directory
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  File "target\x86_64-pc-windows-msvc\release\jrt-tech-native.exe"
  
  // Desktop Shortcut
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  
  // Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\uninstall.exe"
  
  // Uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\*.*"
  RMDir "$SMPROGRAMS\${APP_NAME}"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
