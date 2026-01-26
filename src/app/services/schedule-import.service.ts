import { Injectable } from '@angular/core';
import { OcrWord } from './ocr.service';

export interface ImportedTurn {
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
}

@Injectable({ providedIn: 'root' })
export class ScheduleImportService {
  parseScheduleFromWords(words: OcrWord[], aliases: string[]): ImportedTurn[] {
    return parseFromWords(words, aliases);
  }
}

// ----------------------
// Helpers
// ----------------------

type DayAnchor = { dayNum: number; x: number; y: number };
type LineGroup = { y: number; words: OcrWord[] };

type LineWord = {
  word: OcrWord;
  raw: string;
  token: string;
  x: number;
  y: number;
};

function normalize(str: string): string {
  return (str || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function cleanToken(str: string): string {
  return normalize(str).replace(/[^A-Z0-9]/g, '');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildISODateForDayNumber(dayNum: number, baseDate = new Date()): string {
  const y = baseDate.getFullYear();
  const m = baseDate.getMonth();
  const today = baseDate.getDate();

  let targetMonth = m;
  if (today >= 24 && dayNum <= 7) targetMonth = m + 1;
  else {
    if (dayNum < today - 14) targetMonth = m + 1;
    if (dayNum > today + 14) targetMonth = m - 1;
  }

  const d = new Date(y, targetMonth, dayNum);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function centerX(w: OcrWord): number {
  return (w.bbox.x0 + w.bbox.x1) / 2;
}

function centerY(w: OcrWord): number {
  return (w.bbox.y0 + w.bbox.y1) / 2;
}

function groupWordsByLine(words: OcrWord[]): { lines: LineGroup[]; tolerance: number } {
  if (!words.length) return { lines: [], tolerance: 20 };

  const sorted = [...words].sort((a, b) => centerY(a) - centerY(b));
  const heights = sorted
    .map((w) => Math.max(1, w.bbox.y1 - w.bbox.y0))
    .sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 20;
  const tolerance = Math.max(10, Math.round(medianHeight * 0.6));

  const lines: LineGroup[] = [];

  for (const w of sorted) {
    const y = centerY(w);
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - y) <= tolerance) {
      last.words.push(w);
      last.y = (last.y * (last.words.length - 1) + y) / last.words.length;
    } else {
      lines.push({ y, words: [w] });
    }
  }

  for (const line of lines) {
    line.words.sort((a, b) => centerX(a) - centerX(b));
  }

  return { lines, tolerance };
}

function buildLineWords(line: LineGroup): LineWord[] {
  return line.words.map((word) => ({
    word,
    raw: word.text ?? '',
    token: cleanToken(word.text ?? ''),
    x: centerX(word),
    y: centerY(word),
  }));
}

function extractTime(raw: string): string | null {
  const match = /(\d{1,2})[:.](\d{2})/.exec(raw);
  if (!match) return null;

  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  return `${pad2(hh)}:${pad2(mm)}`;
}

function normalizeAliases(aliases: string[]): string[][] {
  // Importante: respeta alias multi-palabra: "MIGUEL L"
  const normalized = aliases
    .map((a) => normalize(a))
    .map((a) => a.split(/\s+/).map(cleanToken).filter(Boolean))
    .filter((arr) => arr.length > 0);

  normalized.sort((a, b) => b.length - a.length);
  return normalized;
}

function findAliasMatches(lineWords: LineWord[], aliasTokensList: string[][]): { x: number; y: number }[] {
  const valid = lineWords.filter((w) => w.token.length > 0);
  const matches: { x: number; y: number }[] = [];
  const used = new Set<number>();

  for (const aliasTokens of aliasTokensList) {
    for (let i = 0; i <= valid.length - aliasTokens.length; i++) {
      let overlaps = false;
      for (let k = i; k < i + aliasTokens.length; k++) {
        if (used.has(k)) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      let ok = true;
      for (let j = 0; j < aliasTokens.length; j++) {
        if (valid[i + j].token !== aliasTokens[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        const slice = valid.slice(i, i + aliasTokens.length);
        const x = slice.reduce((sum, w) => sum + w.x, 0) / slice.length;
        const y = slice.reduce((sum, w) => sum + w.y, 0) / slice.length;
        matches.push({ x, y });
        for (let k = i; k < i + aliasTokens.length; k++) {
          used.add(k);
        }
      }
    }
  }

  return matches;
}

function findDayNumberToRight(tokens: LineWord[], index: number): { dayNum: number; x: number } | null {
  const baseX = tokens[index].x;
  let best: { dayNum: number; x: number; dx: number } | null = null;

  for (let i = index + 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (!/^\d{1,2}$/.test(t.token)) continue;

    const dx = t.x - baseX;
    if (dx < -5 || dx > 200) continue;

    const dayNum = parseInt(t.token, 10);
    if (dayNum < 1 || dayNum > 31) continue;

    if (!best || dx < best.dx) best = { dayNum, x: t.x, dx };
  }

  return best ? { dayNum: best.dayNum, x: best.x } : null;
}

function extractDayAnchors(words: OcrWord[]): DayAnchor[] {
  const { lines, tolerance } = groupWordsByLine(words);

  const dayNames = new Set([
    'LUNES',
    'MARTES',
    'MIERCOLES',
    'JUEVES',
    'VIERNES',
    'SABADO',
    'DOMINGO',
  ]);

  const anchors: DayAnchor[] = [];

  for (const line of lines) {
    const tokens = buildLineWords(line);

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (!dayNames.has(tok.token)) continue;

      const numTok = findDayNumberToRight(tokens, i);
      if (!numTok) continue;

      anchors.push({ dayNum: numTok.dayNum, x: numTok.x, y: line.y });
    }
  }

  if (!anchors.length) return [];

  // Nos quedamos con la banda superior (headers)
  const minY = Math.min(...anchors.map((a) => a.y));
  const headerBand = Math.max(30, tolerance * 2);
  const headerAnchors = anchors.filter((a) => a.y <= minY + headerBand);

  headerAnchors.sort((a, b) => a.x - b.x);
  return headerAnchors;
}

function nearestDayByX(x: number, anchors: DayAnchor[]): number {
  let best = anchors[0];
  let bestD = Math.abs(x - best.x);

  for (const a of anchors) {
    const d = Math.abs(x - a.x);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best.dayNum;
}

function parseFromWords(words: OcrWord[], aliases: string[]): ImportedTurn[] {
  const aliasTokensList = normalizeAliases(aliases);
  if (!aliasTokensList.length) return [];

  const anchors = extractDayAnchors(words);
  if (!anchors.length) return [];

  const { lines } = groupWordsByLine(words);
  const turns: ImportedTurn[] = [];

  for (const line of lines) {
    const lineWords = buildLineWords(line);

    // tiempos candidatos en la línea
    const timeCandidates = lineWords
      .map((w) => ({ time: extractTime(w.raw), x: w.x }))
      .filter((t): t is { time: string; x: number } => !!t.time);

    if (!timeCandidates.length) continue;

    // matches de alias exactos (MIGUEL != MIGUELL)
    const aliasMatches = findAliasMatches(lineWords, aliasTokensList);
    if (!aliasMatches.length) continue;

    for (const aliasMatch of aliasMatches) {
      // el tiempo más cercano en X a la derecha del alias
      let best: { time: string; x: number; score: number } | null = null;

      for (const c of timeCandidates) {
        const dx = c.x - aliasMatch.x;
        if (dx < -60 || dx > 400) continue; // ventana razonable
        const score = Math.abs(dx);
        if (!best || score < best.score) best = { time: c.time, x: c.x, score };
      }

      if (!best) continue;

      const dayNum = nearestDayByX(best.x, anchors);
      turns.push({
        date: buildISODateForDayNumber(dayNum),
        startTime: best.time,
      });
    }
  }

  return Array.from(new Map(turns.map(t => [`${t.date}_${t.startTime}`, t])).values())
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
}
