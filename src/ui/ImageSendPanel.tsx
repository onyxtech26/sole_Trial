import { useState } from 'react';
import { Icon } from './Icon';
import { Btn, C, Hov, Modal, ModalFoot, ModalHead } from './kit';
import { copyImage, download } from '../utils/exports';

/**
 * WhatsApp's click-to-chat link (`wa.me/…?text=`) carries text only — there is
 * no URL parameter for media, so a template's images can never be attached
 * automatically the way the text is. This is the next best thing: it opens
 * right after the chat does, and copying an image to the clipboard lets the
 * operator paste it straight into the tab that just opened with one Ctrl/Cmd+V.
 */
export function ImageSendPanel({
  label, images, onClose,
}: { label: string; images: string[]; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const copy = async (url: string) => {
    setBusy(url);
    const ok = await copyImage(url);
    setBusy(null);
    return ok;
  };

  return (
    <Modal open onClose={onClose} width={420}>
      <ModalHead
        title="Send the images"
        sub={`${images.length} image${images.length === 1 ? '' : 's'} attached to “${label}” — WhatsApp links can't carry pictures, so copy each one across instead.`}
        onClose={onClose}
      />
      <div style={{
        padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 9,
        maxHeight: '52vh', overflowY: 'auto',
      }}>
        <p style={{ margin: 0, fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
          The chat just opened in another tab. Copy an image below, switch to that tab, and
          paste it (Ctrl/Cmd+V) into the message box.
        </p>
        {images.map((url, i) => (
          <div
            key={url}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              border: `1px solid ${C.lineSoft}`, borderRadius: 8, padding: 8,
            }}
          >
            <img
              src={url}
              alt={`Attachment ${i + 1}`}
              style={{
                width: 52, height: 52, flexShrink: 0, objectFit: 'cover',
                borderRadius: 6, border: `1px solid ${C.lineSoft}`, background: C.wash,
              }}
            />
            <span style={{ flex: 1, fontSize: 11.5, color: C.body }}>Image {i + 1}</span>
            <Btn
              small
              icon={busy === url ? 'spinner' : 'copy'}
              disabled={busy === url}
              onClick={() => { void copy(url); }}
            >
              Copy
            </Btn>
            <Hov
              as="button"
              type="button"
              title="Download instead"
              onClick={() => {
                void fetch(url)
                  .then(r => r.blob())
                  .then(b => download(`image-${i + 1}${extOf(b.type)}`, b, b.type));
              }}
              style={{
                width: 30, height: 30, flexShrink: 0, border: `1px solid ${C.line}`,
                background: C.panel, borderRadius: 6, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: C.body, padding: 0,
              }}
              hover={{ borderColor: '#c9ced7' }}
            >
              <Icon name="download" size={13} />
            </Hov>
          </div>
        ))}
      </div>
      <ModalFoot>
        <Btn variant="primary" onClick={onClose}>Done</Btn>
      </ModalFoot>
    </Modal>
  );
}

function extOf(mime: string): string {
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  return '.jpg';
}
