# Typed-FSM

A small well-typed finite state machine library for TypeScript

* **Type safety:** Never have to rely on unchecked strings to identify your states or dispatch your messages
* **Type inference:** Specifying input types when defining behaviors is optional as they are inferred for you
* **Auto-completion:** Sending messages to a state machine is done in OO style : no need to create / import any message factory if your messages are simple

## Example

Description and usage of a stop light.
States and messages declarations have been left out for brevity.

```typescript
import FSM from 'typed-fsm'

import { StopLight, red, orange, green } from 'src/stoplight/states'
import { next } from 'src/stoplight/messages'

const stopLightDescription = FSM<StopLight>()
  .states({ red, orange, green })
  .withInitialState(() => StopLight.Red)
  .messages({ next })
  .behaviors({
    red: {
      handling: { next: () => StopLight.Orange }
    },
    orange: {
      handling: { next: () => StopLight.Green }
    },
    green: {
      handling: { next: () => StopLight.Red }
    },
  })

const stopLight = stopLightDescription.create({})
turnstile.value()
// { type: 'red' }

stopLight.send.next({})
stopLight.value()
// { type: 'orange' }

stopLight.send.next({})
stopLight.value()
// { type: 'green' }
```

## Installation

You can use Typed-FSM as a a npm module :


```bash
npm install --save-exact typed-fsm
```

## API

### Factories

- [`FSMState`](#fsmstatefactory)
- [`FSMMessage`](#fsmmessage)
- [`FSM`](#fsm)

### Behavior

- [`lifecycle`](#lifecycle)
- [`message handlers`](#messagehandlers)

### FSM Instance

- [`self`](#self)

## Overview

Typed-FSM allows you to describe a finite state machine : an entity that goes
through several [states](#states) that react to a set of [messages](messages).

You can think of a FSM as a union of classes where every method call has the ability to make a state change.  

When compared to a regular class, Typed FSM provides you with :
- Sum type state : Expressing the fact that your object goes through different
states is easy, and the type discrimination boilerplate is Only paid once (see [FSM State creation](#fsmstatefactory))
- Immutable state : A state change is just a new object returned at the end of a message handler, like Redux.
- Scoped message handling : Defining a message handler is just like defining a method in a class, except that you also specify the particular state for which that method applies to. Messages not handled are simply ignored by default.


#### States

A finite state machine contains internal state that changes in reaction to the receipt of messages.  
Different states of that machine are described with their own respective type.  
States can be plain objects that may or may not contain common data, but there must always be a way to tell them appart from one another with a type guard.  
For state creation, see [FSMState factory](#fsmstatefactory).

#### Messages

Messages are signals sent to the state machine. Those signals may, but do not have to, contain data.  
Different states are allowed to handle the same kind of messages (but at runtime, a received message is only processed once by the current state of the FSM).  
For message creation, see [FSMMessage factory](#fsmmessage).  
For sending a message to a FSM, see [Self.send](#self).

#### Behaviors

The [behavior map](#fsmbuilder4) declared during the FSM construction maps every state declared earlier to a behavior.  
A behavior describes the way a state reacts to messages. It consists in :
 - A set of 0, 1, or more message handlers (the maximum being the amount of messages)
 - lifecycle methods that allows the execution of side-effects when a state is entered or exited.

See the [Behavior API](#behavior)


### Factories

#### <a name="fsmstate"></a> `FSMState<State>()`

Creates a state factory where all states must be subtypes of `State`.  
Actual FSM states are then instanciated from said factory with the method `create`.

*Returns: FSMStateFactory*

- - -

#### <a name="fsmstatefactory"></a> `[FSMStateFactory].create<S>(is: State is S)`

*Arguments:*

 - `is: State is S` A type guard to discriminate an instance of `S` among objects of type `State`

Creates a uniquely identified state description for the type `S` in a state machine.

*Returns: FSMState*

```typescript
import { FSMState } from 'typed-fsm'

// States should have a common super-type
export type StopLight = Green | Orange | Red
type Green = { type: 'green' }
type Orange = { type: 'orange' }
type Red = { type: 'red' }

function isGreen(s: StopLight): s is Green { return s.type === 'green' }
function isOrange(s: StopLight): s is Orange { return s.type === 'orange' }
function isRed(s: StopLight): s is Red { return s.type === 'red' }

const factory = FSMState<StopLight>()

export const states = {
  green: factory.create(isGreen),
  orange: factory.create(isOrange),
  red: factory.create(isRed),
}
```

- - -


#### <a id="fsmmessage"></a> `FSMMessage.create<MESSAGE>()`

Creates a uniquely identified message description for all messages of type `T` in a state machine.

```typescript
// Unlike states, messages do not have to have a common super-type
type Next = ...
type GoRed = ...

export const messages = {
  next: FSMMessage.create<Next>
  goRed: FSMMessage.create<GoRed>
}
```

*Returns: FSMMessage*

#### <a id="fsm"></a> `FSM<State>()`

Starts a builder for a FSM where all states must be sub-types of `State`

*Returns: FSMBuilder1*


#### <a id="fsmbuilder1"></a> `[FSMBuilder1].states(stateMap: Record<string, FSMState>)`

*Arguments:*

 - `stateMap: Record<string, FSMState>` A map from string identifiers to FSM states.

Declare all the possible states with their names for the current FSM.  
The same state names declared here are re-used and enforced for behavior definition later (see [Behaviors builder](#fsmbuilder4))


*Returns: FSMBuilder2*


#### <a id="fsmbuilder2"></a> `[FSMBuilder2].withInitialState<Input>(factory: Input => State)`

*Arguments:*

 - `factory: Input => State` A map from string identifiers to FSM states.

Defines the initial state from which every instance of the FSM will start.  
Provides the ability of injecting values with the arbitrary type `Input` 
to construct the initial state if necessary.


*Returns: FSMBuilder3*

- - -

#### <a id="fsmbuilder3"></a> `[FSMBuilder3].messages(messageMap: Record<string, FSMMessage>)`

*Arguments:*

 - `messageMap: Record<string, FSMMessage>` A map from string identifiers to FSM messages.

Declare all the possible messages (or actions) with their names for the current FSM.  
Message names from the map are re-used later during behavior definition to help inference when defining message handlers.


*Returns: FSMBuilder4*

- - -

#### <a id="fsmbuilder4"></a> `[FSMBuilder4].behaviors(behaviors: Record<string, Behavior>)`

*Arguments:*

 - `behaviors: Record<string, Behavior>` A map from state names to behaviors for the associated state.

Declare the [behavior](#behaviors) for the FSM states.
Even if empty, behaviors must be defined at compile-time for all FSM states declared in the builder.

*Returns: FSMDescription*

```typescript
import FSM from 'typed-fsm'

import { StopLight, red, orange, green } from 'src/stoplight/states'
import { next } from 'src/stoplight/messages'

const stopLightDescription = FSM<StopLight>()
  .states({ red, orange, green })
  .withInitialState(() => ({ type: 'red' }))
  .messages({ next })
  .behaviors({
    red: {
      handling: { next: () => ({ type: 'orange' }) }
    },
    orange: {
      handling: { next: () => ({ type: 'green' }) }
    },
    green: {
      handling: { next: () => ({ type: 'red' }) }
    },
  })
```

- - -

#### <a id="FSMCreate"></a> `[FSMDescription].create(input: I)`

*Arguments:*

 - `input: I` An input which type is inferred from the declaration of [withInitialState](#fsmbuilder2)

Spawn an instance of a state machine from the current description in its initial state.  
Instances created from the same description are separate independant state machines that share no data.

*Returns: FSMInstance / Self*

- - -

### Behavior

Behaviors must be defined for every state declared in the state machine.  
A behavior :
 - must contain a list of message handlers
 - can contain lifecycle methods

```typescript
type Behavior = {
  onEnter?: Lifecycle
  handling: Message Handlers
}
```


#### <a id="lifecycle"></a> `Lifecycle`

```typescript
onEnter?: (self: Self, currentState: State) =>
  | {
    onUpdate?: (previousState: State, nextState: State) => void,
    onExit?: (currentState: State) => void
  }
  | void
```

During behavior definition, lifecycle functions are declared per-state.  
The entry point to define lifecycle behavior is the function `onEnter` (even if you're only interested in triggering something on state exit).  
This allows functions like `onUpdate` or `onExit` to close over values that `onEnter` defined, facilitating cleanup.


- - -

#### <a id="messagehandlers"></a> `Message Handlers`

```typescript
handling: {

  [messageName in Message]?: (
    self: Self,
    currentState: State,
    message: Message
  ) => State,

  '_'?: (
    self: Self,
    currentState: State,
    unhandledMessage: Message
  ) => State
}
```

Every state must define the messages that it can handle.  
A state can handle `0` to `m` messages, `m` being the number of messages declared earlier.  
Message names used during the [message declaration](#fsmbuilder4) must be re-used here, otherwise your code will not typecheck.  
The order of message handlers does not matter.

A wildcard handler called `_` can optionally be defined to handle all messages that are not explicitly handled for the current state.

- - -

### FSM Instance

#### <a id="self"></a>`Self`

```typescript
self: {
  value: () => State,
  send: {
    [messageName in Message]: (messagePayload: MessagePayload) => void
  }
}
```

`Self` references one instance of a state machine.  
It allows :
  - Retrieving the current underlying value in the state machine at the time `.value()` is called
  - Sending messages with a call to `.send`

##### `[Self].value()`

*Returns: The underlying immutable value of the state machine at the current time*


##### `[Self].send`

*Returns: A map of functions (one per type of message declared in the FSM) from `MessagePayload` to `void` where the type `MessagePayload` depends on the message name used.*

- - -

### Advanced examples

#### Modeling an HTTP Request
```typescript
import { FSM } from 'typed-fsm'
import { NetworkRequest, idle, loading, success, requestError } from './networkRequest.states'
import { start, progress, complete, fail, timeout } from './networkRequest.messages'

const requestDescription = FSM<NetworkRequest<I, O>>()
  .states({ idle, loading, success, requestError })
  .withInitialState((input: { verb: string, url: string, timeout: number }) => Idle(input))
  .messages({ start, progress, complete, fail, timeout })
  .behaviors({
      idle: {
        handling: {
            start: (_self, state) => {
              const { verb, url } = state
              const xhr = new XmlHttpRequest()
              xhr.open(verb, url)
              xhr.send()
              return Loading({
                xhr,
                params: state.params,
                timeout: state.timeout,
                progress: 0
              })
            }
        }
      },
      loading: {
        // 'onEnter' is called whenever we transition from another state to this one
        onEnter: (self, state) => {
          const xhr = state.xhr
          xhr.onprogress = (event) => {
            // Let's pretend the total size is always known and > 0
            const { loaded, total } = event
            // send ourselves a message to trigger a transition
            self.send.progress({ loaded, total })
          }

          // Set a request timeout
          const timeout = window.setTimeout(() => {
            xhr.abort()
            self.send.timeout({})
          }, state.timeout)

          return {
            onExit: () => window.clearTimeout(timeout)
          }
        },
        handling: {
            progress: (self, state, message) =>
              NetworkRequestState.Progress({
                loaded: message.loaded,
                total: message.total
              }),

            timeout: () =>
              NetworkRequestState.Error('Request timed out')

            fail: (self, state, message) =>
              NetworkRequestState.Error(message.error),

            complete: (self, state, message) =>
              NetworkRequestState.Success(message.result),

            // '_' is the wildcard transition name
            _: (_self, state, message) => {
              console.error('Unsupported transition', { state, message })
              return state
            }
        }
      },
      success: { handling: {} },
      error:   { handling: {} }
  })

const requestInstance = requestDescription.create({ verb: 'GET', url: 'http://...' })

// Send a 'start' message to that specific instance
requestInstance.send.start({})
```

### License

Licensed under the [MIT](LICENSE.txt) License.
