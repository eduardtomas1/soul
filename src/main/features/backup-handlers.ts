import type { IpcRouter } from "../ipc";
import type { BackupService } from "../backup/service";
import type { FileGrants } from "../file-grants";

export function registerBackupHandlers(router: IpcRouter, backup: BackupService, files: FileGrants): void {
  router.handle("backup.status", () => backup.status());
  router.handle("backup.setPassphrase", ({ passphrase }) => backup.setPassphrase(passphrase), "backup");
  router.handle("backup.setMode", ({ mode }) => backup.setMode(mode), "backup");
  router.handle("backup.exportToFile", () => backup.exportToFile(), "backup");
  router.handle("backup.pickRestoreFile", async () => {
    const filePath = await backup.pickRestoreFile();
    return filePath === null ? null : files.grant(filePath);
  });
  router.handle("backup.inspectFile", ({ filePath }) => backup.inspectFile(files.require(filePath)));
  router.handle("backup.restore", (request) => {
    if (request.filePath !== undefined) files.require(request.filePath);
    return backup.restore(request);
  });
  router.handle("backup.drive.setClient", (client) => backup.setDriveClient(client), "backup");
  router.handle("backup.drive.connect", () => backup.connectDrive(), "backup");
  router.handle("backup.drive.cancelConnect", () => {
    backup.cancelConnect();
  });
  router.handle("backup.drive.disconnect", () => backup.disconnectDrive(), "backup");
  router.handle("backup.drive.uploadNow", () => backup.uploadNow(), "backup");
}
