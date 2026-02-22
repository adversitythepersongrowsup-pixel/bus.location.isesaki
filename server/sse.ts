import { Request, Response } from "express";

type SSEClient = {
  id: string;
  res: Response;
};

const clients: Map<string, SSEClient> = new Map();

export function sseHandler(req: Request, res: Response) {
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send initial connection event
  res.write(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`);

  clients.set(clientId, { id: clientId, res });

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
}

export function broadcastSSE(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of Array.from(clients.values())) {
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client.id);
    }
  }
}
