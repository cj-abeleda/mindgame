import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const NOTES_PROMPT = `You write Angus's private session notes. Angus is a Certified Mental Performance Consultant working with a recreational athlete in MindGame, a sports psychology app. Read the session transcript and fill in each field from what was actually said. Use an empty string for anything the session has not reached yet. Never invent details.

- pattern: the mental pattern Angus named, in a few words (empty if he has not named one yet).
- summary: 2-3 sentences on what the athlete brought, what was explored, and where it landed.
- mentalModel: the named mental model Angus gave the athlete, with a one-line description (empty if none yet).
- cue: the short cue or decision rule the athlete will use in games (empty if none yet).
- returnPrompt: the one question Angus should open with next session to follow up, phrased as Angus would ask it.`;

const NOTES_SCHEMA = {
  type: "object",
  properties: {
    pattern: { type: "string" },
    summary: { type: "string" },
    mentalModel: { type: "string" },
    cue: { type: "string" },
    returnPrompt: { type: "string" },
  },
  required: ["pattern", "summary", "mentalModel", "cue", "returnPrompt"],
  additionalProperties: false,
} as const;

const MAX_TRANSCRIPT_MESSAGES = 200;
const MAX_MESSAGE_CHARS = 8000;

function toTranscript(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const lines: string[] = [];
  for (const m of raw.slice(-MAX_TRANSCRIPT_MESSAGES)) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return null;
    }
    const speaker = m.role === "assistant" ? "Angus" : "Athlete";
    lines.push(`${speaker}: ${m.content.slice(0, MAX_MESSAGE_CHARS)}`);
  }
  // Only worth summarizing once the athlete has said something.
  return raw.some((m) => m.role === "user") ? lines.join("\n\n") : null;
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    const transcript = toTranscript(messages);
    if (!transcript) {
      return Response.json({ error: "Nothing to summarize" }, { status: 400 });
    }

    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: {
        effort: "low",
        format: jsonSchemaOutputFormat(NOTES_SCHEMA),
      },
      system: NOTES_PROMPT,
      messages: [
        {
          role: "user",
          content: `<transcript>\n${transcript}\n</transcript>\n\nWrite the session notes.`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "No notes produced" }, { status: 502 });
    }

    return Response.json({ notes: response.parsed_output });
  } catch (error) {
    console.error("Error summarizing session:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
