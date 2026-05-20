# VPAT Tool — Requirements (v0.1)

**Owner:** Rich Sharples
**Status:** Scope locked, ready for design
**Date:** 2026-05-19

## One-line summary

An open-source, self-hostable web app that helps a product manager produce a VPAT 2.5 Accessibility Conformance Report (508 and INT editions) for a web/SaaS product by combining source-code scanning, runtime scanning, and an AI-assisted interview wizard, and exporting a Word document that matches the ITI template.

## Background

The Voluntary Product Accessibility Template (VPAT) is the industry-standard format for vendors to document how their product conforms to accessibility standards. The current template is VPAT 2.5, published by the Information Technology Industry Council (ITI). It is published in four editions: 508 (US federal procurement, WCAG 2.0), EU (EN 301 549, WCAG 2.1), WCAG (WCAG 2.0/2.1/2.2), and INT (combined). Each report uses four conformance levels per criterion: Supports, Partially Supports, Does Not Support, and Not Applicable.

Today, completing a VPAT is largely a manual exercise. Automated scanners reliably detect only 13–40% of WCAG criteria, so any tool has to be hybrid — scan what is mechanically detectable, interview the PM for the rest, and keep human review in the loop. Existing commercial tools (AllAccessible, Accessibility Tracker) automate part of this but are closed-source SaaS. There is no widely-adopted open-source equivalent.

## Goals

The tool exists to make a product manager — not an accessibility specialist — able to produce a defensible VPAT in hours rather than weeks. It is opinionated about the workflow but transparent about what was auto-detected versus declared, so the PM and any reviewer can trust what came out the other end.

## Audience and deployment

The tool is built as an open-source project intended for any PM at any vendor. It deploys as a self-hosted web application with SSO authentication so that a company can run it inside its own infrastructure. Cellebrite is the first user; the project is not Cellebrite-specific.

## Supported standards

Two editions of VPAT 2.5 are in scope for the MVP: the 508 edition (US federal procurement) and the INT edition (combined 508 + EU + WCAG). The EU-only and WCAG-only editions are out of scope unless contributed later. The tool targets the ITI template structure verbatim, including the four 508 chapters (Functional Performance Criteria, Hardware, Software, Support Documentation and Services) and the WCAG success-criteria tables at Levels A and AA.

## Product surface

The tool only evaluates web and SaaS applications in v1. Native desktop, mobile, server/CLI, and documentation-only products are out of scope. This boundary matches where automated scanning has the strongest signal and is a sensible MVP cut.

## Workflow

The PM picks an input mode per project. All three modes are available; they are not mutually exclusive, and a hybrid run is the recommended default once a user is comfortable with the tool.

**Source scan** points the tool at a code repository. It parses HTML, JSX, Vue, and Angular templates for static accessibility issues (missing alt text, missing label associations, heading order, ARIA misuse) and inspects CSS for contrast and focus-indicator problems. Where the project already runs `eslint-plugin-jsx-a11y` or a similar linter, the tool can ingest those results rather than re-implementing the rules. The output is a per-criterion table of evidence with file references.

**Runtime scan** points the tool at a running URL (with optional credentials and a list of paths to crawl). The MVP integrates Lighthouse as its scan engine. Lighthouse runs a subset of axe-core (~57 rules vs. ~96), so this is an explicit coverage trade-off in favour of simplicity and reach — most teams already have Lighthouse familiarity, and axe-core can be added in a later release.

**Interview** walks the PM through each in-scope VPAT criterion as a guided Q&A. The interview is always available as a fallback or supplement for criteria the scanners cannot evaluate (which will be most of them). The questions are written in plain language, with examples and links to the underlying WCAG success criterion.

A typical hybrid run will run the scanners first, pre-fill criteria where there is mechanical evidence, mark the rest as Not Yet Evaluated, and then drop the PM into the interview to resolve them.

## AI role

The tool leans heavily on a large language model. Specifically, it uses the model to (1) draft the Remarks/Explanations column in the conformance-report voice given scan findings and interview answers; (2) infer a conformance level (Supports, Partially Supports, Does Not Support, or Not Applicable) where the evidence permits, flagging low-confidence calls for explicit PM review; and (3) summarise scan output into something legible to a PM. The PM always sees and edits the draft before export — the AI is an assistant, not the author of record.

Model access is bring-your-own-key. The PM (or their admin) configures an Anthropic Claude or OpenAI API key in the tool's settings. The project takes no operational responsibility for model cost or content. A future iteration can add a pluggable provider abstraction (Bedrock, Azure OpenAI, local Ollama) for teams that cannot send code or product detail to a third-party cloud — relevant for government and air-gapped customers, but not required for v1.

## Output

The single supported output is a Microsoft Word `.docx` that matches the ITI VPAT 2.5 template (508 and INT layouts). Each row carries the conformance level, the AI-drafted-and-PM-reviewed remarks, and (internally, not in the final doc by default) a pointer to the evidence that informed it. An HTML/web ACR output is a likely follow-up but is not in v1.

## Explicitly out of scope for MVP

The following are deferred so v1 stays shippable. They are not "won't do ever," just "not in v1":

Native desktop and mobile product support; VPAT versioning and lifecycle management (the v1 tool is a one-shot generator, not a system of record); a dedicated evidence storage and audit-trail UI; EU-only and pure-WCAG editions; runtime scanners beyond Lighthouse (axe-core, Pa11y); CI/CLI integration; and a published HTML ACR output.

## Key risks and trade-offs

Three call-outs the design phase needs to address.

First, **Lighthouse-only is a coverage compromise.** Full axe-core would catch more issues. The mitigation is that the interview step covers anything the scanner misses, and the AI can be told explicitly when a criterion was Not Evaluated by the scanner so it does not over-claim conformance. Adding axe-core later is straightforward.

Second, **AI-inferred conformance creates legal exposure if not gated.** A VPAT is a procurement document; an over-claim of Supports that is wrong can have contractual consequences. The mitigation is to require explicit PM confirmation on every AI-inferred level, mark anything inferred from scanner output alone as low-confidence by default, and keep the underlying evidence in the record so a third-party auditor can verify.

Third, **open-source + heavy AI + government audience is a tension.** Federal LE customers (a likely real-world user given the open-source positioning) often cannot send source or product detail to a cloud LLM. BYO key satisfies the v1 use case but the roadmap should keep a local-model path open. This is the strongest single argument for the pluggable provider abstraction landing sooner rather than later.

## Suggested next steps

The next deliverable is a short architecture/design sketch covering: the data model (project, run, criterion, evidence, remark); the scan-runner contract (so axe-core, Pa11y, etc. can be added later behind the same interface); the AI prompt structure for remark drafting and conformance inference; and the .docx renderer (likely python-docx against an ITI template, or a Word XML approach). After that, a thin walking skeleton that does interview-only + .docx export is the right v1 milestone — it delivers value to PMs with no working scanner, and the scanners then layer on top.
