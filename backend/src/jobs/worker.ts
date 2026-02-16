import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUES, notificationQueue } from './queues';
import { prisma } from '../db';
import webpush from 'web-push';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Configure Web Push (using dummy keys if env not set for dev)
webpush.setVapidDetails(
  'mailto:admin@mindsphere.app',
  process.env.VAPID_PUBLIC_KEY || 'BEl6...',
  process.env.VAPID_PRIVATE_KEY || 'K7...'
);

const reportWorker = new Worker(QUEUES.REPORTS, async (job: Job) => {
  console.log(`Processing report job ${job.id}`);
  const { userId, weekStartDate } = job.data;

  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  // 1. Fetch Sessions
  const sessions = await prisma.learningSession.findMany({
    where: {
      userId,
      startTime: { gte: start, lt: end },
      isCompleted: true
    }
  });

  // 2. Aggregate Totals
  const totalSessions = sessions.length;
  const totalProductiveMins = Math.round(sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / 60);

  // 3. Social Media Reduction Score (Proxy)
  // Assumption: Every minute spent here is a minute NOT doomscrolling.
  // Target: 2.5 hours/week (150 mins) = 100% score.
  const score = Math.min(100, Math.round((totalProductiveMins / 150) * 100));

  // 4. Generate Chart Data (Daily Breakdown)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyStats = new Array(7).fill(0).map((_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      day: days[d.getDay()],
      date: d.toISOString().split('T')[0],
      minutes: 0
    };
  });

  sessions.forEach(s => {
    const dayIndex = Math.floor((s.startTime.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (dayIndex >= 0 && dayIndex < 7) {
      dailyStats[dayIndex].minutes += Math.round((s.duration || 0) / 60);
    }
  });

  // 5. Save Report
  // Upsert to avoid duplicates if job runs twice
  await prisma.weeklyReport.upsert({
    where: {
      userId_weekStartDate: { userId, weekStartDate: start }
    },
    update: {
      totalSessions,
      totalProductiveMins,
      score,
      chartData: dailyStats
    },
    create: {
      userId,
      weekStartDate: start,
      totalSessions,
      totalProductiveMins,
      score,
      chartData: dailyStats
    }
  });

  console.log(`Report generated for ${userId}: Score ${score}`);

  // 6. Trigger Notification
  await notificationQueue.add('send', {
    userId,
    title: 'Your Weekly Insight 🧠',
    body: `You saved ${totalProductiveMins} mins from doomscrolling this week! Score: ${score}/100`,
    url: '/analytics'
  });

}, { connection });

const notificationWorker = new Worker(QUEUES.NOTIFICATIONS, async (job: Job) => {
  console.log(`Processing notification for ${job.data.userId}`);
  const { userId, title, body, url } = job.data;

  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });

    const payload = JSON.stringify({ title, body, url });

    const promises = subscriptions.map(sub =>
      webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }, payload).catch(err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired/invalid, delete it
          return prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
        console.error('Push error', err);
      })
    );

    await Promise.all(promises);
  } catch (error) {
    console.error('Worker failed', error);
  }
}, { connection });

import { ContentFetcherService } from '../services/contentFetcher.service';

const hydratePlanWorker = new Worker(QUEUES.HYDRATE_PLAN, async (job: Job) => {
  console.log(`Hydrating plan ${job.data.planId}`);
  const { planId, topic, difficulty } = job.data;

  try {
    const fetcher = new ContentFetcherService();
    // Fetch a pool of content
    const contents = await fetcher.fetchContentForTopic({
      topic,
      difficulty,
      limit: 20 // Fetch enough to cover unique days if possible
    });

    // Find sessions without content
    const sessions = await prisma.studySession.findMany({
      where: { planId, contentId: null },
      orderBy: { dayOffset: 'asc' }
    });

    // Distribute content
    for (let i = 0; i < sessions.length; i++) {
      const content = contents[i % contents.length]; // cycle if not enough
      if (content) {
        await prisma.studySession.update({
          where: { id: sessions[i].id },
          data: { contentId: content.id }
        });
      }
    }
    console.log(`Plan ${planId} hydrated with content.`);

    // Notify User
    const plan = await prisma.studyPlan.findUnique({ where: { id: planId } });
    if (plan) {
      await notificationQueue.add('send', {
        userId: plan.userId,
        title: 'Study Plan Ready 📚',
        body: `Your custom plan for ${topic} is ready with video recommendations!`,
        url: '/schedule'
      });
    }
  } catch (error) {
    console.error('Hydration failed', error);
  }
}, { connection });


export const initWorkers = () => {
  console.log('Workers initialized');
};
