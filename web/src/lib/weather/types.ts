export type ForecastDay = {
  date: string;
  weekday: string;
  weekdayShort: string;
  maxC: number;
  minC: number;
  precipitationMm: number;
};

export type Forecast = {
  temperatureC: number;
  weatherCode: number;
  windKmh: number;
  /** Calendar day of `current.time` in the forecast timezone. */
  observedOn: string;
  days: ForecastDay[];
};
