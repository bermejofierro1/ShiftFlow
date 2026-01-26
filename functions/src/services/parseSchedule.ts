export interface ParsedDay {
  weekday: string;
  dayOfMonth: number;
  times: string[];
}

export interface TurnItem {
  date: string;
  startTime: string;
}

const WEEKDAY_MAP: Record<string, number> = {
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SABADO: 6,
  DOMINGO: 0,
};

const HEADER_REGEX = /(LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO)\s+(\d{1,2})/i;
const TIME_REGEX = /\b(\d{1,2}:\d{2})\b/g;

export function parseSchedule(text: string, aliases: string[]): ParsedDay[] {
  if (!text || aliases.length === 0) return [];

  const lines = text.split(/\r?\n/);
  const normalizedAliases = aliases
    .map((alias) => normalizeForMatch(alias))
    .filter((alias) => alias.length > 0);

  const byKey = new Map<string, ParsedDay>();
  let current: ParsedDay | null = null;

  for (const rawLine of lines) {
    const normalizedLine = normalizeLine(rawLine);
    const headerMatch = normalizedLine.match(HEADER_REGEX);

    if (headerMatch) {
      const weekday = headerMatch[1].toUpperCase();
      const dayOfMonth = Number(headerMatch[2]);
      const key = `${weekday}-${dayOfMonth}`;

      if (!byKey.has(key)) {
        byKey.set(key, { weekday, dayOfMonth, times: [] });
      }

      current = byKey.get(key) || null;
      continue;
    }

    if (!current) continue;

    if (!lineHasAlias(normalizedLine, normalizedAliases)) {
      continue;
    }

    const times = normalizedLine.match(TIME_REGEX) || [];
    times.forEach((time) => current?.times.push(time));
  }

  return Array.from(byKey.values()).map((day) => ({
    ...day,
    times: Array.from(new Set(day.times)),
  }));
}

export function buildTurns(parsed: ParsedDay[], referenceDate: Date): TurnItem[] {
  const turns: TurnItem[] = [];
  const seen = new Set<string>();

  parsed.forEach((day) => {
    const resolved = resolveDate(day.weekday, day.dayOfMonth, referenceDate);
    if (!resolved) return;

    day.times.forEach((time) => {
      const normalizedTime = normalizeTime(time);
      if (!normalizedTime) return;

      const key = `${resolved}|${normalizedTime}`;
      if (seen.has(key)) return;
      seen.add(key);

      turns.push({ date: resolved, startTime: normalizedTime });
    });
  });

  return turns.sort((a, b) => {
    if (a.date === b.date) return a.startTime.localeCompare(b.startTime);
    return a.date.localeCompare(b.date);
  });
}

export function resolveDate(
  weekday: string,
  dayOfMonth: number,
  referenceDate: Date
): string | null {
  if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) return null;

  const base = new Date(referenceDate.getTime());
  const baseYear = base.getFullYear();
  const baseMonth = base.getMonth();
  const targetWeekday = WEEKDAY_MAP[normalizeWeekday(weekday)];

  const candidates = [-1, 0, 1]
    .map((offset) => new Date(baseYear, baseMonth + offset, dayOfMonth))
    .filter((d) => d.getDate() === dayOfMonth)
    .filter((d) => {
      if (Number.isNaN(targetWeekday)) return true;
      return d.getDay() === targetWeekday;
    });

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) => Math.abs(a.getTime() - base.getTime()) - Math.abs(b.getTime() - base.getTime())
  );

  return formatDate(candidates[0]);
}

function normalizeLine(input: string): string {
  return stripDiacritics(input).toUpperCase();
}

function normalizeWeekday(input: string): string {
  return stripDiacritics(input).toUpperCase();
}

function normalizeForMatch(input: string): string {
  return stripDiacritics(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function lineHasAlias(normalizedLine: string, aliases: string[]): boolean {
  const lineToken = normalizeForMatch(normalizedLine);
  return aliases.some((alias) => lineToken.includes(alias));
}

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeTime(input: string): string | null {
  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const hh = hour.toString().padStart(2, '0');
  const mm = minute.toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
