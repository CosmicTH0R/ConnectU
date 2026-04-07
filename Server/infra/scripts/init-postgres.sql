-- Initialize PostgreSQL databases for all services that use Postgres
-- This runs automatically when the postgres container starts for the first time

-- User service database
CREATE DATABASE instagram_users;
-- Post service database  
CREATE DATABASE instagram_posts;
-- Feed service database
CREATE DATABASE instagram_feed;
-- Feature flags database
CREATE DATABASE instagram_flags;
-- A/B testing database
CREATE DATABASE instagram_experiments;
-- Analytics database
CREATE DATABASE instagram_analytics;

-- Grant all privileges to the instagram user
GRANT ALL PRIVILEGES ON DATABASE instagram TO instagram;
GRANT ALL PRIVILEGES ON DATABASE instagram_users TO instagram;
GRANT ALL PRIVILEGES ON DATABASE instagram_posts TO instagram;
GRANT ALL PRIVILEGES ON DATABASE instagram_feed TO instagram;
GRANT ALL PRIVILEGES ON DATABASE instagram_flags TO instagram;
GRANT ALL PRIVILEGES ON DATABASE instagram_experiments TO instagram;
GRANT ALL PRIVILEGES ON DATABASE instagram_analytics TO instagram;
