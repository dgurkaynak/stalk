import { opentracing, stalk } from 'stalk-opentracing';
import { StalkStudioReporter } from './reporter';

const LOCALSTORAGE_KEY = 'stalkSelfTracing';
const noopTracer = new opentracing.Tracer();
const stalkTracer = new stalk.Tracer();
const customReporter = new StalkStudioReporter();
stalkTracer.addReporter(customReporter);

// Init on run time
if (localStorage.getItem(LOCALSTORAGE_KEY)) {
  turnOn();
}

export function turnOn() {
  opentracing.initGlobalTracer(stalkTracer);
  localStorage.setItem(LOCALSTORAGE_KEY, 'true');
  console.log('Self-tracing is TURNED ON');
}

export function turnOff() {
  opentracing.initGlobalTracer(noopTracer);
  localStorage.removeItem(LOCALSTORAGE_KEY);
  console.log('Self-tracing is TURNED OFF');
}

// Expose to window object
(window as any).selfTracing = {
  noopTracer,
  stalkTracer,
  customReporter,
  turnOn,
  turnOff
};
