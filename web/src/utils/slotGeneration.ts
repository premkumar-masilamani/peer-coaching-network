import { Timestamp } from 'firebase/firestore';
import { 
  timeStringToTimestamp as sharedTimeStringToTimestamp,
  timestampToTimeString,
  generateTemplateSlots,
  type GenerateTemplateSlotsParams
} from '@pcn/shared';

// Client-bound version of timeStringToTimestamp that fits the exact existing signature.
export const timeStringToTimestamp = (timeStr: string): Timestamp => {
  return sharedTimeStringToTimestamp(timeStr, Timestamp.fromDate);
};

export { timestampToTimeString, generateTemplateSlots, type GenerateTemplateSlotsParams };
