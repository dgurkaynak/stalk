/**
 * Just critical javascript allowed here for initial html/css rendering.
 * The real application js file (app) will be load async.
 */

async function main() {
  // Lazy-load app and init it
  const { App } = await import(/* webpackChunkName: "app" */ './app');
  const app = new App({
    element: document.getElementById('app') as HTMLDivElement
  });
  await app.init();
}

main().catch(err => console.error(err));
