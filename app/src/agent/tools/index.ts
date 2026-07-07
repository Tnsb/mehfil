/**
 * Tool manifest. To add a feature to TABLE (for both the UI and the agent):
 *   1. Create the tool in this folder.
 *   2. Add it to this list.
 * That's it — the chat agent, server actions, and scheduler all pick it up.
 */
import type { AnyTool } from "../types";
import {
  createEvent,
  updateEvent,
  publishEvent,
  listMyEvents,
  getEventDetails,
  runItBack,
} from "./events";
import {
  bookSeat,
  confirmPayment,
  cancelTicket,
  getMyTickets,
  getEventRoster,
} from "./tickets";
import { runAfterparty, submitFeedback, getAfterpartySummary } from "./afterparty";
import { getMyActivity, discoverEvents } from "./activity";
import { getPartyChat, postPartyMessage, setCohostVibe } from "./party";
import { takeOneShot, getPhotoRoll } from "./oneshot";
import {
  tapConnect,
  getMatchChat,
  postMatchMessage,
  getMyConnections,
  getMyWrapped,
} from "./social";

export const allTools: AnyTool[] = [
  // setup
  createEvent,
  updateEvent,
  publishEvent,
  listMyEvents,
  getEventDetails,
  runItBack,
  // door
  bookSeat,
  confirmPayment,
  cancelTicket,
  getMyTickets,
  getEventRoster,
  // party chat + cohost
  getPartyChat,
  postPartyMessage,
  setCohostVibe,
  // one shot
  takeOneShot,
  getPhotoRoll,
  // afterparty
  runAfterparty,
  submitFeedback,
  getAfterpartySummary,
  // taps & matches
  tapConnect,
  getMatchChat,
  postMatchMessage,
  getMyConnections,
  getMyWrapped,
  // activity & discovery
  getMyActivity,
  discoverEvents,
];
