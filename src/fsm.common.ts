export namespace FSMCommon {
  export function noTransition(state: string, message: string) {
    return `No transition encoded for (${state}, ${message}), message ignored`;
  }
}