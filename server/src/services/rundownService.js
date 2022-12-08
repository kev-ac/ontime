import { DataProvider } from '../classes/data-provider/DataProvider.js';
import { generateId } from '../utils/generate_id.js';
import {
  block as blockDef,
  delay as delayDef,
  event as eventDef,
} from '../models/eventsDefinition.js';
import { MAX_EVENTS } from '../settings.js';
import { EventLoader, eventLoader } from '../classes/event-loader/EventLoader.js';

const affectedLoaded = (affectedIds) => {
  const now = eventLoader.selectedEventId;
  const nowPublic = eventLoader.selectedPublicEventId;
  const next = eventLoader.nextEventId;
  const nextPublic = eventLoader.nextPublicEventId;
  return (
    affectedIds.includes(now) ||
    affectedIds.includes(now) ||
    affectedIds.includes(nowPublic) ||
    affectedIds.includes(next) ||
    affectedIds.includes(nextPublic)
  );
};

const isNewNext = () => {
  const timedEvents = EventLoader.getTimedEvents();
  const now = eventLoader.selectedEventId;
  const next = eventLoader.nextEventId;

  // check whether the index of now and next are consecutive
  const indexNow = timedEvents.findIndex((event) => event.id === now);
  const indexNext = timedEvents.findIndex((event) => event.id === next);

  if (indexNext - indexNow !== 1) {
    return true;
  }
  // iterate through timed events and see if there are public events between nowPublic and nextPublic
  const nowPublic = eventLoader.selectedPublicEventId;
  const nextPublic = eventLoader.nextPublicEventId;

  let foundNew = false;
  let isAfter = false;
  for (const event of timedEvents) {
    if (!isAfter) {
      if (event.id === nowPublic) {
        isAfter = true;
      }
    } else {
      if (event.id === nextPublic) {
        break;
      }
      if (event.isPublic) {
        foundNew = true;
        break;
      }
    }
  }

  return foundNew;
};

/**
 * updates timer object
 * @param {array} [affectedIds]
 */
export function updateTimer(affectedIds) {
  const runningEventId = eventLoader.selectedEventId;
  if (runningEventId === null) {
    return false;
  }

  // we need to reload in a few scenarios:
  // 1. we are not confident that changes do not affect running event
  // 2. the edited event is currently being used (now or next)
  // 3. the edited event replaces one of the previous (next)
  if (typeof affectedIds === 'undefined') {
    global.timer.syncLoaded(runningEventId);
    return true;
  }
  if (affectedLoaded(affectedIds)) {
    global.timer.syncLoaded(runningEventId);
    return true;
  }
  if (isNewNext()) {
    global.timer.syncLoaded(runningEventId);
    return true;
  }
  return false;
}

/**
 * @description creates a new event with given data
 * @param {object} eventData
 * @return {unknown[]}
 */
export async function addEvent(eventData) {
  const numEvents = DataProvider.getRundownLenght();
  if (numEvents > MAX_EVENTS) {
    throw new Error(`ERROR: Reached limit number of ${MAX_EVENTS} events`);
  }

  let newEvent = {};
  const id = generateId();

  switch (eventData.type) {
    case 'event':
      newEvent = { ...eventDef, ...eventData, id };
      break;
    case 'delay':
      newEvent = { ...delayDef, ...eventData, id };
      break;
    case 'block':
      newEvent = { ...blockDef, ...eventData, id };
      break;
  }

  try {
    const afterId = newEvent?.after;
    if (typeof afterId === 'undefined') {
      await DataProvider.insertEventAt(newEvent, 0);
    } else {
      delete newEvent.after;
      await DataProvider.insertEventAfterId(newEvent, afterId);
    }
  } catch (error) {
    throw new Error(error);
  }
  updateTimer([id]);
  return newEvent;
}

export async function editEvent(eventData) {
  const eventId = eventData.id;
  const eventInMemory = DataProvider.getEventById(eventId);
  if (typeof eventInMemory === 'undefined') {
    throw new Error('No event with ID found');
  }
  const newEvent = await DataProvider.updateEventById(eventId, eventData);
  updateTimer([eventId]);
  return newEvent;
}

/**
 * deletes event by its ID
 * @param eventId
 * @returns {Promise<void>}
 */
export async function deleteEvent(eventId) {
  await DataProvider.deleteEvent(eventId);
  updateTimer([eventId]);
}

/**
 * deletes all events in database
 * @returns {Promise<void>}
 */
export async function deleteAllEvents() {
  await DataProvider.clearRundown();
  updateTimer();
}

/**
 * reorders a given event
 * @param {string} eventId
 * @param {number} from
 * @param {number} to
 * @returns {Promise<void>}
 */
export async function reorderEvent(eventId, from, to) {
  const rundown = DataProvider.getRundown();
  const index = rundown.findIndex((event) => event.id === eventId);

  if (index !== from) {
    throw new Error('ID not found at index');
  }
  const [reorderedItem] = rundown.splice(from, 1);

  // reinsert item at to
  rundown.splice(to, 0, reorderedItem);

  // save rundown
  await DataProvider.setEventData(rundown);
  updateTimer();

  return reorderedItem;
}

/**
 * applies delay value for given event
 * @param eventId
 * @returns {Promise<void>}
 */
export async function applyDelay(eventId) {
  const rundown = DataProvider.getRundown();
  // AUX
  let delayIndex = null;
  let blockIndex = null;
  let delayValue = 0;

  for (const [index, e] of rundown.entries()) {
    // look for delay
    if (delayIndex === null) {
      if (e.id === eventId && e.type === 'delay') {
        delayValue = e.duration;
        delayIndex = index;
      }
    }

    // apply delay value to all items until block or end
    else {
      if (e.type === 'event') {
        // update times
        e.timeStart += delayValue;
        e.timeEnd += delayValue;

        // increment revision
        e.revision += 1;
      } else if (e.type === 'block') {
        // save id and stop
        blockIndex = index;
        break;
      }
    }
  }

  if (delayIndex === null) {
    throw new Error(`Delay event with ID ${eventId} not found`);
  }

  // delete delay
  rundown.splice(delayIndex, 1);

  // delete block
  // index would have moved down since we deleted delay
  if (blockIndex) rundown.splice(blockIndex - 1, 1);

  // update rundown
  await DataProvider.setRundown(rundown);
  updateTimer();
}