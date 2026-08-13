const prisma = require('../db');
const socketStore = require('../sockets/socketStore');

class NotificationService {
  async createNotification({ userId, type, message, data }) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        message,
        data: data || {}
      }
    });

    // Notify connected user live
    const userSockets = socketStore.getSockets(userId);
    const io = socketStore.getIo();
    
    if (io && userSockets.length > 0) {
      for (const sid of userSockets) {
        io.to(sid).emit('notification_created', notification);
      }
    }
    
    return notification;
  }

  async getRecentNotifications(userId, limit = 20) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async markAsRead(notificationId, userId) {
    // verify ownership
    const notif = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notif || notif.userId !== userId) throw new Error('Not found or unauthorized');

    return prisma.notification.update({
      where: { id: notificationId },
      data: { read: true }
    });
  }

  async markAllAsRead(userId) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    });
  }
}

module.exports = new NotificationService();
