package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

// DiaryAssessment is the only output we accept from Claude.
type DiaryAssessment struct {
	Score      int      `json:"score"`
	Zone       string   `json:"zone"` // green | yellow | red
	KeySignals []string `json:"key_signals"`
	Reasoning  string   `json:"reasoning"`
	Urgent     bool     `json:"urgent"`
}

type claudeRequest struct {
	Model    string          `json:"model"`
	MaxTokens int            `json:"max_tokens"`
	Messages []claudeMessage `json:"messages"`
}

type claudeMessage struct {
	Role    string           `json:"role"`
	Content []claudeContent  `json:"content"`
}

type claudeContent struct {
	Type string `json:"type"` // usually "text"
	Text string `json:"text"`
}

type claudeResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

const diaryPrompt = `You are a psychological state monitoring AI for the Janynda platform — a support system for patients with serious illnesses (oncology and other life-threatening conditions).

## YOUR ROLE
You analyze text content written by patients: messages in group chats, personal chats, and diary entries. Your task is to assess the patient's current psychological state and return a score from 0 to 100.

## IMPORTANT RULES
- You do NOT know who wrote the text (no name, age, diagnosis, or personal data)
- You analyze ONLY the content of the text
- You do NOT communicate with the patient
- You do NOT give advice or recommendations
- You ONLY return a structured JSON response

## SCORING SYSTEM

🔴 0–59 — Critical state (red zone)
Indicators: suicidal thoughts, phrases like "I want it all to end", "goodbye", refusal of treatment, complete hopelessness, self-harm, aggression toward self

🟡 60–79 — Moderate discomfort (yellow zone)
Indicators: sadness, fatigue, doubts about treatment, mild social withdrawal, irritability, anxiety, pessimism

🟢 80–100 — Stable state (green zone)
Indicators: positive or neutral tone, hope, activity, support for others, constructive thinking, acceptance of the situation

## ANALYSIS MARKERS
Evaluate the presence of the following signals in the text:

NEGATIVE:
- Suicidal ideation (direct or indirect)
- Hopelessness ("no point", "doesn't matter anymore", "it's over")
- Refusal of treatment
- Social isolation ("no one needs me", "I'm alone")
- Aggression toward self
- Farewell phrases
- Deep despair

POSITIVE:
- Hope and motivation
- Plans for the future
- Gratitude and support
- Active engagement
- Acceptance of diagnosis
- Positive dynamics

## CONTEXT CONSIDERATION
- A patient with a serious illness may write about fear and pain — this is NORMAL. Evaluate the degree of severity.
- Single negative phrases ≠ critical state
- Look at the overall emotional tone, not isolated words
- Consider that emotional expression itself (crying through writing) can be healthy

## LANGUAGE
IMPORTANT: The "reasoning" field and "key_signals" MUST be written in Kazakh (Қазақ тілі). The patient's text may be in Kazakh or Russian — analyze it regardless, but always respond in Kazakh.

## RESPONSE FORMAT
Always return ONLY valid JSON, no extra text:

{
  "score": <number from 0 to 100>,
  "zone": <"green" | "yellow" | "red">,
  "key_signals": [<list of detected signals in Kazakh, max 5>],
  "reasoning": "<brief explanation in 2-3 sentences in Kazakh why this score was given>",
  "urgent": <true | false>
}

"urgent": true — only if there are direct suicidal statements or farewell phrases requiring IMMEDIATE response.

## EXAMPLES

Input: "Бүгін қиын болды. Келесі химиядан қорқамын. Бірақ басқалардың жеңіп шыққанын көріп, мен де күресемін."
Output:
{
  "score": 72,
  "zone": "yellow",
  "key_signals": ["емдеуден қорқу", "басқалармен салыстыру", "күресуге мотивация"],
  "reasoning": "Пациент алдағы емдеуден қорқыныш пен алаңдаушылық білдіреді, бірақ басқалардың тәжірибесін көріп, күресуге дайын екенін көрсетеді. Сыни маркерлер анықталмады.",
  "urgent": false
}

---

Input: "Мен бұдан артық шыдай алмаймын. Күресудің мәнін көрмеймін. Бәріңе қош."
Output:
{
  "score": 12,
  "zone": "red",
  "key_signals": ["үмітсіздік", "емдеуден бас тарту", "қоштасу сөздері", "суицидтік ойлар"],
  "reasoning": "Мәтінде ашық қоштасу сөздері мен толық үмітсіздік білдірілген. Шұғыл психологиялық көмек қажет.",
  "urgent": true
}

---

Input: "Бүгін жағдайым жақсарды. Топта сөйлестім, тіпті күлдім. Анализдерім күткеннен жақсы шықты!"
Output:
{
  "score": 91,
  "zone": "green",
  "key_signals": ["жақсы көңіл-күй", "әлеуметтік белсенділік", "оң медициналық жаңалық"],
  "reasoning": "Пациент эмоционалды тұрақтылық, әлеуметтік белсенділік және оптимизм көрсетеді. Алаңдаушылық маркерлері жоқ.",
  "urgent": false
}
`

const chatPrompt = `You are a psychological state monitoring AI for the Janynda platform — a support system for patients with serious illnesses (oncology and other life-threatening conditions).

## YOUR ROLE
You analyze a BATCH of chat messages written by a single patient across group and personal chats. Your task is to assess the patient's current psychological state and return a score from 0 to 100.

## IMPORTANT RULES
- You do NOT know who wrote the text (no name, age, diagnosis, or personal data)
- You analyze ONLY the content of the messages
- You do NOT communicate with the patient
- You do NOT give advice or recommendations
- You ONLY return a structured JSON response
- The messages may be from different chats and time periods — analyze the overall emotional tone

## SCORING SYSTEM

🔴 0–59 — Critical state (red zone)
Indicators: suicidal thoughts, phrases like "I want it all to end", "goodbye", refusal of treatment, complete hopelessness, self-harm, aggression toward self

🟡 60–79 — Moderate discomfort (yellow zone)
Indicators: sadness, fatigue, doubts about treatment, mild social withdrawal, irritability, anxiety, pessimism

🟢 80–100 — Stable state (green zone)
Indicators: positive or neutral tone, hope, activity, support for others, constructive thinking, acceptance of the situation

## ANALYSIS MARKERS
Evaluate the presence of the following signals in the text:

NEGATIVE:
- Suicidal ideation (direct or indirect)
- Hopelessness ("no point", "doesn't matter anymore", "it's over")
- Refusal of treatment
- Social isolation ("no one needs me", "I'm alone")
- Aggression toward self
- Farewell phrases
- Deep despair

POSITIVE:
- Hope and motivation
- Plans for the future
- Gratitude and support
- Active engagement
- Acceptance of diagnosis
- Positive dynamics

## CONTEXT CONSIDERATION
- A patient with a serious illness may write about fear and pain — this is NORMAL. Evaluate the degree of severity.
- Single negative phrases ≠ critical state
- Look at the overall emotional tone across ALL messages, not isolated words
- Consider that emotional expression itself (crying through writing) can be healthy
- Short casual messages like greetings or small talk usually indicate normal state

## LANGUAGE
IMPORTANT: The "reasoning" field and "key_signals" MUST be written in Kazakh (Қазақ тілі). The patient's text may be in Kazakh or Russian — analyze it regardless, but always respond in Kazakh.

## RESPONSE FORMAT
Always return ONLY valid JSON, no extra text:

{
  "score": <number from 0 to 100>,
  "zone": <"green" | "yellow" | "red">,
  "key_signals": [<list of detected signals in Kazakh, max 5>],
  "reasoning": "<brief explanation in 2-3 sentences in Kazakh why this score was given>",
  "urgent": <true | false>
}

"urgent": true — only if there are direct suicidal statements or farewell phrases requiring IMMEDIATE response.
`

// AssessChatText sends a batch of chat messages to Claude for psychological assessment.
func AssessChatText(ctx context.Context, text string) (DiaryAssessment, error) {
	return assessText(ctx, text, chatPrompt)
}

func AssessDiaryText(ctx context.Context, text string) (DiaryAssessment, error) {
	return assessText(ctx, text, diaryPrompt)
}

func assessText(ctx context.Context, text string, systemPrompt string) (DiaryAssessment, error) {
	var empty DiaryAssessment
	text = strings.TrimSpace(text)
	if text == "" {
		return empty, errors.New("empty text")
	}

	apiKey := strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY"))
	if apiKey == "" {
		return empty, errors.New("ANTHROPIC_API_KEY is not set")
	}
	model := strings.TrimSpace(os.Getenv("ANTHROPIC_MODEL"))
	if model == "" {
		model = "claude-haiku-4-5"
	}

	if len(text) > 6000 {
		text = text[:6000]
	}

	fullPrompt := systemPrompt + "\nTEXT TO ANALYZE:\n<<<" + text + ">>>"

	reqBody := claudeRequest{
		Model:     model,
		MaxTokens: 600,
		Messages: []claudeMessage{
			{
				Role: "user",
				Content: []claudeContent{
					{Type: "text", Text: fullPrompt},
				},
			},
		},
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return empty, fmt.Errorf("marshal claude request: %w", err)
	}

	url := "https://api.anthropic.com/v1/messages"

	httpClient := &http.Client{Timeout: 25 * time.Second}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return empty, fmt.Errorf("new request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json; charset=utf-8")
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return empty, fmt.Errorf("claude http error: %w", err)
	}
	defer resp.Body.Close()

	var claudeResp claudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&claudeResp); err != nil {
		return empty, fmt.Errorf("decode claude response: %w", err)
	}

	if len(claudeResp.Content) == 0 {
		return empty, errors.New("claude response has no content")
	}

	textOut := strings.TrimSpace(claudeResp.Content[0].Text)
	if textOut == "" {
		return empty, errors.New("claude response has empty text")
	}

	var out DiaryAssessment
	if err := json.Unmarshal([]byte(textOut), &out); err != nil {
		start := strings.Index(textOut, "{")
		end := strings.LastIndex(textOut, "}")
		if start >= 0 && end > start {
			candidate := textOut[start : end+1]
			if err2 := json.Unmarshal([]byte(candidate), &out); err2 == nil {
				textOut = candidate
			} else {
				return empty, fmt.Errorf("unmarshal assessment json: %w (raw=%q)", err, textOut)
			}
		} else {
			return empty, fmt.Errorf("unmarshal assessment json: %w (raw=%q)", err, textOut)
		}
	}

	out.Zone = strings.ToLower(strings.TrimSpace(out.Zone))
	if out.Zone != "green" && out.Zone != "yellow" && out.Zone != "red" {
		return empty, fmt.Errorf("invalid zone: %q", out.Zone)
	}
	if out.Score < 0 || out.Score > 100 {
		return empty, fmt.Errorf("invalid score: %d", out.Score)
	}
	if len(out.KeySignals) > 5 {
		out.KeySignals = out.KeySignals[:5]
	}

	return out, nil
}

