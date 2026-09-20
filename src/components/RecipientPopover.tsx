'use client';

import { useEffect, useRef, useState } from 'react';
import { MailPlus, Plus, UsersRound, X } from 'lucide-react';

export interface RecipientPopoverProps {
  recipients: string[];
  onRecipientsChange: (recipients: string[]) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidRecipientEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export default function RecipientPopover({ recipients, onRecipientsChange }: RecipientPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fields = recipients.length > 0 ? recipients : [''];

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  function updateRecipient(index: number, value: string) {
    onRecipientsChange(fields.map((recipient, fieldIndex) => fieldIndex === index ? value : recipient));
  }

  function addRecipient() {
    onRecipientsChange([...fields, '']);
  }

  function removeRecipient(index: number) {
    if (fields.length === 1) {
      onRecipientsChange(['']);
      return;
    }
    onRecipientsChange(fields.filter((_, fieldIndex) => fieldIndex !== index));
  }

  return (
    <div className="recipient-popover-anchor" ref={containerRef}>
      <button
        type="button"
        className="recipient-trigger"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <UsersRound size={14} />
        <span>Alert Recipients</span>
      </button>

      {open && (
        <div className="recipient-popover" role="dialog" aria-label="Alert Recipients">
          <div className="recipient-popover-header">
            <div>
              <p className="recipient-popover-title">Alert Recipients</p>
              <p className="recipient-popover-note">Security alerts will be sent to valid addresses.</p>
            </div>
            <button
              type="button"
              className="recipient-close"
              onClick={() => setOpen(false)}
              aria-label="Close alert recipients"
            >
              <X size={15} />
            </button>
          </div>

          <div className="recipient-fields">
            {fields.map((recipient, index) => {
              const hasError = recipient.trim().length > 0 && !isValidRecipientEmail(recipient);
              return (
                <div className="recipient-field" key={index}>
                  <div className="recipient-input-row">
                    <MailPlus size={14} className="recipient-input-icon" />
                    <input
                      type="email"
                      value={recipient}
                      onChange={(event) => updateRecipient(index, event.target.value)}
                      placeholder="alert@example.com"
                      aria-label={`Alert recipient ${index + 1}`}
                      aria-invalid={hasError}
                    />
                    <button
                      type="button"
                      className="recipient-remove"
                      onClick={() => removeRecipient(index)}
                      aria-label={`Remove recipient ${index + 1}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {hasError && <span className="recipient-error">Enter a valid email address.</span>}
                </div>
              );
            })}
          </div>

          <button type="button" className="recipient-add" onClick={addRecipient}>
            <Plus size={14} />
            Add recipient
          </button>
        </div>
      )}
    </div>
  );
}
