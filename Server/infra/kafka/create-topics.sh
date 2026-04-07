#!/bin/sh
# Create required Kafka topics for Instagram backend
# Run this after the Kafka container is healthy

KAFKA_BROKER="${KAFKA_BROKER:-localhost:9092}"
PARTITIONS="${PARTITIONS:-3}"
REPLICATION_FACTOR="${REPLICATION_FACTOR:-1}"

create_topic() {
  TOPIC=$1
  echo "Creating topic: $TOPIC"
  kafka-topics --bootstrap-server "$KAFKA_BROKER" \
    --create \
    --if-not-exists \
    --topic "$TOPIC" \
    --partitions "$PARTITIONS" \
    --replication-factor "$REPLICATION_FACTOR"
}

# User events
create_topic "user.created"
create_topic "user.updated"
create_topic "user.deleted"
create_topic "user.follow"
create_topic "user.unfollow"

# Post events
create_topic "post.created"
create_topic "post.deleted"
create_topic "post.like"
create_topic "post.unlike"
create_topic "post.comment"
create_topic "post.comment.deleted"
create_topic "post.mention"

# Story events
create_topic "story.created"
create_topic "story.deleted"
create_topic "story.view"
create_topic "story.reaction"

# Chat events
create_topic "chat.message.sent"

# Media events
create_topic "media.uploaded"
create_topic "media.deleted"

# Reel events
create_topic "reel.view"
create_topic "reel.like"

# System events
create_topic "system.rate_limit_exceeded"
create_topic "system.flag_updated"

echo "All Kafka topics created successfully"
