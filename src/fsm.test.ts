import { FSM, FSMState, FSMMessage } from 'src/fsm'
import { FSMCommon } from 'src/fsm.common';

/////////////////////////////
// States
/////////////////////////////

type Idle = {
  type: 'idle'
}
const Idle: Idle = { type: 'idle' }

type Playing = {
  type: 'playing'
  currentTime: number
}
const Playing = (currentTime: number): Playing => ({
  type: 'playing', currentTime
})

type Paused = {
  type: 'paused'
  currentTime: number
}
const Paused = (currentTime: number): Paused => ({
  type: 'paused', currentTime
})

type VideoPlayerState =
Idle | Playing | Paused

namespace VideoPlayerState {
  export function isIdle(s: VideoPlayerState): s is Idle {
    return s.type === 'idle';
  }

  export function isPaused(s: VideoPlayerState): s is Paused {
    return s.type === 'paused';
  }

  export function isPlaying(s: VideoPlayerState): s is Playing {
    return s.type === 'playing';
  }
}

// FSM States
const state = FSMState<VideoPlayerState>();

const idle = state.create(VideoPlayerState.isIdle);
const paused = state.create(VideoPlayerState.isPaused);
const playing = state.create(VideoPlayerState.isPlaying);

/////////////////////////////
// Messages
/////////////////////////////

type Play = {}
type Stop = {}
type Pause = {}
type Seek = {
  time: number
}

const play = FSMMessage.create<Play>();
const stop = FSMMessage.create<Stop>();
const pause = FSMMessage.create<Pause>();
const seek = FSMMessage.create<Seek>();


/////////////////////////////
// State machine base
/////////////////////////////

const videoPlayerSkeleton = FSM<VideoPlayerState>()
  .states({ idle, paused, playing })
  .withInitialState(() => Idle)
  .messages({ play, stop, pause, seek })


/// Test global

beforeEach(() => {
  jest.useFakeTimers();
})

test('Empty state machine', () => {
  const spyWarn = jest.spyOn(console, 'warn');

  const videoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: { transitions: {} },
      paused: { transitions: {} },
      playing: { transitions: {} }
    })

  const instance = videoPlayerDescription.create({});

  expect(instance.value()).toEqual(Idle)

  instance.send.play({});
  expect(spyWarn).toHaveBeenCalledWith(FSMCommon.noTransition('idle', 'play'))
})

test('First state lifecycle', () => {
  const hook = {
    enter: jest.fn(),
    update: jest.fn(),
    exit: jest.fn()
  }

  const videoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: {
        lifecycle: (self) => {
          hook.enter();
          return {
            onUpdate: hook.update,
            onExit: hook.exit
          }
        },
        transitions: {
          pause: () => Idle,
          play: () => Playing(0)
        }
      },
      paused: { transitions: {} },
      playing: { transitions: {} }
    })

  expect(hook.enter).toHaveBeenCalledTimes(0);
  expect(hook.update).toHaveBeenCalledTimes(0);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  const instance = videoPlayerDescription.create({});
  expect(hook.enter).toHaveBeenCalledTimes(1);

  instance.send.pause({})
  expect(hook.update).toHaveBeenCalledTimes(1);
  instance.send.pause({})
  expect(hook.update).toHaveBeenCalledTimes(2);

  instance.send.play({})
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(2);
  expect(hook.exit).toHaveBeenCalledTimes(1);
})

test('Second state lifecycle', () => {
  const hook = {
    enter: jest.fn(),
    update: jest.fn(),
    exit: jest.fn()
  }

  const videoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: {
        transitions: {
          play: () => Playing(0)
        }
      },
      paused: { transitions: {} },
      playing: {
        lifecycle: (self) => {
          hook.enter();
          return {
            onUpdate: hook.update,
            onExit: hook.exit
          }
        },
        transitions: {
          play: () => Playing(0),
          pause: () => Paused(0)
        }
      }
    })

  expect(hook.enter).toHaveBeenCalledTimes(0);
  expect(hook.update).toHaveBeenCalledTimes(0);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  const instance = videoPlayerDescription.create({});
  expect(hook.enter).toHaveBeenCalledTimes(0);
  expect(hook.update).toHaveBeenCalledTimes(0);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  instance.send.play({})
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(0);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  instance.send.play({})
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(1);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  instance.send.play({})
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(2);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  instance.send.pause({})
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(2);
  expect(hook.exit).toHaveBeenCalledTimes(1);
})

test('Same lifecycle repetition', () => {
  const hook = {
    enter: jest.fn(),
    update: jest.fn(),
    exit: jest.fn()
  }

  const videoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: {
        transitions: {
          play: () => Playing(0)
        }
      },
      paused: { transitions: {} },
      playing: {
        lifecycle: (self) => {
          hook.enter();
          return {
            onUpdate: hook.update,
            onExit: hook.exit
          }
        },
        transitions: {
          play: () => Playing(0),
          stop: () => Idle
        }
      }
    })

  const instance = videoPlayerDescription.create({});
  expect(hook.enter).toHaveBeenCalledTimes(0);
  expect(hook.update).toHaveBeenCalledTimes(0);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  instance.send.play({})
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(0);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  instance.send.play({})
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(1);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  instance.send.play({})
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(2);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  instance.send.stop({})
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(2);
  expect(hook.exit).toHaveBeenCalledTimes(1);

  instance.send.play({})
  expect(hook.enter).toHaveBeenCalledTimes(2);
  expect(hook.update).toHaveBeenCalledTimes(2);
  expect(hook.exit).toHaveBeenCalledTimes(1);

  instance.send.play({})
  expect(hook.enter).toHaveBeenCalledTimes(2);
  expect(hook.update).toHaveBeenCalledTimes(3);
  expect(hook.exit).toHaveBeenCalledTimes(1);

  instance.send.stop({})
  expect(hook.enter).toHaveBeenCalledTimes(2);
  expect(hook.update).toHaveBeenCalledTimes(3);
  expect(hook.exit).toHaveBeenCalledTimes(2);
})

test('Enter lifecycle hook should not be retriggered', () => {
  const hook = {
    enter: jest.fn(),
    update: jest.fn(),
    exit: jest.fn()
  }

  const videoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: {
        lifecycle: () => {
          hook.enter();
          return {};
        },
        transitions: {
          stop: () => Idle
        }
      },
      paused: { transitions: {} },
      playing: { transitions: {} }
    })

  const instance = videoPlayerDescription.create({});
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(0);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  instance.send.stop({})
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(0);
  expect(hook.exit).toHaveBeenCalledTimes(0);

  instance.send.stop({})
  expect(hook.enter).toHaveBeenCalledTimes(1);
  expect(hook.update).toHaveBeenCalledTimes(0);
  expect(hook.exit).toHaveBeenCalledTimes(0);
})

test('Asynchronous message leading to state change', () => {
  const waitTime = 500 //ms

  const autoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: {
        lifecycle: (self) => {
          setTimeout(() => self.send.play({}), waitTime)
          return {}
        },
        transitions: {
          pause: () => Idle,
          play: (self) => Playing(0)
        }
      },
      paused: { transitions: {} },
      playing: { transitions: {} }
    })

  const instance = autoPlayerDescription.create({})
  expect(instance.value()).toEqual(Idle)

  jest.advanceTimersByTime(waitTime - 50)
  expect(instance.value()).toEqual(Idle)
  jest.advanceTimersByTime(50);
  expect(instance.value()).toEqual(Playing(0))

})

test('Infinite asynchronous messages', () => {
  const videoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: {
        transitions: {
          pause: () => Idle,
          play: () => Playing(0)
        }
      },
      paused: {
        transitions: {}
      },
      playing: {
        lifecycle: (self, state) => {
          let time = state.currentTime;

          const handle = setInterval(() => {
            self.send.seek({ time: (++time) })
          }, 1000)

          return {
            onExit: () => { clearInterval(handle) }
          }
        },
        transitions: {
          seek: (_, _state, message) => Playing(message.time),
          pause: (_, state) => Paused(state.currentTime),
          stop: () => Idle
        }
      }
    })

  const instance = videoPlayerDescription.create({})

  instance.send.play({})
  expect(VideoPlayerState.isPlaying(instance.value()))
  let state = instance.value() as Playing
  expect(state.currentTime).toEqual(0)

  jest.advanceTimersByTime(1000)
  state = instance.value() as Playing
  expect(state.currentTime).toEqual(1)

  jest.advanceTimersByTime(1000)
  state = instance.value() as Playing
  expect(state.currentTime).toEqual(2)

  instance.send.stop({})

  jest.advanceTimersByTime(10000)
  instance.send.play({})
  state = instance.value() as Playing
  expect(state.currentTime).toEqual(0)
})

test('Wildcard transition', () => {
  const idleUpdate = jest.fn();
  const wildcard = jest.fn();

  const videoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: {
        lifecycle: () => {
          return {
            onUpdate: idleUpdate
          }
        },
        transitions: {
          stop: () => Idle,
          _: () => {
            wildcard();
            return Idle
          }
        }
      },
      paused: { transitions: {} },
      playing: { transitions: {} }
    })

  const instance = videoPlayerDescription.create({});

  expect(instance.value()).toEqual(Idle)

  expect(idleUpdate).toHaveBeenCalledTimes(0);
  expect(wildcard).toHaveBeenCalledTimes(0);

  instance.send.stop({});
  expect(idleUpdate).toHaveBeenCalledTimes(1);
  expect(wildcard).toHaveBeenCalledTimes(0);

  instance.send.play({});
  expect(idleUpdate).toHaveBeenCalledTimes(2);
  expect(wildcard).toHaveBeenCalledTimes(1);

  instance.send.play({});
  expect(idleUpdate).toHaveBeenCalledTimes(3);
  expect(wildcard).toHaveBeenCalledTimes(2);

  instance.send.stop({});
  expect(idleUpdate).toHaveBeenCalledTimes(4);
  expect(wildcard).toHaveBeenCalledTimes(2);
})

test('State as observable', () => {

  class DummySubject <T> {
    private _value: T | undefined

    next(value: T): void {
      this._value = value;
    }

    currentValue(): T | undefined {
      return this._value;
    }
  }

  const videoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: {
        transitions: {
          play: () => Playing(0),
        }
      },
      paused: { transitions: {} },
      playing: {
        transitions: {
          stop: () => Idle
        }
      }
    })
    .observable(observer => {
      const subject = new DummySubject<VideoPlayerState>();
      observer.onValue(value => { subject.next(value) })
      return subject;
    })

  const instance = videoPlayerDescription.create({});
  const secondInstance = videoPlayerDescription.create({});
  expect(instance.asObservable.currentValue()).toEqual(Idle)
  expect(secondInstance.asObservable.currentValue()).toEqual(Idle)

  instance.send.play({})
  expect(instance.asObservable.currentValue()).toEqual(Playing(0))
  expect(secondInstance.asObservable.currentValue()).toEqual(Idle)

  secondInstance.send.play({})
  expect(instance.asObservable.currentValue()).toEqual(Playing(0))
  expect(secondInstance.asObservable.currentValue()).toEqual(Playing(0))

  instance.send.stop({})
  expect(instance.asObservable.currentValue()).toEqual(Idle)
  expect(secondInstance.asObservable.currentValue()).toEqual(Playing(0))
})

test('State getter asynchronously', () => {
  const videoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: {
        lifecycle: (self, enterState, state) => {
          expect(enterState).toEqual(Idle)
          expect(state()).toEqual(Idle)

          // Transition to 'Playing' in 1 second
          setTimeout(() => {
            self.send.play({})
          }, 1000)

          // Check that we can still access the most recent state in 5 seconds
          setTimeout(() => {
            expect(enterState).toEqual(Idle)
            expect(state()).toEqual(Playing(0))
          }, 5000)

          // Timeout not cleaned up on purpose
          return {}
        },
        transitions: {
          play: () => Playing(0)
        }
      },
      paused: { transitions: {} },
      playing: { transitions: {} }
    })

  const instance = videoPlayerDescription.create({});
  expect(instance.value()).toEqual(Idle)

  jest.advanceTimersByTime(1000)
  expect(instance.value()).toEqual(Playing(0))

  jest.advanceTimersByTime(4000)
  expect(instance.value()).toEqual(Playing(0))
})