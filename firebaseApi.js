/**
 * firebaseApi.js
 * ──────────────────────────────────────────────────────────────────
 * Realtime Database paths:
 *
 *  /rsvp_links/{hash}
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │ maxInvitees  : number                                       │
 *  │ label        : string                                       │
 *  │ used         : boolean                                      │
 *  │ createdAt    : number (ms since epoch, server timestamp)    │
 *  └─────────────────────────────────────────────────────────────┘
 *
 *  /attendees/{pushId}
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │ firstName    : string                                       │
 *  │ lastName     : string                                       │
 *  │ middleName   : string                                       │
 *  │ attending    : boolean                                      │
 *  │ hasOwnCar    : boolean                                      │
 *  │ rsvpHash     : string                                       │
 *  │ createdAt    : number (ms since epoch, server timestamp)    │
 *  └─────────────────────────────────────────────────────────────┘
 */

import {
  ref,
  get,
  set,
  push,
  update,
  remove,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";
import { db } from "./firebaseConfig";

const LINKS_PATH = "rsvp_links";
const ATTENDEES_PATH = "attendees";

// ─────────────────────────────────────────────
//  RSVP LINKS
// ─────────────────────────────────────────────

export async function validateRsvpLink(hash) {
  const snap = await get(ref(db, `${LINKS_PATH}/${hash}`));

  if (!snap.exists()) {
    return { valid: false, exists: false, used: false, maxInvitees: 0 };
  }

  const data = snap.val();

  if (data.used) {
    return { valid: false, exists: true, used: true, maxInvitees: data.maxInvitees };
  }

  return { valid: true, exists: true, used: false, maxInvitees: data.maxInvitees };
}

export async function createRsvpLink(hash, maxInvitees = 1, label = "") {
  await set(ref(db, `${LINKS_PATH}/${hash}`), {
    maxInvitees,
    label,
    used: false,
    createdAt: serverTimestamp(),
  });
  return hash;
}

export async function markLinkAsUsed(hash) {
  await update(ref(db, `${LINKS_PATH}/${hash}`), { used: true });
}

export async function deleteRsvpLink(hash) {
  await remove(ref(db, `${LINKS_PATH}/${hash}`));
}

export async function listRsvpLinks() {
  const snap = await get(ref(db, LINKS_PATH));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, data]) => ({ id, ...data }));
}

// ─────────────────────────────────────────────
//  ATTENDEES
// ─────────────────────────────────────────────

export async function addAttendee({ firstName, lastName, middleName, attending, hasOwnCar, rsvpHash }) {
  const newRef = push(ref(db, ATTENDEES_PATH));
  await set(newRef, {
    firstName,
    lastName,
    middleName,
    attending,
    hasOwnCar,
    rsvpHash,
    createdAt: serverTimestamp(),
  });
  return newRef.key;
}

/**
 * Submit the entire RSVP form atomically via a multi-path update.
 */
export async function submitRsvp(hash, attendees) {
  const updates = {};

  for (const attendee of attendees) {
    const key = push(ref(db, ATTENDEES_PATH)).key;
    updates[`${ATTENDEES_PATH}/${key}`] = {
      firstName: attendee.firstName,
      lastName: attendee.lastName,
      middleName: attendee.middleName,
      attending: attendee.attending,
      hasOwnCar: attendee.hasOwnCar,
      rsvpHash: hash,
      createdAt: serverTimestamp(),
    };
  }

  updates[`${LINKS_PATH}/${hash}/used`] = true;

  await update(ref(db), updates);
}

export async function getAttendeesByHash(hash) {
  const q = query(ref(db, ATTENDEES_PATH), orderByChild("rsvpHash"), equalTo(hash));
  const snap = await get(q);
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, data]) => ({ id, ...data }));
}

export async function listAttendees() {
  const snap = await get(ref(db, ATTENDEES_PATH));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, data]) => ({ id, ...data }));
}

export async function updateAttendee(docId, updates) {
  await update(ref(db, `${ATTENDEES_PATH}/${docId}`), updates);
}

export async function deleteAttendee(docId) {
  await remove(ref(db, `${ATTENDEES_PATH}/${docId}`));
}

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────

export async function getGuestLimit() {
  const snap = await get(ref(db, "config/guestLimit"));
  return snap.exists() ? snap.val() : 130;
}

export async function setGuestLimit(limit) {
  await set(ref(db, "config/guestLimit"), limit);
}
