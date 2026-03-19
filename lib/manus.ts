type ManusMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ManusResponseShape = {
  choices?: Array<{ message?: { content?: string } }>;
  output_text?: string;
  text?: string;
  result?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

function parseTextResponse(data: ManusResponseShape): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  if (typeof data.text === "string" && data.text.trim()) return data.text.trim();
  if (typeof data.result === "string" && data.result.trim()) return data.result.trim();
  const outputText = data.output?.[0]?.content?.[0]?.text;
  if (typeof outputText === "string" && outputText.trim()) return outputText.trim();
  const choiceContent = data.choices?.[0]?.message?.content;
  if (typeof choiceContent === "string" && choiceContent.trim()) return choiceContent.trim();
  return "";
}

type ManusAttempt = {
  url: string;
  payload: Record<string, unknown>;
};

function normalizeEnvValue(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/^['"]+|['"]+$/g, "").trim();
}

function normalizeBaseUrl(rawUrl: string) {
  return rawUrl.replace(/\/+$/, "");
}

function buildPromptFromMessages(messages: ManusMessage[]) {
  return messages.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`).join("\n\n");
}

function buildAttempts(messages: ManusMessage[], model: string): ManusAttempt[] {
  const envUrl = normalizeEnvValue(process.env.MANUS_API_URL);
  const promptText = buildPromptFromMessages(messages);
  const envAttempts = envUrl
    ? [
        {
          url: envUrl,
          payload: { model, messages, temperature: 0.7 },
        },
        {
          url: envUrl,
          payload: {
            model,
            input: promptText,
            temperature: 0.7,
          },
        },
      ]
    : [];
  const roots = ["https://api.manus.im", "https://api.manus.ai"];
  const rootAttempts = roots.flatMap((root) => {
    const base = normalizeBaseUrl(root);
    return [
      {
        url: `${base}/v1/chat/completions`,
        payload: { model, messages, temperature: 0.7 },
      },
      {
        url: `${base}/chat/completions`,
        payload: { model, messages, temperature: 0.7 },
      },
      {
        url: `${base}/v1/responses`,
        payload: {
          model,
          input: promptText,
          temperature: 0.7,
        },
      },
    ];
  });
  const attempts = [...envAttempts, ...rootAttempts];
  const uniqueAttempts: ManusAttempt[] = [];
  const seen = new Set<string>();
  for (const attempt of attempts) {
    const key = `${attempt.url}::${JSON.stringify(attempt.payload)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueAttempts.push(attempt);
  }
  return uniqueAttempts;
}

type TaskStartResponse = {
  id?: string;
  task_id?: string;
  task_url?: string;
};

type TaskStatusResponse = {
  status?: string;
  state?: string;
  output_text?: string;
  text?: string;
  result?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

function extractTaskId(payload: TaskStartResponse): string | null {
  if (payload.task_id) return payload.task_id;
  if (payload.id) return payload.id;
  if (payload.task_url) {
    const parts = payload.task_url.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  }
  return null;
}

function resolveTaskStatusUrl(created: TaskStartResponse, baseUrl: string, statusTemplate: string, taskId: string) {
  const rawTaskUrl = (created.task_url || "").trim();
  if (rawTaskUrl) {
    try {
      const parsed = new URL(rawTaskUrl);
      // Some Manus responses return a web/app URL in task_url that serves HTML.
      // Prefer API URLs only; otherwise fall back to status template with taskId.
      if (/\/v\d+\/tasks(\/|$)/.test(parsed.pathname)) {
        return parsed.toString();
      }
    } catch {
      if (/\/v\d+\/tasks(\/|$)/.test(rawTaskUrl)) {
        if (rawTaskUrl.startsWith("/")) return `${baseUrl}${rawTaskUrl}`;
        return `${baseUrl}/${rawTaskUrl}`;
      }
    }
  }
  const statusPath = statusTemplate.replace("{id}", taskId);
  return `${baseUrl}${statusPath.startsWith("/") ? statusPath : `/${statusPath}`}`;
}

function mapTaskStatus(status: string | undefined) {
  const value = (status || "").trim().toLowerCase();
  if (["completed", "done", "success", "verified"].includes(value)) return "done";
  if (["failed", "error", "cancelled"].includes(value)) return "failed";
  return "running";
}

async function generateViaTasksApi(messages: ManusMessage[], apiKey: string): Promise<string> {
  const prompt = buildPromptFromMessages(messages);
  const baseUrl = normalizeBaseUrl(normalizeEnvValue(process.env.MANUS_API_BASE_URL) || "https://api.manus.ai");
  const createPath = normalizeEnvValue(process.env.MANUS_CREATE_JOB_PATH) || "/v1/tasks";
  const statusTemplate = normalizeEnvValue(process.env.MANUS_STATUS_PATH_TEMPLATE) || "/v1/tasks/{id}";
  const shouldLog = normalizeEnvValue(process.env.MANUS_LOG_REQUESTS).toLowerCase() === "true";
  const createUrl = `${baseUrl}${createPath.startsWith("/") ? createPath : `/${createPath}`}`;

  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      API_KEY: apiKey,
    },
    body: JSON.stringify({
      prompt,
      agentProfile: "manus-1.6",
    }),
  });

  if (!createResponse.ok) {
    const text = await createResponse.text();
    throw new Error(`tasks create failed ${createResponse.status}: ${text}`);
  }

  const createRaw = await createResponse.text();
  let created: TaskStartResponse;
  try {
    created = JSON.parse(createRaw) as TaskStartResponse;
  } catch {
    throw new Error(
      `tasks create returned non-JSON response: ${createRaw.slice(0, 220)}`
    );
  }
  const taskId = extractTaskId(created);
  if (!taskId) {
    throw new Error("tasks create succeeded but no task id was returned");
  }
  if (shouldLog) {
    console.info("[manus] task accepted", { createUrl, taskId, taskUrl: created.task_url || null });
  }

  const maxAttempts = Number(normalizeEnvValue(process.env.MANUS_TASK_MAX_POLLS) || "80");
  const pollMs = Number(normalizeEnvValue(process.env.MANUS_TASK_POLL_MS) || "1500");
  const statusUrl = resolveTaskStatusUrl(created, baseUrl, statusTemplate, taskId);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        API_KEY: apiKey,
      },
    });

    if (!statusResponse.ok) {
      const text = await statusResponse.text();
      const isEventuallyConsistentNotFound =
        statusResponse.status === 404 && /task not found|not found/i.test(text);
      if (isEventuallyConsistentNotFound) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        continue;
      }
      throw new Error(`tasks status failed ${statusResponse.status}: ${text}`);
    }

    const statusRaw = await statusResponse.text();
    let statusPayload: TaskStatusResponse | null = null;
    try {
      statusPayload = JSON.parse(statusRaw) as TaskStatusResponse;
    } catch {
      // If Manus returns a temporary HTML/app response while job propagates,
      // keep polling instead of failing hard.
      if (/<!doctype html|<html/i.test(statusRaw)) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        continue;
      }
      throw new Error(`tasks status returned non-JSON response: ${statusRaw.slice(0, 220)}`);
    }

    const status = mapTaskStatus(statusPayload.status || statusPayload.state);
    if (shouldLog && (attempt === 0 || attempt % 5 === 0 || status !== "running")) {
      console.info("[manus] task poll", {
        taskId,
        pollAttempt: attempt + 1,
        maxAttempts,
        statusUrl,
        status: statusPayload.status || statusPayload.state || "unknown",
      });
    }
    if (status === "done") {
      const parsedText = parseTextResponse(statusPayload as ManusResponseShape);
      if (!parsedText) throw new Error("tasks completed but returned empty output");
      return parsedText;
    }
    if (status === "failed") {
      const detail = JSON.stringify(statusPayload);
      throw new Error(`tasks execution failed: ${detail}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error("tasks polling timed out before completion");
}

export async function generateWithManus(messages: ManusMessage[]) {
  const apiKey = normalizeEnvValue(process.env.MANUS_API_KEY);
  if (!apiKey) {
    throw new Error("MANUS_API_KEY is missing or empty after normalization.");
  }
  const useChatFallback = normalizeEnvValue(process.env.MANUS_ENABLE_CHAT_FALLBACK).toLowerCase() === "true";

  try {
    return await generateViaTasksApi(messages, apiKey);
  } catch (taskError) {
    const taskMessage = taskError instanceof Error ? taskError.message : "request failed";
    if (!useChatFallback) {
      throw new Error(`tasks_primary -> ${taskMessage}`);
    }
  }

  const model = process.env.MANUS_MODEL || "manus-1";
  const attempts = buildAttempts(messages, model);
  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          API_KEY: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attempt.payload),
      });

      if (!response.ok) {
        const text = await response.text();
        errors.push(`${attempt.url} -> ${response.status}: ${text}`);
        continue;
      }

      const data = (await response.json()) as ManusResponseShape;
      const content = parseTextResponse(data);
      if (!content) {
        errors.push(`${attempt.url} -> empty response body`);
        continue;
      }

      return content;
    } catch (error) {
      errors.push(`${attempt.url} -> ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  throw new Error(`chat_fallback_failed after ${attempts.length} attempts. ${errors.join(" | ")}`);
}

