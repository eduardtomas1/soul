Soul 0.0.1 is the first public release. It is a desktop app for logging your days: routines, habits, a daily journal, personal measures and money, with charts, a quick Log window for any day, light, dark and natural themes, local backups, optional Google Drive backup and an assistant that uses your existing Claude Code or Codex sign-in.

This release is for Windows and Linux. Download the file for your computer: `x64` (`x86_64` on Linux) for Intel and AMD processors, `arm64` for ARM machines such as Snapdragon laptops.

- **Windows:** run the `.exe` installer. It is not signed yet; if SmartScreen appears, choose More info → Run anyway after checking the download.
- **Linux:** make the `.AppImage` executable (`chmod +x Soul-0.0.1-linux-*.AppImage`) and open it. If FUSE is unavailable, start it with `--appimage-extract-and-run`. On Ubuntu 24.04 and later, if Soul closes right after it starts, AppArmor is blocking Chromium's sandbox: start it with `--no-sandbox`, which turns that sandbox off.

`SHA256SUMS` lists every installer's SHA-256. On Linux use `sha256sum <file>`, or in PowerShell `Get-FileHash <file> -Algorithm SHA256`, and compare the result with the matching line.

Your data stays on your computer. Claude Code and Codex are optional and must be installed and signed in separately. Google Drive backup needs your own Google client configuration. There is no automatic updater yet; new versions are installed from Releases and keep your data.
