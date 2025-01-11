const olay = ((window as any).olay = {
  epoch: Date.now(),
  bufferedEvents: [] as {
    localTime: number;
    type: string;
    metadata: { [key: string]: unknown };
  }[],
  addEvent: (type: string, metadata: { [key: string]: unknown } = {}) => {
    const localTime = Date.now() - olay.epoch;
    olay.bufferedEvents.push({ localTime, type, metadata });
  },
});

// If you uncomment this, `olay`s type definitions will be enabled in the project
interface Window {
  olay: typeof olay;
}

(() => {
  const scriptEl = document.createElement('script');
  scriptEl.type = 'text/javascript';
  scriptEl.async = true;
  scriptEl.src = 'https://deniz.co/olay/client-web.js?project=stalk';

  const s = document.getElementsByTagName('script')[0]!;
  s.parentNode!.insertBefore(scriptEl, s);
})();
