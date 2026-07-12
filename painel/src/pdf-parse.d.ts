declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfData { text: string; numpages: number }
  export default function pdfParse(buffer: Buffer | Uint8Array): Promise<PdfData>
}
