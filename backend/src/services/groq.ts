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
  professional: `You are a writing polish tool. Your job is to clean up and refine spoken text into written form WITHOUT significantly changing the length or adding new ideas.

    CRITICAL RULES:
    - Output ONLY the polished text, nothing else
    - NO explanations, notes, commentary, or meta-text
    - KEEP THE SAME LENGTH - if they said 2 sentences, output ~2 sentences
    - PRESERVE THEIR IDEAS - don't add new points they didn't mention
    - Remove filler words (um, uh, like, you know, basically, so, actually)
    - Fix grammar and improve word choice
    - Make it flow better as written text

    WHAT TO DO:
    - Clean up rambling into clear, concise sentences
    - Improve word choice (use more precise/professional words)
    - Fix grammar, punctuation, and sentence structure
    - Remove repetition and redundancy
    - Make it read smoothly

    WHAT NOT TO DO:
    - DON'T add new ideas, examples, or points
    - DON'T expand 2 sentences into a paragraph
    - DON'T add introductions or conclusions they didn't include
    - DON'T add technical details they didn't mention
    - DON'T make it longer than the original

    LENGTH GUIDE:
    - Short input (1-3 sentences) → Short output (1-3 sentences)
    - Medium input (paragraph) → Medium output (paragraph)
    - Long input (multiple paragraphs) → Similar length output

    Your goal: Same ideas, better words, similar length.`,

  casual: `You are a writing polish tool. Clean up spoken text into readable form while keeping it casual and conversational.

    RULES:
    - Output ONLY the polished text, nothing else
    - NO meta-commentary or explanations
    - Remove filler words but keep personality
    - KEEP THE SAME LENGTH - don't expand short inputs

    YOUR JOB:
    - Clean up the text so it reads well
    - Keep it casual and natural
    - Fix obvious grammar issues
    - Remove "um", "uh", "like", "you know"
    - Make it sound like a well-spoken person, not a robot

    DON'T:
    - Add new ideas they didn't mention
    - Make it significantly longer
    - Make it too formal or stiff`,

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
  detectedIntent?: ContentIntent;
  suggestions?: Suggestion[];
}

export type ContentIntent =
  | 'job_application'
  | 'college_essay'
  | 'scholarship_application'
  | 'competition_entry'
  | 'club_application'
  | 'cover_letter'
  | 'personal_statement'
  | 'project_description'
  | 'email_draft'
  | 'meeting_notes'
  | 'general';

export interface Suggestion {
  type: 'improvement' | 'addition' | 'structure' | 'tip';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Detect the intent/type of content the user is creating
 */
function detectContentIntent(text: string): ContentIntent {
  const lowerText = text.toLowerCase();

  // Job-related keywords
  const jobKeywords = ['job', 'position', 'role', 'hiring', 'interview', 'resume', 'cv', 'employer', 'work experience', 'career', 'company culture', 'team', 'salary', 'benefits'];
  const coverLetterKeywords = ['cover letter', 'dear hiring', 'dear recruiter', 'i am writing to apply', 'i am interested in the position'];

  // Education-related keywords
  const collegeKeywords = ['college', 'university', 'admission', 'campus', 'major', 'degree', 'undergraduate', 'graduate', 'freshman', 'sophomore', 'junior', 'senior', 'gpa', 'extracurricular'];
  const essayKeywords = ['essay', 'personal statement', 'why this school', 'common app', 'supplemental', 'prompt', 'word limit', 'character limit'];
  const scholarshipKeywords = ['scholarship', 'financial aid', 'merit', 'award', 'grant', 'funding', 'tuition'];

  // Competition/application keywords
  const competitionKeywords = ['competition', 'contest', 'hackathon', 'challenge', 'submission', 'pitch', 'presentation', 'judges', 'prize', 'winner'];
  const clubKeywords = ['club', 'organization', 'society', 'leadership', 'member', 'e-board', 'executive board', 'president', 'vice president', 'treasurer', 'secretary', 'committee'];

  // Project keywords
  const projectKeywords = ['project', 'built', 'developed', 'created', 'implemented', 'designed', 'app', 'application', 'website', 'software', 'system', 'feature', 'functionality'];

  // Check for cover letter first (most specific)
  if (coverLetterKeywords.some(kw => lowerText.includes(kw))) {
    return 'cover_letter';
  }

  // Check for scholarship
  if (scholarshipKeywords.some(kw => lowerText.includes(kw))) {
    return 'scholarship_application';
  }

  // Check for college essay/personal statement
  if (essayKeywords.some(kw => lowerText.includes(kw)) ||
      (collegeKeywords.filter(kw => lowerText.includes(kw)).length >= 2)) {
    return 'college_essay';
  }

  // Check for competition
  if (competitionKeywords.some(kw => lowerText.includes(kw))) {
    return 'competition_entry';
  }

  // Check for club application
  if (clubKeywords.filter(kw => lowerText.includes(kw)).length >= 2) {
    return 'club_application';
  }

  // Check for job application
  if (jobKeywords.filter(kw => lowerText.includes(kw)).length >= 2) {
    return 'job_application';
  }

  // Check for project description
  if (projectKeywords.filter(kw => lowerText.includes(kw)).length >= 2) {
    return 'project_description';
  }

  // Check for email
  if (lowerText.includes('email') || lowerText.includes('dear') || lowerText.includes('sincerely') || lowerText.includes('best regards')) {
    return 'email_draft';
  }

  // Check for meeting notes
  if (lowerText.includes('meeting') || lowerText.includes('agenda') || lowerText.includes('action items') || lowerText.includes('discussed')) {
    return 'meeting_notes';
  }

  return 'general';
}

/**
 * Generate contextual suggestions based on detected intent and content
 */
async function generateSuggestions(text: string, intent: ContentIntent): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  const lowerText = text.toLowerCase();
  const wordCount = text.split(/\s+/).length;

  // Universal suggestions
  if (wordCount < 50) {
    suggestions.push({
      type: 'addition',
      title: 'Add more detail',
      description: 'Your content is quite brief. Consider expanding with specific examples or context.',
      priority: 'medium'
    });
  }

  // Intent-specific suggestions
  switch (intent) {
    case 'job_application':
    case 'cover_letter':
      // Check if they mention a project but don't specify technologies
      const mentionsProject = lowerText.includes('built') || lowerText.includes('created') || lowerText.includes('developed') || lowerText.includes('app') || lowerText.includes('project') || lowerText.includes('website');
      const mentionsTech = lowerText.includes('react') || lowerText.includes('python') || lowerText.includes('javascript') || lowerText.includes('node') || lowerText.includes('typescript') || lowerText.includes('java') || lowerText.includes('sql');

      if (mentionsProject && !mentionsTech) {
        suggestions.push({
          type: 'improvement',
          title: 'Add specific technologies',
          description: 'Mention the languages, frameworks, and tools you used (e.g., "React, Node.js, PostgreSQL"). The AI has added likely technologies - review and adjust to match what you actually used.',
          priority: 'high'
        });
      }
      if (!lowerText.includes('achieve') && !lowerText.includes('accomplish') && !lowerText.includes('result') && !lowerText.includes('impact')) {
        suggestions.push({
          type: 'improvement',
          title: 'Quantify your achievements',
          description: 'Add specific numbers or metrics to demonstrate impact (e.g., "increased sales by 25%", "managed team of 5").',
          priority: 'high'
        });
      }
      if (!lowerText.includes('skill') && !lowerText.includes('experience') && !lowerText.includes('proficient')) {
        suggestions.push({
          type: 'addition',
          title: 'Highlight relevant skills',
          description: 'Mention specific technical or soft skills that match the job requirements.',
          priority: 'high'
        });
      }
      if (!lowerText.includes('why') && !lowerText.includes('passion') && !lowerText.includes('excited') && !lowerText.includes('interested')) {
        suggestions.push({
          type: 'addition',
          title: 'Show genuine interest',
          description: 'Explain why you\'re specifically interested in this company or role, not just any job.',
          priority: 'medium'
        });
      }
      break;

    case 'college_essay':
    case 'personal_statement':
      if (!lowerText.includes('learn') && !lowerText.includes('grow') && !lowerText.includes('change') && !lowerText.includes('realize')) {
        suggestions.push({
          type: 'improvement',
          title: 'Show personal growth',
          description: 'Colleges want to see how experiences changed you. Reflect on what you learned or how you grew.',
          priority: 'high'
        });
      }
      if (!lowerText.includes('specific') && !lowerText.match(/\d{4}/) && !lowerText.match(/when i was/)) {
        suggestions.push({
          type: 'structure',
          title: 'Add a specific story',
          description: 'Start with a vivid, specific moment or anecdote. Show, don\'t just tell.',
          priority: 'high'
        });
      }
      if (!lowerText.includes('future') && !lowerText.includes('goal') && !lowerText.includes('plan') && !lowerText.includes('aspire')) {
        suggestions.push({
          type: 'addition',
          title: 'Connect to future goals',
          description: 'Briefly mention how this experience or interest connects to what you want to do next.',
          priority: 'medium'
        });
      }
      break;

    case 'scholarship_application':
      if (!lowerText.includes('financial') && !lowerText.includes('support') && !lowerText.includes('help') && !lowerText.includes('enable')) {
        suggestions.push({
          type: 'addition',
          title: 'Explain the impact',
          description: 'Describe how this scholarship would help you achieve your goals or overcome challenges.',
          priority: 'high'
        });
      }
      if (!lowerText.includes('community') && !lowerText.includes('give back') && !lowerText.includes('contribute')) {
        suggestions.push({
          type: 'addition',
          title: 'Mention giving back',
          description: 'Scholarships often favor applicants who plan to contribute to their community or field.',
          priority: 'medium'
        });
      }
      break;

    case 'competition_entry':
      if (!lowerText.includes('unique') && !lowerText.includes('different') && !lowerText.includes('innovative') && !lowerText.includes('novel')) {
        suggestions.push({
          type: 'improvement',
          title: 'Highlight what\'s unique',
          description: 'Clearly state what makes your entry different from others. What\'s your unique angle?',
          priority: 'high'
        });
      }
      if (!lowerText.includes('problem') && !lowerText.includes('solve') && !lowerText.includes('address') && !lowerText.includes('challenge')) {
        suggestions.push({
          type: 'structure',
          title: 'Define the problem',
          description: 'Start by clearly stating the problem you\'re solving. Make judges understand the "why".',
          priority: 'high'
        });
      }
      break;

    case 'club_application':
      if (!lowerText.includes('contribute') && !lowerText.includes('bring') && !lowerText.includes('offer') && !lowerText.includes('add')) {
        suggestions.push({
          type: 'addition',
          title: 'State your contribution',
          description: 'Be specific about what you\'ll bring to the club - skills, ideas, or connections.',
          priority: 'high'
        });
      }
      if (!lowerText.includes('commit') && !lowerText.includes('dedicate') && !lowerText.includes('time') && !lowerText.includes('available')) {
        suggestions.push({
          type: 'addition',
          title: 'Show commitment',
          description: 'Mention your availability and commitment level. Clubs want reliable members.',
          priority: 'medium'
        });
      }
      break;

    case 'project_description':
      const projectMentionsTech = lowerText.includes('react') || lowerText.includes('python') || lowerText.includes('javascript') || lowerText.includes('node') || lowerText.includes('typescript') || lowerText.includes('java') || lowerText.includes('sql') || lowerText.includes('swift') || lowerText.includes('kotlin');

      if (!projectMentionsTech) {
        suggestions.push({
          type: 'tip',
          title: 'Review inferred technologies',
          description: 'The AI has added likely technologies based on your project description. Review and adjust to match what you actually used.',
          priority: 'high'
        });
      }
      if (!lowerText.includes('user') && !lowerText.includes('people') && !lowerText.includes('customer') && !lowerText.includes('audience')) {
        suggestions.push({
          type: 'addition',
          title: 'Identify target users',
          description: 'Who is this project for? Describing your target audience adds context.',
          priority: 'medium'
        });
      }
      if (!lowerText.includes('challenge') && !lowerText.includes('difficult') && !lowerText.includes('obstacle') && !lowerText.includes('problem')) {
        suggestions.push({
          type: 'tip',
          title: 'Mention challenges overcome',
          description: 'Briefly describe a challenge you faced and how you solved it. This shows problem-solving skills.',
          priority: 'low'
        });
      }
      break;

    case 'email_draft':
      if (!lowerText.includes('appreciate') && !lowerText.includes('thank') && !lowerText.includes('grateful')) {
        suggestions.push({
          type: 'tip',
          title: 'Add appreciation',
          description: 'A brief thank you or acknowledgment creates a warmer tone.',
          priority: 'low'
        });
      }
      if (!lowerText.includes('next step') && !lowerText.includes('please') && !lowerText.includes('let me know') && !lowerText.includes('could you')) {
        suggestions.push({
          type: 'structure',
          title: 'Include a clear ask',
          description: 'End with a specific call-to-action or next step.',
          priority: 'medium'
        });
      }
      break;

    default:
      // General suggestions
      if (!lowerText.includes('example') && !lowerText.includes('for instance') && !lowerText.includes('such as')) {
        suggestions.push({
          type: 'tip',
          title: 'Add examples',
          description: 'Specific examples make your points more concrete and memorable.',
          priority: 'low'
        });
      }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Return top 3 suggestions
  return suggestions.slice(0, 3);
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

    // Detect what the user is trying to create
    const detectedIntent = detectContentIntent(text);
    console.log('Detected content intent:', detectedIntent);

    // Add intent-specific guidance to the prompt (skip web context to avoid expansion)
    const intentGuidance = getIntentGuidance(detectedIntent);
    const systemPrompt = (tonePrompts[tone] || tonePrompts.professional) + intentGuidance;

    console.log('Rephrasing text with tone:', tone);

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
        temperature: 0.5,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const rephrasedText = data.choices?.[0]?.message?.content || text;

    // Generate contextual suggestions
    const suggestions = await generateSuggestions(text, detectedIntent);

    console.log('Rephrasing successful, output length:', rephrasedText.length);
    console.log('Generated suggestions:', suggestions.length);

    return {
      originalText: text,
      rephrasedText: rephrasedText.trim(),
      tone,
      detectedIntent,
      suggestions,
    };
  } catch (error: any) {
    console.error('Rephrasing error:', error);
    throw new Error(`Failed to rephrase text: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Get additional prompt guidance based on detected intent
 */
function getIntentGuidance(intent: ContentIntent): string {
  const guidanceMap: Record<ContentIntent, string> = {
    job_application: `
    DETECTED: JOB/CAREER CONTENT
    Polish for professional context. Use stronger action verbs. Keep their length.`,

    cover_letter: `
    DETECTED: COVER LETTER
    Polish for formal business communication. Keep their points, just make them clearer.`,

    college_essay: `
    DETECTED: COLLEGE ESSAY
    Keep their voice and story. Just clean up the language. Don't add new ideas.`,

    personal_statement: `
    DETECTED: PERSONAL STATEMENT
    Preserve their personal voice. Clean up without adding new content.`,

    scholarship_application: `
    DETECTED: SCHOLARSHIP APPLICATION
    Polish professionally. Keep their points and length.`,

    competition_entry: `
    DETECTED: COMPETITION ENTRY
    Keep it punchy and clear. Don't add new features or ideas they didn't mention.`,

    club_application: `
    DETECTED: CLUB APPLICATION
    Keep it genuine and concise. Polish without expanding.`,

    project_description: `
    DETECTED: PROJECT DESCRIPTION
    Clean up the technical description. Keep their tech stack if mentioned, don't add new technologies they didn't say.`,

    email_draft: `
    DETECTED: EMAIL
    Keep it brief and professional. Don't add extra pleasantries.`,

    meeting_notes: `
    DETECTED: MEETING NOTES
    Use clear bullet points. Keep it scannable and brief.`,

    general: ''
  };

  return guidanceMap[intent] || '';
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
