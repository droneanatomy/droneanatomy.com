'use client';

/* ============================================================
   PrimaryButton — one control, two grounds.

   Renders an <a> when given an href and a <button> otherwise, because
   the thing that decides which element is correct is whether it
   navigates, and only the caller knows that. A <button> that navigates
   breaks middle-click, "open in new tab" and the browser's own history;
   an <a> that submits a form is a lie to a screen reader.

   The hover lives entirely in CSS — see the note in the stylesheet for
   why the fill enters from one side and leaves by the other.
   ============================================================ */

import React from 'react';
import styles from './PrimaryButton.module.css';

/* Named for the ground the button sits ON, not for the button's own
   colour. At a call site you know what is behind it; you should not
   have to work out which way round that makes the pill. */
export type PrimaryButtonTone = 'onLight' | 'onDark';

type Common = {
  children: React.ReactNode;
  tone?: PrimaryButtonTone;
  /* The accent dot. On by default because both existing calls have one,
     and it is what keeps the pill from reading as a plain slab. */
  dot?: boolean;
  className?: string;
};

type AsLink = Common &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof Common> & { href: string };

type AsButton = Common &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof Common> & { href?: undefined };

export type PrimaryButtonProps = AsLink | AsButton;

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  tone = 'onLight',
  dot = true,
  className = '',
  ...rest
}) => {
  const cls = `${styles.btn} ${styles[tone]} ${className}`.trim();

  /* The label is wrapped rather than left as a bare text node so the
     stylesheet can lift it above the sweeping fill. A text node cannot
     be positioned, and without that the fill paints over the words. */
  const inner = (
    <>
      <span className={styles.label}>{children}</span>
      {dot && <i className={styles.dot} aria-hidden="true" />}
    </>
  );

  if ('href' in rest && rest.href !== undefined) {
    const { href, ...anchorRest } = rest as AsLink;
    return (
      <a className={cls} href={href} {...anchorRest}>
        {inner}
      </a>
    );
  }

  const buttonRest = rest as AsButton;
  return (
    /* Defaulted to "button". An unspecified <button> inside a <form> is
       a submit button, which is a surprising way to lose a page. */
    <button className={cls} type={buttonRest.type ?? 'button'} {...buttonRest}>
      {inner}
    </button>
  );
};

export default PrimaryButton;
