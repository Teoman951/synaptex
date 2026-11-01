; Removes what SynapTeX downloaded. Project folders are never touched.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION "Also delete SynapTeX data (AI models, chats, checkpoints, LaTeX package cache)? Your project folders stay.$\r$\n$\r$\nAuch SynapTeX-Daten löschen (KI-Modelle, Chats, Checkpoints, LaTeX-Paket-Cache)? Deine Projektordner bleiben." /SD IDNO IDNO keepData
      SetShellVarContext current
      RMDir /r "$APPDATA\SynapTeX"
      RMDir /r "$APPDATA\synaptex"
      RMDir /r "$LOCALAPPDATA\TectonicProject"
    keepData:
  ${endIf}
!macroend
