import { useState } from "react";
import { invoke } from "@/lib/bridge";
import { Button, Field, InlineError, TextInput } from "@/components/primitives";
import { Modal } from "@/components/sheet";

export interface RestoreRequest {
  readonly source: "file" | "drive";
  readonly filePath?: string;
  readonly encrypted: boolean;
}

export function PassphraseModal({ hasPassphrase, onClose }: { hasPassphrase: boolean; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = async (passphrase: string | null) => {
    if (passphrase !== null && passphrase.length < 8) return setError("Use at least 8 characters.");
    if (passphrase !== null && passphrase !== confirm) return setError("The two entries do not match.");
    try {
      await invoke("backup.setPassphrase", { passphrase });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the passphrase.");
    }
  };
  return (
    <Modal open onClose={onClose} title={hasPassphrase ? "Change passphrase" : "Set a passphrase"} footer={<>{hasPassphrase && <Button variant="ghost" className="mr-auto" onClick={() => void save(null)}>Turn off encryption</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void save(value)}>Save</Button></>}>
      <Field label="Passphrase"><TextInput type="password" value={value} onChange={(event) => setValue(event.target.value)} autoFocus /></Field>
      <Field label="Repeat it"><TextInput type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></Field>
      <p className="text-[12px] text-muted">Backups made from now on use the new passphrase. Older files keep the one they were made with. If you lose it, the backup cannot be opened.</p>
      <InlineError message={error} />
    </Modal>
  );
}

export function RestoreModal({ request, onClose }: { request: RestoreRequest; onClose: () => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      await invoke("backup.restore", { source: request.source, ...(request.filePath ? { filePath: request.filePath } : {}), ...(passphrase ? { passphrase } : {}) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Restore failed.");
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Replace everything with this backup?" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={() => void restore()} loading={busy}>Restore and restart</Button></>}>
      <p className="text-[13px] text-muted">Your current data is copied aside first, then replaced with the backup. Soul restarts when it is done.</p>
      {request.filePath && <div className="break-all rounded-[6px] border border-border bg-surface-2 px-3 py-2 font-mono text-[12px]">{request.filePath}</div>}
      {request.encrypted && <Field label="Passphrase" hint="Leave empty to try the passphrase saved in your keychain."><TextInput type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoFocus /></Field>}
      <InlineError message={error} />
    </Modal>
  );
}

export function ClientModal({ onClose }: { onClose: () => void }) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      await invoke("backup.drive.setClient", { clientId: clientId.trim(), clientSecret: clientSecret.trim() });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the client.");
    }
  };
  return (
    <Modal open onClose={onClose} title="Google OAuth client" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void save()} disabled={clientId.trim().length < 10 || clientSecret.trim().length < 5}>Save</Button></>}>
      <Field label="Client ID"><TextInput value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="…apps.googleusercontent.com" autoFocus /></Field>
      <Field label="Client secret"><TextInput type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} /></Field>
      <p className="text-[12px] text-muted">Stored encrypted in your operating system keychain. Soul requests only the permission to manage files it created itself.</p>
      <InlineError message={error} />
    </Modal>
  );
}
