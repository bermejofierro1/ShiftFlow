import { Injectable } from '@angular/core';
import { createWorker, PSM } from 'tesseract.js';

export interface OcrWord {
  text: string;
  bbox: { x0: number; x1: number; y0: number; y1: number };
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
}

function mapRawWords(rawWords: any[]): OcrWord[] {
  return rawWords
    .filter((w) => (w?.text ?? '').trim().length > 0)
    .map((w) => ({
      text: String(w.text ?? '').trim(),
      bbox: {
        x0: w.bbox?.x0 ?? 0,
        x1: w.bbox?.x1 ?? 0,
        y0: w.bbox?.y0 ?? 0,
        y1: w.bbox?.y1 ?? 0,
      },
    }));
}

function extractWordsFromBlocks(blocks: any[]): OcrWord[] {
  if (!Array.isArray(blocks)) return [];
  const words: OcrWord[] = [];

  for (const block of blocks) {
    const paragraphs = Array.isArray(block?.paragraphs) ? block.paragraphs : [];
    for (const paragraph of paragraphs) {
      const lines = Array.isArray(paragraph?.lines) ? paragraph.lines : [];
      for (const line of lines) {
        const lineWords = Array.isArray(line?.words) ? line.words : [];
        for (const w of lineWords) {
          const text = String(w?.text ?? '').trim();
          if (!text) continue;
          words.push({
            text,
            bbox: {
              x0: w.bbox?.x0 ?? 0,
              x1: w.bbox?.x1 ?? 0,
              y0: w.bbox?.y0 ?? 0,
              y1: w.bbox?.y1 ?? 0,
            },
          });
        }
      }
    }
  }

  return words;
}

function parseTsvWords(tsv: string): OcrWord[] {
  if (!tsv) return [];
  const lines = tsv.split(/\r?\n/);
  const words: OcrWord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && line.startsWith('level')) continue;

    const parts = line.split('\t');
    if (parts.length < 12) continue;

    const wordNum = parseInt(parts[5], 10);
    if (!Number.isNaN(wordNum) && wordNum === 0) continue;

    const left = parseInt(parts[6], 10);
    const top = parseInt(parts[7], 10);
    const width = parseInt(parts[8], 10);
    const height = parseInt(parts[9], 10);
    if ([left, top, width, height].some((n) => Number.isNaN(n))) continue;

    const text = parts.slice(11).join('\t').trim();
    if (!text) continue;

    words.push({
      text,
      bbox: {
        x0: left,
        y0: top,
        x1: left + width,
        y1: top + height,
      },
    });
  }

  return words;
}

function buildWordsFromData(data: any): OcrWord[] {
  const rawWords = Array.isArray(data?.words) ? data.words : [];
  const mapped = mapRawWords(rawWords);
  if (mapped.length > 0) return mapped;

  const blocksWords = extractWordsFromBlocks(data?.blocks ?? []);
  if (blocksWords.length > 0) return blocksWords;

  const tsv = typeof data?.tsv === 'string' ? data.tsv : '';
  return parseTsvWords(tsv);
}

@Injectable({
  providedIn: 'root',
})
export class OcrService {
  async readTextFromImage(file: File): Promise<OcrResult> {
    const worker = await createWorker('spa', undefined, {
      // logger: (m) => console.log(m),
    });

    try {
      await worker.load();
      await worker.reinitialize('spa');
      await worker.setParameters({
        tessjs_create_tsv: '1',
        tessedit_pageseg_mode: PSM.AUTO,
      });

      const result = await worker.recognize(
        file,
        {},
        {
          text: true,
          blocks: true,
          tsv: true,
        }
      );

      const data = (result as any)?.data ?? {};
      const text = (data?.text ?? '').trim();
      const words = buildWordsFromData(data);

      return { text, words };
    } finally {
      await worker.terminate();
    }
  }
}
