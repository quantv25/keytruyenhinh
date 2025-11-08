// V2 MỚI: Thư viện nhỏ để lấy số ngày trong tháng
export const Calendar = {
  isLeap: (year) => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  },
  getDaysInMonth: (year, month) => {
    return [
      31,
      Calendar.isLeap(year) ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ][month - 1];
  }
};
