import { escapeCsvCell, toCsv } from '../csv.utils';
import { historyToCsv, HISTORY_CSV_COLUMNS } from '../../features/history/history-csv';

describe('escapeCsvCell', () => {
  it('leaves simple values untouched and renders null/undefined as empty', () => {
    expect(escapeCsvCell('abc')).toBe('abc');
    expect(escapeCsvCell(12)).toBe('12');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises spreadsheet formulas in text but keeps negative numbers numeric', () => {
    expect(escapeCsvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(escapeCsvCell('+1')).toBe("'+1");
    expect(escapeCsvCell('@cmd')).toBe("'@cmd");
    expect(escapeCsvCell('-5 text')).toBe("'-5 text");
    expect(escapeCsvCell(-5)).toBe('-5');
  });
});

describe('toCsv', () => {
  it('writes a header row and CRLF line endings', () => {
    const csv = toCsv([{ a: 1, b: 'x' }], [
      { header: 'A', value: r => r.a },
      { header: 'B', value: r => r.b }
    ]);
    expect(csv).toBe('A,B\r\n1,x\r\n');
  });

  it('returns only the header for no rows', () => {
    expect(toCsv([], [{ header: 'A', value: () => 1 }])).toBe('A\r\n');
  });
});

describe('historyToCsv', () => {
  it('maps a match, joins players and computes profit', () => {
    const csv = historyToCsv([{
      date: '2025-01-05', teamA: ['An', 'Bình'], teamB: ['Cường'], scoreA: 3, scoreB: 2,
      scorerA: 'An (2), Bình', thu: 1000000, chi_total: 400000, description: '=HYPERLINK("x")'
    }]);
    const [header, row] = csv.trim().split('\r\n');
    expect(header.split(',')).toHaveLength(HISTORY_CSV_COLUMNS.length);
    expect(row).toContain('2025-01-05');
    expect(row).toContain(',An; Bình,Cường,');
    expect(row).toContain('"An (2), Bình"');
    expect(row).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(row.endsWith(',600000')).toBe(true);
  });
});
