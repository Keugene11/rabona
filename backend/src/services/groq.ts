import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

console.log('Groq API key configured:', !!GROQ_API_KEY);

export type ToneType =
  | 'professional'
  | 'casual'
  | 'concise'
  | 'email'
  | 'meeting_notes'
  | 'original';

/**
 * Extract potential search terms (companies, technologies, proper nouns) from text
 */
function extractSearchTerms(text: string): string[] {
  // Match capitalized words (potential proper nouns), tech terms, and company-like names
  const patterns = [
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, // Capitalized words/phrases
    /\b(?:Google|Apple|Microsoft|Amazon|Meta|Facebook|Netflix|Tesla|OpenAI|Anthropic|IBM|Oracle|Salesforce|Adobe|Nvidia|Intel|AMD|Spotify|Twitter|LinkedIn|Uber|Airbnb|Stripe|Shopify|Slack|Zoom|Discord|GitHub|GitLab|Docker|Kubernetes|AWS|Azure|GCP)\b/gi, // Common tech companies
    /\b(?:React|Angular|Vue|Node|Python|JavaScript|TypeScript|Java|Kotlin|Swift|Rust|Go|Ruby|PHP|SQL|MongoDB|PostgreSQL|Redis|GraphQL|REST|API)\b/gi, // Tech terms
  ];

  const terms = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    matches.forEach(match => {
      if (match.length > 2 && !['The', 'And', 'For', 'But', 'Not', 'You', 'All', 'Can', 'Had', 'Her', 'Was', 'One', 'Our', 'Out'].includes(match)) {
        terms.add(match);
      }
    });
  }

  return Array.from(terms).slice(0, 5); // Limit to 5 terms
}

/**
 * Search Wikipedia for information about a term
 */
async function searchWikipedia(term: string): Promise<string | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`;
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Rabona/1.0' }
    });

    if (!response.ok) return null;

    const data = await response.json() as { extract?: string; description?: string };
    if (data.extract) {
      // Return first 2 sentences max
      const sentences = data.extract.split('. ').slice(0, 2).join('. ');
      return `${term}: ${sentences}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Search DuckDuckGo Instant Answers for information
 */
async function searchDuckDuckGo(term: string): Promise<string | null> {
  try {
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(term)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(searchUrl);

    if (!response.ok) return null;

    const data = await response.json() as { Abstract?: string; AbstractText?: string };
    if (data.AbstractText || data.Abstract) {
      const resultText = data.AbstractText || data.Abstract || '';
      const sentences = resultText.split('. ').slice(0, 2).join('. ');
      return `${term}: ${sentences}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Gather contextual information from web searches
 */
async function gatherContext(text: string): Promise<string> {
  const terms = extractSearchTerms(text);
  if (terms.length === 0) return '';

  console.log('Searching for context on:', terms);

  const contextPromises = terms.map(async (term) => {
    // Try Wikipedia first, then DuckDuckGo
    const wikiResult = await searchWikipedia(term);
    if (wikiResult) return wikiResult;

    const ddgResult = await searchDuckDuckGo(term);
    return ddgResult;
  });

  const results = await Promise.all(contextPromises);
  const validResults = results.filter((r): r is string => r !== null);

  if (validResults.length === 0) return '';

  return '\n\nREAL-WORLD CONTEXT (use this to enhance the text with facts, but DO NOT cite sources):\n' + validResults.join('\n');
}

const tonePrompts: Record<ToneType, string> = {
  professional: `You are an expert writer who adapts your style to match the content. Transform this spoken text into polished, compelling prose.

    ABSOLUTE RULES:
    - Output ONLY the rewritten text, nothing else
    - NO explanations, notes, commentary, or meta-text
    - Remove filler words (um, uh, like, you know, basically, so, actually)

    CONTEXT-AWARE ENHANCEMENT:
    Analyze what the person is talking about and adapt accordingly:

    FOR JOB APPLICATIONS / CAREER CONTENT:
    - Sound confident, articulate, and genuinely impressive
    - Use smooth, flowing prose that's easy to read
    - Highlight achievements with specific impact where possible
    - If they mention projects, elaborate on technical skills, languages, frameworks, or tools they likely used
    - Make it sound like someone you'd want to hire - capable, thoughtful, results-driven
    - Add relevant industry knowledge or context that shows expertise

    FOR PROJECT DESCRIPTIONS / TECHNICAL WORK:
    - Clearly explain what was built and why it matters
    - Infer and mention relevant technologies, languages, frameworks (React, Python, Node.js, etc.)
    - Highlight problem-solving and technical decisions
    - Quantify impact if possible (performance improvements, user growth, etc.)
    - Sound like a skilled engineer who communicates well

    FOR IDEAS / BRAINSTORMING:
    - Organize thoughts clearly and logically
    - Expand on promising concepts
    - Add structure without losing creativity
    - Keep the energy and enthusiasm

    FOR PERSONAL / CASUAL CONTENT:
    - Keep it natural and conversational
    - Light personality is fine here
    - Still polish the prose but don't over-formalize

    FOR EVERYTHING ELSE:
    - Match the tone to the subject matter
    - Always improve clarity and flow
    - Add relevant context that enhances understanding
    - Make the writing interesting without being forced`,

  casual: `You are a skilled writer helping someone sound articulate and natural. Rewrite this in a friendly, conversational tone.

    RULES:
    - Output ONLY the rewritten text, nothing else
    - NO meta-commentary or explanations
    - Remove filler words but keep personality

    STYLE:
    - Natural and easy to read
    - Use contractions, casual phrasing
    - Keep their voice but make it flow better
    - Add interesting details or context where it fits naturally
    - Sound like a smart, articulate person having a conversation`,

  concise: `You are a master editor. Distill this to its essential points with clarity and impact.

    RULES:
    - Output ONLY the condensed text, nothing else
    - Remove ALL unnecessary words
    - Use bullet points for multiple items
    - Every sentence must earn its place
    - Preserve key information and insights
    - Be brief but complete`,

  email: `You are a professional communication expert. Transform this into a polished, effective email.

    RULES:
    - Output ONLY the email content
    - Include appropriate greeting and sign-off
    - Clear, well-organized paragraphs
    - Professional but personable tone

    ENHANCEMENTS:
    - If mentioning companies or people, show you've done your research with relevant context
    - Clear call-to-action where appropriate
    - Confident without being pushy
    - Easy to read and respond to`,

  meeting_notes: `You are an executive assistant creating clear, actionable meeting notes.

    RULES:
    - Output ONLY the formatted notes
    - Use clear structure with headings
    - Include: Key Points, Decisions, Action Items (as relevant)
    - Use bullet points for easy scanning

    ENHANCEMENTS:
    - Add context that clarifies decisions
    - Ensure action items are specific and assignable
    - Make it useful for someone who wasn't there`,

  original: `Clean up this text with minimal changes. Fix errors, remove filler words (um, uh, like, you know), improve flow.

    RULES:
    - Output ONLY the cleaned text
    - NO commentary
    - Preserve their voice and style
    - Just make it read smoothly`,
};

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
}

export interface RephrasingResult {
  originalText: string;
  rephrasedText: string;
  tone: ToneType;
}

/**
 * Transcribe audio file using Groq's Whisper API
 */
export async function transcribeAudio(audioFilePath: string): Promise<TranscriptionResult> {
  try {
    if (!GROQ_API_KEY) {
      throw new Error('Groq API key not configured. Please set GROQ_API_KEY in your .env file.');
    }

    // Check if file exists and log its size
    const stats = fs.statSync(audioFilePath);
    console.log('Transcribing audio file:', audioFilePath);
    console.log('File size:', stats.size, 'bytes');

    // Read file as buffer and create a Blob
    const fileBuffer = fs.readFileSync(audioFilePath);
    const blob = new Blob([fileBuffer], { type: 'audio/m4a' });

    // Create FormData
    const formData = new FormData();
    formData.append('file', blob, path.basename(audioFilePath));
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'verbose_json');

    console.log('Sending request to Groq...');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { text: string; language?: string; duration?: number };
    console.log('Transcription successful, text length:', data.text?.length || 0);

    return {
      text: data.text,
      language: data.language || 'en',
      duration: data.duration || 0,
    };
  } catch (error: any) {
    console.error('Transcription error details:', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
      cause: error?.cause,
    });
    throw new Error(`Failed to transcribe audio: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Rephrase text using Groq's LLM (llama-3.3-70b) with web-enhanced context
 */
export async function rephraseText(
  text: string,
  tone: ToneType = 'professional'
): Promise<RephrasingResult> {
  try {
    if (!GROQ_API_KEY) {
      throw new Error('Groq API key not configured. Please set GROQ_API_KEY in your .env file.');
    }

    // Gather real-world context from web searches
    const webContext = await gatherContext(text);
    const systemPrompt = (tonePrompts[tone] || tonePrompts.professional) + webContext;

    console.log('Rephrasing text with tone:', tone);
    console.log('Web context gathered:', webContext ? 'Yes' : 'No');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const rephrasedText = data.choices?.[0]?.message?.content || text;

    console.log('Rephrasing successful, output length:', rephrasedText.length);

    return {
      originalText: text,
      rephrasedText: rephrasedText.trim(),
      tone,
    };
  } catch (error: any) {
    console.error('Rephrasing error:', error);
    throw new Error(`Failed to rephrase text: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Process audio: transcribe and rephrase in one call
 */
export async function processAudio(
  audioFilePath: string,
  tone: ToneType = 'professional'
): Promise<{
  transcription: TranscriptionResult;
  rephrasing: RephrasingResult;
}> {
  // First transcribe
  const transcription = await transcribeAudio(audioFilePath);

  // Then rephrase
  const rephrasing = await rephraseText(transcription.text, tone);

  return {
    transcription,
    rephrasing,
  };
}
