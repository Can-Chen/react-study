import { enableProfiling } from './new.SchedulerFeatureFlags';

let runIdCounter: number = 0;
let mainThreadIdCounter: number = 0;

// Bytes per element is 4
const INITIAL_EVENT_LOG_SIZE = 131072;
const MAX_EVENT_LOG_SIZE = 524288; // Equivalent to 2 megabytes

let eventLogSize = 0;
let eventLogBuffer: ArrayBufferLike | null;
let eventLog: Int32Array | null;
let eventLogIndex = 0;

const TaskStartEvent = 1;
const TaskCompleteEvent = 2;
const TaskErrorEvent = 3;
const TaskCancelEvent = 4;
const TaskRunEvent = 5;
const TaskYieldEvent = 6;
const SchedulerSuspendEvent = 7;
const SchedulerResumeEvent = 8;

function logEvent(entries: any[]) {
  if (eventLog !== null) {
    const offset = eventLogIndex;
    eventLogIndex += entries.length;
    if (eventLogIndex + 1 > eventLogSize) {
      eventLogSize *= 2;

      if (eventLogSize > MAX_EVENT_LOG_SIZE) {
        // throw error
        stopLoggingProfilingEvents();
        return;
      }
      const newEventLog = new Int32Array(eventLogSize * 4);
      newEventLog.set(eventLog);
      eventLogBuffer = newEventLog.buffer;
      eventLog = newEventLog;
    }
    eventLog.set(entries, offset)
  }
}

export function startLoggingProfilingEvents(): void {
  eventLogSize = INITIAL_EVENT_LOG_SIZE;
  eventLogBuffer = new ArrayBuffer(eventLogSize * 4);
  eventLog = new Int32Array(eventLogBuffer);
  eventLogIndex = 0;
}

export function stopLoggingProfilingEvents(): ArrayBuffer | null {
  const buffer = eventLogBuffer;
  eventLogSize = 0;
  eventLogBuffer = null;
  eventLog = null;
  eventLogIndex = 0;
  return buffer;
}

type ITask = Schedule.INode

export function markTaskStart(task: ITask, ms: number): void {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([
        TaskStartEvent,
        ms * 1000,
        task.id,
        task.priorityLevel
      ])
    }
  }
}

export function markTaskCompleted(task: ITask, ms: number): void {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([
        TaskCompleteEvent,
        ms * 1000,
        task.id
      ])
    }
  }
}

export function markTaskCanceled(task: ITask, ms: number): void {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([
        TaskCancelEvent,
        ms * 1000,
        task.id
      ])
    }
  }
}

export function markTaskErrored(task: ITask, ms: number): void {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([
        TaskErrorEvent,
        ms * 1000,
        task.id
      ])
    }
  }
}

export function markTaskRun(task: ITask, ms: number): void {
  if (enableProfiling) {
    runIdCounter++;

    if (eventLog !== null) {
      logEvent([
        TaskRunEvent,
        ms * 1000,
        task.id,
        runIdCounter
      ])
    }
  }
}

export function markTaskYield(task: ITask, ms: number): void {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([
        TaskYieldEvent,
        ms * 1000,
        task.id,
        runIdCounter
      ])
    }
  }
}

export function markSchedulerSuspended(ms: number): void {
  if (enableProfiling) {
    mainThreadIdCounter++;

    if (eventLog !== null) {
      logEvent([
        SchedulerSuspendEvent,
        ms * 1000,
        mainThreadIdCounter
      ]);
    }
  }
}

export function markSchedulerUnSuspended(ms: number): void {
  if (enableProfiling) {
    if (eventLog !== null) {
      logEvent([
        SchedulerResumeEvent,
        ms * 1000,
        mainThreadIdCounter
      ])
    }
  }
}