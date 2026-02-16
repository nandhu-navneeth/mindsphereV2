
import { PrismaClient, ContentType, Content } from '@prisma/client';
import axios from 'axios';
import { prisma } from '../db';
import { parseISO8601Duration } from '../utils/duration';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

interface FetchOptions {
    topic: string;
    difficulty?: string;
    limit?: number;
}

export class ContentFetcherService {

    /**
     * Fetches content for a given topic, prioritizing local DB then external sources.
     */
    async fetchContentForTopic(options: FetchOptions): Promise<Content[]> {
        const { topic, difficulty, limit = 5 } = options;
        console.log(`Fetching content for: ${topic} (${difficulty})`);

        // 1. Search Local DB
        // We match against tags or title
        let localContent = await prisma.content.findMany({
            where: {
                OR: [
                    { title: { contains: topic, mode: 'insensitive' } },
                    { tags: { some: { tag: { name: { contains: topic, mode: 'insensitive' } } } } }
                ],
                // Optional: Filter by difficulty if added to Content model
            },
            take: limit
        });

        if (localContent.length >= limit) {
            return localContent;
        }

        // 2. Fetch from External (YouTube) if needed
        const needed = limit - localContent.length;
        const externalContent = await this.fetchFromYouTube(topic, needed);

        // 3. Save External Content to DB
        const savedExternalContent = [];
        for (const item of externalContent) {
            // Check for duplicates by externalId
            const existing = await prisma.content.findUnique({
                where: { externalId: item.externalId }
            });

            if (!existing) {
                // Create new content
                const created = await prisma.content.create({
                    data: {
                        title: item.title,
                        description: item.description,
                        url: item.url,
                        source: 'YouTube',
                        type: ContentType.VIDEO,
                        duration: item.duration || 600, // Use fetched duration or fallback
                        thumbnail: item.thumbnail,
                        externalId: item.externalId,
                        difficulty: difficulty,
                        tags: {
                            create: {
                                tag: {
                                    connectOrCreate: {
                                        where: { name: topic },
                                        create: { name: topic }
                                    }
                                }
                            }
                        }
                    }
                });
                savedExternalContent.push(created);
            } else {
                savedExternalContent.push(existing);
            }
        }

        return [...localContent, ...savedExternalContent];
    }

    private async fetchFromYouTube(query: string, limit: number): Promise<any[]> {
        if (!YOUTUBE_API_KEY) {
            console.warn('YOUTUBE_API_KEY not set. Using mock data.');
            return this.getMockYouTubeData(query, limit);
        }

        try {
            const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                params: {
                    part: 'snippet',
                    q: query + ' tutorial', // Append tutorial for better results
                    type: 'video',
                    key: YOUTUBE_API_KEY,
                    maxResults: limit
                }
            });

            const videoIds = response.data.items.map((item: any) => item.id.videoId).join(',');

            // Follow-up request to get durations
            const detailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                params: {
                    part: 'contentDetails,snippet',
                    id: videoIds,
                    key: YOUTUBE_API_KEY
                }
            });

            return detailsResponse.data.items.map((item: any) => {
                const duration = parseISO8601Duration(item.contentDetails.duration);
                console.log(`Fetched duration for ${item.id}: ${duration}s`);
                return {
                    externalId: item.id,
                    title: item.snippet.title,
                    description: item.snippet.description,
                    url: `https://www.youtube.com/watch?v=${item.id}`,
                    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
                    duration
                };
            });
        } catch (error) {
            console.error('YouTube API Error:', error);
            return this.getMockYouTubeData(query, limit); // Fallback to mock
        }
    }

    private getMockYouTubeData(query: string, limit: number): any[] {
        return Array.from({ length: limit }).map((_, i) => ({
            externalId: `mock_${query}_${i}_${Date.now()}`,
            title: `${query} Tutorial Part ${i + 1} (Mock)`,
            description: `This is a mock video description for learning ${query}.`,
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
            thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', // Rickroll thumbnail as placeholder
            duration: Math.floor(Math.random() * (3600 - 300 + 1)) + 300 // Random 5-60 mins (in seconds)
        }));
    }
}
