import { ArrowSquareOut, CloudArrowUp, DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import type { BackupEvent, BackupStatus } from "@shared/contracts/backup";
import { invoke, subscribe } from "@/lib/bridge";
import { useQuery } from "@/lib/query";
import { useToasts } from "@/lib/toasts";
import { formatTimestamp } from "@/lib/format";
import { Button, Field, InlineError, Pill, Segmented } from "@/components/primitives";
import { ClientModal, PassphraseModal, RestoreModal, type RestoreRequest } from "./backup-modals";
import { SettingsCard } from "./settings-card";

export function BackupSection() {
  const status = useQuery("backup.status", undefined, ["backup"]);
  const { push } = useToasts();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passphraseModal, setPassphraseModal] = useState(false);
  const [restoreModal, setRestoreModal] = useState<RestoreRequest | null>(null);
  const [clientModal, setClientModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const cancelRequested = useRef(false);

  useEffect(() => subscribe<BackupEvent>("backup.event", (event) => {
    if (event.kind === "progress") setProgress(event.label);
    if (event.kind === "uploaded") {
      setProgress(null);
      push({ title: "Backup uploaded to Google Drive", tone: "success" });
    }
    if (event.kind === "failed") {
      setProgress(null);
      setError(event.message);
    }
  }), [push]);

  const act = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setProgress(null);
    }
  };

  const connect = async () => {
    setError(null);
    setConnecting(true);
    try {
      await invoke("backup.drive.connect");
    } catch (caught) {
      if (!cancelRequested.current) setError(caught instanceof Error ? caught.message : "Could not connect to Google Drive.");
    } finally {
      cancelRequested.current = false;
      setConnecting(false);
      setProgress(null);
    }
  };

  const cancelConnect = () => {
    cancelRequested.current = true;
    void invoke("backup.drive.cancelConnect");
  };

  const data: BackupStatus | null = status.data;
  if (!data) return <div className="h-40 rounded-card bg-surface-2" />;

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard title="Backup file" description="A single .soul file with everything: routines, habits, finances, milestones and conversations. Never your passwords or Google tokens.">
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<DownloadSimple size={14} />} onClick={() => void act(async () => {
            const result = await invoke("backup.exportToFile");
            if (result) push({ title: "Backup exported", description: result.path, tone: "success" });
          })}>Export a backup</Button>
          <Button icon={<UploadSimple size={14} />} onClick={() => void act(async () => {
            const filePath = await invoke("backup.pickRestoreFile");
            if (!filePath) return;
            const info = await invoke("backup.inspectFile", { filePath });
            setRestoreModal({ source: "file", filePath, encrypted: info.encrypted });
          })}>Restore from a file</Button>
          {data.lastLocalExportAt && <span className="ml-auto text-[12px] text-muted">Last export {formatTimestamp(data.lastLocalExportAt)}</span>}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium">Encrypt backups with a passphrase {data.passphraseSet && <Pill tone="mint">On</Pill>}</div>
            <div className="mt-0.5 text-[12.5px] text-muted">AES-256. Anyone restoring the file will need the passphrase. Soul remembers it in your keychain so automatic uploads keep working.</div>
          </div>
          <Button size="sm" onClick={() => setPassphraseModal(true)}>{data.passphraseSet ? "Change" : "Set passphrase"}</Button>
        </div>
      </SettingsCard>
      <SettingsCard title="Google Drive" description="Soul keeps exactly one backup file in your Drive and overwrites it each time. Your Google OAuth client and tokens stay in this computer's keychain.">
        {!data.drive.clientConfigured ? (
          <div className="flex flex-col gap-3">
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] text-muted">
              <li>Create a project in the <button type="button" className="inline-flex items-center gap-0.5 text-link hover:underline" onClick={() => void invoke("app.openExternal", { url: "https://console.cloud.google.com/apis/credentials" })}>Google Cloud console <ArrowSquareOut size={12} /></button> and enable the Google Drive API.</li>
              <li>Create an OAuth client of type <strong className="text-text">Desktop app</strong>. Add yourself as a test user if the app is in testing.</li>
              <li>Paste the client ID and secret here. They never leave this computer.</li>
            </ol>
            <Button variant="primary" className="self-start" onClick={() => setClientModal(true)}>Add Google client</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className={clsx("h-2 w-2 rounded-full", data.drive.connected ? "bg-success" : "bg-faint")} />
              <div className="flex-1 text-[13px]">
                {data.drive.connected ? <>Connected{data.drive.accountEmail ? <span className="text-muted"> as {data.drive.accountEmail}</span> : null}</> : "Client configured, not connected"}
                <div className="text-[12px] text-muted">{data.drive.lastUploadAt ? `Last upload ${formatTimestamp(data.drive.lastUploadAt)} · “${data.drive.fileName}”` : "No upload yet"}</div>
              </div>
              {data.drive.connected ? (
                <>
                  <Button size="sm" icon={<CloudArrowUp size={14} />} variant="primary" loading={data.busy} onClick={() => void act(() => invoke("backup.drive.uploadNow"))}>Upload now</Button>
                  <Button size="sm" onClick={() => void act(() => invoke("backup.drive.disconnect"))}>Disconnect</Button>
                </>
              ) : (
                <Button size="sm" variant="primary" loading={data.busy || connecting} onClick={() => void connect()}>Connect Google Drive</Button>
              )}
            </div>
            {data.drive.connected && (
              <Field label="Upload automatically" group>
                <Segmented value={data.mode} onChange={(mode) => void act(() => invoke("backup.setMode", { mode }))} options={[{ value: "off", label: "Only manually" }, { value: "daily", label: "Once a day" }, { value: "on-change", label: "After changes" }]} />
              </Field>
            )}
            {data.drive.connected && <Button size="sm" variant="ghost" className="self-start" onClick={() => setRestoreModal({ source: "drive", encrypted: data.passphraseSet })}>Restore from Google Drive…</Button>}
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <button type="button" className="underline decoration-border-strong hover:text-text" onClick={() => setClientModal(true)}>Change client</button>
              <span>·</span>
              <button type="button" className="underline decoration-border-strong hover:text-text" onClick={() => void act(() => invoke("backup.drive.setClient", null))}>Remove client and tokens</button>
            </div>
          </div>
        )}
        {progress && (
          <div className="flex items-center gap-2 text-[12.5px] text-muted">
            <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
            {progress}
            {connecting && <Button size="sm" variant="ghost" onClick={cancelConnect}>Cancel</Button>}
          </div>
        )}
        <InlineError message={error ?? data.drive.lastError} />
      </SettingsCard>
      {passphraseModal && <PassphraseModal hasPassphrase={data.passphraseSet} onClose={() => setPassphraseModal(false)} />}
      {restoreModal && <RestoreModal request={restoreModal} onClose={() => setRestoreModal(null)} />}
      {clientModal && <ClientModal onClose={() => setClientModal(false)} />}
    </div>
  );
}
