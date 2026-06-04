# RSVP App

A Firebase-backed RSVP form with hash-validated single-use invitation links.

---

## Project Structure

```
src/
├── firebaseConfig.js   ← Replace placeholder values with your Firebase config
├── firebaseApi.js      ← All Firestore CRUD functions
├── App.jsx             ← URL hash reader + router
└── RSVPPage.jsx        ← Full form UI (shadcn/ui + Tailwind)
```

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up shadcn/ui
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add card input label button checkbox badge separator alert
```

### 3. Add your Firebase config
Edit `src/firebaseConfig.js` and replace all placeholder values with your Firebase project credentials.

### 4. Firestore Collections

Create two collections in Firestore:

#### `rsvp_links`
| Field | Type | Description |
|---|---|---|
| `(docId)` | string | The hash string itself (e.g. `123adsf8asdf`) |
| `maxInvitees` | number | How many guests this link allows |
| `used` | boolean | `true` after form is submitted |
| `createdAt` | timestamp | Auto-set on creation |

#### `attendees`
| Field | Type | Description |
|---|---|---|
| `firstName` | string | |
| `lastName` | string | |
| `middleName` | string | |
| `attending` | boolean | Whether they're coming |
| `hasOwnCar` | boolean | Whether they have transportation |
| `rsvpHash` | string | Links back to the `rsvp_links` doc |
| `createdAt` | timestamp | Auto-set on creation |

### 5. Firestore Security Rules (recommended)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rsvp_links/{hash} {
      allow read: if true;           // needed for validation
      allow write: if false;         // only via Admin SDK or your backend
    }
    match /attendees/{docId} {
      allow create: if true;         // form submissions
      allow read, update, delete: if false;
    }
  }
}
```

---

## URL Format

```
https://yourdomain.com/rsvp?hash=123adsf8asdf
```

---

## API Functions (firebaseApi.js)

| Function | Description |
|---|---|
| `validateRsvpLink(hash)` | Checks if hash exists and is unused |
| `createRsvpLink(hash, maxInvitees)` | Creates a new invitation link |
| `markLinkAsUsed(hash)` | Marks a link as used |
| `deleteRsvpLink(hash)` | Deletes a link |
| `listRsvpLinks()` | Lists all links (admin) |
| `submitRsvp(hash, attendees)` | Atomic batch: saves all attendees + marks link used |
| `addAttendee(data)` | Adds a single attendee |
| `getAttendeesByHash(hash)` | Gets all attendees for a hash |
| `listAttendees()` | Lists all attendees (admin) |
| `updateAttendee(docId, updates)` | Updates an attendee |
| `deleteAttendee(docId)` | Deletes an attendee |

---

## Dev Server
```bash
npm run dev
# Visit: http://localhost:5173/rsvp?hash=YOUR_TEST_HASH
```
