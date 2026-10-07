import { Request, Response } from 'express';
import { dbStore } from '../config/database';
import { emergencyService } from '../services/emergency.service';
import { sim7670Service } from '../services/sim7670.service';
import { AlarmEventType, AlarmSeverity, AuthenticatedRequest } from '../types';

export const getAlarmsList = (req: Request, res: Response): void => {
  const statusFilter = req.query.status as string | undefined;
  const lifecycleFilter = req.query.lifecycle_state as string | undefined;
  const floorFilter = req.query.floor ? Number(req.query.floor) : undefined;

  let list = dbStore.alarmEvents;
  if (statusFilter) {
    list = list.filter((a) => a.status === statusFilter);
  }
  if (lifecycleFilter) {
    list = list.filter((a) => a.lifecycle_state === lifecycleFilter);
  }
  if (floorFilter) {
    list = list.filter((a) => a.floor_number === floorFilter);
  }

  res.json({
    alarms: list,
    active_count: dbStore.alarmEvents.filter((a) => a.status === 'active').length
  });
};

export const triggerEmergencySimulation = async (req: Request, res: Response): Promise<void> => {
  const { sensor_id, chip_id, event_type, severity, smoke_val, temp_val } = req.body as {
    sensor_id?: number;
    chip_id?: string;
    event_type?: AlarmEventType;
    severity?: AlarmSeverity;
    smoke_val?: number;
    temp_val?: number;
  };

  const alarm = await emergencyService.triggerAlarm({
    sensorId: sensor_id,
    chipId: chip_id,
    eventType: event_type || 'SMOKE_CRITICAL',
    severity: severity || 'critical',
    smokeVal: smoke_val ?? 680.5,
    tempVal: temp_val ?? 62.4
  });

  res.status(201).json({
    message: 'Emergency alarm triggered — 60s grace countdown started before 112 State Dispatch',
    alarm
  });
};

export const acknowledgeFalseAlarm = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const alarmId = Number(req.params.id);
  const userId = req.user?.id || 2;
  const { comment } = (req.body || {}) as { comment?: string };

  const updated = await emergencyService.acknowledgeAlarm(alarmId, userId, comment);
  if (!updated) {
    res.status(404).json({ error: 'Alarm event not found' });
    return;
  }

  res.json({
    message: `Alarm acknowledged (${updated.lifecycle_state}). 112 State escalation cancelled.`,
    alarm: updated
  });
};

export const forceDispatch112 = async (req: Request, res: Response): Promise<void> => {
  const alarmId = Number(req.params.id);
  const updated = await emergencyService.dispatchTo112StateApi(alarmId);

  if (!updated) {
    res.status(404).json({ error: 'Alarm event not found' });
    return;
  }

  res.json({
    message: 'Emergency payload dispatched to 112 State Emergency API',
    alarm: updated
  });
};

export const resolveAlarmEvent = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const alarmId = Number(req.params.id);
  const userId = req.user?.id || 1;
  const { comment } = (req.body || {}) as { comment?: string };

  const updated = await emergencyService.resolveAlarm(alarmId, userId, comment);
  if (!updated) {
    res.status(404).json({ error: 'Alarm event not found' });
    return;
  }

  res.json({
    message: `Alarm event cleared & resolved (${updated.lifecycle_state})`,
    alarm: updated
  });
};

export const addCommentToAlarm = (req: AuthenticatedRequest, res: Response): void => {
  const alarmId = Number(req.params.id);
  const userId = req.user?.id || 1;
  const { comment } = req.body as { comment: string };

  if (!comment) {
    res.status(400).json({ error: 'Comment text is required' });
    return;
  }

  const updated = emergencyService.addCommentToAlarm(alarmId, userId, comment);
  if (!updated) {
    res.status(404).json({ error: 'Alarm event not found' });
    return;
  }

  res.json({
    message: 'Audit comment added to alarm lifecycle',
    alarm: updated
  });
};

export const getSim7670GatewayStatus = (_req: Request, res: Response): void => {
  res.json({
    gateway: sim7670Service.getStatus()
  });
};

export const sendSim7670AtCommand = (req: Request, res: Response): void => {
  const { command } = req.body as { command: string };
  if (!command) {
    res.status(400).json({ error: 'AT command string is required' });
    return;
  }

  const result = sim7670Service.executeCustomAtCommand(command);
  res.json({
    result,
    gateway: sim7670Service.getStatus()
  });
};
