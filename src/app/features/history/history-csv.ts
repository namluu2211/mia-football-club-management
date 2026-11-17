import type { HistoryEntry } from '../../services/firebase.service';
import { CsvColumn, toCsv } from '../../utils/csv.utils';

const names = (list: readonly string[] | undefined): string => (list ?? []).join('; ');
const profit = (m: HistoryEntry): number => (m.thu ?? 0) - (m.chi_total ?? 0);

export const HISTORY_CSV_COLUMNS: readonly CsvColumn<HistoryEntry>[] = [
  { header: 'Ngày', value: m => m.date },
  { header: 'Ghi chú', value: m => m.description },
  { header: 'Đội Xanh', value: m => names(m.teamA) },
  { header: 'Đội Cam', value: m => names(m.teamB) },
  { header: 'Bàn Xanh', value: m => m.scoreA },
  { header: 'Bàn Cam', value: m => m.scoreB },
  { header: 'Ghi bàn Xanh', value: m => m.scorerA },
  { header: 'Ghi bàn Cam', value: m => m.scorerB },
  { header: 'Kiến tạo Xanh', value: m => m.assistA },
  { header: 'Kiến tạo Cam', value: m => m.assistB },
  { header: 'Thẻ vàng Xanh', value: m => m.yellowA },
  { header: 'Thẻ vàng Cam', value: m => m.yellowB },
  { header: 'Thẻ đỏ Xanh', value: m => m.redA },
  { header: 'Thẻ đỏ Cam', value: m => m.redB },
  { header: 'Thu', value: m => m.thu },
  { header: 'Chi trọng tài', value: m => m.chi_trongtai },
  { header: 'Chi nước', value: m => m.chi_nuoc },
  { header: 'Chi sân', value: m => m.chi_san },
  { header: 'Chi đi lại', value: m => m.chi_dilai },
  { header: 'Chi ăn uống', value: m => m.chi_anuong },
  { header: 'Chi khác', value: m => m.chi_khac },
  { header: 'Tổng chi', value: m => m.chi_total },
  { header: 'Lãi/Lỗ', value: profit }
];

export function historyToCsv(matches: readonly HistoryEntry[]): string {
  return toCsv(matches, HISTORY_CSV_COLUMNS);
}
