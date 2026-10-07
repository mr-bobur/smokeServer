import { Request, Response } from 'express';
import { dbStore, isMysqlConnected, mysqlPool } from '../config/database';
import { socketService } from '../services/socket.service';

export const getAllFloors = (req: Request, res: Response): void => {
  const buildingId = req.query.building_id ? Number(req.query.building_id) : 1;

  const buildingFloors = dbStore.floors.filter((f) => f.building_id === buildingId);

  const enrichedFloors = buildingFloors.map((fl) => {
    const floorSensors = dbStore.sensors.filter((s) => s.floor_id === fl.id);
    const floorRooms = dbStore.rooms.filter((r) => r.floor_id === fl.id);
    const activeAlarms = dbStore.alarmEvents.filter(
      (a) =>
        (a.building_id ? a.building_id === buildingId : true) &&
        a.floor_number === fl.floor_number &&
        a.status === 'active'
    );

    return {
      ...fl,
      stats: {
        total_sensors: floorSensors.length,
        online_sensors: floorSensors.filter((s) => s.status === 'online').length,
        warning_sensors: floorSensors.filter(
          (s) => s.status === 'warning' || s.battery_level < 25
        ).length,
        alarm_sensors: floorSensors.filter((s) => s.status === 'alarm').length,
        offline_sensors: floorSensors.filter((s) => s.status === 'offline').length,
        active_alarms_count: activeAlarms.length,
        total_rooms: floorRooms.length
      }
    };
  });

  res.json({ floors: enrichedFloors });
};

export const getFloorDetail = (req: Request, res: Response): void => {
  const floorNumber = Number(req.params.floorNumber);
  const buildingId = req.query.building_id ? Number(req.query.building_id) : 1;

  const floor =
    dbStore.floors.find(
      (f) => f.building_id === buildingId && f.floor_number === floorNumber
    ) || dbStore.floors.find((f) => f.floor_number === floorNumber);

  if (!floor) {
    res.status(404).json({ error: `Floor ${floorNumber} not found` });
    return;
  }

  const rooms = dbStore.rooms.filter((r) => r.floor_id === floor.id);
  const sensors = dbStore.sensors.filter((s) => s.floor_id === floor.id);
  const alarms = dbStore.alarmEvents.filter((a) => a.floor_number === floorNumber);

  res.json({
    floor,
    rooms,
    sensors,
    alarms
  });
};

export const uploadFloorBlueprint = async (req: Request, res: Response): Promise<void> => {
  const floorNumber = Number(req.params.floorNumber);
  const buildingId = req.body.building_id ? Number(req.body.building_id) : 1;
  const floor =
    dbStore.floors.find(
      (f) => f.building_id === buildingId && f.floor_number === floorNumber
    ) || dbStore.floors.find((f) => f.floor_number === floorNumber);

  if (!floor) {
    res.status(404).json({ error: `Floor ${floorNumber} not found` });
    return;
  }

  const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;
  const customImageUrl = req.body.map_image_url as string | undefined;

  if (uploadedFile) {
    floor.map_image_url = `/uploads/blueprints/${uploadedFile.filename}`;
  } else if (customImageUrl) {
    floor.map_image_url = customImageUrl;
  } else {
    res.status(400).json({ error: 'No blueprint image file or URL provided' });
    return;
  }

  if (isMysqlConnected && mysqlPool) {
    try {
      await mysqlPool.query(`UPDATE floors SET map_image_url = ? WHERE id = ?`, [
        floor.map_image_url,
        floor.id
      ]);
    } catch {
      // Non-blocking
    }
  }

  socketService.emitGlobal('FLOOR_BLUEPRINT_UPDATED', { floor });

  res.json({
    message: `Blueprint for Floor ${floorNumber} updated successfully`,
    floor
  });
};

export const getRs485Diagnostics = (req: Request, res: Response): void => {
  const buildingId = req.query.building_id ? Number(req.query.building_id) : 1;
  const busFrames = dbStore.floors
    .filter((f) => f.building_id === buildingId)
    .map((fl) => {
      const srcHex = `0x0${fl.dip_switch_address}`;
      return {
        floor_number: fl.floor_number,
        dip_binary: fl.dip_binary,
        hub_mac: fl.hub_mac,
        hub_status: fl.hub_status,
        hub_battery_pct: fl.hub_battery_pct,
        latency_ms: fl.rs485_latency_ms,
        packet_loss_pct: fl.rs485_packet_loss_pct,
        crc_errors: fl.rs485_crc_errors,
        tx_frames: fl.rs485_tx_frames,
        rx_frames: fl.rs485_rx_frames,
        sample_frame_hex: `AA ${srcHex.slice(2)} 01 08 2D 08 18 5E C4 9B 55`
      };
    });

  res.json({
    protocol: 'RS485 Half-Duplex (MAX485 / SP485) @ 115200 bps',
    frame_contract:
      '[START_BYTE(0xAA), SRC_FLOOR, MSG_TYPE, LEN, PAYLOAD..., CRC16_H, CRC16_L, STOP_BYTE(0x55)]',
    pinout: { DI_TX: 'GPIO 5', RO_RX: 'GPIO 6', DE_RE: 'GPIO 7', DIP_SW: 'GPIO 1, 2, 3, 4' },
    hubs: busFrames
  });
};
