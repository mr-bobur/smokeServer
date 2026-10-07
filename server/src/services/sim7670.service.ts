import { Sim7670Status } from '../types';
import { socketService } from './socket.service';

class Sim7670Service {
  private status: Sim7670Status = {
    module_model: 'SIMCom SIM7670G 4G LTE Cat 1',
    imei: '869482059114028',
    sim_ready: true,
    operator: 'Uztelecom GSM / LTE',
    network_mode: '4G LTE Cat 1',
    rssi_csq: 27,
    rssi_dbm: -59,
    signal_bars: 5,
    gprs_attached: true,
    mqtt_tls_connected: true,
    sms_credit_balance_uzs: 148500,
    api_112_uplink: 'READY',
    last_at_command: 'AT+CMQTTCONNECT=0,"tcp://mqtt.smartbuilding.uz:1883",60,1',
    at_logs: [
      {
        timestamp: new Date(Date.now() - 180000).toISOString(),
        tx: 'AT+CPIN?',
        rx: '+CPIN: READY / OK',
        category: 'INIT'
      },
      {
        timestamp: new Date(Date.now() - 175000).toISOString(),
        tx: 'AT+CSQ',
        rx: '+CSQ: 27,99 (-59 dBm) / OK',
        category: 'INIT'
      },
      {
        timestamp: new Date(Date.now() - 170000).toISOString(),
        tx: 'AT+CGATT=1',
        rx: 'OK (LTE Packet Domain Attached)',
        category: 'INIT'
      },
      {
        timestamp: new Date(Date.now() - 165000).toISOString(),
        tx: 'AT+CMQTTSTART',
        rx: '+CMQTTSTART: 0 / OK',
        category: 'MQTT'
      },
      {
        timestamp: new Date(Date.now() - 160000).toISOString(),
        tx: 'AT+CMQTTACCQ=0,"building_gw_01"',
        rx: 'OK',
        category: 'MQTT'
      },
      {
        timestamp: new Date(Date.now() - 155000).toISOString(),
        tx: 'AT+CMQTTCONNECT=0,"tcp://mqtt.smartbuilding.uz:1883",60,1',
        rx: '+CMQTTCONNECT: 0,0 / OK',
        category: 'MQTT'
      }
    ]
  };

  public getStatus(): Sim7670Status {
    return this.status;
  }

  private pushLog(tx: string, rx: string, category: 'INIT' | 'MQTT' | 'SMS' | 'VOICE'): void {
    const entry = {
      timestamp: new Date().toISOString(),
      tx,
      rx,
      category
    };
    this.status.last_at_command = tx;
    this.status.at_logs = [entry, ...this.status.at_logs.slice(0, 29)];
    socketService.emitGlobal('SIM7670_AT_LOG', this.status);
  }

  public sendEmergencySms(phoneNumber: string, floor: number, roomNumber: string, eventType: string): void {
    const cleanPhone = phoneNumber || '+998712000000';
    const message = `EMERGENCY [${eventType}]: Hazard detected in Floor ${floor}, ${roomNumber}! Check immediately!`;
    const txCmd = `AT+CMGS="${cleanPhone}" <CR> "${message}" <Ctrl+Z>`;
    const rxResp = `+CMGS: ${Math.floor(100 + Math.random() * 899)} / OK`;

    this.status.sms_credit_balance_uzs = Math.max(0, this.status.sms_credit_balance_uzs - 150);
    this.pushLog(txCmd, rxResp, 'SMS');
  }

  public initiateEmergencyVoiceCall(phoneNumber: string, roleLabel: string): void {
    const cleanPhone = phoneNumber || '+998712000000';
    const txCmd = `ATD${cleanPhone};`;
    const rxResp = `VOICE CALLING (${roleLabel}) -> AUDIO TONE: FIRE_EVAC_ALERT.WAV / OK`;
    this.pushLog(txCmd, rxResp, 'VOICE');
  }

  public executeCustomAtCommand(command: string): { tx: string; rx: string } {
    const cmd = command.trim().toUpperCase();
    let rx = 'OK';
    if (cmd === 'AT+CSQ') {
      rx = `+CSQ: ${this.status.rssi_csq},99 (${this.status.rssi_dbm} dBm) / OK`;
    } else if (cmd === 'AT+CPIN?') {
      rx = '+CPIN: READY / OK';
    } else if (cmd.startsWith('AT+CMGS')) {
      rx = '+CMGS: 204 / OK';
    } else if (cmd.startsWith('ATD')) {
      rx = 'VOICE CARRIER ACTIVE / OK';
    }
    this.pushLog(command, rx, 'INIT');
    return { tx: command, rx };
  }
}

export const sim7670Service = new Sim7670Service();
