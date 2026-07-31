import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true, namespace: 'notifications' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  sendRiskAlert(pmId: string, message: string) {
    // In a real app, map pmId to their socket connection.
    // For now, emit to all or a specific room if joined.
    this.server.emit('risk-alert', { pmId, message });
  }

  sendBalanceWarning(pmId: string, message: string) {
    this.server.emit('balance-warning', { pmId, message });
  }
}
