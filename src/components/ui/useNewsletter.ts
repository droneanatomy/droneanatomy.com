'use client';

/* ============================================================
   useNewsletter — the one way this site subscribes someone.

   LIFTED OUT OF Banner.tsx, which had the only working copy. There are
   four newsletter forms on this site — the footer, the nav's panel,
   FieldMenu's and Banner's — and until this existed exactly one of them
   sent anything. The other three rendered a field, an arrow and a
   `preventDefault` that swallowed the submit without a word to the
   reader, which is worse than not offering the field at all.

   A FORM POST, NOT AN API CALL, and that is what makes it work here.
   next.config sets output:'export', so this site is a folder of files:
   no API routes, no server actions, no process.env at runtime. Loops'
   form endpoint accepts a form-encoded POST straight from the browser,
   which is why NEXT_PUBLIC_NEWSLETTER_ENDPOINT is the whole integration.

   LOOPS_API_KEY CANNOT BE USED HERE. A server key needs a server to keep
   it on; inlined into a static bundle it would simply be published. If a
   future form needs the API rather than the form endpoint, that form
   needs somewhere to run first.
   IT LIVES IN ui/ RATHER THAN A newsletter/ FOLDER because there is
   already a Newsletter/ component directory, and on a case-insensitive
   filesystem the two resolve to the same path — the import compiled to
   the wrong file and tsc caught it as a casing conflict.
   ============================================================ */

import { useState } from 'react';

export type NewsletterStatus = 'idle' | 'submitting' | 'done' | 'error';

export function useNewsletter(userGroup = 'Newsletter') {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<NewsletterStatus>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'submitting') return;

    const endpoint = process.env.NEXT_PUBLIC_NEWSLETTER_ENDPOINT;
    /* Said out loud rather than failed silently. The variable is inlined
       at BUILD time, so a deploy whose environment is missing it ships a
       form that can never work — and the only place that is visible is
       here. */
    if (!endpoint) {
      setStatus('error');
      setMessage('Newsletter service is not configured.');
      return;
    }

    setStatus('submitting');
    setMessage('');

    const body = new URLSearchParams();
    body.append('email', email);
    body.append('userGroup', userGroup);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (res.ok) {
        setStatus('done');
        setMessage('Thanks — you’re on the list.');
        setEmail('');
      } else {
        const text = await res.text().catch(() => '');
        console.error('Newsletter subscription failed:', res.status, text || res.statusText);
        setStatus('error');
        setMessage('That didn’t go through. Please try again.');
      }
    } catch (err) {
      console.error('Newsletter subscription error:', err);
      setStatus('error');
      setMessage('That didn’t go through. Please try again.');
    }
  };

  return { email, setEmail, status, message, submit };
}

export default useNewsletter;
