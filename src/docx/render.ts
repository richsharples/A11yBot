import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  TableLayoutType,
  BorderStyle,
} from "docx";
import type { Project } from "../types";
import { getCriteriaFile } from "../state/project";
import { readManifest } from "../state/criteria-store";

const LEVEL_LABELS: Record<string, string> = {
  supports: "Supports",
  partial: "Partially Supports",
  doesNotSupport: "Does Not Support",
  notApplicable: "Not Applicable",
  notEvaluated: "Not Evaluated",
};

// Page body width in DXA (twips). Letter/A4 with 1" margins = ~9000 dxa.
// Using absolute DXA widths instead of percentages for cross-app compatibility
// (Pages, LibreOffice, and older Word versions don't honour WidthType.PERCENTAGE).
const PAGE_WIDTH = 9000;

const dxa = (n: number) => ({ size: n, type: WidthType.DXA });

function metaRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
        width: dxa(Math.round(PAGE_WIDTH * 0.30)),
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: value })] })],
        width: dxa(Math.round(PAGE_WIDTH * 0.70)),
      }),
    ],
  });
}

function criterionRow(ref: string, text: string, level: string, remark: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [
          new Paragraph({ children: [new TextRun({ text: ref, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text })] }),
        ],
        width: dxa(Math.round(PAGE_WIDTH * 0.40)),
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: LEVEL_LABELS[level] ?? level })] })],
        width: dxa(Math.round(PAGE_WIDTH * 0.20)),
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: remark || "(no remarks)" })] })],
        width: dxa(Math.round(PAGE_WIDTH * 0.40)),
      }),
    ],
  });
}

function criteriaHeaderRow(): TableRow {
  const widths = [0.40, 0.20, 0.40];
  return new TableRow({
    children: ["Criteria", "Conformance Level", "Remarks and Explanations"].map((h, i) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        shading: { fill: "C0C0C0" },
        width: dxa(Math.round(PAGE_WIDTH * widths[i])),
      })
    ),
    tableHeader: true,
  });
}

const fixedTable = (rows: TableRow[], columnWidths: number[]) =>
  new Table({
    rows,
    width: dxa(PAGE_WIDTH),
    layout: TableLayoutType.FIXED,
    columnWidths,
  });

export async function renderDocx(project: Project): Promise<Buffer> {
  const criteriaFile = getCriteriaFile(project.edition);
  const sections: (Paragraph | Table)[] = [];

  // Title
  sections.push(
    new Paragraph({
      text: `VPAT® 2.5 Accessibility Conformance Report`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: `${project.edition === "INT" ? "International Edition" : "Revised Section 508 Edition"}`,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: "" })
  );

  const metaCols = [Math.round(PAGE_WIDTH * 0.30), Math.round(PAGE_WIDTH * 0.70)];

  // Product metadata table
  sections.push(
    new Paragraph({ text: "Product Details", heading: HeadingLevel.HEADING_2 }),
    fixedTable([
      metaRow("Name of Product", project.productName),
      metaRow("Product Version", project.productVersion),
      metaRow("Report Date", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })),
      metaRow("Contact", `${project.contactName} <${project.contactEmail}>`),
      metaRow("Notes", project.productDescription),
    ], metaCols),
    new Paragraph({ text: "" })
  );

  // Evaluation methods
  sections.push(
    new Paragraph({ text: "Evaluation Methods Used", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({
      children: [new TextRun({
        text: `This report was generated using the VPAT Tool. Automated scanning (${project.mode !== "interview" ? "source and/or runtime" : "interview only"}) was combined with product manager review. All AI-assisted conformance assessments were reviewed and confirmed by the named contact.`,
      })],
    }),
    new Paragraph({ text: "" })
  );

  // Compliance Standards
  const manifest = readManifest();
  const editionSources = manifest.sources.filter((s) => s.editions.includes(project.edition));
  const srcWidths = [0.25, 0.40, 0.35];
  const srcCols = srcWidths.map((w) => Math.round(PAGE_WIDTH * w));
  sections.push(
    new Paragraph({ text: "Compliance Standards", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({
      children: [new TextRun({
        text: `Criteria set version ${manifest.criteriaVersion}, released ${manifest.releasedAt}. ${manifest.notes}`,
        italics: true,
      })],
    }),
    new Paragraph({ text: "" }),
    fixedTable([
      new TableRow({
        children: ["Standard", "Reference URL", "Scope"].map((h, i) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            shading: { fill: "C0C0C0" },
            width: dxa(Math.round(PAGE_WIDTH * srcWidths[i])),
          })
        ),
        tableHeader: true,
      }),
      ...editionSources.map(
        (source) =>
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: source.name })] })],
                width: dxa(Math.round(PAGE_WIDTH * srcWidths[0])),
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: source.url })] })],
                width: dxa(Math.round(PAGE_WIDTH * srcWidths[1])),
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: source.description })] })],
                width: dxa(Math.round(PAGE_WIDTH * srcWidths[2])),
              }),
            ],
          })
      ),
    ], srcCols),
    new Paragraph({ text: "" })
  );

  const criteriaCols = [0.40, 0.20, 0.40].map((w) => Math.round(PAGE_WIDTH * w));

  // Chapter tables
  for (const chapter of criteriaFile.chapters) {
    sections.push(
      new Paragraph({ text: chapter.title, heading: HeadingLevel.HEADING_2 }),
    );
    if (chapter.description) {
      sections.push(new Paragraph({ children: [new TextRun({ text: chapter.description, italics: true })] }));
    }
    sections.push(new Paragraph({ text: "" }));

    const rows = [criteriaHeaderRow()];
    for (const criterion of chapter.criteria) {
      const cs = project.criteria[criterion.id];
      rows.push(criterionRow(
        criterion.ref,
        criterion.text,
        cs?.level ?? "notEvaluated",
        cs?.remark ?? ""
      ));
    }

    sections.push(
      fixedTable(rows, criteriaCols),
      new Paragraph({ text: "" })
    );
  }

  const doc = new Document({
    sections: [{ children: sections }],
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "Arial", size: 20 },
        },
      ],
    },
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
