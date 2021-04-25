import EventEmitter from 'events';
import { Machine, interpret, actions } from 'xstate';

const { send, cancel } = actions;

const DOUBLE_CLICK_WAIT_TIME = 0;
const PAN_DETECTION_DELTA_X = 3;
const PAN_DETECTION_DELTA_Y = 3;

export enum MouseHandlerEvent {
  CLICK = 'gh_click',
  DOUBLE_CLICK = 'gh_double_click',
  PAN_START = 'gh_pan_start',
  PAN_MOVE = 'gh_pan_move',
  PAN_END = 'gh_pan_end',
  WHEEL = 'gh_wheel',
  IDLE_MOVE = 'gh_idle_move',
  IDLE_LEAVE = 'gh_idle_leave',
}

interface MouseHandlerStateSchema {
  states: {
    idle: {};
    waitForInitialUp: {};
    waitForSecondDown: {};
    waitForSecondUp: {};
    pan: {};
  };
}

type MouseHandlerStateEvent =
  | { type: 'MOUSE_DOWN'; mouseEvent: MouseEvent }
  | { type: 'MOUSE_MOVE'; mouseEvent: MouseEvent }
  | { type: 'MOUSE_UP'; mouseEvent: MouseEvent }
  | { type: 'MOUSE_LEAVE'; mouseEvent: MouseEvent }
  | { type: 'DOUBLE_CLICK_TIMEOUT'; mouseEvent: MouseEvent };

interface MouseHandlerStateContext {
  firstDown: MouseEvent | null;
  secondDown: MouseEvent | null;
}

export default class MouseHandler extends EventEmitter {
  private machine = Machine<
    MouseHandlerStateContext,
    MouseHandlerStateSchema,
    MouseHandlerStateEvent
  >(
    {
      key: 'mouseHandlerStateMachine',
      initial: 'idle',
      context: { firstDown: null, secondDown: null },
      states: {
        idle: {
          entry: ['clearFirstDown', 'clearSecondDown'],
          on: {
            MOUSE_DOWN: {
              actions: ['saveEventAsFirstDown'],
              target: 'waitForInitialUp',
            },

            MOUSE_UP: {
              target: undefined,
            },

            MOUSE_MOVE: {
              actions: ['emitdIdleMove'],
              target: undefined,
            },

            MOUSE_LEAVE: {
              actions: ['emitdIdleLeave'],
              target: undefined,
            },
          },
        },

        waitForInitialUp: {
          on: {
            // Another mouse button is pressed,
            // Ignore the initial down event and save the current one as initial down and stay in the same state
            MOUSE_DOWN: [
              {
                actions: ['saveEventAsFirstDown'],
                target: undefined,
              },
            ],

            // A button is released
            MOUSE_UP: [
              // If another mouse button is released, ignore event
              {
                cond: {
                  type: 'isDifferentButton',
                  with: 'firstDown',
                },
                target: undefined, // noop
              },
              // We now know it's the same button
              // If it's already too late for double click, emit click event
              {
                cond: {
                  type: 'isTooLateForDoubleClick',
                  with: 'initialDown',
                },
                actions: ['emitClickForFirstDown'],
                target: 'idle',
              },
              // We have enough time to double click event
              {
                target: 'waitForSecondDown',
              },
            ],

            // Mouse is moving while a button is being pressed
            MOUSE_MOVE: [
              {
                cond: {
                  type: 'isNearby',
                  to: 'initialDown',
                },
                target: undefined,
              },
              // We now know user is panning
              {
                target: 'pan',
              },
            ],

            // Mouse is leaved, ignore the event
            MOUSE_LEAVE: {
              target: 'idle',
            },
          },
        },

        waitForSecondDown: {
          entry: 'setDoubleClickTimeout',
          on: {
            DOUBLE_CLICK_TIMEOUT: {
              actions: ['clearDoubleClickTimeout', 'emitClickForFirstDown'],
              target: 'idle',
            },

            MOUSE_DOWN: [
              {
                cond: {
                  type: 'isDifferentButton',
                  with: 'firstDown',
                },
                actions: [
                  'clearDoubleClickTimeout',
                  'emitClickForFirstDown',
                  'saveEventAsFirstDown',
                ],
                target: 'waitForInitialUp',
              },
              // We now know it's the same button
              {
                actions: ['saveEventAsSecondDown'],
                target: 'waitForSecondUp',
              },
            ],

            MOUSE_MOVE: {
              target: undefined,
            },

            MOUSE_UP: {
              target: undefined,
            },

            MOUSE_LEAVE: {
              actions: ['clearDoubleClickTimeout', 'emitClickForFirstDown'],
              target: 'idle',
            },
          },
        },

        waitForSecondUp: {
          on: {
            DOUBLE_CLICK_TIMEOUT: {
              actions: [
                'clearDoubleClickTimeout',
                'emitClickForFirstDown',
                'saveEventAsFirstDown',
              ],
              target: 'waitForInitialUp',
            },

            // Another mouse button is pressed,
            // Ignore the initial down event and save the current one as initial down and stay in the same state
            MOUSE_DOWN: [
              {
                actions: [
                  'clearDoubleClickTimeout',
                  'emitClickForFirstDown',
                  'saveEventAsFirstDown',
                ],
                target: 'waitForInitialUp',
              },
            ],

            // A button is released
            MOUSE_UP: [
              // If another mouse button is released, ignore event
              {
                cond: {
                  type: 'isDifferentButton',
                  with: 'secondDown',
                },
                target: undefined, // noop
              },
              // We now know it's the same button
              // If it's already too late for double click, emit click event
              // This will not gonna happen because there is a timeout up there
              {
                cond: {
                  type: 'isTooLateForDoubleClick',
                  with: 'secondDown',
                },
                actions: [
                  'clearDoubleClickTimeout',
                  'emitClickForFirstDown',
                  'emitClickForSecondDown',
                ],
                target: 'idle',
              },
              // Double clicked
              {
                actions: ['clearDoubleClickTimeout', 'emitDoubleClick'],
                target: 'idle',
              },
            ],

            // Mouse is moving while a button is being pressed
            MOUSE_MOVE: [
              {
                cond: {
                  type: 'isNearby',
                  to: 'initialDown',
                },
                target: undefined,
              },
              // We now know user is panning
              {
                actions: ['clearDoubleClickTimeout'],
                target: 'pan',
              },
            ],

            // Mouse is leaved, ignore the event
            MOUSE_LEAVE: {
              actions: ['clearDoubleClickTimeout', 'emitClickForFirstDown'],
              target: 'idle',
            },
          },
        },

        pan: {
          entry: ['emitPanStart'],
          exit: ['emitPanEnd'],
          on: {
            MOUSE_DOWN: {
              actions: ['saveEventAsFirstDown'],
              target: 'waitForInitialUp',
            },

            MOUSE_UP: [
              {
                cond: {
                  type: 'isDifferentButton',
                  with: 'firstDown',
                },
                target: undefined,
              },
              // We now know pressed button is released
              { target: 'idle' },
            ],

            MOUSE_MOVE: {
              actions: ['emitPanMove'],
              target: undefined,
            },

            MOUSE_LEAVE: {
              target: 'idle',
            },
          },
        },
      },
    },
    {
      actions: {
        clearFirstDown: (context, event) => {
          context.firstDown = null;
        },
        clearSecondDown: (context, event) => {
          context.secondDown = null;
        },
        saveEventAsFirstDown: (context, event) => {
          context.firstDown = event.mouseEvent;
        },
        saveEventAsSecondDown: (context, event) => {
          context.secondDown = event.mouseEvent;
        },
        emitdIdleMove: (context, event) => {
          this.emit(MouseHandlerEvent.IDLE_MOVE, event.mouseEvent);
        },
        emitdIdleLeave: (context, event) => {
          this.emit(MouseHandlerEvent.IDLE_LEAVE, event.mouseEvent);
        },
        emitClickForFirstDown: (context, event) => {
          this.emit(MouseHandlerEvent.CLICK, context.firstDown);
        },
        emitClickForSecondDown: (context, event) => {
          this.emit(MouseHandlerEvent.CLICK, context.secondDown);
        },
        emitDoubleClick: (context, event) => {
          this.emit(MouseHandlerEvent.DOUBLE_CLICK, context.firstDown);
        },
        setDoubleClickTimeout: send('DOUBLE_CLICK_TIMEOUT', {
          delay: DOUBLE_CLICK_WAIT_TIME,
          id: 'doubleClickTimeout',
        }),
        clearDoubleClickTimeout: cancel('DOUBLE_CLICK_TIMEOUT'),
        emitPanStart: (context, event) => {
          this.emit(MouseHandlerEvent.PAN_START, event.mouseEvent);
        },
        emitPanEnd: (context, event) => {
          this.emit(MouseHandlerEvent.PAN_END, event.mouseEvent);
        },
        emitPanMove: (context, event) => {
          this.emit(MouseHandlerEvent.PAN_MOVE, event.mouseEvent);
        },
      },

      guards: {
        isDifferentButton: (context, event, { cond }) => {
          const refMouseEvent: MouseEvent | null = (context as any)[
            (cond as any).with
          ];
          if (!refMouseEvent) return false;
          return refMouseEvent.button !== event.mouseEvent.button;
        },
        isTooLateForDoubleClick: (context, event, { cond }) => {
          const refMouseEvent: MouseEvent | null = (context as any)[
            (cond as any).with
          ];
          if (!refMouseEvent) return false;
          return (
            event.mouseEvent.timeStamp - refMouseEvent.timeStamp >=
            DOUBLE_CLICK_WAIT_TIME
          );
        },
        isNearby: (context, event, { cond }) => {
          const refMouseEvent: MouseEvent | null = (context as any)[
            (cond as any).to
          ];
          if (!refMouseEvent) return false;
          const deltaX = Math.abs(
            event.mouseEvent.offsetX - refMouseEvent.offsetX
          );
          const deltaY = Math.abs(
            event.mouseEvent.offsetY - refMouseEvent.offsetY
          );
          return (
            deltaX < PAN_DETECTION_DELTA_X && deltaY < PAN_DETECTION_DELTA_Y
          );
        },
      },
    }
  );
  private service = interpret(this.machine);
  private binded = {
    onMouseDown: this.onMouseDown.bind(this),
    onMouseMove: this.onMouseMove.bind(this),
    onMouseUp: this.onMouseUp.bind(this),
    onMouseLeave: this.onMouseLeave.bind(this),
    onWheel: this.onWheel.bind(this),
    onContextMenu: this.onContextMenu.bind(this),
  };

  constructor(private element: SVGSVGElement) {
    super();

    // this.service.onTransition((state) => {
    //   if (state.changed) {
    //     console.log('state change', state.value)
    //   }
    // });
  }

  init() {
    this.element.addEventListener('mousedown', this.binded.onMouseDown, false);
    this.element.addEventListener('mousemove', this.binded.onMouseMove, false);
    this.element.addEventListener('mouseup', this.binded.onMouseUp, false);
    this.element.addEventListener(
      'mouseleave',
      this.binded.onMouseLeave,
      false
    );
    this.element.addEventListener('wheel', this.binded.onWheel, false);
    this.element.addEventListener(
      'contextmenu',
      this.binded.onContextMenu,
      false
    );

    this.service.start();
  }

  dispose() {
    this.element.removeEventListener(
      'mousedown',
      this.binded.onMouseDown,
      false
    );
    this.element.removeEventListener(
      'mousemove',
      this.binded.onMouseMove,
      false
    );
    this.element.removeEventListener('mouseup', this.binded.onMouseUp, false);
    this.element.removeEventListener(
      'mouseleave',
      this.binded.onMouseLeave,
      false
    );
    this.element.removeEventListener('wheel', this.binded.onWheel, false);
    this.element.removeEventListener(
      'contextmenu',
      this.binded.onContextMenu,
      false
    );

    this.removeAllListeners();

    this.service.stop();
  }

  onMouseDown(e: MouseEvent) {
    this.service.send({ type: 'MOUSE_DOWN', mouseEvent: e });
  }

  onMouseMove(e: MouseEvent) {
    this.service.send({ type: 'MOUSE_MOVE', mouseEvent: e });
  }

  onMouseUp(e: MouseEvent) {
    this.service.send({ type: 'MOUSE_UP', mouseEvent: e });
  }

  onMouseLeave(e: MouseEvent) {
    this.service.send({ type: 'MOUSE_LEAVE', mouseEvent: e });
  }

  onWheel(e: WheelEvent) {
    this.emit(MouseHandlerEvent.WHEEL, e);
  }

  onContextMenu(e: MouseEvent) {
    e.preventDefault();
  }
}
