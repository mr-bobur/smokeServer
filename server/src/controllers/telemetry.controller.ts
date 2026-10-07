import { Request, Response } from 'express';
import { dbStore, ensureQuarterlyPartitions } from '../config/database';

export const getTelemetryAnalytics = (req: Request, res: Response): void => {
  const sensorId = req.query.sensor_id ? Number(req.query.sensor_id) : 3; // Default Apt 42 Multi-Fire
  const rangeParam = (req.query.range as string) || '24h';
  const validRange: '24h' | '7d' | '30d' | '1y' = ['24h', '7d', '30d', '1y'].includes(rangeParam)
    ? (rangeParam as '24h' | '7d' | '30d' | '1y')
    : '24h';

  const sensor = dbStore.sensors.find((s) => s.id === sensorId) || dbStore.sensors[0];
  const series = dbStore.generateHistoricalTelemetry(sensor.id, validRange);

  const maxSmoke = Math.max(...series.map((p) => p.smoke_ppm));
  const avgSmoke = Number(
    (series.reduce((acc, p) => acc + p.smoke_ppm, 0) / Math.max(1, series.length)).toFixed(1)
  );
  const maxTemp = Math.max(...series.map((p) => p.temperature));
  const avgTemp = Number(
    (series.reduce((acc, p) => acc + p.temperature, 0) / Math.max(1, series.length)).toFixed(1)
  );

  res.json({
    sensor,
    range: validRange,
    benchmarks: {
      smoke_critical_ppm: 400,
      temperature_critical_c: 60
    },
    summary: {
      max_smoke_ppm: maxSmoke,
      avg_smoke_ppm: avgSmoke,
      max_temp_c: maxTemp,
      avg_temp_c: avgTemp,
      total_points: series.length
    },
    series
  });
};

export const getPartitionMetadata = async (_req: Request, res: Response): Promise<void> => {
  const info = await ensureQuarterlyPartitions();
  res.json({
    table: 'telemetry_logs',
    retention_policy: '1+ Year High-Performance Range Partitioning',
    ...info
  });
};
