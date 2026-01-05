import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Groq API (OpenAI-compatible, faster and free)
export const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
});

// OpenAI for embeddings (Groq doesn't support embeddings yet)
export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
