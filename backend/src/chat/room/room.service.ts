import { WsException } from "@nestjs/websockets";
import { PrismaService } from "src/prisma/prisma.service";
import { UserService } from "src/user/user.service";
import { CreateRoomDto, UpdateRoomDto } from "./dto/room.dto";
import { MuteMemberDto, KickMemberDto, LeaveRoomDto, JoinRoomDto, SetRoomAdminDto } from "./dto/membership.dto";
import { hash, verify } from "argon2";
import { ChatService } from "../chat.service";
import { addMinutes } from "date-fns";
import { Injectable } from "@nestjs/common";


@Injectable()
export class RoomService
{
    constructor(
        private prisma:         PrismaService,
        private userService:    UserService,
        private chatService:    ChatService
    ){}

    async getRoomById(roomId: number)
    {
        const room = await this.prisma.room.findUnique({
            where: {id : roomId}
        });
        if (!room)
            throw new WsException(`roomId ${roomId} does not exist`);
        return room;
    }

    // TODO : need to be refactored (remove trycatch block)
    async getRoomByName(roomName: string) 
    {
        try {
            const room = await this.prisma.room.findFirst({
                where : {name : roomName}
            });
            if (!room)
                return null;
            return room;
        } catch (error) {
            const response = {
                success: false,
                message: error.message
            };
            return response;
        }
    }

   
   // get All Rooms
   async getAllRooms()
    {
        try {
            const rooms = await this.prisma.room.findMany();
            if (!rooms.length)
            return 'no rooms exists';
            return rooms;
        } catch (error) {
            const response = {
                success: false,
                message: error.message
            }
            console.log(response);
            return response;
        }
    }
    
    // async getAllRoomsInfos()
    // {
    //     const rooms = await this.prisma.room.findMany({
    //         include : {
    //             members: {
    //                 select: {
    //                     intraId: true,
    //                     userName: true
    //                 }
    //             },
    //             admins: {
    //                 select: {
    //                     intraId: true,
    //                     userName: true
    //                 }
    //             }
    //         }
    //     });
    //     if (!rooms.length)
    //     throw new NotFoundException(`No rooms exist in the database`);
    //     return rooms;
    // }
    
     /* DTO create
        {
            "name" : "riayda",
            "ownerId" : 90635,
            "type" : "private",
            "password" : "a74s"
        }
    */
    // function to create a new room
    async createRoom(createRoomDto: CreateRoomDto, userId: number)
    {
        // try {
        const {name, type, password} = createRoomDto;
        if (!createRoomDto.name || !createRoomDto.type)
            throw new WsException(`name and type are required !`);
        const user = await this.userService.getUser(userId);
        if(!user)
            throw new WsException(`userId = ${userId} does not exist !`);
        // console.log("user ==" + JSON.stringify(user));
        const roomExist = await this.getRoomByName(name);
        if (roomExist)
            throw new WsException(`room name ${name} already exist !`);
        if (type !== "public" && (!password?.length || password.length < 4))
                throw new WsException(`password must have at least 4 characters!`);
        if (type === "public" && password)
            throw new WsException(`public rooms should not have a password !`);
        // const hashedPass: string | undefined = type === "private" && password ? await hash(password) : undefined;
        if (type == "private" && password)
            var hashedPass: string = await hash(password);
        const newRoom = await this.prisma.room.create({
            data : {
                name : name,
                password : hashedPass || "",
                type : type,
            }
        });
        // Step 2: Create the new membership entry
        await this.prisma.membership.create({
            data: {
                room: {
                    connect: {
                        id: newRoom.id,
                    },
                },
                user: {
                    connect: {
                        intraId: userId,
                    },
                },
                isOwner: true,
                isAdmin: true,
            },
        });
        console.log(`${user.userName} has created a ${newRoom.name} room`)
        return newRoom;
        // } catch (error) {
        //     console.log("error || " + error)
        // }
    }

    /* DTO update
        {
            "id" : 1,
            "name" : "kora2",
            "type" : "public"
        }
    */
    // update Room
    async updateRoomById(body: UpdateRoomDto, userId: number)
    {
        const room = await this.getRoomById(body.id);
        console.log("room Id ==" + JSON.stringify(room))
        if (!room)
            throw new WsException(`room Id ${body.id} does not exist`)

        // Check if the user is an admin in the room
        const isAdmin = await this.prisma.membership.findFirst({
            where : { 
                roomId: room.id, 
                userId: userId
            },
            select : {isAdmin : true},
        })
        console.log("isAdmin ==" + JSON.stringify(isAdmin));
        if (!isAdmin.isAdmin) {
            throw new WsException(`User with intraId ${userId} is not an admin in the room`);
        }
        // check body data before persistence
        if (body.type !== "public" && (!body.password?.length || body.password.length < 4))
                throw new WsException(`password must have at least 4 characters!`);
        if (body.type === "public" && body.password)
            throw new WsException(`public rooms shouldnt have a password !`);
        const hashedPass: string | undefined = body.type === "private" && body.password ? await hash(body.password) : "";
        const roomUpdate = await this.prisma.room.update({
            where: {id : room.id},
            data : {
                name: body.name,
                type: body.type,
                password: hashedPass
            }
        });
        console.log("room updated successfully")
        return roomUpdate;
    }

    /* DTO join
    {
        "id" : 1
    }
    */
    // join room
    // TODO: need to add the user to the room conversation
    async joinRoom(body: JoinRoomDto, userId: number)
    {
        if (!body.id)
            throw new WsException('id field is required !')
        const room = await this.getRoomById(body.id);
        // console.log("ROOM ==" + JSON.stringify(room));
        if (!room)
            throw new WsException(`room ${body.id} not found`);
        const isMember = await this.isMember(userId, room.id)
        // console.log("isMem in join === " + isMember)
        if (isMember)
            throw new WsException(`user is already member on the room`);
        if (room.type === 'private' && !body.password)
            throw new WsException(`password is required for this room !`);
        if (room.type == 'private' && body.password)
        {
            const isMatch = await verify(room.password, body.password);
            if (!isMatch)
                throw new WsException(`Passwords don't matchs`);
        }
        const newMembership = await this.prisma.membership.create({
            data : {
                room: {
                    connect: {
                        id: room.id,
                    },
                },
                user: {
                    connect: {
                        intraId: userId,
                    },
                },
                isOwner: false,
                isAdmin: false,
                isBanned: false,
                isMute: false,
            }
        })
        // console.log("join room service");
        console.log(`${userId} has joined the room ${room.name}`)
        return newMembership;
    }

    /*
        leaveRoom JSON
        {
            "roomId" : 3,
        }
    */
    // function to leave a room
    // TODO: need to remove the user from the room conversation
    async leaveRoom(body: LeaveRoomDto, userId: number)
    {
        if (!body.roomId)
            throw new WsException('room Id is reauired !')
        const room = await this.getRoomById(body.roomId);
        const user = await this.userService.getUser(userId);
        if(!user)
            throw new WsException(`userId = ${userId} does not exist !`);
        // check if the user is already a member in this room
        // getMemberShip
        const membership = await this.chatService.getMembership(userId, room.id);
        if (!membership)
            throw new WsException (`no membership between ${userId} and ${room.id}`);
        const updatedMembership = await this.prisma.membership.delete({
            where: {
                id: membership.id
            }
        });

        console.log(`${user.userName} has left ${room.name} room`);
        return updatedMembership;
    }

    async setAdminToRoom(body: SetRoomAdminDto, userId: number)
    {
        if (!body.roomId || !body.userId)
            throw new WsException('roomId OR userId are missed !');
        const room = await this.getRoomById(body.roomId);
        // console.log("ROOM ==" + JSON.stringify(room));
        if (!room)
            throw new WsException(`room ${body.roomId} not found`);
        // check if the user in the body exists
        const user = await this.userService.getUser(body.userId);
        // console.log("USER == " + JSON.stringify(user));
        if(!user)
                throw new WsException(`userId = ${body.userId} does not exist !`);
        // check if the user is who wants to set an admin is also an admin
        const isAdmin = await this.isAdmin(userId, room.id);
        if (!isAdmin)
            throw new WsException(`User with intraId ${userId} is not an admin in the room, so he can't set an admin`);
        // check if the user is already a member in this room
        // getMemberShip
        const membership = await this.chatService.getMembership(body.userId, room.id);
        if (!membership)
            throw new WsException (`no membership between ${body.userId} and ${room.id}`);
        // set new Admin
        const newAdmin = await this.prisma.membership.update({
            where: {
                id: membership.id
            },
            data :{
                isAdmin: true
            }
        })
        console.log("Admin setted successfully");
        return newAdmin;
    }

    // TODO: need improvement || need to remove the user kicked from the room conversation
    /*
        kick JSON
        {
            "userId" : 90682,
            "roomId" : 3,
        }
    */
    async kickMember(body: KickMemberDto, userId: number)
    {
        if (!body.roomId || !body.userId)
            throw new WsException('roomId or userId is missed !')
        const room = await this.getRoomById(body.roomId);
        // console.log("ROOM ==" + JSON.stringify(room));
        if (!room)
            throw new WsException(`room ${body.roomId} not found`);
        // check if the user that will performs the kick exists
        const kicker = await this.userService.getUser(userId);
        if (!kicker)
            throw new WsException(`userId (kicker) = ${userId} does not exist !`);
        // check if the user that will be kicked is exists
        const user = await this.userService.getUser(body.userId);
        // console.log("USER == " + JSON.stringify(user));
        if(!user)
            throw new WsException(`userId = ${body.userId} does not exist !`);
        // check if the user that will be kicked is a member in the room or not
        const membership = await this.chatService.getMembership(body.userId, room.id);
        if (!membership)
            throw new WsException(`no membership between ${body.userId} and ${room.id}`);
         // check if the user that will performs the kick is an Admin
        const isAdmin = await this.isAdmin(userId, room.id);
        if (!isAdmin)
            throw new WsException(`User with intraId ${userId} is not an admin in the room, so he can't kick a member`);
        // check if the user that will be kicked is a the owner of the room
        // TODO : change isOwner to isAdmin
        const isOwner = await this.isOwner(body.userId, room.id);
        if (isOwner)
            throw new WsException(`You can't kick the owner of the room`)
        const updatedMembership = await this.prisma.membership.delete({
            where : {
                id: membership.id
            }
        })
        console.log(`${user.userName} has been kicked successfully from ${room.name}`);
        return updatedMembership;
    }

    async muteMember(userId: number, body: MuteMemberDto)
    {
        if (!body.roomId || !body.userId || !body.timeMute)
            throw new WsException('some fields are missed !!')
        const room = await this.getRoomById(body.roomId);
        // console.log("ROOM ==" + JSON.stringify(room));
        if (!room)
            throw new WsException(`room ${body.roomId} not found`);
        const kicker = await this.userService.getUser(userId);
        if (!kicker)
            throw new WsException(`userId (kicker) = ${userId} does not exist !`);
        // check if the user in the body exists
        const user = await this.userService.getUser(body.userId);
        // console.log("USER == " + JSON.stringify(user));
        if(!user)
            throw new WsException(`userId = ${body.userId} does not exist !`);
        const membership = await this.chatService.getMembership(body.userId, room.id);
        if (!membership)
            throw new WsException(`no membership between ${body.userId} and ${room.id}`);
        // check if the user that will be muted is the owner of the room
        const isOwner = await this.isOwner(body.userId, room.id);
        if (isOwner)
            throw new WsException(`You can't mute the owner of the room`)
        const isMuted = await this.isMuted(body.userId, room.id);
        if (isMuted)
            throw new WsException(`This user is already muted. Wait until his muted time ends.`)
        // calculate time mute based on the DTO
        const now = new Date();
        const endMutedTime = addMinutes(now, body.timeMute);
        console.log("endMutedTime = " + endMutedTime);
        const updateMembership = await this.prisma.membership.update({
            where : {
                id: membership.id
            },
            data : {
                isMute: true,
                timeMute: endMutedTime
            }
        })
        console.log("User muted successfully");
        return updateMembership;
    }


    // async unSetAdminOfRoom(body: SetRoomAdmin, userId: number)
    // {
    //     const room = await this.getRoomById(body.roomId);
    //     // console.log("ROOM ==" + JSON.stringify(room));
    //     if (!room)
    //         throw new WsException(`room ${body.roomId} not found`);
    //     // check if the user in the body exists
    //     const user = await this.userService.getUser(body.userId);
    //     // console.log("USER == " + JSON.stringify(user));
    //     if(!user)
    //             throw new WsException(`userId = ${body.userId} does not exist !`);
    //     const isAdmin = await this.isAdmin(body.userId, room.id);
    //     if (!isAdmin) {
    //         throw new WsException(`User with intraId ${userId} is not an admin in the room, so he can't be unsetted`);
    //     }
    //     // check if the user is already a member in this room
    //     const isMember = await this.isMember(body.userId, room.id)
    //     if (!isMember)
    //         throw new WsException(`User id ${body.userId} not in the room`);
    // }

    /********************************************************************************************************* */
    // isOwner
    async isOwner(userId: number, roomId: number)
    {
        const isOwner = await this.prisma.membership.findFirst({
            where : {
                userId: userId,
                roomId: roomId
            },
            select : {
                isOwner: true
            }
        });
        return isOwner.isOwner;
    }

    // isAdmin
    async isAdmin(userId: number, roomId: number)
    {
        const isAdmin = await this.prisma.membership.findFirst({
            where: {
                userId: userId,
                roomId: roomId
            },
            select : {
                isAdmin: true
            }
        })
        return isAdmin.isAdmin;
    }

    // isMember
    async isMember(userId: number, roomId: number)
    {
        const isMember = await this.prisma.room.findFirst({
            where : {
                id: roomId,
                members:{
                    some : {
                        userId : userId
                    }
                }
            },
        })
        return isMember ? true : false;
    }
    // isMuted
    async isMuted(userId: number, roomId: number)
    {
        const isMuted = await this.prisma.membership.findFirst({
            where: {
                userId: userId,
                roomId: roomId
            },
            select : {
                isMute: true
            }
        })
        
        return isMuted.isMute;
    }
    // isBanned
    async isBanned(userId: number, roomId: number)
    {
        const isBanned = await this.prisma.membership.findFirst({
            where: {
                userId: userId,
                roomId: roomId
            },
            select : {
                isBanned: true
            }
        })
        return isBanned.isBanned;
    }
}