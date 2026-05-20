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
  BorderStyle,
} from "docx";
import type { Project } from "../types";
import { getCriteriaFile } from "../state/project";

const LEVEL_LABELS: Record<string, string> = {
  supports: "Supports",
  partial: "Partially Supports",
  doesNotSupport: "Does Not Support",
  notApplicable: "Not Applicable",
  notEvaluated: "Not Evaluated",
};

function metaRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
        width: { size: 30, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: value })] })],
        width: { size: 70, type: WidthType.PERCENTAGE },
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
        width: { size: 40, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: LEVEL_LABELS[level] ?? level })] })],
        width: { size: 20, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: remark || "(no remarks)" })] })],
        width: { size: 40, type: WidthType.PERCENTAGE },
      }),
    ],
  });
}

function headerRow(): TableRow {
  return new TableRow({
    children: ["Criteria", "Conformance Level", "Remarks and Explanations"].map((h) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        shading: { fill: "C0C0C0" },
      })
    ),
    tableHeader: true,
  });
}

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

  // Product metadata table
  sections.push(
    new Paragraph({ text: "Product Details", heading: HeadingLevel.HEADING_2 }),
    new Table({
      rows: [
        metaRow("Name of Product", project.productName),
        metaRow("Product Version", project.productVersion),
        metaRow("Report Date", new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })),
        metaRow("Contact", `${project.contactName} <${project.contactEmail}>`),
        metaRow("Notes", project.productDescription),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
    new Paragraph({ text: "" })
  );

  // Conformance disclaimer
  sections.push(
    new Paragraph({ text: "Evaluation Methods Used", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({
      children: [new TextRun({
        text: `This report was generated using the VPAT Tool. Automated scanning (${project.mode !== "interview" ? "source and/or runtime" : "interview only"}) was combined with product manager review. All AI-assisted conformance assessments were reviewed and confirmed by the named contact.`,
      })],
    }),
    new Paragraph({ text: "" })
  );

  // Chapter tables
  for (const chapter of criteriaFile.chapters) {
    sections.push(
      new Paragraph({ text: chapter.title, heading: HeadingLevel.HEADING_2 }),
    );
    if (chapter.description) {
      sections.push(new Paragraph({ children: [new TextRun({ text: chapter.description, italics: true })] }));
    }
    sections.push(new Paragraph({ text: "" }));

    const rows = [headerRow()];
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
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
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
