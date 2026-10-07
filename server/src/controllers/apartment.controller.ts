import { Request, Response } from 'express';
import { dbStore, isMysqlConnected, mysqlPool } from '../config/database';
import { mqttService } from '../services/mqtt.service';
import { socketService } from '../services/socket.service';
import { AuthenticatedRequest, PerimeterSecurityStatus } from '../types';

export const getAllApartments = (req: AuthenticatedRequest, res: Response): void => {
  const buildingId = req.query.building_id ? Number(req.query.building_id) : undefined;
  const floorNumber = req.query.floor ? Number(req.query.floor) : undefined;
  const ownerId = req.query.owner_id ? Number(req.query.owner_id) : undefined;

  let rooms = dbStore.rooms;
  if (buildingId) {
    rooms = rooms.filter((r) => r.building_id === buildingId);
  }
  if (floorNumber) {
    rooms = rooms.filter((r) => r.floor_number === floorNumber);
  }
  if (ownerId) {
    rooms = rooms.filter((r) => r.owner_user_id === ownerId);
  }

  const enriched = rooms.map((rm) => ({
    ...rm,
    sensors: dbStore.sensors.filter((s) => s.room_id === rm.id)
  }));

  res.json({ apartments: enriched });
};

export const updatePerimeterSecurity = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const roomId = Number(req.params.id);
  const { status } = req.body as { status: PerimeterSecurityStatus };

  if (!['disarmed', 'armed_home', 'armed_away'].includes(status)) {
    res.status(400).json({ error: 'Invalid perimeter_security_status value' });
    return;
  }

  const room = dbStore.rooms.find((r) => r.id === roomId);
  if (!room) {
    res.status(404).json({ error: 'Room / Apartment not found' });
    return;
  }

  room.perimeter_security_status = status;

  const roomSensors = dbStore.sensors.filter((s) => s.room_id === room.id);
  const armFlag = status !== 'disarmed';
  for (const s of roomSensors) {
    s.arm_perimeter = armFlag;
    mqttService.publishDownlinkConfig(s.floor_number, s.chip_id, {
      cmd: 'SET_CONFIG',
      beacon_interval_seconds: s.beacon_interval_seconds,
      smoke_threshold_ppm: s.smoke_threshold_ppm,
      arm_perimeter: armFlag
    });
  }

  if (isMysqlConnected && mysqlPool) {
    try {
      await mysqlPool.query(
        `UPDATE rooms_apartments SET perimeter_security_status = ? WHERE id = ?`,
        [status, room.id]
      );
    } catch {
      // Non-blocking
    }
  }

  socketService.emitGlobal('PERIMETER_UPDATED', {
    room,
    sensors: roomSensors,
    updated_by: req.user?.email || 'system'
  });

  res.json({
    message: `${room.room_number} perimeter security set to ${status.toUpperCase()}`,
    apartment: room,
    sensors: roomSensors
  });
};

export const assignApartmentOwner = async (req: Request, res: Response): Promise<void> => {
  const roomId = Number(req.params.id);
  const { owner_user_id } = req.body as { owner_user_id: number | null };

  const room = dbStore.rooms.find((r) => r.id === roomId);
  if (!room) {
    res.status(404).json({ error: 'Room / Apartment not found' });
    return;
  }

  const owner = owner_user_id ? dbStore.users.find((u) => u.id === Number(owner_user_id)) : null;
  room.owner_user_id = owner ? owner.id : null;
  room.owner_name = owner ? owner.name : null;
  room.owner_email = owner ? owner.email : null;
  room.owner_phone = owner ? owner.phone_number : null;

  if (isMysqlConnected && mysqlPool) {
    try {
      await mysqlPool.query(`UPDATE rooms_apartments SET owner_user_id = ? WHERE id = ?`, [
        room.owner_user_id,
        room.id
      ]);
    } catch {
      // Non-blocking
    }
  }

  socketService.emitGlobal('APARTMENT_OWNER_ASSIGNED', { apartment: room });

  res.json({
    message: `Assigned ${owner ? owner.name : 'Unassigned'} to ${room.room_number}`,
    apartment: room
  });
};

export const broadcastBuildingAnnouncement = (req: AuthenticatedRequest, res: Response): void => {
  const { message, trigger_siren, floors, building_id } = req.body as {
    message: string;
    trigger_siren?: boolean;
    floors?: number[];
    building_id?: number;
  };

  const payload = {
    id: `BRC-${Date.now()}`,
    building_id: building_id || 1,
    message: message || 'ATTENTION RESIDENTS: Scheduled fire safety inspection in progress.',
    trigger_siren: Boolean(trigger_siren),
    target_floors: floors || [1, 2, 3, 4, 5, 6, 7, 8, 9],
    issued_by: req.user?.name || 'Shirkat Building Manager',
    timestamp: new Date().toISOString()
  };

  socketService.emitGlobal('SIREN_BROADCAST', payload);

  res.json({
    message: 'Mass building announcement & siren command broadcasted across floor hubs',
    broadcast: payload
  });
};
