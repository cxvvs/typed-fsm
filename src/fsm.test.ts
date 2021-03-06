import { FSM, FSMState, FSMMessage } from 'src/fsm'

function noTransition(state: string, message: string) {
  return `No transition encoded for (${state}, ${message}), message ignored`;
}

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
const idle = FSMState(VideoPlayerState.isIdle);
const paused = FSMState(VideoPlayerState.isPaused);
const playing = FSMState(VideoPlayerState.isPlaying);

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
      idle: { handling: {} },
      paused: { handling: {} },
      playing: { handling: {} }
    })

  const instance = videoPlayerDescription.create({});

  expect(instance.value()).toEqual(Idle)

  instance.send.play({});
  expect(spyWarn).toHaveBeenCalledWith(noTransition('idle', 'play'))
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
        onEnter: (self) => {
          hook.enter();
          return {
            onUpdate: hook.update,
            onExit: hook.exit
          }
        },
        handling: {
          pause: () => Idle,
          play: () => Playing(0)
        }
      },
      paused: { handling: {} },
      playing: { handling: {} }
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

test('Support void lifecycle', () => {
  const hook = {
    enter: jest.fn(),
  }

  const videoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: {
        onEnter: (self) => {
          hook.enter();
        },
        handling: {
          pause: () => Idle,
          play: () => Playing(0)
        }
      },
      paused: { handling: {} },
      playing: { handling: {} }
    })

  expect(hook.enter).toHaveBeenCalledTimes(0);

  const instance = videoPlayerDescription.create({});
  expect(hook.enter).toHaveBeenCalledTimes(1);
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
        handling: {
          play: () => Playing(0)
        }
      },
      paused: { handling: {} },
      playing: {
        onEnter: (self) => {
          hook.enter();
          return {
            onUpdate: hook.update,
            onExit: hook.exit
          }
        },
        handling: {
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
        handling: {
          play: () => Playing(0)
        }
      },
      paused: { handling: {} },
      playing: {
        onEnter: (self) => {
          hook.enter();
          return {
            onUpdate: hook.update,
            onExit: hook.exit
          }
        },
        handling: {
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
        onEnter: () => {
          hook.enter();
          return {};
        },
        handling: {
          stop: () => Idle
        }
      },
      paused: { handling: {} },
      playing: { handling: {} }
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
        onEnter: (self) => {
          setTimeout(() => self.send.play({}), waitTime)
          return {}
        },
        handling: {
          pause: () => Idle,
          play: (self) => Playing(0)
        }
      },
      paused: { handling: {} },
      playing: { handling: {} }
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
        handling: {
          pause: () => Idle,
          play: () => Playing(0)
        }
      },
      paused: {
        handling: {}
      },
      playing: {
        onEnter: (self, state) => {
          let time = state.currentTime;

          const handle = setInterval(() => {
            self.send.seek({ time: (++time) })
          }, 1000)

          return {
            onExit: () => { clearInterval(handle) }
          }
        },
        handling: {
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
        onEnter: () => {
          return {
            onUpdate: idleUpdate
          }
        },
        handling: {
          stop: () => Idle,
          _: () => {
            wildcard();
            return Idle
          }
        }
      },
      paused: { handling: {} },
      playing: { handling: {} }
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
        handling: {
          play: () => Playing(0),
        }
      },
      paused: { handling: {} },
      playing: {
        handling: {
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
        onEnter: (self, enterState) => {
          expect(enterState).toEqual(Idle)
          expect(self.value()).toEqual(Idle)

          // Transition to 'Playing' in 1 second
          setTimeout(() => {
            self.send.play({})
          }, 1000)

          // Check that we can still access the most recent state in 5 seconds
          setTimeout(() => {
            expect(enterState).toEqual(Idle)
            expect(self.value()).toEqual(Playing(0))
          }, 5000)

          // Timeout not cleaned up on purpose
          return {}
        },
        handling: {
          play: () => Playing(0)
        }
      },
      paused: { handling: {} },
      playing: { handling: {} }
    })

  const instance = videoPlayerDescription.create({});
  expect(instance.value()).toEqual(Idle)

  jest.advanceTimersByTime(1000)
  expect(instance.value()).toEqual(Playing(0))

  jest.advanceTimersByTime(4000)
  expect(instance.value()).toEqual(Playing(0))
})

test('Message sent during lifecycle enter should be processed at the end of lifecycle method', () => {
  const hook = {
    idleEnter: jest.fn(),
    idleEnterCompleted: jest.fn(),
    playingEnter: jest.fn()
  }

  const videoPlayerDescription = videoPlayerSkeleton
    .behaviors({
      idle: {
        onEnter: (self, enterState) => {
          hook.idleEnter();
          expect(hook.idleEnter).toHaveBeenCalledTimes(1);
          expect(hook.idleEnterCompleted).toHaveBeenCalledTimes(0);
          expect(hook.playingEnter).toHaveBeenCalledTimes(0);

          self.send.play({})

          hook.idleEnterCompleted();
          expect(hook.idleEnter).toHaveBeenCalledTimes(1);
          expect(hook.idleEnterCompleted).toHaveBeenCalledTimes(1);
          expect(hook.playingEnter).toHaveBeenCalledTimes(0);
          return {}
        },
        handling: {
          play: () => Playing(0)
        }
      },
      paused: {
        onEnter:  () => {
          hook.playingEnter();
          expect(hook.idleEnter).toHaveBeenCalledTimes(1);
          expect(hook.idleEnterCompleted).toHaveBeenCalledTimes(1);
          expect(hook.playingEnter).toHaveBeenCalledTimes(1);
          return {};
        },
        handling: {}
      },
      playing: { handling: {} }
    })

  const instance = videoPlayerDescription.create({});
  expect(instance.value()).toEqual(Playing(0))
})