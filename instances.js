// organizer/instances.js
// Small API module to create and load instances under /instances.
// Includes Firebase initialization (merged from firebase.js).

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getDatabase /*, connectDatabaseEmulator */, ref, push, set, get, remove } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAM0jSKxniPCNdemeq6vcMHPOPepkwCEUs",
  authDomain: "bubbleorganizer-ac487.firebaseapp.com",
  databaseURL: "https://bubbleorganizer-ac487-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bubbleorganizer-ac487",
  storageBucket: "bubbleorganizer-ac487.firebasestorage.app",
  messagingSenderId: "1052154676115",
  appId: "1:1052154676115:web:854853336f788e37cd5e66"
};

export const app = initializeApp(firebaseConfig);
export const db  = getDatabase(app);

// Firebase Realtime Database push() keys are 20-character strings.
// We rely on this length when parsing composite instance ids that embed a prototype id.
export const PROTOTYPE_ID_LENGTH = 20;

// For local testing with the Realtime Database Emulator, uncomment:
// if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
//   connectDatabaseEmulator(db, "127.0.0.1", 9000);
// }

/** Canonical list of day keys */
export const DAYS = [
  "monday","tuesday","wednesday","thursday","friday","saturday","sunday"
];

/** Build the initial days schema */
export const makeDays = () => ({
  monday: {},
  tuesday: {},
  wednesday: {},
  thursday: {},
  friday: {},
  saturday: {},
  sunday: {}
});

/**
 * Creates /instances/<id> with { days: {...}, createdAt, ...extra }.
 * If extra.id is provided, uses that as the instance id; otherwise
 * falls back to a client-generated push() key.
 *
 * @param {{id?:string}} extra Optional fields to merge in; may include an explicit id.
 * @returns {Promise<{id:string, data:object}>}
 */
export async function createInstance(extra = {}) {
  const payload = extra || {};
  const providedId = typeof payload.id === "string" && payload.id ? payload.id : null;

  let instanceRef;
  let id;

  if (providedId) {
    id = providedId;
    instanceRef = ref(db, `instances/${id}`);
  } else {
    const newRef = push(ref(db, "instances")); // client-generated unguessable key
    instanceRef = newRef;
    id = newRef.key;
  }

  const { id: _omitId, ...rest } = payload;
  const data = { days: makeDays(), createdAt: Date.now(), ...rest };
  await set(instanceRef, data);
  return { id, data };
}

/**
 * Loads /instances/<id> and returns the object (or null if missing).
 * @param {string} id
 */
export async function loadInstance(id) {
  if (!id) return null;
  const snap = await get(ref(db, `instances/${id}`));
  return snap.val();
}

/**
 * Creates /prototypes/<autoId> with
 * { prototypes: [{text,color,description}], createdAt }.
 * Colors are stored as 6-hex digits without leading '#', same as day items.
 *
 * @param {Array<{text?:string,color?:string,description?:string}>} prototypes
 * @returns {Promise<{id:string, data:object}>}
 */
export async function createPrototypeSet(prototypes = []) {
  const newRef = push(ref(db, "prototypes"));
  const id = newRef.key;

  const list = Array.isArray(prototypes) ? prototypes : [];
  const normalized = list.map((p) => ({
    text: String(p.text ?? ""),
    color: normalizeColor(p.color ?? "38bdf8"),
    description: String(p.description ?? ""),
  }));

  const data = { prototypes: normalized, createdAt: Date.now() };
  await set(newRef, data);
  return { id, data };
}

/**
 * Loads /prototypes/<id> and returns the object (or null if missing).
 * Shape: { prototypes?: Array<{text,color,description}>, createdAt?, updatedAt? }
 * @param {string} id
 */
export async function loadPrototypeSet(id) {
  if (!id) return null;
  const snap = await get(ref(db, `prototypes/${id}`));
  return snap.val();
}

/**
 * Overwrites /prototypes/<id> with the given prototypes list.
 * Colors are normalized to 6-hex digits without '#'; description is optional string.
 *
 * @param {string} id
 * @param {Array<{text?:string,color?:string,description?:string}>} prototypes
 */
export async function savePrototypeSet(id, prototypes = []) {
  if (!id) throw new Error("Missing prototype id");
  const list = Array.isArray(prototypes) ? prototypes : [];
  const normalized = list.map((p) => ({
    text: String(p.text ?? ""),
    color: normalizeColor(p.color ?? "38bdf8"),
    description: String(p.description ?? ""),
  }));
  const data = { prototypes: normalized, updatedAt: Date.now() };
  await set(ref(db, `prototypes/${id}`), data);
}

/** Build a shareable URL with ?id=<id> for the current page */
export function makeShareURL(id) {
  const u = new URL(location.href);
  u.searchParams.set("id", id);
  return u.toString();
}

/** Normalize a day name (accepts Mon/monday/etc.), returns canonical lowercase or null */
export function normalizeDay(input) {
  const k = String(input ?? "").trim().toLowerCase();
  const map = {
    mon: "monday", monday: "monday",
    tue: "tuesday", tues: "tuesday", tuesday: "tuesday",
    wed: "wednesday", weds: "wednesday", wednesday: "wednesday",
    thu: "thursday", thur: "thursday", thurs: "thursday", thursday: "thursday",
    fri: "friday", friday: "friday",
    sat: "saturday", saturday: "saturday",
    sun: "sunday", sunday: "sunday"
  };
  return map[k] || null;
}

/** Normalize/validate a color. Accepts "rrggbb" or "#rrggbb"; returns "rrggbb" */
export function normalizeColor(color) {
  let c = String(color ?? "").trim();
  if (c.startsWith("#")) c = c.slice(1);
  c = c.toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(c)) {
    throw new Error("Invalid color; expected 6-digit hex like rrggbb");
  }
  return c;
}

/**
 * Push an item under /instances/<instanceId>/days/<day>/ with schema
 * { title: string, color: "rrggbb", position: number, square?: boolean, insertedAt?: number, description?: string }
 *
 * @param {string} instanceId
 * @param {string} day - any of Monday..Sunday (case/abbr OK)
 * @param {{title?:string,color?:string,position?:number}} item
 * @returns {Promise<{id:string, data:{title:string,color:string,position:number}}>} new child id & data
 */
export async function pushDayItem(instanceId, day, item = {}) {
  const canonDay = normalizeDay(day);
  if (!canonDay) throw new Error("Invalid day; use Monday..Sunday");

  const title = String(item.title ?? "");
  const color = normalizeColor(item.color ?? "000000");
  const position = Number.isFinite(Number(item.position)) ? Number(item.position) : 0;
  const square = Boolean(item.square ?? false);
  const insertedAt = Number.isFinite(Number(item.insertedAt)) ? Number(item.insertedAt) : Date.now();
  const description = String(item.description ?? "");

  const path = `instances/${instanceId}/days/${canonDay}`;
  const childRef = push(ref(db, path));
  const data = { title, color, position, square, insertedAt, description };
  await set(childRef, data);
  return { id: childRef.key, data };
}

/**
 * Sets/overwrites a specific day item by id.
 * Path: /instances/<instanceId>/days/<day>/<id>
 * @param {string} instanceId
 * @param {string} day
 * @param {string} id
 * @param {{title?:string,color?:string,position?:number,square?:boolean}} item
 */
export async function setDayItem(instanceId, day, id, item = {}) {
  const canonDay = normalizeDay(day);
  if (!canonDay) throw new Error("Invalid day; use Monday..Sunday");
  if (!id) throw new Error("Missing item id");

  const title = String(item.title ?? "");
  const color = normalizeColor(item.color ?? "000000");
  const position = Number.isFinite(Number(item.position)) ? Number(item.position) : 0;
  const square = Boolean(item.square ?? false);
  // Preserve/allow insertedAt to be set/kept
  const insertedAt = Number.isFinite(Number(item.insertedAt)) ? Number(item.insertedAt) : undefined;
  const description = String(item.description ?? "");
  const base = { title, color, position, square, description };
  const data = insertedAt != null ? { ...base, insertedAt } : base;
  await set(ref(db, `instances/${instanceId}/days/${canonDay}/${id}`), data);
}

/**
 * Removes a specific day item by id.
 * @param {string} instanceId
 * @param {string} day
 * @param {string} id
 */
export async function removeDayItem(instanceId, day, id) {
  const canonDay = normalizeDay(day);
  if (!canonDay) throw new Error("Invalid day; use Monday..Sunday");
  if (!id) return;
  await remove(ref(db, `instances/${instanceId}/days/${canonDay}/${id}`));
}
