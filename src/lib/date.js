export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
export const todayYmd = () => ymd(new Date());

export const fmtDate = (s) => {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
};
export const fmtDateFull = (s) => `${parseYmd(s).getFullYear()}년 ${fmtDate(s)}`;
