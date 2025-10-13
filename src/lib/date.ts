import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.tz.setDefault("Asia/Bangkok");

export { dayjs };

export function monthKey(d = dayjs()) {
  return d.tz().format("YYYY-MM");
}

export function todayKey() {
  return dayjs().tz().format("YYYY-MM-DD");
}

export function buildMonthGrid(yyyyMm: string) {
  const first = dayjs.tz(`${yyyyMm}-01`);
  const from = first.startOf("isoWeek");
  const to = first.endOf("month").endOf("isoWeek");
  const days: string[] = [];
  for (let d = from; d.isBefore(to) || d.isSame(to, "day"); d = d.add(1, "day")) {
    days.push(d.format("YYYY-MM-DD"));
  }
  return days;
}
