import fs from 'fs';
import path from 'path';
import { config } from '../config';

export class Logger {
  private sessionId: string;
  
  constructor() {
    this.sessionId = `session-${Date.now()}`;
    if (!fs.existsSync(config.paths.agentsLogs)) {
      fs.mkdirSync(config.paths.agentsLogs, { recursive: true });
    }
  }
  
  log(message: string) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    const logFile = path.join(config.paths.agentsLogs, 'agents.log');
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  }
}
