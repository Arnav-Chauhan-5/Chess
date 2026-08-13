const prisma = require('../db');
const socketStore = require('../sockets/socketStore');
const notificationService = require('./notificationService');

class FriendService {
  async sendRequest(requesterId, addresseeUsername) {
    const addressee = await prisma.user.findUnique({
      where: { username: addresseeUsername }
    });

    if (!addressee) {
      throw new Error('User not found');
    }

    if (requesterId === addressee.id) {
      throw new Error('You cannot friend yourself');
    }

    // Check existing
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId: addressee.id },
          { requesterId: addressee.id, addresseeId: requesterId }
        ]
      }
    });

    if (existing) {
      throw new Error('Friendship or pending request already exists');
    }

    const friendship = await prisma.friendship.create({
      data: {
        requesterId,
        addresseeId: addressee.id,
        status: 'PENDING'
      }
    });

    const requesterUser = await prisma.user.findUnique({ where: { id: requesterId } });

    await notificationService.createNotification({
      userId: addressee.id,
      type: 'FRIEND_REQUEST',
      message: `You have a new friend request from ${requesterUser.username}`,
      data: {
        fromUserId: requesterId,
        fromUsername: requesterUser.username,
        friendshipId: friendship.id
      }
    });

    return friendship;
  }

  async respondToRequest(friendshipId, addresseeId, accept) {
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      throw new Error('Request not found');
    }

    if (friendship.addresseeId !== addresseeId) {
      throw new Error('Unauthorized');
    }

    if (accept) {
      return prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: 'ACCEPTED' }
      });
    } else {
      await prisma.friendship.delete({
        where: { id: friendshipId }
      });
      return { deleted: true };
    }
  }

  async getFriendsList(userId) {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId },
          { addresseeId: userId }
        ]
      },
      include: {
        requester: { select: { id: true, username: true, rating: true, avatarUrl: true } },
        addressee: { select: { id: true, username: true, rating: true, avatarUrl: true } }
      }
    });

    const accepted = [];
    const pendingIncoming = [];
    const pendingOutgoing = [];

    for (const f of friendships) {
      if (f.status === 'ACCEPTED') {
        const friendUser = f.requesterId === userId ? f.addressee : f.requester;
        const isOnline = friendUser.showOnlineStatus ? socketStore.isOnline(friendUser.id) : false;
        accepted.push({
          friendshipId: f.id,
          ...friendUser,
          isOnline
        });
      } else if (f.status === 'PENDING') {
        if (f.addresseeId === userId) {
          pendingIncoming.push({
            friendshipId: f.id,
            ...f.requester
          });
        } else {
          pendingOutgoing.push({
            friendshipId: f.id,
            ...f.addressee
          });
        }
      }
    }

    return { accepted, pendingIncoming, pendingOutgoing };
  }

  async broadcastStatusToFriends(io, userId, isOnline) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { showOnlineStatus: true }
    });

    if (user && !user.showOnlineStatus) {
      isOnline = false;
    }

    // Get all accepted friends
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId },
          { addresseeId: userId }
        ]
      }
    });

    for (const f of friendships) {
      const friendId = f.requesterId === userId ? f.addresseeId : f.requesterId;
      const friendSockets = socketStore.getSockets(friendId);
      
      for (const socketId of friendSockets) {
        io.to(socketId).emit('friend_status_changed', { userId, isOnline });
      }
    }
  }
}

module.exports = new FriendService();
