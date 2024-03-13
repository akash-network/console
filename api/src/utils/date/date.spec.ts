import { getTodayUTC, toUTC, getPrettyTime } from './date';

describe('date helpers', () => {
  describe('getTodayUTC', () => {
    it('should return the current date in UTC with the time set to 00:00:00', () => {
      const currentDate = new Date();
      const expected = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate(), 0, 0, 0, 0));

      expect(getTodayUTC()).toEqual(expected);
    });
  });

  describe('toUTC', () => {
    it('should return the date in UTC', () => {
      const date = new Date();
      const expected = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()));

      expect(toUTC(date)).toEqual(expected);
    });
  });

  describe('getPrettyTime', () => {
    it('should return the time in milliseconds', () => {
      expect(getPrettyTime(5)).toBe('5ms');
    });

    it('should return the time in seconds', () => {
      expect(getPrettyTime(500)).toBe('500ms');
      expect(getPrettyTime(5000)).toBe('5s');
    });

    it('should return the time in minutes and seconds', () => {
      expect(getPrettyTime(60 * 1000)).toBe('1m 0s');
      expect(getPrettyTime(60 * 1000 + 400)).toBe('1m 0s');
      expect(getPrettyTime(60 * 1000 + 1400)).toBe('1m 1s');
    });

    it('should return the time in hours and minutes', () => {
      expect(getPrettyTime(60 * 60 * 1000)).toBe('1h 0m');
      expect(getPrettyTime(60 * 60 * 1000 + 60 * 1000)).toBe('1h 1m');
      expect(getPrettyTime(60 * 60 * 1000 + 60 * 1000 + 500)).toBe('1h 1m');
    });
  });
})
