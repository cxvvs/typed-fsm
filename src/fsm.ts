//////////////////
/// STATES
/////////////////

type FSMState<PARENT, STATE extends PARENT> = {
  // Unique way to identify an object of type `STATE`
  is: (state: PARENT) => state is STATE
  T: STATE;
}

/**
 * Creates a state factory where all states must be subtypes of a specific type
 *
 * @param PARENT The upper-bound type for all the possible state
 * @returns A state factory
 */
export function FSMState<PARENT, STATE extends PARENT>(
  is: (state: PARENT) => state is STATE
): FSMState<PARENT, STATE> {
  return {
    is,
    T: (undefined as any as STATE)
  }
}

//////////////////
/// MESSAGES
/////////////////

type FSMMessage<T> = {
  (value: T): MessageInstance<T>
  _T: T
}

type _InternalMessage<T> = FSMMessage<T> & {
  _id: MessageId
}

type MessageId = number;

type MessageInstance<T> = {
  value: T
}

type _InternalMessageInstance<T> = MessageInstance<T> & {
  _id: MessageId;
}

let messageId = 1;

export namespace FSMMessage {
  /**
   * Creates a uniquely identified message description for all messages of type `T` in a state machine
   *
   * @param T Type for the message content. Does not need any specific constraint or discriminator field.
   * @returns A message identifier
   */
  export function create<T>(): FSMMessage<T> {
    const _id = messageId++;

    const message: (t: T) => _InternalMessageInstance<T> =
      (value: T) => ({ _id, value });

    (message as any)._id = _id;

    return message as any as FSMMessage<T>;
  }
}

/**
 * Self is an object that is always attached to a specific FSM instance and allows :
 *  - sending messages to said instance
 *  - retrieving the current state of that instance (e.g after a promise completion)
 */
export type Self<
  SM extends StateMap<any>,
  MM extends MessageMap
> = {
  value: () => SM[keyof SM]['T']
  send: {
    [K in keyof MM]: (message: MM[K]['_T']) => void
  }
}

/**
 * A lifecycle is a function executed for every transition
 * (ALLSTATES ∪ {}) - STATE -> STATE
 *
 * It must return a function that optionally defines :
 *  - onUpdate : a function executed for the transitions STATE -> STATE
 *  - onExit : a function executed for the transitions STATE -> ALLSTATES - STATE
 */
type Lifecycle<
  SM extends StateMap<any>,
  STATE extends keyof SM,
  MM extends MessageMap
> = (
  self: Self<SM, MM>,
  entryState: SM[STATE]['T']
) => Hooks<SM[STATE]['T']> | void

type StateMap<STATE> =
  // Last type is always guaranteed to be a sub-type of `STATE` by construction
  Record<string, FSMState<STATE, any>>

type MessageMap =
  Record<string, FSMMessage<any>>

type Hooks<CURRENTSTATE> = {
  onUpdate?: (
    previous: CURRENTSTATE,
    current: CURRENTSTATE
  ) => void,
  onExit?: (state: CURRENTSTATE) => void
}

type MessageHandlers<
  SM extends StateMap<any>,
  CURRENTSTATE extends keyof SM,
  MM extends MessageMap
> = {
  [M in keyof MM]?: (
    self: Self<SM, MM>,
    currentState: (SM[CURRENTSTATE]['T']),
    message: MM[M]['_T']
  ) => SM[keyof SM]['T']
}

type WildcardHandler<
  SM extends StateMap<any>,
  CURRENTSTATE extends keyof SM,
  MM extends MessageMap
> = {
  '_'?: (
    self: Self<SM, MM>,
    currentState: (SM[CURRENTSTATE]['T']),
    message: MM[keyof MM]['_T']
  ) => SM[keyof SM]['T']
}

function noTransition(state: string, message: string) {
  return `No transition encoded for (${state}, ${message}), message ignored`;
}

type BehaviorMap<
  SM extends StateMap<any>,
  MM extends MessageMap
  > = {
    [S in keyof SM]: {
      onEnter?: Lifecycle<SM, S, MM>
      handling: MessageHandlers<SM, S, MM> & WildcardHandler<SM, S, MM>
    }
  }

interface Subscription {
  unsubscribe(): void
}

type Callback<T> = (t: T) => void
interface Observer<T> {
  onValue: (cb: Callback<T>) => Subscription
}

type ObservableHook <STATE, HOOKRESULT> =
  (observer: Observer<STATE>) => HOOKRESULT

export function FSM<STATES>(): FSMTyped<STATES> {
  return new FSMTyped<STATES>();
}

class FSMTyped<STATES> {
  states <SM extends StateMap<STATES>>(
    states: SM
  ): FSMWithStates<STATES, SM> {
    return new FSMWithStates(states);
  }
}

class FSMWithStates<
  STATES,
  SM extends StateMap<STATES>,
  > {
  constructor(
    private readonly states: SM
  ) {}

  withInitialState <INITIAL> (
    factory: (initial: INITIAL) => SM[keyof SM]['T']
  ): FSMWithStatesInitialized<STATES, SM, INITIAL> {
    return new FSMWithStatesInitialized(this.states, factory);
  }
}

class FSMWithStatesInitialized<
  STATES,
  SM extends StateMap<STATES>,
  INITIAL
> {
  constructor(
    private states: SM,
    private factory: (input: INITIAL) => SM[keyof SM]['T']
  ) {}

  messages<MM extends MessageMap>(
    messages: MM
  ) {
    return new FSMMessagesInitialized<
      STATES,
      SM,
      INITIAL,
      MM
    >(this.states, this.factory, messages);
  }
}

class FSMMessagesInitialized<
  STATES,
  SM extends StateMap<STATES>,
  INITIAL,
  MM extends MessageMap
> {
  constructor(
    private states: SM,
    private factory: (input: INITIAL) => SM[keyof SM]['T'],
    private messages: MM
  ) {}

  behaviors(behaviors: BehaviorMap<SM, MM>) {
    return new FSMDescription<STATES, SM, INITIAL, MM>(
      this.states, this.factory, this.messages, behaviors
    );
  }
}

class FSMDescription<
  STATES,
  SM extends StateMap<STATES>,
  INITIAL,
  MM extends MessageMap
> {

  readonly create: (initial: INITIAL) => FSMInstance<SM[keyof SM]['T'], SM, MM>;

  readonly observable: <OBSERVABLERESULT> (
    hook: ObservableHook<STATES, OBSERVABLERESULT>
  ) => FSMDescriptionWithObservable<STATES, SM, INITIAL, MM, OBSERVABLERESULT>;

  constructor(
    private states: SM,
    private factory: (input: INITIAL) => SM[keyof SM]['T'],
    private messages: MM,
    private behaviors: BehaviorMap<SM, MM>
  ) {
    const stateKeys: string[] = Object.keys(states);

    const reverseMessageMap: Record<MessageId, string> = {};
    for (let messageName in messages) {
      const messageId: MessageId = (messages[messageName] as any as _InternalMessage<any>)._id
      reverseMessageMap[messageId] = messageName
    }

    function findStateKey<S extends STATES>(
      state: S
    ): string | undefined {
      for(let i = 0; i < stateKeys.length; i++) {
        const key = stateKeys[i]
        if (states[key].is(state)) {
          return key;
        }
      }
      return undefined
    }

    // Behavior<S> | undefined
    function findStateBehavior<S extends STATES>(state: S) {
      const stateKey = findStateKey(state)
      return stateKey !== undefined
        ? behaviors[stateKey]
        : undefined;
    }

    const dispatch =
        (stateSet: (state: STATES) => void, stateGet: () => STATES) =>
        (hookSet: (hooks: Hooks<STATES> | undefined) => void, hookGet: () => Hooks<STATES> | undefined): Self<SM, MM> => {
          const self: Self<SM, MM> = {} as Self<SM, MM>;

          const sendFactory = <T>(message: FSMMessage<T>) => (messagePayload: T) => {
            const state = stateGet();
            const stateKey = findStateKey(state)!

            const stateBehavior = findStateBehavior(state);
            if (stateBehavior === undefined) {
              console.error('No matching state', { state, message, messagePayload, states })
              throw new Error('Could not find any matching state definition, message ignored')
            }

            const internalMessage: _InternalMessage<any> = (message as any)
            const messageId: MessageId = internalMessage._id
            const messageKey = reverseMessageMap[messageId];

            if (messageKey === undefined) {
              console.error('No matching message', { message, messagePayload, messages })
              throw new Error('Could not find any matching state definition, message ignored')
            }

            const messageTransition =
              stateBehavior.handling[messageKey] ||
              stateBehavior.handling['_']

            if (messageTransition === undefined) {
              console.warn(noTransition(stateKey, messageKey))
              console.warn({ messageKey, state, messages })
              return
            }

            // Transition : produce a new state
            const newState = messageTransition(self, state, messagePayload)
            const newStateBehavior = findStateBehavior(newState);
            if (newStateBehavior === undefined) {
              console.error('No matching state', { newState, message, messagePayload, states })
              throw new Error('Could not find any matching state definition, message ignored')
            }

            // Update state with new reference
            stateSet(newState);

            const currentHooks = hookGet();
            const stillInSameState = newStateBehavior === stateBehavior;

            // Lifecycle : On update
            if (stillInSameState) {
              if(currentHooks !== undefined && currentHooks.onUpdate !== undefined) {
                currentHooks.onUpdate(state, newState)
              }
            }
            else {
              // Lifecycle : On exit previous state
              if (currentHooks !== undefined && currentHooks.onExit !== undefined) {
                currentHooks.onExit(state)
              }
              // Lifecycle : On enter new state
              if (newStateBehavior.onEnter !== undefined) {
                const newHook = newStateBehavior.onEnter(self, newState)
                hookSet(newHook || {})
              }
              // No lifecycle for the new state : reset the hooks
              else {
                hookSet(undefined)
              }
            }
          }

          const send: any = {};
          for (let messageKey in messages) {
            const messagePrototype: FSMMessage<any> = messages[messageKey];
            send[messageKey] = sendFactory(messagePrototype);
          }

          self.value = stateGet
          self.send = send

          return self;
        }

    this.create = (initial: INITIAL): FSMInstance<SM[keyof SM]['T'], SM, MM> => {
      const initialValue = this.factory(initial);

      return new FSMInstance<SM[keyof SM]['T'], SM, MM>(
        initialValue,
        dispatch,
        findStateBehavior
      );
    }

    this.observable = <OBSERVABLERESULT> (
      hook: ObservableHook<STATES, OBSERVABLERESULT>
    ): FSMDescriptionWithObservable<STATES, SM, INITIAL, MM, OBSERVABLERESULT> => {
      return new FSMDescriptionWithObservable(
        states, factory, messages, behaviors, dispatch, hook, findStateBehavior
      )
    }
  }

}

class FSMInstance<
  STATE,
  SM extends StateMap<STATE>,
  MM extends MessageMap
> implements Self<SM, MM> {

  readonly value: () => STATE;
  readonly send: Self<SM, MM>['send']

  private _value: STATE;
  private _hooks?: Hooks<STATE>;

  constructor(
    private initialValue: STATE,
    private dispatch:
      (stateSet: (state: STATE) => void, stateGet: () => STATE) =>
      (hookSet: (hooks: Hooks<STATE> | undefined) => void, hookGet: () => Hooks<STATE> | undefined) =>
      Self<SM, MM>,
    private findStateBehavior: (state: STATE) => any
  ) {
    this._value = initialValue;
    this.value = () => this._value;

    const dispatcher: Self<SM, MM> = dispatch
      ((newState) => this._value = newState, this.value)
      ((hooks) => this._hooks = hooks, () => this._hooks);

    this.send = dispatcher.send;

    // Lifecycle for the initial state state
    const initialBehavior = findStateBehavior(this._value);
    if (initialBehavior !== undefined && initialBehavior.onEnter !== undefined) {
      // call onEnter()
      const hooks: Hooks<STATE> = initialBehavior.onEnter(dispatcher, this._value, this.value);
      // Update hooks
      this._hooks = hooks;
    }
  }
}


class InternalObserver<T> implements Observer<T> {
  private followers: Record<string, Callback<T>>
  private cbId: number;

  onValue(callback: Callback<T>) {
    const callbackId = this.cbId++;
    this.followers[callbackId] = callback
    return {
      unsubscribe: () => { delete this.followers[callbackId] }
    }
  }

  next(t: T) {
    Object.keys(this.followers).forEach(cbId => this.followers[cbId](t))
  }

  constructor() {
    this.followers = {}
    this.cbId = 0;
  }
}

class FSMDescriptionWithObservable<
  STATE,
  SM extends StateMap<STATE>,
  INITIAL,
  MM extends MessageMap,
  OBSERVABLE
> {

  readonly create: (initial: INITIAL) => ObservableFSMInstance<SM[keyof SM]['T'], SM, MM, OBSERVABLE>;

  constructor(
    private states: SM,
    private factory: (input: INITIAL) => SM[keyof SM]['T'],
    private messages: MM,
    private behaviors: BehaviorMap<SM, MM>,
    private _dispatch:
      (stateSet: (state: STATE) => void, stateGet: () => STATE) =>
      (hookSet: (hooks: Hooks<STATE> | undefined) => void, hookGet: () => Hooks<STATE> | undefined) =>
      Self<SM, MM>,
    private observableHook: ObservableHook<STATE, OBSERVABLE>,
    private findStateBehavior: (state: STATE) => any
  ) {
    this.create = (initial: INITIAL): ObservableFSMInstance<SM[keyof SM]['T'], SM, MM, OBSERVABLE> => {

      const observer: InternalObserver<STATE> = new InternalObserver()
      const hookResult: OBSERVABLE = observableHook(observer)

      // Push the initial value manually `AFTER` the observableHook is created
      const initialValue = this.factory(initial);
      observer.next(initialValue)

      const dispatch = (stateSet: (state: STATE) => void, stateGet: () => STATE) => {
        const newStateSet = (state: STATE) => {
          stateSet(state)
          observer.next(state)
        }
        return _dispatch(newStateSet, stateGet)
      }

      return new ObservableFSMInstance<SM[keyof SM]['T'], SM, MM, OBSERVABLE>(
        initialValue,
        dispatch,
        hookResult,
        findStateBehavior
      );
    }
  }

}


class ObservableFSMInstance<STATE, SM extends StateMap<STATE>, MM extends MessageMap, OBSERVABLE>
  extends FSMInstance<STATE, SM, MM> {

  readonly asObservable: OBSERVABLE

  constructor(
    private _initialValue: STATE,
    private _dispatch:
      (stateSet: (state: STATE) => void, stateGet: () => STATE) =>
      (hookSet: (hooks: Hooks<STATE> | undefined) => void, hookGet: () => Hooks<STATE> | undefined) =>
      Self<SM, MM>,
    private _observable: OBSERVABLE,
    private _findStateBehavior: (state: STATE) => any
  ) {
    super(_initialValue, _dispatch, _findStateBehavior);
    this.asObservable = _observable;
  }
}