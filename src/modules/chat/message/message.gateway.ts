import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnModuleInit } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as path from 'path';
import * as fs from 'fs';
import appConfig from '../../../config/app.config';
import { ChatRepository } from '../../../common/repository/chat/chat.repository';
import { MessageStatus } from 'prisma/generated/enums';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  maxHttpBufferSize: 1e8, // 100MB
})
export class MessageGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private recordings = new Map<string, fs.WriteStream>();
  private chunks = new Map<string, Buffer>();
  private uploadsDir = path.join(
    __dirname,
    '../../../../public/storage/recordings',
  );

  constructor(private readonly chatRepository: ChatRepository) {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  // Map to store connected clients
  public clients = new Map<string, string>(); // userId -> socketId
  private activeUsers = new Map<string, string>(); // username -> socketId

  onModuleInit() {}

  afterInit(server: Server) {
    console.log('Websocket server started');
  }

  // implement jwt token validation
  async handleConnection(client: Socket, ...args: any[]) {
    try {
      // const token = client.handshake.headers.authorization?.split(' ')[1];
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        console.log('No token provided');
        return;
      }

      const decoded: any = jwt.verify(token, appConfig().jwt.secret);
      // const decoded: any = this.jwtService.verify(token);
      // const userId = client.handshake.query.userId as string;
      const userId = decoded.sub;
      if (!userId) {
        client.disconnect();
        console.log('Invalid token');
        return;
      }

      this.clients.set(userId, client.id);
      // console.log(`User ${userId} connected with socket ${client.id}`);
      await this.chatRepository.updateUserStatus(userId, 'online');
      // notify the user that the user is online
      this.server.emit('userStatusChange', {
        user_id: userId,
        status: 'online',
      });

      console.log(`User ${userId} connected`);
    } catch (error) {
      client.disconnect();
      console.error('Error handling connection:', error);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = [...this.clients.entries()].find(
      ([, socketId]) => socketId === client.id,
    )?.[0];
    if (userId) {
      this.clients.delete(userId);

      const username = [...this.activeUsers.entries()].find(
        ([, id]) => id === client.id,
      )?.[0];
      if (username) {
        this.activeUsers.delete(username);
      }

      await this.chatRepository.updateUserStatus(userId, 'offline');
      // notify the user that the user is offline
      this.server.emit('userStatusChange', {
        user_id: userId,
        status: 'offline',
      });

      console.log(`User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('joinRoom')
  handleRoomJoin(client: Socket, body: { room_id: string }) {
    const roomId = body.room_id;

    client.join(roomId); // join the room using user_id
    client.emit('joinedRoom', { room_id: roomId });
  }

  @SubscribeMessage('sendMessage')
  async listenForMessages(
    client: Socket,
    @MessageBody() body: { to: string; data: any },
  ) {
    const recipientSocketId = this.clients.get(body.to);
    if (recipientSocketId) {
      this.server.to(recipientSocketId).emit('message', {
        from: body.data.sender.id,
        data: body.data,
      });
    }
  }

  @SubscribeMessage('updateMessageStatus')
  async updateMessageStatus(
    client: Socket,
    @MessageBody() body: { message_id: string; status: MessageStatus },
  ) {
    await this.chatRepository.updateMessageStatus(body.message_id, body.status);
    // notify the sender that the message has been sent
    this.server.emit('messageStatusUpdated', {
      message_id: body.message_id,
      status: body.status,
    });
  }

  @SubscribeMessage('typing')
  handleTyping(client: Socket, @MessageBody() body: { to: string; data: any }) {
    const recipientSocketId = this.clients.get(body.to);
    if (recipientSocketId) {
      this.server.to(recipientSocketId).emit('userTyping', {
        from: client.id,
        data: body.data,
      });
    }
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    client: Socket,
    @MessageBody() body: { to: string; data: any },
  ) {
    const recipientSocketId = this.clients.get(body.to);
    if (recipientSocketId) {
      this.server.to(recipientSocketId).emit('userStoppedTyping', {
        from: client.id,
        data: body.data,
      });
    }
  }

  // for calling
  @SubscribeMessage('join')
  handleJoin(client: Socket, { username }: { username: string }) {
    this.activeUsers.set(username, client.id);
    console.log(`${username} joined`);
  }

  @SubscribeMessage('call')
  handleCall(
    client: Socket,
    {
      caller,
      receiver,
      offer,
    }: { caller: string; receiver: string; offer: any },
  ) {
    const receiverSocketId = this.activeUsers.get(receiver);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('incomingCall', { caller, offer });
    }
  }

  @SubscribeMessage('answer')
  handleAnswer(
    client: Socket,
    {
      caller,
      receiver,
      answer,
    }: { caller: string; receiver: string; answer: any },
  ) {
    const callerSocketId = this.activeUsers.get(caller);
    if (callerSocketId) {
      this.server.to(callerSocketId).emit('callAccepted', { answer });
    }
  }

  @SubscribeMessage('iceCandidate')
  handleICECandidate(
    client: Socket,
    { receiver, candidate }: { receiver: string; candidate: any },
  ) {
    const receiverSocketId = this.activeUsers.get(receiver);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('iceCandidate', { candidate });
    }
  }

  @SubscribeMessage('endCall')
  handleEndCall(client: Socket, { receiver }: { receiver: string }) {
    const receiverSocketId = this.activeUsers.get(receiver);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('callEnded');
    }
  }

  // recording
  @SubscribeMessage('recordingChunk')
  handleRecordingChunk(
    client: Socket,
    @MessageBody()
    payload: {
      recordingId: string;
      sequence: number;
      chunk: Buffer | any;
    },
  ) {
    console.log('Received chunk', payload.sequence, payload.chunk.length);
    const { recordingId, chunk } = payload;
    const filePath = path.join(this.uploadsDir, `${recordingId}.webm`);

    if (!this.chunks.has(recordingId)) {
      this.chunks.set(recordingId, Buffer.alloc(0));
    }

    this.chunks.set(
      recordingId,
      Buffer.concat([
        this.chunks.get(recordingId),
        Buffer.from(new Uint8Array(chunk)),
      ]),
    );
  }

  @SubscribeMessage('recordingEnded')
  handleRecordingEnd(
    client: Socket,
    @MessageBody() payload: { recordingId: string },
  ) {
    const filePath = path.join(this.uploadsDir, `${payload.recordingId}.webm`);
    const stream = fs.createWriteStream(filePath, { flags: 'a' });

    console.log(`Started writing to file ${filePath}`);
    const buffer = this.chunks.get(payload.recordingId);
    if (buffer) {
      stream.write(buffer);
      this.chunks.delete(payload.recordingId);
    }
  }
}
