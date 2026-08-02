import { Router } from 'express';
import { db, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { bad, now, uid, wrap } from '../util.js';

export const eventsRouter = Router();

const EVENTS = {
  'leadership-2026': {
    id: 'leadership-2026',
    title: 'Leadership Vote',
    subtitle: 'Two leaders. One public verdict.',
    status: 'live',
    candidates: [
      { id: 'left', side: 'left', name: 'Left Candidate', nationality: 'To be announced', organization: 'To be announced', slogan: 'A future worth choosing.', image: '/leader-left.svg' },
      { id: 'right', side: 'right', name: 'Right Candidate', nationality: 'To be announced', organization: 'To be announced', slogan: 'A different road forward.', image: '/leader-right.svg' },
    ],
  },
};

function resultFor(event, viewer) {
  db.eventVotes ||= [];
  const manualVotes = db.eventVotes.filter((vote) => vote.eventId === event.id);
  const tomatoVotes = db.tomatoes.filter((tomato) => !tomato.hidden && tomato.voteEventId === event.id);
  const counts = Object.fromEntries(event.candidates.map((candidate) => [candidate.id, 0]));
  for (const vote of [...manualVotes, ...tomatoVotes]) if (counts[vote.candidateId] !== undefined) counts[vote.candidateId] += 1;
  return {
    event,
    counts,
    totalVotes: Object.values(counts).reduce((sum, value) => sum + value, 0),
    myManualVote: viewer ? manualVotes.find((vote) => vote.userId === viewer.id)?.candidateId || null : null,
  };
}

eventsRouter.get('/:id', wrap((req, res) => {
  const event = EVENTS[req.params.id];
  if (!event) return res.status(404).json({ error: 'Voting event not found.' });
  res.json(resultFor(event, req.user));
}));

eventsRouter.post('/:id/vote', requireAuth, wrap((req, res) => {
  const event = EVENTS[req.params.id];
  if (!event) return res.status(404).json({ error: 'Voting event not found.' });
  db.eventVotes ||= [];
  if (db.eventVotes.some((vote) => vote.eventId === event.id && vote.userId === req.user.id)) throw bad('Your manual ballot has already been submitted. Tomatoes may still be thrown as additional public support.');
  const candidateId = String(req.body.candidateId || '');
  if (!event.candidates.some((candidate) => candidate.id === candidateId)) throw bad('Choose one of the listed candidates.');
  db.eventVotes.push({ id: uid('evt_vote'), eventId: event.id, candidateId, userId: req.user.id, createdAt: now() });
  save();
  res.json(resultFor(event, req.user));
}));
