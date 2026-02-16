import { Request, Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { GamificationService } from '../services/gamification.service';

const StartSessionSchema = z.object({
  contentId: z.string(),
  studySessionId: z.string().optional(),
});

const EndSessionSchema = z.object({
  sessionId: z.string(),
  duration: z.number().optional(), // Client reported duration if needed, or computed
});

const EventBatchSchema = z.object({
  sessionId: z.string(),
  events: z.array(z.object({
    id: z.string().optional(), // Client UUID
    type: z.enum(['VIEW', 'COMPLETE', 'LIKE', 'SKIP', 'SHARE']),
    timestamp: z.string(), // ISO string
    metadata: z.any().optional(),
  })),
});

export const startSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { contentId, studySessionId } = StartSessionSchema.parse(req.body);

    const session = await prisma.learningSession.create({
      data: {
        userId,
        contentId,
        studySessionId,
        startTime: new Date(),
      },
      include: {
        content: true
      }
    });

    res.json(session);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const endSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { sessionId, duration } = EndSessionSchema.parse(req.body);

    const session = await prisma.learningSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const endTime = new Date();
    // Calculate duration in seconds if not provided or verify
    const computedDuration = Math.round((endTime.getTime() - session.startTime.getTime()) / 1000);

    const updatedSession = await prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        endTime,
        duration: computedDuration,
        isCompleted: true,
      }
    });

    // If linked to a study session, mark it as completed
    if (updatedSession.studySessionId) {
      await prisma.studySession.update({
        where: { id: updatedSession.studySessionId },
        data: { isCompleted: true }
      });
    }

    // Award XP and Update Streak
    await GamificationService.awardXP(userId, computedDuration, 'SESSION');
    await GamificationService.updateStreak(userId);

    res.json(updatedSession);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const logEvents = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { sessionId, events } = EventBatchSchema.parse(req.body);

    // Verify session ownership? 
    // For batch perf, maybe trust or simpler check. 
    // Let's verify.
    const session = await prisma.learningSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Bulk insert events
    // Transform timestamp string to Date
    const eventsData = events.map(e => ({
      // id: e.id, // Use client ID if provided? Prisma defaults to uuid if not present. 
      // If client provides ID, we should use it for idempotency.
      // But InteractionEvent.id is default(uuid). To use client ID, we need to allow setting it.
      // Schema says @default(uuid()), we can supply it.
      ...(e.id ? { id: e.id } : {}),
      sessionId,
      userId,
      type: e.type,
      timestamp: new Date(e.timestamp),
      metadata: e.metadata || {},
    }));

    // Use createMany? Postgres supports it.
    // Idempotency: createMany doesn't support skipDuplicates in all versions or databases? 
    // Prisma createMany supports skipDuplicates!
    await prisma.interactionEvent.createMany({
      data: eventsData,
      skipDuplicates: true, // Idempotency based on ID
    });

    res.json({ success: true, count: events.length });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
