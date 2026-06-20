import { describe, it, expect } from 'vitest';
import { resolveEventTemplate } from '../eventTemplates';

describe('eventTemplates', () => {
  describe('resolveEventTemplate', () => {
    it('replaces placeholders correctly', () => {
      const template = 'Summary: {coachName} & {clientName} ({coachEmail} / {clientEmail}) for {topic}';
      const data = {
        coachName: 'Alice Coach',
        coachEmail: 'alice@coach.com',
        clientName: 'Bob Client',
        clientEmail: 'bob@client.com',
        topic: 'Goal Setting',
      };
      const result = resolveEventTemplate(template, data);
      expect(result).toBe('Summary: Alice Coach & Bob Client (alice@coach.com / bob@client.com) for Goal Setting');
    });

    it('replaces multiple occurrences of same placeholder', () => {
      const template = '{coachName} is coaching {clientName}. {coachName} loves {topic}.';
      const data = {
        coachName: 'Alice',
        coachEmail: 'alice@coach.com',
        clientName: 'Bob',
        clientEmail: 'bob@client.com',
        topic: 'Life',
      };
      const result = resolveEventTemplate(template, data);
      expect(result).toBe('Alice is coaching Bob. Alice loves Life.');
    });
  });
});
