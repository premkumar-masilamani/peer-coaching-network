import { describe, it, expect } from 'vitest';
import { resolveEventTemplate, DEFAULT_EVENT_TEMPLATES } from '../eventTemplates';

describe('eventTemplates', () => {
  it('interpolates placeholders into event summary and description', () => {
    const data = {
      coachName: 'Coach Prem',
      coachEmail: 'coach@example.com',
      clientName: 'Client Kalai',
      clientEmail: 'client@example.com',
      topic: 'Career Acceleration',
    };

    const summary = resolveEventTemplate(DEFAULT_EVENT_TEMPLATES.summary, data);
    expect(summary).toBe('[PCN] Peer Coaching: Coach Prem & Client Kalai');

    const desc = resolveEventTemplate(DEFAULT_EVENT_TEMPLATES.description, data);
    expect(desc).toContain('Coach: Coach Prem (coach@example.com)');
    expect(desc).toContain('Client: Client Kalai (client@example.com)');
    expect(desc).toContain('Topic: Career Acceleration');
  });
});
