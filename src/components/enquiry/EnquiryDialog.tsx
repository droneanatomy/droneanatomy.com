'use client';

/* ============================================================
   EnquiryDialog — the three-step enquiry, in a modal.

   A NATIVE <dialog>, opened with showModal(). That one choice buys the
   focus trap, the Escape key, the inert background and the top-layer
   stacking that a div-based modal has to reimplement — and reimplement
   correctly, which most do not. The page already carries three WebGL
   contexts and a sticky stage; a hand-rolled overlay fighting those for
   z-index was never going to be the simpler option.

   Split in two, like the reference: an aside that says who is receiving
   this, and the steps themselves. The aside is not decoration — a form
   that names the person reading it gets answered differently from one
   that looks like a ticket queue.
   ============================================================ */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  DIAL_CODES,
  STEPS,
  allValid,
  firstIncomplete,
  stepValid,
  type Field,
  type Values,
} from './enquirySteps';
import styles from './Enquiry.module.css';

/* Reused from the existing /contact page rather than a second endpoint,
   so homepage enquiries land in the same inbox as the ones from the
   contact form. Overridable for a deploy that wants its own. */
const ENDPOINT = process.env.NEXT_PUBLIC_FORM_ENDPOINT || 'https://formspree.io/f/xdalkdko';

/* The published address, NOT a personal one. Shown only when the POST
   has already failed, so the enquiry is not lost with it. */
const FALLBACK_EMAIL = 'info@droneanatomy.com';

/* Seconds the success panel waits before closing itself. Long enough to
   read the two lines, short enough that nobody is stuck looking at a
   dialog they are finished with. */
const AUTO_CLOSE_SEC = 10;

type Status = 'idle' | 'sending' | 'ok' | 'bad';

export interface EnquiryDialogProps {
  open: boolean;
  onClose: () => void;
}

export const EnquiryDialog: React.FC<EnquiryDialogProps> = ({ open, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({ dial: DIAL_CODES[0].code });
  const [status, setStatus] = useState<Status>('idle');
  const [left, setLeft] = useState(AUTO_CLOSE_SEC);
  /* Whether the enquiry currently in `values` has already been sent.
     Survives the close because it decides what the NEXT open looks
     like, and a ref rather than state because nothing renders from
     it. */
  const sent = useRef(false);

  const set = useCallback((name: string, v: string) => {
    setValues((prev) => (prev[name] === v ? prev : { ...prev, [name]: v }));
  }, []);

  /* Drive the element from the prop.

     showModal() is imperative and the open state is declarative, so the
     two have to be reconciled somewhere. Doing it here — and listening
     for 'close' to report Escape back up — keeps the parent unaware that
     a native dialog is involved at all. */
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancelOrClose = () => onClose();
    d.addEventListener('close', onCancelOrClose);
    return () => d.removeEventListener('close', onCancelOrClose);
  }, [onClose]);

  /* showModal makes the background inert but does not stop it scrolling
     under the dialog in every browser. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* Reset on open, not on close — resetting on close would wipe the
     fields out from under the closing animation.

     ANSWERS ARE KEPT, deliberately: closing by accident and losing a
     half-written enquiry is worse than seeing your own words again.
     What is not kept is an enquiry that already went — coming back to
     a form still full of a message you sent five minutes ago reads as
     though it never sent at all. */
  useEffect(() => {
    if (!open) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- Resetting
       the form as the dialog opens is the whole job of this effect, and it
       has to be synchronous: the panel is already on screen by the time an
       async reset would land, so the reader would watch last session's
       step and countdown blink away. The ref below rules out clearing a
       half-written enquiry — see the comment above. */
    setStep(0);
    setStatus('idle');
    setLeft(AUTO_CLOSE_SEC);
    if (sent.current) {
      sent.current = false;
      setValues({ dial: DIAL_CODES[0].code });
    }
    /* Skip anything the honeypot's tabindex has already excluded — the
       first control in DOM order IS the honeypot, so an unqualified
       query opens the dialog with focus on a field no person should
       ever reach. */
    const first = ref.current?.querySelector<HTMLElement>(
      'input:not([tabindex="-1"]), select, textarea'
    );
    first?.focus({ preventScroll: true });
  }, [open]);

  /* The success panel closes itself. */
  useEffect(() => {
    if (status !== 'ok') return;
    const id = window.setInterval(() => {
      setLeft((n) => {
        if (n <= 1) { window.clearInterval(id); onClose(); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [status, onClose]);

  const complete = useMemo(() => allValid(values), [values]);

  const compose = useCallback(() => {
    const line = (k: string, v?: string) => (v && v.trim() ? `${k}: ${v.trim()}\n` : '');
    const phone = values.phone ? `${values.dial || ''} ${values.phone}` : '';
    return (
      line('Name', values.name) +
      line('Email', values.email) +
      line('Phone', phone) +
      line('Found us via', values.source) +
      line('Enquiry', values.intent) +
      line('Platform', values.platform) +
      line('Timeline', values.timeline) +
      line('Budget', values.budget) +
      `\n${(values.message || '').trim()}\n`
    );
  }, [values]);

  const submit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (status === 'sending') return;

      /* Hitting SEND from step 1 with step 3 empty should not produce a
         message about a field that is currently collapsed out of view —
         open the step that is actually blocking instead. */
      const gap = firstIncomplete(values);
      if (gap >= 0) { setStep(gap); return; }

      setStatus('sending');
      const body = new FormData();
      Object.entries(values).forEach(([k, v]) => v && body.append(k, v));
      body.append('_subject', `Enquiry from ${values.name || 'the homepage'}`);
      body.append('summary', compose());

      try {
        const res = await fetch(ENDPOINT, { method: 'POST', body, headers: { Accept: 'application/json' } });
        sent.current = res.ok;
        setStatus(res.ok ? 'ok' : 'bad');
      } catch {
        setStatus('bad');
      }
    },
    [values, status, compose]
  );

  const mailto = `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent(
    `Enquiry from ${values.name || 'the DroneAnatomy site'}`
  )}&body=${encodeURIComponent(compose())}`;

  const field = (f: Field) => {
    const id = `${uid}-${f.name}`;
    const common = {
      id,
      name: f.name,
      className: styles.input,
      value: values[f.name] ?? '',
      required: f.required,
      'aria-required': f.required || undefined,
    };

    return (
      <div key={f.name} className={f.kind === 'textarea' ? styles.rowWide : styles.row}>
        {/* Visible placeholders carry the look; a real label carries the
            meaning. Placeholder-only forms lose their labels the moment
            anything is typed, and never had one for a screen reader. */}
        <label className={styles.srOnly} htmlFor={id}>
          {f.label}
          {f.required ? ' (required)' : ''}
        </label>

        {f.kind === 'select' ? (
          <div className={styles.selectWrap}>
            <select
              {...common}
              className={`${styles.input} ${styles.select} ${values[f.name] ? '' : styles.unset}`}
              onChange={(e) => set(f.name, e.target.value)}
            >
              <option value="">{f.ph}</option>
              {f.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <span className={styles.caret} aria-hidden="true" />
          </div>
        ) : f.kind === 'textarea' ? (
          <textarea
            {...common}
            rows={f.rows}
            placeholder={f.ph}
            className={`${styles.input} ${styles.textarea}`}
            onChange={(e) => set(f.name, e.target.value)}
          />
        ) : f.kind === 'phone' ? (
          <div className={styles.phone}>
            <div className={styles.selectWrap}>
              <label className={styles.srOnly} htmlFor={`${uid}-dial`}>Country dialling code</label>
              <select
                id={`${uid}-dial`}
                name="dial"
                className={`${styles.input} ${styles.select} ${styles.dial}`}
                value={values.dial ?? DIAL_CODES[0].code}
                onChange={(e) => set('dial', e.target.value)}
              >
                {DIAL_CODES.map((d) => (
                  <option key={d.code} value={d.code}>{d.label}</option>
                ))}
              </select>
              <span className={styles.caret} aria-hidden="true" />
            </div>
            <input
              {...common}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={f.ph}
              onChange={(e) => set(f.name, e.target.value)}
            />
          </div>
        ) : (
          <input
            {...common}
            type={f.kind === 'email' ? 'email' : 'text'}
            inputMode={f.kind === 'email' ? 'email' : undefined}
            autoComplete={f.autoComplete}
            placeholder={f.ph}
            onChange={(e) => set(f.name, e.target.value)}
          />
        )}
      </div>
    );
  };

  const done = status === 'ok' || status === 'bad';

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby={`${uid}-head`}>
      <div className={styles.card}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close enquiry">
          <span aria-hidden="true">×</span>
        </button>

        <aside className={styles.aside}>
          <h2 id={`${uid}-head`} className={styles.asideHead}>
            Tell us where
            <br />
            it needs to fly
          </h2>
          <p className={styles.asideBody}>
            Fill this in and it comes straight to the team that builds the aircraft.
            The more you tell us, the more useful the first reply.
          </p>

          <div className={styles.sign}>
            <span className={styles.signMark} aria-hidden="true" />
            <span className={styles.signName}>Flight operations</span>
            <span className={styles.signRole}>DroneAnatomy &middot; Delhi</span>
          </div>
        </aside>

        <form className={styles.form} onSubmit={submit} noValidate>
          {/* Off-screen, never filled by a person; anything that arrives
              with it set came from something automated. */}
          <input type="checkbox" name="_gotcha" tabIndex={-1} className={styles.srOnly} aria-hidden="true" />

          <div className={styles.steps} hidden={done}>
            {STEPS.map((s, i) => {
              const isOpen = i === step;
              const ok = stepValid(s, values);
              const last = i === STEPS.length - 1;
              return (
                <section key={s.id} className={`${styles.sec} ${isOpen ? styles.secOpen : ''}`}>
                  <h3 className={styles.secHead}>
                    <button
                      type="button"
                      className={styles.secToggle}
                      aria-expanded={isOpen}
                      aria-controls={`${uid}-${s.id}`}
                      onClick={() => setStep(isOpen ? -1 : i)}
                    >
                      <span className={`${styles.num} ${ok ? styles.numOk : ''}`} aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className={styles.secTitle}>{s.title}</span>
                    </button>
                  </h3>

                  <div className={styles.secBody} id={`${uid}-${s.id}`}>
                    <div className={styles.secInner}>
                      <div className={styles.grid}>{s.fields.map(field)}</div>
                      {!last && (
                        <div className={styles.next}>
                          <button
                            type="button"
                            className={styles.pill}
                            disabled={!ok}
                            onClick={() => setStep(i + 1)}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <div className={styles.foot} hidden={done}>
            <p className={styles.consent}>
              By sending this you agree to our{' '}
              <a href="/privacy" className={styles.link}>Privacy Policy</a>. We use what you
              write here to answer you, and nothing else.
            </p>
            <button
              type="submit"
              className={`${styles.pill} ${styles.send}`}
              disabled={status === 'sending'}
              /* Enabled even when incomplete: pressing it then jumps to
                 the step that is missing something, which teaches more
                 than a permanently dead button does. */
              aria-disabled={!complete}
            >
              {status === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </div>

          {status === 'ok' && (
            <div className={styles.result} role="status">
              <p className={styles.resultHead}>Thank you.</p>
              <p className={styles.resultBody}>
                We read everything, and we&apos;ll come back to you very soon.
              </p>
              <button type="button" className={styles.pill} onClick={onClose}>
                Close now <span className={styles.count}>{left}</span>
              </button>
            </div>
          )}

          {status === 'bad' && (
            <div className={styles.result} role="alert">
              <p className={styles.resultHead}>That didn&apos;t send.</p>
              <p className={styles.resultBody}>
                Something went wrong on the way out. Your answers are still here —{' '}
                <a className={styles.link} href={mailto}>send them by email instead</a>, or write
                to <a className={styles.link} href={`mailto:${FALLBACK_EMAIL}`}>{FALLBACK_EMAIL}</a>.
              </p>
              <button type="button" className={styles.pill} onClick={() => setStatus('idle')}>
                Try again
              </button>
            </div>
          )}
        </form>
      </div>
    </dialog>
  );
};

export default EnquiryDialog;
