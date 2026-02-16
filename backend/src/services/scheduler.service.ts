
import { prisma } from '../db';
import { QUEUES, hydratePlanQueue } from '../jobs/queues';

interface GeneratePlanParams {
    userId: string;
    topic: string;
    difficulty: string; // Beginner, Intermediate, Advanced
    startDate: Date;
    endDate: Date;
}

export class StudyPlanService {
    async generatePlan(params: GeneratePlanParams) {
        const { userId, topic, difficulty, startDate, endDate } = params;

        // 2. Create Plan Record
        const plan = await prisma.studyPlan.create({
            data: {
                userId,
                topic,
                difficulty,
                startDate: startDate,
                endDate: endDate
            }
        });

        // 3. Generate Skeleton Sessions (70% coverage rule for now, weekends lighter?)
        // Let's keep it simple: Everyday session for now.
        const sessionsData = [];

        // Calculate total days between start and end date (inclusive)
        const diffTime = endDate.getTime() - startDate.getTime();
        const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

        for (let i = 0; i < totalDays; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);

            // Simple curriculum progression placeholder
            // In a real app, 'topic' would be broken down via LLM or detailed curriculum tree.
            const subTopic = `${topic}: Day ${i + 1} - ${this.getSubTopic(topic, i, difficulty)}`;

            sessionsData.push({
                planId: plan.id,
                dayOffset: i,
                date: date,
                topic: subTopic,
                isCompleted: false
            });
        }

        await prisma.studySession.createMany({
            data: sessionsData
        });

        // 4. Trigger Async Content Hydration
        // We add a job to the queue to find content for these sessions
        await hydratePlanQueue.add('hydrate', {
            planId: plan.id,
            topic,
            difficulty
        });

        // 5. Return the full plan with sessions
        return this.getPlan(userId);
    }

    private getSubTopic(mainTopic: string, dayIndex: number, difficulty: string): string {
        // Mock curriculum logic
        if (dayIndex === 0) return "Introduction & Basics";
        if (dayIndex === 1) return "Environment Setup";
        return "Core Concepts & Practice";
    }

    async getPlan(userId: string) {
        return prisma.studyPlan.findFirst({
            where: { userId },
            include: {
                sessions: {
                    include: { content: true },
                    orderBy: { dayOffset: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}
