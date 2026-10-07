import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

class SocketService {
  private io: SocketIOServer | null = null;

  public initialize(httpServer: HttpServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
      }
    });

    this.io.on('connection', (socket: Socket) => {
      socket.emit('SYSTEM_CONNECTED', {
        status: 'connected',
        building_id: 'SMART-BLD-TASHKENT-09',
        timestamp: new Date().toISOString()
      });

      socket.on('JOIN_FLOOR', (floorNumber: number) => {
        socket.join(`floor_${floorNumber}`);
      });
    });

    return this.io;
  }

  public emitGlobal(event: string, payload: unknown): void {
    if (this.io) {
      this.io.emit(event, payload);
    }
  }

  public emitToFloor(floorNumber: number, event: string, payload: unknown): void {
    if (this.io) {
      this.io.to(`floor_${floorNumber}`).emit(event, payload);
    }
  }
}

export const socketService = new SocketService();
