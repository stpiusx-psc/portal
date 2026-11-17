/**
 * Turn a dropped file into plain text for the PEC report parser.
 *
 * The minutes arrive as a Word document, and copying them out of Word by hand
 * is the step that makes this screen feel like work. Reading the file directly
 * removes it.
 *
 * .docx is a ZIP holding word/document.xml. There is no dependency here to
 * unpack it: the browser's own DecompressionStream inflates the entry, which
 * keeps a 100KB zip library out of a bundle that volunteers load on a phone.
 */

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Read a little-endian integer out of the archive. */
function u16(v: DataView, at: number) { return v.getUint16(at, true) }
function u32(v: DataView, at: number) { return v.getUint32(at, true) }

/**
 * Pull one named entry out of a ZIP.
 *
 * Walks the central directory rather than scanning local headers, because a
 * local header is allowed to carry zeroed sizes and defer them to a trailing
 * data descriptor; the central directory always has the real ones.
 */
async function unzipEntry(buf: ArrayBuffer, wanted: string): Promise<Uint8Array | null> {
  const bytes = new Uint8Array(buf)
  const view = new DataView(buf)

  // The end-of-central-directory record sits at the end, after a comment of up
  // to 64KB, so it has to be searched for rather than computed.
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(view, i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not a zip')

  const count = u16(view, eocd + 10)
  let p = u32(view, eocd + 16)
  const dec = new TextDecoder()

  for (let n = 0; n < count; n++) {
    if (u32(view, p) !== 0x02014b50) break
    const method = u16(view, p + 10)
    const compSize = u32(view, p + 20)
    const nameLen = u16(view, p + 28)
    const extraLen = u16(view, p + 30)
    const commentLen = u16(view, p + 32)
    const localAt = u32(view, p + 42)
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))

    if (name === wanted) {
      // The local header repeats the name and may hold a differently sized
      // extra field, so the data offset has to be read from it, not reused.
      const lNameLen = u16(view, localAt + 26)
      const lExtraLen = u16(view, localAt + 28)
      const start = localAt + 30 + lNameLen + lExtraLen
      const raw = bytes.subarray(start, start + compSize)
      if (method === 0) return raw
      if (method !== 8) throw new Error(`unsupported compression (${method})`)
      const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      return new Uint8Array(await new Response(stream).arrayBuffer())
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

/**
 * Flatten Word's XML into the sort of text a person would have pasted.
 *
 * Paragraphs and table rows become line breaks and cells become separators,
 * because the parser keys off line structure — collapsing the document onto
 * one line is exactly the PDF-paste case it has to work hardest to survive.
 */
function docxXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, '\t')
    .replace(/<\/w:tr>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface ReadResult {
  text: string
  /** What to tell the person about what was read, or why it could not be. */
  note: string
  ok: boolean
}

/** The extensions the picker offers and this function can actually handle. */
export const ACCEPTED_FILES = '.docx,.txt,.md,.rtf,.csv'

export async function readDocumentFile(file: File): Promise<ReadResult> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return {
      ok: false,
      text: '',
      note: 'A PDF cannot be read directly here. Open it, select all and paste instead — the parser copes with PDF paste.',
    }
  }

  if (name.endsWith('.doc') && !name.endsWith('.docx')) {
    return {
      ok: false,
      text: '',
      note: 'That is the old .doc format. Open it in Word and save as .docx, or paste the text instead.',
    }
  }

  if (name.endsWith('.docx') || file.type === DOCX) {
    try {
      const entry = await unzipEntry(await file.arrayBuffer(), 'word/document.xml')
      if (!entry) return { ok: false, text: '', note: 'That .docx has no readable document inside it.' }
      const text = docxXmlToText(new TextDecoder().decode(entry))
      if (text.length < 40) {
        return { ok: false, text, note: 'That document came through almost empty — check it is the right file.' }
      }
      return { ok: true, text, note: `Read ${file.name} — ${text.length.toLocaleString()} characters.` }
    } catch (e) {
      return {
        ok: false,
        text: '',
        note: `Could not read that .docx (${e instanceof Error ? e.message : 'unknown error'}). Paste the text instead.`,
      }
    }
  }

  // Everything else that is plausibly text, including .rtf, which still has
  // the words in it even with the control codes left in.
  const text = (await file.text()).trim()
  if (!text) return { ok: false, text: '', note: 'That file came through empty.' }
  return { ok: true, text, note: `Read ${file.name} — ${text.length.toLocaleString()} characters.` }
}
