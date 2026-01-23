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
 * Extract potential search terms (companies, universities, organizations, technologies) from text
 */
function extractSearchTerms(text: string): string[] {
  const lowerText = text.toLowerCase();

  // Known companies, universities, and organizations to look for
  const knownEntities = [
    // Top tech companies
    'google', 'apple', 'microsoft', 'amazon', 'meta', 'facebook', 'netflix', 'tesla', 'openai', 'anthropic',
    'ibm', 'oracle', 'salesforce', 'adobe', 'nvidia', 'intel', 'amd', 'spotify', 'twitter', 'linkedin',
    'uber', 'airbnb', 'stripe', 'shopify', 'slack', 'zoom', 'discord', 'github', 'gitlab', 'dropbox',
    // Crypto/Fintech
    'binance', 'coinbase', 'kraken', 'ftx', 'robinhood', 'paypal', 'square', 'block', 'visa', 'mastercard',
    'revolut', 'wise', 'plaid', 'affirm', 'klarna', 'chime', 'sofi',
    // Startups & other companies
    'palantir', 'snowflake', 'datadog', 'mongodb', 'elastic', 'twilio', 'okta', 'cloudflare', 'figma',
    'notion', 'airtable', 'asana', 'monday', 'atlassian', 'jira', 'confluence', 'vercel', 'netlify',
    'heroku', 'digitalocean', 'linode', 'render', 'supabase', 'firebase', 'auth0',
    // Big consulting/finance
    'mckinsey', 'bain', 'bcg', 'deloitte', 'pwc', 'kpmg', 'ey', 'accenture', 'goldman sachs', 'morgan stanley',
    'jp morgan', 'blackrock', 'citadel', 'two sigma', 'jane street', 'bridgewater',
    // Top universities
    'mit', 'stanford', 'harvard', 'yale', 'princeton', 'columbia', 'berkeley', 'caltech', 'carnegie mellon',
    'cornell', 'upenn', 'penn', 'brown', 'dartmouth', 'duke', 'northwestern', 'uchicago', 'chicago',
    'ucla', 'nyu', 'umich', 'michigan', 'gatech', 'georgia tech', 'ut austin', 'uiuc', 'illinois',
    'purdue', 'waterloo', 'toronto', 'oxford', 'cambridge', 'imperial', 'eth zurich',
    // Research labs
    'deepmind', 'fair', 'google brain', 'microsoft research', 'ibm research', 'bell labs',
  ];

  const terms = new Set<string>();

  // Check for known entities (case-insensitive)
  for (const entity of knownEntities) {
    if (lowerText.includes(entity)) {
      // Capitalize properly for search
      const properName = entity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      terms.add(properName);
    }
  }

  // Also match capitalized words that might be companies/orgs (2+ words together or single proper nouns)
  const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const matches = text.match(capitalizedPattern) || [];
  const skipWords = ['The', 'And', 'For', 'But', 'Not', 'You', 'All', 'Can', 'Had', 'Her', 'Was', 'One', 'Our', 'Out', 'This', 'That', 'They', 'What', 'When', 'Where', 'Why', 'How', 'Who', 'Will', 'Would', 'Could', 'Should', 'Have', 'Been', 'Being', 'Some', 'Any', 'Each', 'Every', 'Both', 'Few', 'More', 'Most', 'Other', 'Such', 'Only', 'Same', 'Than', 'Very', 'Just', 'Also', 'Now', 'Here', 'There', 'Then', 'Well'];

  matches.forEach(match => {
    if (match.length > 2 && !skipWords.includes(match)) {
      terms.add(match);
    }
  });

  return Array.from(terms).slice(0, 8); // Limit to 8 terms for richer context
}

/**
 * Search Wikipedia for information about a term
 */
async function searchWikipedia(term: string): Promise<string | null> {
  try {
    // First try direct page lookup
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`;
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Rabona/1.0' }
    });

    if (response.ok) {
      const data = await response.json() as { extract?: string; description?: string; title?: string };
      if (data.extract) {
        // Return up to 4 sentences for richer context
        const sentences = data.extract.split('. ').slice(0, 4).join('. ');
        return `${data.title || term}: ${sentences}.`;
      }
    }

    // If direct lookup fails, try search API
    const searchApiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&origin=*`;
    const searchResponse = await fetch(searchApiUrl, {
      headers: { 'User-Agent': 'Rabona/1.0' }
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json() as { query?: { search?: { title: string }[] } };
      const firstResult = searchData.query?.search?.[0]?.title;
      if (firstResult) {
        // Fetch the summary for the first search result
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult)}`;
        const summaryResponse = await fetch(summaryUrl, {
          headers: { 'User-Agent': 'Rabona/1.0' }
        });
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json() as { extract?: string; title?: string };
          if (summaryData.extract) {
            const sentences = summaryData.extract.split('. ').slice(0, 4).join('. ');
            return `${summaryData.title || term}: ${sentences}.`;
          }
        }
      }
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

  console.log('Found context for:', validResults.length, 'terms');

  return `

=== RESEARCHED INFORMATION ===
Use this real-world data to ENHANCE the text. Weave in specific, relevant facts that strengthen the writing.
DO NOT mention "according to research" or cite sources - just naturally incorporate the information.

${validResults.join('\n\n')}

=== END RESEARCHED INFORMATION ===`;
}

const tonePrompts: Record<ToneType, string> = {
  professional: `You are an expert writer who creates impressive, well-researched content. Transform this spoken text into polished, compelling prose.

    ABSOLUTE RULES:
    - Output ONLY the rewritten text, nothing else
    - NO explanations, notes, commentary, or meta-text
    - Remove filler words (um, uh, like, you know, basically, so, actually)

    CRITICAL: INCORPORATE RESEARCHED INFORMATION
    If real-world information is provided about companies, universities, or organizations mentioned:
    - WEAVE IN specific facts, details, and context that strengthen the writing
    - Show knowledge about the company's mission, products, culture, recent news, or values
    - For universities: mention specific programs, research areas, clubs, or unique aspects
    - Make it sound like the person has done their research and genuinely knows about the organization
    - DO NOT say "I researched" or cite sources - just naturally include the knowledge

    CONTEXT-AWARE ENHANCEMENT:

    FOR JOB APPLICATIONS / CAREER CONTENT:
    - Sound confident, articulate, and genuinely impressive
    - If applying to a specific company, show you understand what they do and why you're a fit
    - Reference specific company initiatives, products, or values when relevant
    - Highlight achievements with specific impact where possible
    - If they mention projects, elaborate on technical skills, languages, frameworks used
    - Make it sound like someone who's done their homework and would be great to hire

    FOR UNIVERSITY APPLICATIONS / ACADEMIC CONTENT:
    - If applying to a specific school, show genuine knowledge about it
    - Mention specific programs, professors, research areas, clubs, or campus culture
    - Connect personal interests/goals to what the school offers
    - Sound intellectually curious and well-informed
    - Show why this specific school is the right fit, not just any school

    FOR PROJECT DESCRIPTIONS / TECHNICAL WORK:
    - Clearly explain what was built and why it matters
    - Infer and mention relevant technologies, languages, frameworks
    - Highlight problem-solving and technical decisions
    - Quantify impact if possible (performance improvements, user growth, etc.)

    FOR IDEAS / BRAINSTORMING:
    - Organize thoughts clearly and logically
    - Expand on promising concepts with relevant real-world context
    - Add structure without losing creativity

    FOR EVERYTHING ELSE:
    - Match the tone to the subject matter
    - Always improve clarity and flow
    - Add relevant context that enhances understanding`,

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
