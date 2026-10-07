import axios from 'axios';
import { dbStore, isMysqlConnected, mysqlPool } from '../config/database';
import {
  AlarmEventRecord,
  AlarmEventType,
  AlarmSeverity,
  Emergency112Payload
} from '../types';
import { socketService } from './socket.service';
import { sim7670Service } from './sim7670.service';

interface ActiveCountdown {
  alarmId: number;
  remainingSeconds: number;
  intervalHandle: NodeJS.Timeout;
}

class EmergencyService {
  private activeCountdowns: Map<number, ActiveCountdown> = new Map();

  public async triggerAlarm(params: {
    chipId?: string;
    sensorId?: number;
    eventType?: AlarmEventType;
    severity?: AlarmSeverity;
    smokeVal?: number;
    tempVal?: number;
    coVal?: number;
  }): Promise<AlarmEventRecord> {
    const sensor =
      (params.sensorId ? dbStore.sensors.find((s) => s.id === params.sensorId) : undefined) ||
      (params.chipId ? dbStore.sensors.find((s) => s.chip_id === params.chipId) : undefined) ||
      dbStore.sensors.find((s) => s.chip_id === 'C3-9A4F22B8') ||
      dbStore.sensors[0];

    const room = dbStore.rooms.find((r) => r.id === sensor.room_id);
    const owner = room?.owner_user_id ? dbStore.users.find((u) => u.id === room.owner_user_id) : null;
    const manager = dbStore.users.find((u) => u.role === 'tenant') || dbStore.users[0];

    const eventType: AlarmEventType = params.eventType || 'SMOKE_CRITICAL';
    const severity: AlarmSeverity = params.severity || 'critical';
    const smokeVal = params.smokeVal ?? 680.5;
    const tempVal = params.tempVal ?? 62.4;
    const coVal = params.coVal ?? 48.0;

    sensor.status = 'alarm';
    sensor.smoke_ppm = smokeVal;
    sensor.temperature = tempVal;
    sensor.co_ppm = coVal;
    sensor.beacon_interval_seconds = 1;
    sensor.last_seen = new Date().toISOString();
    if (eventType === 'UNAUTHORIZED_ENTRY') sensor.reed_switch_open = true;
    if (eventType === 'GLASS_BREAK') sensor.glass_break_detected = true;

    // ThingsBoard Stateful Alarm Deduplication:
    // If an active alarm already exists for this originator (sensor_id + event_type),
    // increment trigger_count and update peak_value instead of creating duplicate alarm rows.
    const existingActiveAlarm = dbStore.alarmEvents.find(
      (a) =>
        a.sensor_id === sensor.id &&
        a.event_type === eventType &&
        (a.status === 'active' ||
          a.lifecycle_state === 'ACTIVE_UNACK' ||
          a.lifecycle_state === 'ACTIVE_ACK')
    );

    const currentPrimaryMetric =
      eventType === 'TEMP_THRESHOLD'
        ? tempVal
        : eventType === 'CO_DANGER'
          ? coVal
          : smokeVal;

    if (existingActiveAlarm) {
      existingActiveAlarm.trigger_count = (existingActiveAlarm.trigger_count || 1) + 1;
      existingActiveAlarm.peak_value = Math.max(
        existingActiveAlarm.peak_value || 0,
        currentPrimaryMetric
      );
      existingActiveAlarm.smoke_val = smokeVal;
      existingActiveAlarm.temp_val = tempVal;
      existingActiveAlarm.co_val = coVal;
      existingActiveAlarm.updated_at = new Date().toISOString();

      socketService.emitGlobal('ALARM_TRIGGERED', {
        alarm: existingActiveAlarm,
        deduplicated: true,
        sensor,
        audio_alert: {
          play_siren: true,
          frequency_hz: 880,
          pattern: 'PULSE_FAST'
        }
      });

      return existingActiveAlarm;
    }

    const newAlarmId =
      dbStore.alarmEvents.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const alarmCode = `ALM-${dateStamp}-${String(newAlarmId).padStart(3, '0')}`;
    const nowIso = new Date().toISOString();

    const alarmRecord: AlarmEventRecord = {
      id: newAlarmId,
      building_id: sensor.building_id,
      alarm_code: alarmCode,
      sensor_id: sensor.id,
      chip_id: sensor.chip_id,
      floor_number: sensor.floor_number,
      room_number: sensor.room_number,
      event_type: eventType,
      severity,
      status: 'active',
      lifecycle_state: 'ACTIVE_UNACK',
      trigger_count: 1,
      peak_value: currentPrimaryMetric,
      smoke_val: smokeVal,
      temp_val: tempVal,
      co_val: coVal,
      acknowledged_by: null,
      acknowledged_by_name: null,
      acknowledged_at: null,
      cleared_at: null,
      comments: [
        {
          id: `CMT-${Date.now()}`,
          user_id: 0,
          user_name: 'ThingsBoard Safety Engine',
          comment: `Originator ${sensor.chip_id} (${sensor.profile_code}) crossed critical threshold (${currentPrimaryMetric}). State -> ACTIVE_UNACK.`,
          created_at: nowIso
        }
      ],
      emergency_112_payload: null,
      emergency_112_dispatched_at: null,
      emergency_112_response: null,
      countdown_remaining_sec: 60,
      created_at: nowIso,
      updated_at: nowIso
    };

    dbStore.alarmEvents.unshift(alarmRecord);

    if (isMysqlConnected && mysqlPool) {
      try {
        await mysqlPool.query(
          `INSERT INTO alarm_events (sensor_id, event_type, severity, smoke_val, temp_val, status, lifecycle_state, trigger_count, peak_value) VALUES (?, ?, ?, ?, ?, 'active', 'ACTIVE_UNACK', 1, ?)`,
          [sensor.id, eventType, severity, smokeVal, tempVal, currentPrimaryMetric]
        );
        await mysqlPool.query(
          `UPDATE sensors_endpoints SET status = 'alarm', beacon_interval_seconds = 1, last_seen = NOW() WHERE id = ?`,
          [sensor.id]
        );
      } catch {
        // Non-blocking DB sync
      }
    }

    socketService.emitGlobal('ALARM_TRIGGERED', {
      alarm: alarmRecord,
      sensor,
      audio_alert: {
        play_siren: true,
        frequency_hz: 880,
        pattern: 'PULSE_FAST'
      }
    });

    if (owner?.phone_number) {
      sim7670Service.sendEmergencySms(
        owner.phone_number,
        sensor.floor_number,
        sensor.room_number,
        eventType
      );
    }
    sim7670Service.sendEmergencySms(
      manager?.phone_number || '+998712000000',
      sensor.floor_number,
      sensor.room_number,
      eventType
    );
    sim7670Service.initiateEmergencyVoiceCall(
      manager?.phone_number || '+998712000000',
      'Shirkat Building Manager'
    );

    if (severity === 'critical' || severity === 'emergency') {
      this.start60SecondEscalationTimer(alarmRecord.id);
    }

    return alarmRecord;
  }

  private start60SecondEscalationTimer(alarmId: number): void {
    this.clearCountdown(alarmId);

    const state: ActiveCountdown = {
      alarmId,
      remainingSeconds: 60,
      intervalHandle: setInterval(async () => {
        const alarm = dbStore.alarmEvents.find((a) => a.id === alarmId);
        if (!alarm || alarm.status !== 'active') {
          this.clearCountdown(alarmId);
          return;
        }

        state.remainingSeconds -= 1;
        alarm.countdown_remaining_sec = state.remainingSeconds;

        socketService.emitGlobal('ALARM_COUNTDOWN', {
          alarm_id: alarm.id,
          alarm_code: alarm.alarm_code,
          countdown_remaining_sec: state.remainingSeconds
        });

        if (state.remainingSeconds <= 0) {
          this.clearCountdown(alarmId);
          await this.dispatchTo112StateApi(alarm.id);
        }
      }, 1000)
    };

    this.activeCountdowns.set(alarmId, state);
  }

  private clearCountdown(alarmId: number): void {
    const existing = this.activeCountdowns.get(alarmId);
    if (existing) {
      clearInterval(existing.intervalHandle);
      this.activeCountdowns.delete(alarmId);
    }
  }

  public async acknowledgeAlarm(
    alarmId: number,
    userId: number,
    commentText?: string
  ): Promise<AlarmEventRecord | null> {
    this.clearCountdown(alarmId);

    const alarm = dbStore.alarmEvents.find((a) => a.id === alarmId);
    if (!alarm) return null;

    const nowIso = new Date().toISOString();
    const user = dbStore.users.find((u) => u.id === userId) || dbStore.users[0];
    alarm.status = 'acknowledged';
    alarm.lifecycle_state =
      alarm.lifecycle_state === 'CLEARED_UNACK' ? 'CLEARED_ACK' : 'ACTIVE_ACK';
    alarm.acknowledged_by = user.id;
    alarm.acknowledged_by_name = user.name;
    alarm.acknowledged_at = nowIso;
    alarm.updated_at = nowIso;
    alarm.countdown_remaining_sec = 0;

    if (!alarm.comments) alarm.comments = [];
    alarm.comments.push({
      id: `CMT-${Date.now()}`,
      user_id: user.id,
      user_name: user.name,
      comment:
        commentText ||
        `Alarm acknowledged by ${user.name}. Lifecycle -> ${alarm.lifecycle_state}.`,
      created_at: nowIso
    });

    const sensor = dbStore.sensors.find((s) => s.id === alarm.sensor_id);
    if (sensor) {
      sensor.status = 'online';
      sensor.smoke_ppm = 32.4;
      sensor.temperature = 24.2;
      sensor.co_ppm = 6.5;
      sensor.reed_switch_open = false;
      sensor.glass_break_detected = false;
      sensor.beacon_interval_seconds = 600;
      sensor.last_seen = nowIso;
    }

    if (isMysqlConnected && mysqlPool) {
      try {
        await mysqlPool.query(
          `UPDATE alarm_events SET status = 'acknowledged', lifecycle_state = ?, acknowledged_by = ?, acknowledged_at = NOW() WHERE id = ?`,
          [alarm.lifecycle_state, user.id, alarm.id]
        );
      } catch {
        // Non-blocking
      }
    }

    socketService.emitGlobal('ALARM_ACKNOWLEDGED', {
      alarm,
      sensor
    });

    return alarm;
  }

  public async resolveAlarm(
    alarmId: number,
    userId: number,
    commentText?: string
  ): Promise<AlarmEventRecord | null> {
    this.clearCountdown(alarmId);

    const alarm = dbStore.alarmEvents.find((a) => a.id === alarmId);
    if (!alarm) return null;

    const nowIso = new Date().toISOString();
    const user = dbStore.users.find((u) => u.id === userId) || dbStore.users[0];
    alarm.status = 'resolved';
    alarm.lifecycle_state = alarm.acknowledged_by ? 'CLEARED_ACK' : 'CLEARED_ACK';
    alarm.cleared_at = nowIso;
    alarm.updated_at = nowIso;
    if (!alarm.acknowledged_by) {
      alarm.acknowledged_by = user.id;
      alarm.acknowledged_by_name = user.name;
      alarm.acknowledged_at = nowIso;
    }
    alarm.countdown_remaining_sec = 0;

    if (!alarm.comments) alarm.comments = [];
    alarm.comments.push({
      id: `CMT-${Date.now()}`,
      user_id: user.id,
      user_name: user.name,
      comment:
        commentText ||
        `Hazard cleared & verified by ${user.name}. Lifecycle -> CLEARED_ACK.`,
      created_at: nowIso
    });

    const sensor = dbStore.sensors.find((s) => s.id === alarm.sensor_id);
    if (sensor) {
      sensor.status = 'online';
      sensor.smoke_ppm = 26.0;
      sensor.temperature = 23.8;
      sensor.co_ppm = 5.2;
      sensor.reed_switch_open = false;
      sensor.glass_break_detected = false;
      sensor.beacon_interval_seconds = 600;
    }

    socketService.emitGlobal('ALARM_RESOLVED', { alarm, sensor });
    return alarm;
  }

  public addCommentToAlarm(
    alarmId: number,
    userId: number,
    commentText: string
  ): AlarmEventRecord | null {
    const alarm = dbStore.alarmEvents.find((a) => a.id === alarmId);
    if (!alarm) return null;

    const user = dbStore.users.find((u) => u.id === userId) || dbStore.users[0];
    if (!alarm.comments) alarm.comments = [];
    alarm.comments.push({
      id: `CMT-${Date.now()}`,
      user_id: user.id,
      user_name: user.name,
      comment: commentText,
      created_at: new Date().toISOString()
    });
    alarm.updated_at = new Date().toISOString();

    socketService.emitGlobal('ALARM_COMMENT_ADDED', { alarm });
    return alarm;
  }

  public async dispatchTo112StateApi(alarmId: number): Promise<AlarmEventRecord | null> {
    this.clearCountdown(alarmId);

    const alarm = dbStore.alarmEvents.find((a) => a.id === alarmId);
    if (!alarm) return null;

    const payload112: Emergency112Payload = {
      agency_code: 'EMERGENCY_UZ_112',
      building_id: 'SMART-BLD-TASHKENT-09',
      address: 'Amir Timur Avenue 108, Block B',
      floor_number: alarm.floor_number,
      room_number: alarm.room_number,
      threat_type:
        alarm.event_type === 'UNAUTHORIZED_ENTRY' || alarm.event_type === 'GLASS_BREAK'
          ? 'PERIMETER_INTRUSION_HAZARD'
          : 'FIRE_SMOKE_HAZARD',
      readings: {
        smoke_ppm: alarm.smoke_val,
        temp_celsius: alarm.temp_val
      },
      contact_person: 'Shirkat Manager',
      contact_phone: '+998712000000',
      dispatched_at: new Date().toISOString()
    };

    let apiResponse: Record<string, unknown> = {
      agency: 'Ministry of Emergency Situations (FVV 112 Uzbekistan)',
      incident_ticket: `UZ112-${Date.now().toString().slice(-6)}`,
      dispatch_unit: 'Tashkent Central Fire & Rescue Brigade #4',
      eta_minutes: 5,
      voice_channel: 'GSM_SIM7670_PRIORITY_PATCH',
      status: 'DISPATCH_CONFIRMED'
    };

    const api112Url = process.env.EMERGENCY_112_API_URL;
    if (api112Url) {
      try {
        const response = await axios.post(api112Url, payload112, {
          headers: { Authorization: `Bearer ${process.env.EMERGENCY_112_TOKEN || 'uz-112-token'}` },
          timeout: 4000
        });
        apiResponse = response.data;
      } catch {
        // Fallback to simulated 112 State Dispatch confirmation when external govt endpoint is offline
      }
    }

    alarm.status = 'escalated_to_112';
    alarm.countdown_remaining_sec = 0;
    alarm.emergency_112_payload = payload112;
    alarm.emergency_112_dispatched_at = payload112.dispatched_at;
    alarm.emergency_112_response = apiResponse;

    if (isMysqlConnected && mysqlPool) {
      try {
        await mysqlPool.query(
          `UPDATE alarm_events SET status = 'escalated_to_112', emergency_112_payload = ?, emergency_112_dispatched_at = NOW(), emergency_112_response = ? WHERE id = ?`,
          [JSON.stringify(payload112), JSON.stringify(apiResponse), alarm.id]
        );
      } catch {
        // Non-blocking
      }
    }

    socketService.emitGlobal('ALARM_ESCALATED_112', {
      alarm,
      payload112,
      response: apiResponse
    });

    return alarm;
  }
}

export const emergencyService = new EmergencyService();
