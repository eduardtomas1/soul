Soul's first desktop release brings routines, habits, a daily journal, personal measures, a quick Log window for any day, milestones, euro finances with charts and forecasts, local backups, optional Google Drive backup and an assistant that uses your existing Claude Code or Codex sign-in.

Download the file for your computer: `arm64` for Apple silicon Macs and ARM Windows or Linux machines, `x64` for Intel and AMD.

- **Mac:** open the `.dmg` and drag Soul to Applications. This build is ad-hoc signed and is not notarized. After the first blocked launch, open System Settings → Privacy & Security → Open Anyway, then confirm.
- **Windows:** run the `.exe` installer. It is unsigned; if SmartScreen appears, choose More info → Run anyway after checking the download.
- **Linux:** make the `.AppImage` executable and open it. If FUSE is unavailable, run `./Soul-0.1.0-linux-<arch>.AppImage --appimage-extract-and-run` from a terminal.

`SHA256SUMS` lists every installer's SHA-256. On Mac use `shasum -a 256 <file>`, on Linux `sha256sum <file>`, or in PowerShell `Get-FileHash <file> -Algorithm SHA256`, and compare with the matching line.

Your data stays on your computer. If you ran Soul from source before, export a backup from Settings first. Claude Code and Codex are optional and must be installed and signed in separately. Google Drive backup requires your own Google client configuration. There is no automatic updater; future versions are installed from Releases.
