// MongoDB initialization script
// Runs inside the MongoDB container on first startup

db = db.getSiblingDB('instagram_stories');
db.createUser({
  user: 'instagram',
  pwd: 'instagram_password',
  roles: [{ role: 'readWrite', db: 'instagram_stories' }],
});
db.createCollection('stories');
db.stories.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.stories.createIndex({ userId: 1, createdAt: -1 });

db = db.getSiblingDB('instagram_chat');
db.createUser({
  user: 'instagram',
  pwd: 'instagram_password',
  roles: [{ role: 'readWrite', db: 'instagram_chat' }],
});
db.createCollection('conversations');
db.createCollection('messages');
db.conversations.createIndex({ participants: 1, updatedAt: -1 });
db.messages.createIndex({ conversationId: 1, createdAt: -1 });

db = db.getSiblingDB('instagram_notifications');
db.createUser({
  user: 'instagram',
  pwd: 'instagram_password',
  roles: [{ role: 'readWrite', db: 'instagram_notifications' }],
});
db.createCollection('notifications');
db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.notifications.createIndex({ userId: 1, isRead: 1 });

print('MongoDB initialization complete');
