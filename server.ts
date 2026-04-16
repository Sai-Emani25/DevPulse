import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize Clients
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  // Qdrant initialization (using mock/placeholder if credentials missing for demo)
  const hasQdrant = process.env.QDRANT_URL && process.env.QDRANT_API_KEY;
  const qdrant = hasQdrant ? new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  }) : null;

  // Vapi "Server URL" / Webhook Endpoint for RAG
  app.post('/api/vapi/webhook', async (req, res) => {
    const { message } = req.body;

    if (message?.type === 'tool-calls' || message?.type === 'function-call') {
      const toolCall = message.toolCalls?.[0] || message.functionCall;
      
      if (toolCall?.name === 'search_technical_docs') {
        const query = toolCall.arguments?.query || toolCall.parameters?.query;
        console.log('Searching Qdrant for:', query);

        let context = "No specific documentation found in local memory.";
        
        if (qdrant) {
          try {
            // Placeholder: real implementation would vectorize the query.
            const searchResults = await qdrant.search('dev_docs', {
              vector: Array(1536).fill(0), // Mock vector
              limit: 3,
            });
            context = searchResults.map(r => r.payload?.content).join('\n\n');
          } catch (e) {
            console.error('Qdrant search error:', e);
          }
        } else {
          context = `[Demo Context] For ${query}: Ensure you are using the latest React 19 patterns. Remember that useEffect should be used sparingly for external synchronization. Use 'motion/react' for animations.`;
        }

        // Logic for Gemini synthesizing the technical response
        const prompt = `
          ## Role
          You are "DevPulse," a high-performance voice agent for software engineers. Provide a concise, technical, voice-friendly answer (under 40 words). Focus on "what" and "how".
          
          ## Context
          ${context}
          
          User Query: "${query}"
        `;

        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt
        });
        const responseText = result.text || "I found some context but couldn't synthesize a response.";

        return res.json({
          results: [
            {
              toolCallId: toolCall.id,
              result: responseText
            }
          ]
        });
      }
    }

    // Default response for other webhook types
    res.status(200).json({ status: 'ok' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DevPulse Server running on http://localhost:${PORT}`);
    console.log(`Vapi Webhook URL: ${process.env.APP_URL || 'http://localhost:3000'}/api/vapi/webhook`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
