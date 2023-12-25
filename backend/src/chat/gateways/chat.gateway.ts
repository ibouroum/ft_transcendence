import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { User } from '@prisma/client';
import { ChatService } from '../chat.service';
import { JwtService } from '@nestjs/jwt';
import { BlacklistService } from 'src/user/blacklist/blacklist.service';
import { UserService } from 'src/user/user.service';
import { MessageService } from '../message/message.service';
import { RoomService } from '../room/room.service';
import {
  SendMessageToRoomDto,
  SendMessageToUserDto,
} from '../message/dto/handle.messages.dto';
import {
  CreateRoomDto,
  UpdateRoomDto,
} from '../room/dto/room.dto';
import {
  BlockUserDto,
  UnBlockUserDto,
} from '../../user/blacklist/dto/handle.block.dto';
import {
  KickMemberDto,
  LeaveRoomDto,
  MuteMemberDto,
  JoinRoomDto,
  SetRoomAdminDto,
  AddUserToRoomDto,
  BanUserFromRoom,
} from '../room/dto/membership.dto';
import {
  AcceptFriendRequestDto,
  SendFriendRequestDto,
} from 'src/user/friend/dto/friend.dto';
import { FriendService } from 'src/user/friend/friend.service';

  @WebSocketGateway({
    cors: {
      origin: `${process.env.FRONTEND_URL}`,
      credentials: true,
    },
  })
  export class ChatGateway
    implements
      OnGatewayConnection,
      OnGatewayDisconnect
  {
    @WebSocketServer()
    server: Server;

  private connectedClients = new Map<string,User>();
  private userSockets = new Map<number,string[]>();
  // private BlackListedTokens = new Map<string,number>();
  

  constructor(
    private chatService: ChatService,
    private blacklistService: BlacklistService,
    private jwtService: JwtService,
    private userService: UserService,
    private roomService: RoomService,
    private messageService: MessageService,
    private friendService: FriendService,
  ) {}

  printClients() {
    console.log('users connected {');
    this.connectedClients.forEach(
      (value, key) => {
        console.log(
          'socketId = ' +
            key +
            ' || username = ' +
            value.userName,
        );
      },
    );
    console.log('}');
  }

  printClientSockets() {
    console.log('user sockets {');
    this.userSockets.forEach((value, key) => {
      console.log(
        'user = ' +
          key +
          ' || socketID = ' +
          value,
      );
    });
    console.log('}');
  }

  private deleteUserSockets(intraId: number) {
    const sockets = this.userSockets.get(intraId);
    if (sockets) {
      sockets.forEach((socketId) => {
        const socket = this.server.sockets.sockets[socketId];
        if (socket) {
          socket.disconnect();
        }
      });
      this.userSockets.delete(intraId);
    }
    console.log("userSockets == ", this.userSockets);
  }

  // deleteUserSingleSocket()

  // deleteUserDisconnected(intraId: number)
  // {
  //     this.connectedClients.forEach((mapUser, mapId) => {
  //         if (mapUser.intraId === intraId) {
  //           this.connectedClients.delete(mapId);
  //         }
  //     });
  // }

  private deleteUserDisconnected(intraId: number) {
    const disconnectedSockets = [];
    this.connectedClients.forEach(
      (mapUser, mapId) => {
        if (mapUser.intraId === intraId) {
          disconnectedSockets.push(mapId);
        }
      },
    );

    disconnectedSockets.forEach((socketId) => {
      this.connectedClients.delete(socketId);
    });
  }

  // disconnectAllUserSocket(intraId: number)
  // {

  // }

  private findUserByClientSocketId(clientId: string) {
    let ret = null;
    this.connectedClients.forEach(
      (user, socketId) => {
        if (socketId == clientId) ret = user;
      }
    );
    return ret;
  }

  

  async handleConnection(client: Socket) {
    const token = client.handshake.headers.authorization;
    try {
      const decodedToken =
        await this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET,
        });
      const user = await this.userService.getUser(decodedToken.sub);
      if (!user) {
        throw new WsException('User not found.');
      }

      if (!this.connectedClients.has(client.id)) {
        this.connectedClients.set(
          client.id,
          user,
        );
      }

      if (!this.userSockets.has(user.intraId)) {
        this.userSockets.set(user.intraId, []);
      }

      this.userSockets.get(user.intraId).push(client.id);
      this.userService.updateUserStatus(user.intraId,'ONLINE',);
      this.server.emit('userConnected', {
        userId: client.id,
      });
      // this.printClients();
      console.log(user.userName + ' is Connected ' + client.id);
      // this.printClients();
      // this.printClientSockets();
    } catch (error) {
      client.disconnect();
      console.error(
        'Client disconnected due to invalid authorization',
      );
      const response = {
        success: false,
        message: error.message,
      };

      return response;
    }
  }


  async handleDisconnect(client: Socket) {
    try {
      const user = this.connectedClients.get(
        client.id,
      );
      if (user) {
        const intraId = user.intraId;

        // Remove the disconnected socket from userSockets
        const userSockets = this.userSockets.get(intraId) || [];
        const updatedSockets = userSockets.filter(
          (socketId) => socketId !== client.id,
        );

        if (updatedSockets.length === 0) {
          // If there are no more sockets for this user, remove the user entirely
          this.userSockets.delete(intraId);
           // Update the user status to "OFFLINE" since all tabs are disconnected
          this.userService.updateUserStatus(intraId, 'OFFLINE');
        } else {
          // Update the userSockets map
          this.userSockets.set(intraId, updatedSockets);
        }

        // Other cleanup tasks for disconnection
        this.connectedClients.delete(client.id);
        client.disconnect();
        console.log(user.userName + ' is Disconnected ' + client.id);
      } else {
        throw new WsException(
          `cannot find the user`,
        );
      }
    } catch (error) {
      client.emit(error);
    }
  }

  @SubscribeMessage('createRoom')
  async createRoom(
    client: Socket,
    createRoomDto: CreateRoomDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const roomData =
        await this.roomService.createRoom(
          createRoomDto,
          currentUser.intraId,
        );
      const socketsOfUser: string[] =
        this.userSockets.get(currentUser.intraId);
      socketsOfUser.forEach((value) => {
        this.server
          .to(value)
          .emit('roomCreated', {
            data: roomData.dataMembership,
            successMsg:
              'Room is create succeffuly',
          });
      });
      if (roomData.dataRoom.type !== 'private')
        this.userSockets.forEach((socketId) => {
          this.server
            .to(socketId)
            .emit('newRoom', roomData.dataRoom);
        });
    } catch (error) {
      console.error(error.message);
      client.emit('roomCreationError', {
        message: error.message,
      });
      // throw error.message;
    }
  }

  @SubscribeMessage('updateRoom')
  async updateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: UpdateRoomDto,
  ) {
    try {
      // get current User
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const roomUpdated =
        await this.roomService.updateRoomById(
          body,
          currentUser.intraId,
        );
      const userSockets: string[] =
        this.userSockets.get(currentUser.intraId);
      userSockets.forEach((value) => {
        this.server
          .to(value)
          .emit('roomUpdated', {
            data: roomUpdated,
            successMsg:
              'Room is updated succeffuly',
          });
      });
    } catch (error) {
      client.emit('updateRoomError', {
        message: error.message,
      });
      // if (error instanceof NotFoundException)
      //     console.log("Room not found:", error.message);
      // else
      console.error(error.message);
    }
  }

  @SubscribeMessage('joinRoom')
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinRoomDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const member =
        await this.roomService.getMember(
          currentUser.intraId,
        );
      const joinedRoom =
        await this.roomService.joinRoom(
          body,
          currentUser.intraId,
        );
      const roomUsers =
        await this.roomService.getRoomUsersExcludingSender(
          joinedRoom.dataRoom.id,
          currentUser.intraId,
        );
      const socketsOfUser: string[] =
        this.userSockets.get(currentUser.intraId);
      const usersInRoom = roomUsers.map(
        (user) => user.intraId,
      );

      // this event for the users in the room
      usersInRoom.forEach((userId) => {
        const userSockets =
          this.userSockets.get(userId);
        if (userSockets) {
          userSockets.forEach((socketId) => {
            this.server
              .to(socketId)
              .emit('userJoinRoom', {
                roomId: body.id,
                user: {
                  idAdmin: false,
                  isBanned: false,
                  isOwner: false,
                  isMute: false,
                  user: member,
                },
              });
          });
        }
      });

      // this event for the user who joins a room
      socketsOfUser.forEach((socketId) => {
        this.server
          .to(socketId)
          .emit(
            'roomJoined',
            joinedRoom.dataMembership,
          );
      });

      // this event is for all user who are connected
      this.userSockets.forEach((value) => {
        this.server
          .to(value)
          .emit(
            'newRoomJoined',
            joinedRoom.dataRoom,
          );
      });
    } catch (error) {
      client.emit('roomJoinError', {
        message: error.message,
      });
      console.error(error.message);
    }
  }

  // leave room
  @SubscribeMessage('leaveRoom')
  async leaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: LeaveRoomDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      await this.roomService.leaveRoom(
        body,
        currentUser.intraId,
      );
      const currentUserSockets: string[] =
        this.userSockets.get(currentUser.intraId);
      const roomUsers =
        await this.roomService.getRoomUsersExcludingSender(
          body.roomId,
          currentUser.intraId,
        );

      // Retrieve the user IDs of users in the room
      const usersInRoom = roomUsers.map(
        (user) => user.intraId,
      );

      // this event is for the user how perform the action
      currentUserSockets.forEach((value) => {
        this.server
          .to(value)
          .emit('roomLeaved', body.roomId);
      });
      // This event is for the userInRoom exculding the performer
      usersInRoom.forEach((userId) => {
        const socketsUser =
          this.userSockets.get(userId);
        if (socketsUser) {
          socketsUser.forEach((socketId) => {
            this.server
              .to(socketId)
              .emit('userLeftRoom', {
                roomId: body.roomId,
                userId: currentUser.intraId,
              });
          });
        }
      });

      this.userSockets.forEach((socketId) => {
        this.server
          .to(socketId)
          .emit('roomHasBeenLeft', {
            roomId: body.roomId,
            userId: currentUser.intraId,
          });
      });
    } catch (error) {
      client.emit('leaveRoomError', {
        message: error.message,
      });
      console.error(
        'leaveRoom error =' + error.message,
      );
    }
  }

  @SubscribeMessage('addUserToRoom')
  async addUserToRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: AddUserToRoomDto,
  ) {
    try {
      const { roomId, userId } = body;

      const currentUser =
        this.findUserByClientSocketId(client.id);
      const joinedRoom =
        await this.roomService.addUserToRoom(
          currentUser.intraId,
          body,
        );
      const addedUserSockets: string[] =
        this.userSockets.get(userId);
      const member =
        await this.roomService.getMember(userId);

      const roomUsers =
        await this.roomService.getRoomUsersExcludingSender(
          roomId,
          userId,
        );

      const usersInRoom = roomUsers.map(
        (user) => user.intraId,
      );
      // this event for the users in the room
      usersInRoom.forEach((userId) => {
        const userSockets =
          this.userSockets.get(userId);
        if (userSockets) {
          userSockets.forEach((socketId) => {
            this.server
              .to(socketId)
              .emit('userJoinRoom', {
                roomId: roomId,
                user: {
                  idAdmin: false,
                  isBanned: false,
                  isOwner: false,
                  isMute: false,
                  user: member,
                },
              });
          });
        }
      });

      // this event is for the user how's been added to the room
      if (addedUserSockets) {
        addedUserSockets.forEach((value) => {
          this.server
            .to(value)
            .emit(
              'roomJoined',
              joinedRoom.dataMembership,
            );
        });
      }

      // this event is for all user who are connected
      this.userSockets.forEach((value) => {
        this.server
          .to(value)
          .emit(
            'newRoomJoined',
            joinedRoom.dataRoom,
          );
      });
    } catch (error) {
      client.emit('addUserToRoomError', {
        message: error.message,
      });
      console.error(
        'addUserToRoomError ==',
        error.message,
      );
    }
  }

  // set room Admins
  @SubscribeMessage('setRoomAdmin')
  async setRoomAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SetRoomAdminDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const response =
        await this.roomService.setAdminToRoom(
          body,
          currentUser.intraId,
        );
      const roomUsers =
        await this.roomService.getRoomUsers(
          body.roomId,
        );

      // Retrieve the user IDs of users in the room
      const usersInRoom = roomUsers.map(
        (user) => user.intraId,
      );
      // This event is for the userInRoom
      usersInRoom.forEach((userId) => {
        const socketsUser =
          this.userSockets.get(userId);
        if (socketsUser) {
          socketsUser.forEach((socketId) => {
            this.server
              .to(socketId)
              .emit(
                'AdminSettedToRoom',
                response,
              );
          });
        }
      });
      // this.server.emit('AdminSettedToRoom', response);
    } catch (error) {
      client.emit('setRoomAdminError', {
        message: error.message,
      });
      console.error(
        'Subs error =' + error.message,
      );
    }
  }
  // remove Channel Admins
  @SubscribeMessage('unSetRoomAdmin')
  async unSetRoomAdmin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SetRoomAdminDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const response =
        await this.roomService.unSetAdminOfRoom(
          body,
          currentUser.intraId,
        );
      const roomUsers =
        await this.roomService.getRoomUsers(
          body.roomId,
        );

      // Retrieve the user IDs of users in the room
      const usersInRoom = roomUsers.map(
        (user) => user.intraId,
      );
      // This event is for the userInRoom
      usersInRoom.forEach((userId) => {
        const socketsUser =
          this.userSockets.get(userId);
        if (socketsUser) {
          socketsUser.forEach((socketId) => {
            this.server
              .to(socketId)
              .emit(
                'AdminRemovedFromRoom',
                response,
              );
          });
        }
      });
      // this.server.emit('AdminSettedToRoom', response);
    } catch (error) {
      client.emit('unSetRoomAdminError', {
        message: error.message,
      });
      console.error(
        'Subs error =' + error.message,
      );
    }
  }
  // ban member
  @SubscribeMessage('banMember')
  async BanMember(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BanUserFromRoom,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const response =
        await this.roomService.banMember(
          currentUser.intraId,
          body,
        );
      const roomUsers =
        await this.roomService.getRoomUsers(
          body.roomId,
        );
      const currentUserSockets: string[] =
        this.userSockets.get(body.userId);
      // Retrieve the user IDs of users in the room
      const usersInRoom = roomUsers.map(
        (user) => user.intraId,
      );
      // This event is for the userInRoom
      usersInRoom.forEach((userId) => {
        const socketsUser =
          this.userSockets.get(userId);
        if (socketsUser) {
          socketsUser.forEach((socketId) => {
            this.server
              .to(socketId)
              .emit(
                'userBannedFromRoom',
                response,
              );
          });
        }
      });

      if (currentUserSockets)
        currentUserSockets.forEach((socketId) => {
          this.server
            .to(socketId)
            .emit('IhaveBeenBanned', {
              roomId: body.roomId,
            });
        });
    } catch (error) {
      client.emit('banMemberError', {
        message: error.message,
      });
      console.error(
        'Subs error =' + error.message,
      );
    }
  }
  // unBan member
  @SubscribeMessage('unBanMember')
  async UnBanMember(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BanUserFromRoom,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const roomUsers =
        await this.roomService.getRoomUsers(
          body.roomId,
        );
      const response =
        await this.roomService.unBanMember(
          currentUser.intraId,
          body,
        );
      const retrivedRoom =
        await this.chatService.getRoom(
          body.roomId,
        );

      const currentUserSockets: string[] =
        this.userSockets.get(body.userId);
      // Retrieve the user IDs of users in the room
      const usersInRoom = roomUsers.map(
        (user) => user.intraId,
      );
      // This event is for the userInRoom
      usersInRoom.forEach((userId) => {
        const socketsUser =
          this.userSockets.get(userId);
        if (socketsUser) {
          socketsUser.forEach((socketId) => {
            this.server
              .to(socketId)
              .emit(
                'userUnBannedFromRoom',
                response,
              );
          });
        }
      });
      if (currentUserSockets)
        currentUserSockets.forEach((socketId) => {
          this.server
            .to(socketId)
            .emit(
              'IhaveBeenUnBanned',
              retrivedRoom,
            );
        });
    } catch (error) {
      client.emit('unBanMemberError', {
        message: error.message,
      });
      console.error(
        'Subs error =' + error.message,
      );
    }
  }

  // kick member
  @SubscribeMessage('kickMember')
  async kickMember(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: KickMemberDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const roomUsers =
        await this.roomService.getRoomUsers(
          body.roomId,
        );
      const response =
        await this.roomService.kickMember(
          body,
          currentUser.intraId,
        );
      const currentUserSockets: string[] =
        this.userSockets.get(body.userId);
      // Retrieve the user IDs of users in the room
      const usersInRoom = roomUsers.map(
        (user) => user.intraId,
      );
      // This event is for the userInRoom
      usersInRoom.forEach((userId) => {
        const socketsUser =
          this.userSockets.get(userId);
        if (socketsUser) {
          socketsUser.forEach((socketId) => {
            this.server
              .to(socketId)
              .emit(
                'userKickedFromRoom',
                response,
              );
          });
        }
      });
      if (currentUserSockets)
        currentUserSockets.forEach((socketId) => {
          this.server
            .to(socketId)
            .emit('IhaveBeenKicked', response);
        });

      // this event is for all user who are connected (for search component)
      this.userSockets.forEach((value) => {
        this.server
          .to(value)
          .emit('UserHaveBeenKicked', response);
      });
    } catch (error) {
      client.emit('kickMemberError', {
        message: error.message,
      });
      console.error(
        'Subs error =' + error.message,
      );
    }
  }

  // mute member
  @SubscribeMessage('muteMember')
  async muteMemeber(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: MuteMemberDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const response =
        await this.roomService.muteMember(
          currentUser.intraId,
          body,
        );
      const roomUsers =
        await this.roomService.getRoomUsers(
          body.roomId,
        );
      // const currentUserSockets: string[] = this.userSockets.get(body.userId);
      // Retrieve the user IDs of users in the room
      const usersInRoom = roomUsers.map(
        (user) => user.intraId,
      );
      // This event is for the userInRoom
      usersInRoom.forEach((userId) => {
        const socketsUser =
          this.userSockets.get(userId);
        if (socketsUser) {
          socketsUser.forEach((socketId) => {
            this.server
              .to(socketId)
              .emit('userMuted', response);
          });
        }
      });
    } catch (error) {
      client.emit('muteMemberError', {
        message: error.message,
      });
      console.error(
        'Subs error =' + error.message,
      );
    }
  }

  private handleLogout(client: Socket) {
    try {
      const user = this.connectedClients.get(client.id);
  
      if (user) {
        const intraId = user.intraId;
  
        // Disconnect all tabs of the same user
        this.deleteUserSockets(intraId);
  
        // Update the user status to "OFFLINE"
        this.userService.updateUserStatus(intraId, 'OFFLINE');
  
        // Remove the user from connectedClients
        this.connectedClients.delete(client.id);
  
        console.log(user.userName + ' has logged out from all tabs');
      } else {
        throw new WsException(`Cannot find the user`);
      }
    } catch (error) {
      client.emit(error);
    }
  }

  @SubscribeMessage('logout')
  async logout(
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const currentUser = this.findUserByClientSocketId(client.id);
      const currentUserSockets: string[] = this.userSockets.get(currentUser.intraId);
      currentUserSockets.forEach((value) => {
        this.server
        .to(value)
        .emit('userLoggedOut');
      });
      this.handleLogout(client);
    } catch (error) {
      const response = {
        success: false,
        message: error.message,
      };
      return response;
    }
  }


  // send private message
  @SubscribeMessage('sendMessageToUser')
  async sendMessageToUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendMessageToUserDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const message =
        await this.messageService.sendMessageToUser(
          body,
          currentUser.intraId,
        );
      const senderSockets: string[] =
        this.userSockets.get(currentUser.intraId);
      const receiverSockets: string[] =
        this.userSockets.get(body.receiverId);

      const sender =
        await this.roomService.getMember(
          currentUser.intraId,
        );
      const receiver =
        await this.roomService.getMember(
          body.receiverId,
        );
      senderSockets.forEach((value) => {
        let conversation = Object.assign(
          message,
          { receiver: receiver },
        );
        this.server
          .to(value)
          .emit(
            'conversationCreated',
            conversation,
          );
        this.server
          .to(value)
          .emit('messageSentToUser', {
            id: message.lastMessage.id,
            content: message.lastMessage.content,
            createdAt:
              message.lastMessage.createdAt,
            chatId: message.id,
            sender: sender,
          });
      });
      if (receiverSockets)
        receiverSockets.forEach((value) => {
          let conversation = Object.assign(
            message,
            { receiver: sender },
          );
          this.server
            .to(value)
            .emit(
              'conversationCreated',
              conversation,
            );
          this.server
            .to(value)
            .emit('messageSentToUser', {
              id: message.lastMessage.id,
              content:
                message.lastMessage.content,
              createdAt:
                message.lastMessage.createdAt,
              chatId: message.id,
              sender: sender,
            });
        });
    } catch (error) {
      client.emit('sendMessageToUserError', {
        message: error.message,
      });
      console.error(
        'Subs error =' + error.message,
      );
    }
  }

  // send message to room
  @SubscribeMessage('sendMessageToRoom')
  async senMessageToRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendMessageToRoomDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const message =
        await this.messageService.sendMessageToRoom(
          body,
          currentUser.intraId,
        );
      const member =
        await this.roomService.getMember(
          currentUser.intraId,
        );
      const roomUsers =
        await this.roomService.getRoomUsers(
          body.roomId,
        );
      const blacklist =
        await this.blacklistService.getBlacklistUsers(
          currentUser.intraId,
        );
      // Retrieve the user IDs of users in the room
      const usersInRoom = roomUsers.map(
        (user) => user.intraId,
      );
      // Exclude blacklisted users from the list of users in the room
      const usersNotBlacklisted =
        usersInRoom.filter(
          (userId) => !blacklist.includes(userId),
        );
      // This event is for the userInRoom
      usersNotBlacklisted.forEach((userId) => {
        const socketsUser =
          this.userSockets.get(userId);
        if (socketsUser) {
          socketsUser.forEach((socketId) => {
            this.server
              .to(socketId)
              .emit('messageSentToRoom', {
                id: message.id,
                content: message.content,
                createdAt: message.createdAt,
                chatId: message.chatId,
                sender: member,
                roomId: body.roomId,
              });
          });
        }
      });
      // this.server.emit('sendMessageToRoom');
    } catch (error) {
      client.emit('sendMessageToRoomError', {
        message: error.message,
      });
      console.error(
        'Subs error =' + error.message,
      );
    }
  }

  // block user
  @SubscribeMessage('blockUser')
  async blockUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: BlockUserDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      const response =
        await this.blacklistService.blockUser(
          body,
          currentUser.intraId,
        );
      const blockerSockets: string[] =
        this.userSockets.get(currentUser.intraId);
      const blockedSockets: string[] =
        this.userSockets.get(body.blockedId);

      // event to the blocker
      blockerSockets.forEach((socketId) => {
        this.server
          .to(socketId)
          .emit('blockedByMe', response.blocked);
      });

      // event to the blocked
      if (blockedSockets)
        blockedSockets.forEach((socketId) => {
          this.server
            .to(socketId)
            .emit('blockedMe', response.blocker);
        });
      // this.server.emit('blockUser');
    } catch (error) {
      client.emit('blockUserError', {
        message: error.message,
      });
      console.error(
        'Subs error =' + error.message,
      );
    }
  }

  @SubscribeMessage('unBlockUser')
  async unBlockUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: UnBlockUserDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      await this.blacklistService.unBlockUser(
        body,
        currentUser.intraId,
      );
      this.server.emit('unBlockUser');
    } catch (error) {
      client.emit('unBlockUserError', {
        message: error.message,
      });
      console.error(
        'Subs error =' + error.message,
      );
    }
  }

  @SubscribeMessage('sendFriendRequest')
  async sendFriendRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SendFriendRequestDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      await this.friendService.sendFriendRequest(
        body,
        currentUser.intraId,
      );
      this.server.emit('sendFriendRequest');
    } catch (error) {
      client.emit('sendFriendRequestError', {
        message: error.message,
      });
      console.error(
        'send error = ' + error.message,
      );
    }
  }

  @SubscribeMessage('acceptFriendRequest')
  async acceptFriendRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: AcceptFriendRequestDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      await this.friendService.acceptFriendRequest(
        body,
        currentUser.intraId,
      );
      /* need to handle the event emitted to the accepted user 
       to inform him that a user has accepted your friend request */ 
      this.server.emit('acceptFriendRequest');
    } catch (error) {
      client.emit('acceptFriendRequestError', {
        message: error.message,
      });
      console.error(
        'accept error = ' + error.message,
      );
    }
  }

  @SubscribeMessage('declineFriendRequest')
  async declineFriendRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: AcceptFriendRequestDto,
  ) {
    try {
      const currentUser =
        this.findUserByClientSocketId(client.id);
      await this.friendService.declineFriendRequest(
        body,
        currentUser.intraId,
      );
      /* need to handle the event emitted to the declined user 
       to inform him that a user has declined your friend request */ 
      this.server.emit('declineFriendRequest');
    } catch (error) {
      client.emit('acceptFriendRequestError', {
        message: error.message,
      });
      console.error(
        'accept error = ' + error.message,
      );
    }
  }
  
  @SubscribeMessage('inviteToGame')
  async inviteUserToGame( 
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any)
  {
    try {
      console.log('userInvitedToGame');
      const currentUser =
        this.findUserByClientSocketId(client.id);
        // console.log('body  ==', body);
        const invitedSockets : string[] = this.userSockets.get(body.invitedId);
        console.log('invitedSockets ==', invitedSockets);
      // if (blockedSockets)
      // blockedSockets.forEach((socketId) =>{
      //   this.server.to(socketId).emit('blockedMe', response.blocker);
      // });
      if (invitedSockets)
        invitedSockets.forEach((socketId) => {
          this.server.to(socketId).emit('gameInvitationReceived', {
            inviterId: body.inviterId,
            invitedId: body.invitedId
            })
        });
    } catch (error) {
      client.emit('gameInvitationReceivedError', {
        message: error.message,
      });
      console.log(
        'send error = ' + error.message,
      );
    }
  }

  @SubscribeMessage('acceptGameInvite')
  async acceptGameInvite( 
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any)
  {
    try {
        console.log('acceptGameInvite');
        const currentUser =
        this.findUserByClientSocketId(client.id);
        console.log('body (acceptGameInvite)== ', body);
        const invitedSockets : string[] = this.userSockets.get(currentUser.intraId);
        const inviterSockets: string[] = this.userSockets.get(body.inviterId);
        console.log('inviter == ', currentUser.intraId);
        console.log('invited == ', body.invitedId);
        if (invitedSockets)
          invitedSockets.forEach((socketId) => {
            this.server.to(socketId).emit('gameInvitationAccepted')
          });
        inviterSockets.forEach((socketId) => {
          this.server.to(socketId).emit('opponentAcceptGameInvite');
        });
    } catch (error) {
      client.emit('gameInvitationAcceptedError', {
        message: error.message,
      });
      console.log(
        'send error = ' + error.message,
      );
    }
  } 
  @SubscribeMessage('declineGameInvite')
  async declineGameInvite( 
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any)
  {
    try {
        console.log('declineGameInvite');
        let inviter;
        const currentUser =
        this.findUserByClientSocketId(client.id);
        console.log("ssssssssssss")
        console.log('body (declineGameInvite) == ', body);
        const invitedSockets : string[] = this.userSockets.get(currentUser.intraId);
        const inviterSockets: string[] = this.userSockets.get(body.inviterId);
        if (inviterSockets.length)
          inviter = this.findUserByClientSocketId(inviterSockets[0]);
        if (invitedSockets)
          invitedSockets.forEach((socketId) => {
            this.server.to(socketId).emit('gameInvitationDeclined')
          });
        inviterSockets.forEach((socketId) => {
          this.server.to(socketId).emit('opponentDeclineGameInvite', {
            data : body.inviterId,
            successMsg: `${inviter.userName} decline your game Invite`
          });
        });
    } catch (error) {
      client.emit('gameInvitationDeclinedError', {
        message: error.message,
      });
      console.log(
        'send error = ' + error.message,
      );
    }
  } 
}
