import Redis from 'ioredis';
import { getConfig } from '../config/config.loader';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.INFRASTRUCTURE;
let redis: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redis) {
        const config = getConfig();

        const retryStrategy = (times: number) => {
            return Math.min(times * 50, 2000);
        };

        if (config.REDIS_URL) {
            redis = new Redis(config.REDIS_URL, { retryStrategy });
        } else {
            redis = new Redis({
                host: config.REDIS_HOST,
                port: config.REDIS_PORT,
                password: config.REDIS_PASSWORD || undefined,
                retryStrategy,
            });
        }

        redis.on('connect', () => {
            appLogger.info({ label: logLabel, msg: 'Redis connected' });
        });

        redis.on('error', (err) => {
            appLogger.error({ label: logLabel, msg: 'Redis error', err });
        });
    }
    return redis;
}

export async function closeRedisConnection(): Promise<void> {
    if (redis) {
        await redis.quit();
        redis = null;
        appLogger.info({ label: logLabel, msg: 'Redis connection closed' });
    }
}

// Helper to get the Redis key for an event's available spots
export function getEventSpotsKey(eventId: number): string {
    return `event:${eventId}:spots`;
}
