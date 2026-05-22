/**
 * REGRESSION TEST FIXTURE — DO NOT FIX THESE VIOLATIONS
 *
 * This file intentionally contains accessibility violations that the
 * vpat-tool source scanner should detect. It is the baseline for the
 * "fixture" regression target.
 *
 * Expected violations (jsx-a11y rules):
 *   1. alt-text               — <img> missing alt attribute
 *   2. img-redundant-alt      — alt text contains "image of"
 *   3. label-has-associated-control — <input> with no associated label
 *   4. anchor-has-content     — <a> with no text content
 *   5. heading-has-content    — <h2> with no text content
 *   6. click-events-have-key-events — <div> with onClick, no onKeyDown
 *   7. aria-role              — invalid ARIA role value
 *   8. tabindex-no-positive   — tabIndex={2}
 *
 * To update the baseline after intentional scanner changes:
 *   npm run regression:update -- --target fixture
 */

/* eslint-disable @typescript-eslint/no-empty-function */

// Violation 1: img missing alt attribute
export function MissingAlt() {
  return <img src="/hero.png" />;
}

// Violation 2: img-redundant-alt — alt contains "image of"
export function RedundantAlt() {
  return <img src="/logo.png" alt="image of company logo" />;
}

// Violation 3: label-has-associated-control
// The <label> is not associated with the input (no htmlFor / no wrapping)
export function UnlabelledInput() {
  return (
    <div>
      <label>Search term</label>
      <input type="text" name="q" />
    </div>
  );
}

// Violation 4: anchor-has-content
export function EmptyAnchor() {
  return <a href="/home" aria-label=""></a>;
}

// Violation 5: heading-has-content
export function EmptyHeading() {
  return <h2></h2>;
}

// Violation 6: click-events-have-key-events
// Interactive div with onClick but no onKeyDown/onKeyUp/onKeyPress
export function ClickableDiv() {
  return (
    <div onClick={() => {}}>
      Activate me
    </div>
  );
}

// Violation 7: aria-role — "foobar" is not a valid WAI-ARIA role
export function BadAriaRole() {
  return <div role={"foobar" as React.AriaRole}>Content</div>;
}

// Violation 8: tabindex-no-positive
export function PositiveTabIndex() {
  return <button tabIndex={2}>Submit</button>;
}

// Clean component (no violations) — scanner must NOT flag this
export function AccessibleButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => {}} onKeyDown={() => {}}>
      {label}
    </button>
  );
}

import React from "react";
