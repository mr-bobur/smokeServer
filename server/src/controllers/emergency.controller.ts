import { Request, Response } from 'express';
import { dbStore } from '../config/database';
import { emergencyService } from '../services/emergency.service';
import { sim7670Service } from '../services/sim7670.service';
import { AlarmEventType, AlarmManagedStatus, AlarmSeverity, AuthenticatedRequest } from '../types';
import { isMqttBrokerConnected, mqttClient } from '../config/mqtt';

export const getAlarmsList = (req: Request, res: Response): void => {
  const statusFilter = req.query.status as string | undefined;
  const managedStatusFilter = req.query.managed_status as string | undefined;
  const lifecycleFilter = req.query.lifecycle_state as string | undefined;
  const floorFilter = req.query.floor ? Number(req.query.floor) : undefined;
  const buildingFilter = req.query.building_id ? Number(req.query.building_id) : undefined;

  let list = dbStore.alarmEvents.map((a) => {
    if (!a.managed_status) {
      a.managed_status =
        a.status === 'resolved'
          ? 'managed_alarm'
          : a.status === 'acknowledged'
          ? 'seen_alarm'
          : 'new_alarm';
    }
    if (!a.status_history || a.status_history.length === 0) {
      a.status_history = [
        {
          id: `HIST-${a.id}-init`,
          from_status: null,
          to_status: a.managed_status,
          user_id: a.acknowledged_by || 0,
          user_name: a.acknowledged_by_name || 'Tizim',
          user_role: 'system',
          resolution_outcome:
            a.resolution_outcome ||
            (a.status === 'resolved' ? 'Xavf bartaraf etilgan' : 'Signal qayd etilgan'),
          comment: `Dastlabki signal holati: ${a.managed_status}`,
          timestamp: a.created_at
        }
      ];
    }
    return a;
  });

  if (managedStatusFilter) {
    list = list.filter((a) => a.managed_status === managedStatusFilter);
  }
  if (statusFilter) {
    list = list.filter((a) => a.status === statusFilter);
  }
  if (lifecycleFilter) {
    list = list.filter((a) => a.lifecycle_state === lifecycleFilter);
  }
  if (floorFilter) {
    list = list.filter((a) => a.floor_number === floorFilter);
  }
  if (buildingFilter) {
    list = list.filter((a) => a.building_id === buildingFilter);
  }

  const newAlarmsCount = dbStore.alarmEvents.filter(
    (a) => (a.managed_status || (a.status === 'active' ? 'new_alarm' : '')) === 'new_alarm'
  ).length;

  const seenAlarmsCount = dbStore.alarmEvents.filter(
    (a) => (a.managed_status || (a.status === 'acknowledged' ? 'seen_alarm' : '')) === 'seen_alarm'
  ).length;

  const managedAlarmsCount = dbStore.alarmEvents.filter(
    (a) => (a.managed_status || (a.status === 'resolved' ? 'managed_alarm' : '')) === 'managed_alarm'
  ).length;

  res.json({
    alarms: list,
    active_count: dbStore.alarmEvents.filter((a) => a.status === 'active').length,
    counts: {
      new_alarm: newAlarmsCount,
      seen_alarm: seenAlarmsCount,
      managed_alarm: managedAlarmsCount,
      total: dbStore.alarmEvents.length
    }
  });
};

export const updateAlarmStatusHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const alarmId = Number(req.params.id);
  const userId = req.user?.id || 1;
  const { status, resolution_outcome, comment } = req.body as {
    status: AlarmManagedStatus;
    resolution_outcome?: string;
    comment?: string;
  };

  if (!status || !['new_alarm', 'seen_alarm', 'managed_alarm'].includes(status)) {
    res.status(400).json({
      error: "Yaroqsiz status! Mumkin bo'lgan holatlar: 'new_alarm', 'seen_alarm', 'managed_alarm'"
    });
    return;
  }

  const updated = await emergencyService.updateAlarmStatus({
    alarmId,
    newStatus: status,
    userId,
    resolutionOutcome: resolution_outcome,
    comment
  });

  if (!updated) {
    res.status(404).json({ error: 'Alarm hodisasi topilmadi' });
    return;
  }

  res.json({
    message: `Alarm statusi muvaffaqiyatli yangilandi: ${status}`,
    alarm: updated
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
  const { command, gateway_id } = req.body as { command: string; gateway_id?: string };
  if (!command) {
    res.status(400).json({ error: 'AT command string is required' });
    return;
  }

  const targetGwId = gateway_id || 'GW-LILYGO-TCALL-SIM800';

  // Publish downlink command via MQTT to gateway if connected
  if (isMqttBrokerConnected && mqttClient) {
    const topic = `smartbuilding/gateway/${targetGwId}/command`;
    mqttClient.publish(topic, JSON.stringify({ command, gateway_id: targetGwId, timestamp: Date.now() }), { qos: 1 });
  }

  const result = sim7670Service.executeCustomAtCommand(command);
  res.json({
    result,
    gateway_id: targetGwId,
    gateway: sim7670Service.getStatus()
  });
};
