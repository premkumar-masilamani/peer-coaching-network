export interface EventTemplateData {
  coachName: string;
  coachEmail: string;
  clientName: string;
  clientEmail: string;
  topic: string;
}

export const DEFAULT_EVENT_TEMPLATES = {
  summary: '[PCN] Peer Coaching: {coachName} & {clientName}',
  description: 'Hello!\n\nA peer coaching session has been scheduled.\n\nDetails:\n- Coach: {coachName} ({coachEmail})\n- Client: {clientName} ({clientEmail})\n- Topic: {topic}\n\nPlease join the Google Meet link attached to this event.\n\nCreated via Peer Coaching Network.'
};

export const resolveEventTemplate = (template: string, data: EventTemplateData): string => {
  return template
    .replace(/{coachName}/g, data.coachName)
    .replace(/{coachEmail}/g, data.coachEmail)
    .replace(/{clientName}/g, data.clientName)
    .replace(/{clientEmail}/g, data.clientEmail)
    .replace(/{topic}/g, data.topic);
};
