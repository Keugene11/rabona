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

  // Check for specific program/department mentions to create targeted searches
  const programKeywords = ['math', 'mathematics', 'computer science', 'engineering', 'physics', 'chemistry', 'biology', 'economics', 'business', 'law', 'medicine', 'research', 'program', 'department'];
  const foundProgram = programKeywords.find(kw => lowerText.includes(kw));

  // If a program is mentioned along with an entity, create a combined search term
  if (foundProgram) {
    const termsArray = Array.from(terms);
    termsArray.forEach(entity => {
      // Add combined search like "Princeton mathematics department"
      terms.add(`${entity} ${foundProgram}`);
    });
  }

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
 * Extract only sentences containing specific proper nouns (product names, team names, etc.)
 * Returns null if no specific facts found
 */
function extractSpecificFacts(text: string): string | null {
  // Look for sentences containing specific proper nouns (capitalized multi-word names or known products)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

  // Patterns that indicate specific named things (not generic descriptions)
  const specificPatterns = [
    // Product/service names (usually capitalized words together or with numbers)
    /\b(AWS|EC2|S3|Lambda|Azure|GCP|iOS|Android|Chrome|Gmail|YouTube|Maps|Drive|Alexa|Siri|Cortana)\b/i,
    // Named programs/initiatives with proper nouns
    /\b(STEP|BOLD|APM|LDP|Foundry|Gotham|Apollo|Metropolis)\b/,
    // Specific competitions/events
    /\b(Putnam|IMO|ICPC|ACM|IEEE|SIGGRAPH|NeurIPS|ICML)\b/i,
    // Specific numbers with context
    /\b(ranked?\s*#?\d+|top\s*\d+|\d+%|\$[\d.]+\s*(billion|million|B|M))\b/i,
    // Named labs/research groups (capitalized acronyms or multi-word names)
    /\b([A-Z]{2,}(?:\s+Lab|\s+Research|\s+Institute)?)\b/,
    // Specific course numbers
    /\b(CS\s*\d{3}|Math\s*\d{3}|[A-Z]{2,4}\s*\d{3,4})\b/,
  ];

  const specificSentences: string[] = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    // Check if this sentence has specific named facts
    const hasSpecific = specificPatterns.some(pattern => pattern.test(trimmed));
    if (hasSpecific) {
      specificSentences.push(trimmed);
    }
  }

  if (specificSentences.length === 0) {
    return null;
  }

  return specificSentences.slice(0, 3).join('. ') + '.';
}

/**
 * Gather contextual information from web searches
 * Only returns context if it contains specific proper nouns
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

  // Extract only specific facts from the results
  const allText = validResults.join(' ');
  const specificFacts = extractSpecificFacts(allText);

  if (!specificFacts) {
    console.log('No specific facts found in context - will just clean up text');
    return '';
  }

  console.log('Found specific facts:', specificFacts.substring(0, 100) + '...');

  return `

=== SPECIFIC FACTS (use these exact names/numbers) ===
${specificFacts}
=== END FACTS ===

RULE: Only use the EXACT names and numbers above. If none are relevant to what the user said, just clean up their text without adding anything.`;
}

const tonePrompts: Record<ToneType, string> = {
  professional: `You are a writing editor. Clean up voice notes into polished text.

    DEFAULT BEHAVIOR: Just clean up the text.
    - Remove filler words (um, uh, like, you know, basically)
    - Fix grammar and awkward phrasing
    - Make it sound polished but keep their meaning
    - DO NOT add information they didn't say

    ONLY ADD CONTEXT IF: You have SPECIFIC FACTS provided below (product names, team names, rankings with numbers).
    If no specific facts are provided, or the facts aren't relevant, just clean up their text.

    NEVER USE THESE VAGUE WORDS:
    - "exceptional", "excellent", "outstanding", "remarkable", "prestigious"
    - "wide range of", "variety of", "numerous", "opportunities"
    - "world-class", "top-tier", "renowned", "leading"
    - "innovative", "cutting-edge" (unless naming WHAT specifically)
    - "reputation", "culture", "environment"

    These words are EMPTY. They add nothing.

    EXAMPLES:
    Input: "I want to work at Amazon because they're a good company"
    Without specific facts → "I want to work at Amazon."
    With fact "AWS powers 33% of cloud" → "I want to work at Amazon, particularly on AWS which powers 33% of cloud infrastructure."

    Input: "I want to apply to Cornell because of the quant stuff"
    Without specific facts → "I want to apply to Cornell for its quantitative programs."
    With fact "ranked #6 in applied math" → "I want to apply to Cornell, which is ranked #6 in applied mathematics."

    RULE: When in doubt, keep it simple. A clean, short output is better than a vague, fluffy one.

    Output ONLY the enhanced text.`,

  casual: `You are a skilled writer helping transform spoken thoughts into well-written casual content.

    YOUR JOB:
    - Clean up the text while keeping it warm and conversational
    - Add helpful context and details that make the writing more engaging
    - Keep personality and voice, but make it read smoothly
    - Output ONLY the enhanced text

    DO:
    - Remove filler words but keep natural speech patterns
    - Add interesting details or context where it strengthens the message
    - Make it sound like an articulate, thoughtful person
    - Keep it relatable and genuine

    PRESERVE LENGTH: If they wrote a lot, don't cut it down. Enhance it.`,

  concise: `You are a master editor. Distill this to its essential points with clarity and impact.

    RULES:
    - Output ONLY the condensed text, nothing else
    - Remove ALL unnecessary words
    - Use bullet points for multiple items
    - Every sentence must earn its place
    - Preserve key information and insights
    - Be brief but complete
    - This is the ONLY mode where aggressive shortening is appropriate`,

  email: `You are an expert professional communicator. Transform this into a compelling, effective email that gets results.

    YOUR JOB:
    - Create a polished, professional email
    - Output ONLY the email content
    - Include appropriate greeting and sign-off

    ENHANCEMENTS (IMPORTANT):
    - If they mention a company, ADD specific details about that company that show research
    - If they mention a role, ADD relevant context about what that role typically involves
    - Make their qualifications sound impressive with specific details
    - Add confident, persuasive language
    - Include a clear, compelling call-to-action
    - Structure for easy reading with clear paragraphs

    Make them sound knowledgeable, prepared, and genuinely interested.`,

  meeting_notes: `You are an executive assistant creating clear, actionable meeting notes.

    RULES:
    - Output ONLY the formatted notes
    - Use clear structure with headings
    - Include: Key Points, Decisions, Action Items (as relevant)
    - Use bullet points for easy scanning

    ENHANCEMENTS:
    - Add context that clarifies decisions
    - Ensure action items are specific and assignable
    - Make it useful for someone who wasn't there
    - Include relevant background where helpful`,

  original: `Clean up this text with light editing. Fix errors, remove filler words (um, uh, like, you know), improve flow.

    RULES:
    - Output ONLY the cleaned text
    - NO commentary
    - Preserve their voice and style
    - Minimal changes - just make it read smoothly
    - This mode should change the least`,
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
  const jobKeywords = ['job', 'position', 'role', 'hiring', 'interview', 'resume', 'cv', 'employer', 'work experience', 'career', 'company culture', 'team', 'salary', 'benefits', 'apply', 'applying', 'want to work', 'work at', 'join', 'application'];
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

  // Check for job application - be more sensitive if company names are mentioned
  const hasApplyIntent = ['apply', 'applying', 'want to work', 'work at', 'join'].some(kw => lowerText.includes(kw));
  const mentionsCompany = ['google', 'apple', 'microsoft', 'amazon', 'meta', 'facebook', 'netflix', 'tesla', 'openai', 'anthropic', 'palantir', 'stripe', 'airbnb', 'uber', 'spotify', 'twitter', 'linkedin', 'github', 'snowflake', 'datadog', 'coinbase', 'robinhood', 'mckinsey', 'bain', 'bcg', 'deloitte', 'goldman sachs', 'morgan stanley', 'jp morgan', 'jane street', 'citadel', 'two sigma'].some(company => lowerText.includes(company));

  if (hasApplyIntent && mentionsCompany) {
    return 'job_application';
  }
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
    console.log('=== TRANSCRIPTION DEBUG ===');
    console.log('Transcribing audio file:', audioFilePath);
    console.log('File size:', stats.size, 'bytes');
    console.log('File size (KB):', (stats.size / 1024).toFixed(2), 'KB');

    // Read file as buffer and create a Blob with correct MIME type
    const fileBuffer = fs.readFileSync(audioFilePath);
    const ext = path.extname(audioFilePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.webm': 'audio/webm',
      '.mp3': 'audio/mpeg',
      '.mp4': 'audio/mp4',
      '.m4a': 'audio/m4a',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
    };
    const mimeType = mimeTypes[ext] || 'audio/webm';
    const blob = new Blob([fileBuffer], { type: mimeType });
    console.log('Audio file type:', ext, '-> MIME:', mimeType);

    // Log first few bytes of the file to check header
    const headerBytes = fileBuffer.slice(0, 20);
    console.log('File header (hex):', headerBytes.toString('hex'));
    console.log('File header (ascii):', headerBytes.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));

    // Create FormData
    const formData = new FormData();
    formData.append('file', blob, path.basename(audioFilePath));
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'verbose_json');
    formData.append('language', 'en'); // Force English to prevent misdetection
    formData.append('temperature', '0'); // Use greedy decoding for more accuracy

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

    const data = await response.json() as {
      text: string;
      language?: string;
      duration?: number;
      segments?: Array<{
        id: number;
        start: number;
        end: number;
        text: string;
        no_speech_prob?: number;
        avg_logprob?: number;
      }>;
    };

    console.log('Transcription successful, text length:', data.text?.length || 0);
    console.log('Transcribed text:', data.text);
    console.log('Audio duration:', data.duration, 'seconds');
    console.log('Detected language:', data.language);

    // Log segment details for debugging
    if (data.segments && data.segments.length > 0) {
      console.log('Segments:');
      data.segments.forEach((seg, i) => {
        console.log(`  ${i}: [${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s] "${seg.text}" (no_speech: ${seg.no_speech_prob?.toFixed(3) || 'N/A'})`);
      });
    }

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

    // Check if this is a simple/short input that shouldn't be over-enhanced
    const wordCount = text.split(/\s+/).length;
    const isSimpleInput = wordCount < 10 && detectedIntent === 'general';

    // Check if text mentions any companies/entities that warrant web research
    const searchTerms = extractSearchTerms(text);
    const hasEntities = searchTerms.length > 0;

    // Gather web context when: not a simple greeting AND (has entities OR is substantive content)
    let webContext = '';
    if (!isSimpleInput && (hasEntities || wordCount > 15)) {
      webContext = await gatherContext(text);
      if (webContext) {
        console.log('Added web context for enhancement');
      }
    }

    // Add intent-specific guidance only for substantive content
    const intentGuidance = isSimpleInput ? '' : getIntentGuidance(detectedIntent);
    const systemPrompt = (tonePrompts[tone] || tonePrompts.professional) + intentGuidance + webContext;

    console.log('Rephrasing text with tone:', tone);

    // Calculate appropriate max tokens based on input length
    // Short inputs get fewer tokens to prevent over-expansion
    // Long inputs get more tokens to preserve detail
    const maxTokens = isSimpleInput
      ? Math.min(500, wordCount * 10)  // Short inputs: keep it brief
      : Math.max(2000, Math.min(4000, wordCount * 3));  // Long inputs: allow expansion

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
        max_tokens: maxTokens,
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

    DETECTED: JOB APPLICATION
    Clean up their text. Only add company details if SPECIFIC FACTS are provided above (product names, team names, program names like "STEP internship" or "Foundry platform").
    No specific facts? Just output a clean version of what they said.`,

    cover_letter: `

    DETECTED: COVER LETTER
    Clean up into a professional cover letter. Only add company details if SPECIFIC FACTS are provided above.
    No specific facts? Just make their text sound professional without adding vague corporate language.`,

    college_essay: `

    DETECTED: COLLEGE ESSAY
    Clean up while preserving their voice. Only add school details if SPECIFIC FACTS are provided above (club names, course numbers, competition names like "Putnam" or "TreeHacks").
    No specific facts? Just polish their text without adding vague praise.`,

    personal_statement: `

    DETECTED: PERSONAL STATEMENT
    Elevate their personal narrative:
    - Enhance storytelling with vivid, specific details
    - Strengthen the connection between past experiences and future goals
    - Add context that helps readers understand their unique perspective
    - Make their voice shine while improving clarity and impact`,

    scholarship_application: `

    DETECTED: SCHOLARSHIP APPLICATION
    Make this a winning application:
    - Highlight their achievements with specific context
    - Connect their goals to broader impact
    - Show why they deserve investment
    - Add compelling details about their aspirations and plans`,

    competition_entry: `

    DETECTED: COMPETITION/HACKATHON ENTRY
    Make this stand out to judges:
    - Emphasize innovation and unique approach
    - Add technical credibility with relevant details
    - Highlight problem-solving and impact
    - Make the value proposition crystal clear`,

    club_application: `

    DETECTED: CLUB/ORGANIZATION APPLICATION
    Show they'd be a valuable member:
    - Highlight relevant experience and skills
    - Show genuine interest in the organization's mission
    - Demonstrate what they can contribute
    - Make their enthusiasm authentic and specific`,

    project_description: `

    DETECTED: PROJECT DESCRIPTION
    Make this technically impressive:
    - If they mention building something, add likely technologies and methodologies
    - Highlight technical challenges and solutions
    - Emphasize impact and user value
    - Use industry-standard terminology
    - Make it sound like professional-grade work`,

    email_draft: `

    DETECTED: EMAIL
    Make this effective and professional:
    - If contacting a company, add specific details that show research
    - Clear structure with compelling opening
    - Professional but personable tone
    - Strong, clear call-to-action`,

    meeting_notes: `

    DETECTED: MEETING NOTES
    Structure for clarity and action:
    - Clear headings and bullet points
    - Specific, assignable action items
    - Context for decisions made
    - Easy to scan and reference later`,

    general: `

    GENERAL CONTENT
    Enhance thoughtfully:
    - Add relevant context and details
    - Improve clarity and flow
    - Make it more engaging and professional
    - Preserve their core message while elevating the execution`
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
