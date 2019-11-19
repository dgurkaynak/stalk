/**
 * Just critical javascript allowed here for initial html/css rendering.
 * The real application js file (app) will be load async.
 */

async function main() {
  const { App } = await import(/* webpackChunkName: "app" */ './app');
  const app = new App();
  await app.init();
}

main().catch(err => console.error(err));
