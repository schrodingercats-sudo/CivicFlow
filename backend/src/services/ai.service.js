import Groq from 'groq-sdk';
// Node 22+ has native global fetch - no need for node-fetch
import { logger } from '../utils/logger.js';

const SYSTEM_PROMPT = `You are CivicFlow AI, a senior municipal civil engineer & automated complaint triage agent.
Analyze the citizen's complaint title and description carefully.

Task:
1. Categorize into EXACTLY ONE of: "road_damage", "garbage", "street_lights", "drainage", "water_supply", "electricity", "traffic", "pollution", "public_property", "others".
2. Predict Priority level ("low", "medium", "high", "critical") based on safety hazard, public inconvenience, and infrastructure risks.
3. Generate an AI Executive Summary (10-18 words): DO NOT simply repeat the title or description verbatim. Rephrase into professional municipal terminology highlighting the root cause and public impact.
4. Generate a Suggested Officer Response (15-25 words): Actionable, official communication template for dispatched engineers detailing field inspection, containment, and repair timelines.
5. Provide confidence score (0.75 - 0.99).

Output JSON Format strictly matching:
{
  "category": "drainage",
  "priority": "high",
  "ai_summary": "Major drainage pipeline collapse causing surface road obstruction and sanitary hazard.",
  "ai_suggested_response": "Sanitation & PWD repair crew dispatched for urgent gutter line de-clogging and structural road repair within 12 hours.",
  "ai_confidence": 0.95
}
Respond ONLY with valid raw JSON object. Do not include markdown quotes, markdown codeblocks, or conversational text.`;

export class AIService {
  static async analyzeComplaint(title, description) {
    const promptText = `Complaint Title: ${title}\nDescription: ${description}`;

    // 1. Try Primary Provider: Groq API
    try {
      logger.info('Attempting AI Triage via Primary Provider (Groq)...');
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey || groqKey.includes('your_groq_api_key')) {
        throw new Error('Groq API Key not configured');
      }

      const groq = new Groq({ apiKey: groqKey });
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: promptText }
        ],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 350
      });

      const rawJson = completion.choices[0]?.message?.content;
      const parsed = JSON.parse(rawJson);
      logger.info('Groq AI Triage Succeeded', { category: parsed.category, priority: parsed.priority });
      return { ...parsed, provider: 'Groq' };
    } catch (groqErr) {
      logger.warn(`Groq API Triage failed: ${groqErr.message}. Attempting Fallback to NVIDIA NIM...`);
    }

    // 2. Try Secondary Provider: NVIDIA NIM API
    try {
      const nvidiaKey = process.env.NVIDIA_NIM_API_KEY;
      if (!nvidiaKey || nvidiaKey.includes('your_nvidia_nim_api_key')) {
        throw new Error('NVIDIA NIM API Key not configured');
      }

      const nimRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${nvidiaKey}`
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-70b-instruct',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: promptText }
          ],
          temperature: 0.3,
          max_tokens: 350
        })
      });

      if (!nimRes.ok) {
        throw new Error(`NVIDIA NIM HTTP ${nimRes.status}: ${await nimRes.text()}`);
      }

      const nimData = await nimRes.json();
      let rawJson = nimData.choices?.[0]?.message?.content || '{}';
      rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(rawJson);
      logger.info('NVIDIA NIM AI Triage Succeeded', { category: parsed.category, priority: parsed.priority });
      return { ...parsed, provider: 'NVIDIA NIM' };
    } catch (nvidiaErr) {
      logger.error(`NVIDIA NIM Fallback failed: ${nvidiaErr.message}. System falling back to manual review.`);
    }

    // 3. Tertiary Fallback
    return {
      category: 'others',
      priority: 'medium',
      ai_summary: 'Infrastructure issue queued for manual officer triage.',
      ai_suggested_response: 'Field team notified for manual inspection.',
      ai_confidence: 0.50,
      provider: 'manual_fallback',
      needs_manual_review: true
    };
  }
}
