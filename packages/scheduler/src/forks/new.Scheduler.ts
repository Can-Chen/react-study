import {
  enableIsInputPending,
  enableIsInputPendingContinuous,
  enableProfiling,
  enableSchedulerDebugging,
  frameYieldMs,
  continuousYieldMs,
  maxYieldMs
} from '../new.SchedulerFeatureFlags';

import { peek, pop, push } from '../new.SchedulerMinHeap';

import {
  ImmediatePriority,
  UserBlockingPriority,
  NormalPriority,
  LowPriority,
  IdlePriority
} from '../new.SchedulerPriorities';

import {
  markTaskCanceled,
  markSchedulerSuspended,
  markSchedulerUnSuspended,
  markTaskCompleted,
  markTaskErrored,
  markTaskRun,
  markTaskStart,
  markTaskYield,
  startLoggingProfilingEvents,
  stopLoggingProfilingEvents
} from '../new.SchedulerProfiling';

let getCurrentTime: () => number;

const hasPerformanceNow =
  typeof performance === 'object' &&
  typeof performance.now === 'function';

if (hasPerformanceNow) {
  const localPerformance = performance;
  getCurrentTime = () => localPerformance.now();
} else {
  const localData = Date;
  const initialTime = localData.now();
  getCurrentTime = () => localData.now() - initialTime;
}

// 最大31位整数. V8中32位系统的最大整数大小
// Math.pow(2, 30) - 1
// 0b111111111111111111111111111111
const maxSigned31BitInt = 1073741823;

// Times out immediately
const IMMEDIATE_PRIORITY_TIMEOUT = -1;
// Eventually times out
const USER_BLOCKING_PRIORITY_TIMEOUT = 250;
const NORMAL_PRIORITY_TIMEOUT = 5000;
const LOW_PRIORITY_TIMEOUT = 10000;
// Never times out
const IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;

/**
 * Tasks are stored on a min heap
 */
const taskQueue: Schedule.Heap = [];
const timerQueue: Schedule.Heap = [];

/**
 * Incrementing id counter. Used to maintain insertion order.
 */
let taskIdCounter = 1;

/**
 * Pausing the scheduler is useful for debugging.
 */
let isSchedulerPaused = false;

let currentTask: Schedule.INode | null = null;
let currentPriorityLevel = NormalPriority;

// This is set while performing work, to prevent re-entrance.
let isPerformingWork = false;

let isHostCallbackScheduled = false;
let isHostTimeoutScheduled = false;

// 缓存api
const localSetTimeout =
  typeof setTimeout === 'function'
    ? setTimeout
    : null;
const lcoalClearTimeout =
  typeof clearTimeout === 'function'
    ? clearTimeout
    : null;
// ie and node + jsdom
const localSetImmediate =
  typeof setImmediate !== 'undefined'
    ? setImmediate
    : null

const localNavigator: any = navigator;
const isInputPending =
  typeof navigator !== 'undefined' &&
    localNavigator.scheduling !== undefined &&
    localNavigator.scheduling.isInputPending !== undefined
    ? localNavigator.scheduling.isInputPending.bind(localNavigator.scheduling)
    : null

const continuousOptions = {
  includeContinuous: enableIsInputPendingContinuous
}

function advanceTimers(_currentTime: number) {
  let timer = peek(timerQueue);

  while (timer !== null) {
    if (timer.callback === null) {
      pop(timerQueue);
    } else if (timer.startTime <= _currentTime) {
      pop(timerQueue);
      timer.sortIndex = timer.expirationTime;
      push(taskQueue, timer);
      if (enableProfiling) {
        markTaskStart(timer, _currentTime);
      }
    } else {
      return;
    }
    timer = peek(timerQueue)
  }
}

function hadnleTimeout(_currentTime: number) {
  isHostTimeoutScheduled = false;
  advanceTimers(_currentTime);

  if (!isHostCallbackScheduled) {
    if (peek(taskQueue) !== null) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork)
    } else {
      const firstTimer = peek(timerQueue);
      if (firstTimer !== null) {
        requestHostTimeout(hadnleTimeout, firstTimer.startTime - _currentTime)
      }
    }
  }
}

function flushWork(hasTimeRemaining: number, initialTime: number) {
  if (enableProfiling) {
    markSchedulerUnSuspended(initialTime);
  }

  isHostCallbackScheduled = false;
  if (isHostTimeoutScheduled) {
    isHostTimeoutScheduled = false;
    cancelHostTimeout();
  }

  isPerformingWork = true;
  const previousPriorityLevel = currentPriorityLevel;

  try {
    if (enableProfiling) {
      try {
        return workLoop(hasTimeRemaining, initialTime);
      } catch (error) {
        if (currentTask !== null) {
          const currentTime = getCurrentTime();
          markTaskErrored(currentTask, currentTime);
        }
        throw error;
      }
    } else {
      return workLoop(hasTimeRemaining, initialTime);
    }
  } finally {
    currentTask = null;
    currentPriorityLevel = previousPriorityLevel;
    isPerformingWork = false;
    if (enableProfiling) {
      const currentTime = getCurrentTime();
      markSchedulerSuspended(currentTime);
    }
  }
}

function workLoop(hasTimeRemaining: number, initialTime: number) {
  let currentTime = initialTime;
  advanceTimers(currentTime);
  currentTask = peek(taskQueue);

  while(
    currentTask !== null &&
    !(enableSchedulerDebugging && isSchedulerPaused)
  ) {
    if (
      currentTask.expirationTime > currentTime &&
      (!hasTimeRemaining || shouldYieldToHost())
    ) {
      break;
    }

    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      currentTask.callback = null;
    }
  }
}

function requestHostCallback(fn: any) {

}

function requestHostTimeout(fn: any, time: number) { }

function cancelHostTimeout() {}